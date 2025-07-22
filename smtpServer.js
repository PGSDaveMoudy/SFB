// Custom SMTP Server for Salesforce Form Builder
// Provides secure, self-hosted email delivery for OTP and form notifications

const { SMTPServer } = require('smtp-server');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { simpleParser } = require('mailparser');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

class CustomSMTPServer {
    constructor(options = {}) {
        this.config = {
            port: options.port || 2525,
            secure: options.secure || false,
            allowInsecureAuth: options.allowInsecureAuth || true,
            authOptional: options.authOptional || false,
            banner: options.banner || 'Portwood Global Solutions SMTP Server',
            hostname: options.hostname || 'localhost',
            
            // Storage paths
            mailDir: path.join(__dirname, 'mail-storage'),
            queueDir: path.join(__dirname, 'mail-queue'),
            usersFile: path.join(__dirname, 'smtp-users.json'),
            logFile: path.join(__dirname, 'smtp-server.log'),
            
            // Delivery settings
            maxRetries: 3,
            retryDelay: 5000, // 5 seconds
            cleanupInterval: '0 0 * * *', // Daily at midnight
            maxStorageAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            
            // Security settings
            maxConnections: 10,
            maxFileSize: 10 * 1024 * 1024, // 10MB
            rateLimits: {
                connections: 5, // per minute
                emails: 10 // per minute per user
            }
        };
        
        this.server = null;
        this.isRunning = false;
        this.connectionCount = 0;
        this.emailQueue = new Map();
        this.userConnections = new Map();
        this.users = new Map();
        
        // Initialize asynchronously
        this.initPromise = this.init();
    }
    
    async init() {
        try {
            // Create required directories
            await this.ensureDirectories();
            
            // Load user accounts
            await this.loadUsers();
            
            // Setup SMTP server
            this.setupSMTPServer();
            
            // Setup cleanup cron job
            this.setupCleanup();
            
            console.log('Custom SMTP Server initialized successfully');
        } catch (error) {
            console.error('Failed to initialize SMTP Server:', error);
        }
    }
    
    async ensureDirectories() {
        const dirs = [
            this.config.mailDir,
            this.config.queueDir,
            path.join(this.config.mailDir, 'sent'),
            path.join(this.config.mailDir, 'failed'),
            path.join(this.config.mailDir, 'incoming')
        ];
        
        for (const dir of dirs) {
            await fs.ensureDir(dir);
        }
        
        console.log('SMTP storage directories created');
    }
    
    async loadUsers() {
        try {
            if (await fs.pathExists(this.config.usersFile)) {
                const userData = await fs.readJson(this.config.usersFile);
                this.users = new Map(Object.entries(userData));
                console.log(`Loaded ${this.users.size} SMTP users`);
            } else {
                // Create default admin user
                await this.createUser('admin', 'smtp-admin-2025', true);
                console.log('Created default SMTP admin user');
            }
        } catch (error) {
            console.error('Failed to load SMTP users:', error);
        }
    }
    
    async saveUsers() {
        try {
            const userData = Object.fromEntries(this.users);
            await fs.writeJson(this.config.usersFile, userData, { spaces: 2 });
        } catch (error) {
            console.error('Failed to save SMTP users:', error);
        }
    }
    
    async createUser(username, password, isAdmin = false) {
        const hashedPassword = await bcrypt.hash(password, 12);
        const user = {
            username,
            password: hashedPassword,
            isAdmin,
            created: new Date().toISOString(),
            lastLogin: null,
            emailsSent: 0,
            active: true
        };
        
        this.users.set(username, user);
        await this.saveUsers();
        
        console.log(`SMTP user created: ${username} (admin: ${isAdmin})`);
        return user;
    }
    
    async authenticateUser(username, password) {
        const user = this.users.get(username);
        if (!user || !user.active) {
            return false;
        }
        
        const isValid = await bcrypt.compare(password, user.password);
        if (isValid) {
            user.lastLogin = new Date().toISOString();
            await this.saveUsers();
        }
        
        return isValid;
    }
    
    setupSMTPServer() {
        this.server = new SMTPServer({
            secure: this.config.secure,
            banner: this.config.banner,
            
            // Authentication
            onAuth: async (auth, session, callback) => {
                try {
                    const isValid = await this.authenticateUser(auth.username, auth.password);
                    if (isValid) {
                        session.user = this.users.get(auth.username);
                        session.username = auth.username;
                        this.log(`Authentication successful for user: ${auth.username}`);
                        callback(null, { user: auth.username });
                    } else {
                        this.log(`Authentication failed for user: ${auth.username}`);
                        callback(new Error('Invalid credentials'));
                    }
                } catch (error) {
                    this.log(`Authentication error: ${error.message}`);
                    callback(error);
                }
            },
            
            // Connection handling
            onConnect: (session, callback) => {
                this.connectionCount++;
                this.log(`New connection from ${session.remoteAddress} (total: ${this.connectionCount})`);
                
                if (this.connectionCount > this.config.maxConnections) {
                    return callback(new Error('Too many connections'));
                }
                
                callback();
            },
            
            onClose: (session) => {
                this.connectionCount--;
                this.log(`Connection closed from ${session.remoteAddress} (remaining: ${this.connectionCount})`);
            },
            
            // Mail handling
            onMailFrom: (address, session, callback) => {
                this.log(`Mail from: ${address.address} (user: ${session.user?.username || 'anonymous'})`);
                callback();
            },
            
            onRcptTo: (address, session, callback) => {
                this.log(`Mail to: ${address.address}`);
                callback();
            },
            
            onData: async (stream, session, callback) => {
                try {
                    await this.handleIncomingEmail(stream, session);
                    callback();
                } catch (error) {
                    this.log(`Email processing error: ${error.message}`);
                    callback(error);
                }
            }
        });
        
        // Error handling
        this.server.on('error', (error) => {
            this.log(`SMTP Server error: ${error.message}`, 'error');
        });
    }
    
    async handleIncomingEmail(stream, session) {
        return new Promise(async (resolve, reject) => {
            try {
                // Parse the email
                const parsed = await simpleParser(stream, {
                    streamAttachments: true,
                    maxFileSize: this.config.maxFileSize
                });
                
                // Generate unique email ID
                const emailId = crypto.randomBytes(16).toString('hex');
                const timestamp = new Date().toISOString();
                
                // Email metadata
                const emailData = {
                    id: emailId,
                    timestamp,
                    session: {
                        user: session.user?.username || 'anonymous',
                        remoteAddress: session.remoteAddress,
                        hostName: session.hostNameAppearsAs
                    },
                    from: parsed.from?.value || [],
                    to: parsed.to?.value || [],
                    cc: parsed.cc?.value || [],
                    bcc: parsed.bcc?.value || [],
                    subject: parsed.subject || '',
                    messageId: parsed.messageId,
                    date: parsed.date,
                    size: stream.length || 0,
                    attachments: (parsed.attachments || []).map(att => ({
                        filename: att.filename,
                        contentType: att.contentType,
                        size: att.size
                    }))
                };
                
                // Save email content
                const emailDir = path.join(this.config.mailDir, 'incoming', emailId);
                await fs.ensureDir(emailDir);
                
                // Save metadata
                await fs.writeJson(path.join(emailDir, 'metadata.json'), emailData, { spaces: 2 });
                
                // Save email content
                const emailContent = {
                    headers: parsed.headers,
                    text: parsed.text,
                    html: parsed.html,
                    textAsHtml: parsed.textAsHtml
                };
                await fs.writeJson(path.join(emailDir, 'content.json'), emailContent, { spaces: 2 });
                
                // Save attachments
                if (parsed.attachments && parsed.attachments.length > 0) {
                    const attachmentsDir = path.join(emailDir, 'attachments');
                    await fs.ensureDir(attachmentsDir);
                    
                    for (const attachment of parsed.attachments) {
                        if (attachment.content) {
                            await fs.writeFile(
                                path.join(attachmentsDir, attachment.filename),
                                attachment.content
                            );
                        }
                    }
                }
                
                // Queue for delivery if this is outgoing email
                if (this.shouldQueueForDelivery(emailData)) {
                    await this.queueEmailForDelivery(emailData, emailContent);
                }
                
                // Update user stats
                if (session.user && typeof session.user === 'object') {
                    session.user.emailsSent++;
                    await this.saveUsers();
                } else if (session.user && typeof session.user === 'string') {
                    // Handle case where session.user is just the username string
                    const user = this.users.get(session.user);
                    if (user) {
                        user.emailsSent++;
                        await this.saveUsers();
                    }
                }
                
                this.log(`Email processed successfully: ${emailId} from ${emailData.from[0]?.address || 'unknown'} to ${emailData.to.map(t => t.address).join(', ')}`);
                
                resolve();
                
            } catch (error) {
                this.log(`Error processing email: ${error.message}`, 'error');
                reject(error);
            }
        });
    }
    
    shouldQueueForDelivery(emailData) {
        // Check if this is an outgoing email that needs external delivery
        const localDomains = [this.config.hostname, 'localhost'];
        const hasExternalRecipients = emailData.to.some(recipient => {
            const domain = recipient.address.split('@')[1];
            return !localDomains.includes(domain);
        });
        
        return hasExternalRecipients;
    }
    
    async queueEmailForDelivery(emailData, emailContent) {
        const queueId = crypto.randomBytes(16).toString('hex');
        const queueItem = {
            id: queueId,
            emailId: emailData.id,
            timestamp: new Date().toISOString(),
            retries: 0,
            status: 'queued',
            recipients: emailData.to.filter(recipient => {
                const domain = recipient.address.split('@')[1];
                return !['localhost', this.config.hostname].includes(domain);
            }),
            emailData,
            emailContent
        };
        
        // Save to queue
        await fs.writeJson(
            path.join(this.config.queueDir, `${queueId}.json`),
            queueItem,
            { spaces: 2 }
        );
        
        this.emailQueue.set(queueId, queueItem);
        
        // Process immediately
        this.processEmailQueue();
        
        this.log(`Email queued for delivery: ${queueId}`);
    }
    
    async processEmailQueue() {
        if (this.emailQueue.size === 0) return;
        
        for (const [queueId, queueItem] of this.emailQueue.entries()) {
            if (queueItem.status === 'processing') continue;
            
            try {
                queueItem.status = 'processing';
                await this.deliverEmail(queueItem);
                
                // Mark as delivered
                queueItem.status = 'delivered';
                queueItem.deliveredAt = new Date().toISOString();
                
                // Move to sent folder
                await this.moveEmailToSent(queueItem);
                
                // Remove from queue
                this.emailQueue.delete(queueId);
                await fs.remove(path.join(this.config.queueDir, `${queueId}.json`));
                
                this.log(`Email delivered successfully: ${queueId}`);
                
            } catch (error) {
                queueItem.retries++;
                queueItem.lastError = error.message;
                queueItem.status = 'failed';
                
                if (queueItem.retries >= this.config.maxRetries) {
                    // Move to failed folder
                    await this.moveEmailToFailed(queueItem);
                    this.emailQueue.delete(queueId);
                    await fs.remove(path.join(this.config.queueDir, `${queueId}.json`));
                    
                    this.log(`Email delivery failed permanently: ${queueId} - ${error.message}`, 'error');
                } else {
                    queueItem.status = 'queued';
                    queueItem.nextRetry = new Date(Date.now() + this.config.retryDelay * queueItem.retries).toISOString();
                    
                    // Save updated queue item
                    await fs.writeJson(
                        path.join(this.config.queueDir, `${queueId}.json`),
                        queueItem,
                        { spaces: 2 }
                    );
                    
                    this.log(`Email delivery failed, will retry: ${queueId} (attempt ${queueItem.retries}/${this.config.maxRetries})`);
                }
            }
        }
    }
    
    async deliverEmail(queueItem) {
        // Real email delivery implementation
        const { emailData, emailContent } = queueItem;
        
        try {
            // Create nodemailer transporter for external delivery
            const externalTransporter = nodemailer.createTransporter({
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: process.env.EXTERNAL_EMAIL_USER || 'your-email@gmail.com',
                    pass: process.env.EXTERNAL_EMAIL_PASS || 'your-app-password'
                },
                tls: {
                    rejectUnauthorized: false
                }
            });

            // Prepare email for external delivery
            const mailOptions = {
                from: `"${emailData.from[0]?.name || 'Portwood Global Solutions'}" <${process.env.EXTERNAL_EMAIL_USER || emailData.from[0]?.address}>`,
                to: queueItem.recipients.map(r => r.address).join(', '),
                subject: emailData.subject,
                html: emailContent.html,
                text: emailContent.text,
                replyTo: 'support@portwoodglobalsolutions.com'
            };

            // Send email through external SMTP
            const info = await externalTransporter.sendMail(mailOptions);
            
            this.log(`✅ Email delivered successfully via external SMTP: ${queueItem.emailId}`);
            this.log(`   To: ${queueItem.recipients.map(r => r.address).join(', ')}`);
            this.log(`   Message ID: ${info.messageId}`);
            
            return Promise.resolve();
            
        } catch (error) {
            this.log(`❌ Failed to deliver email ${queueItem.emailId}: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async moveEmailToSent(queueItem) {
        const sentDir = path.join(this.config.mailDir, 'sent', queueItem.emailId);
        const incomingDir = path.join(this.config.mailDir, 'incoming', queueItem.emailId);
        
        if (await fs.pathExists(incomingDir)) {
            await fs.move(incomingDir, sentDir);
        }
        
        // Save delivery info
        await fs.writeJson(path.join(sentDir, 'delivery.json'), {
            queueId: queueItem.id,
            deliveredAt: queueItem.deliveredAt,
            recipients: queueItem.recipients,
            retries: queueItem.retries
        }, { spaces: 2 });
    }
    
    async moveEmailToFailed(queueItem) {
        const failedDir = path.join(this.config.mailDir, 'failed', queueItem.emailId);
        const incomingDir = path.join(this.config.mailDir, 'incoming', queueItem.emailId);
        
        if (await fs.pathExists(incomingDir)) {
            await fs.move(incomingDir, failedDir);
        }
        
        // Save failure info
        await fs.writeJson(path.join(failedDir, 'failure.json'), {
            queueId: queueItem.id,
            failedAt: new Date().toISOString(),
            recipients: queueItem.recipients,
            retries: queueItem.retries,
            lastError: queueItem.lastError
        }, { spaces: 2 });
    }
    
    setupCleanup() {
        // Daily cleanup of old emails
        cron.schedule(this.config.cleanupInterval, async () => {
            try {
                await this.cleanupOldEmails();
            } catch (error) {
                this.log(`Cleanup error: ${error.message}`, 'error');
            }
        });
        
        console.log('Email cleanup scheduled for daily execution');
    }
    
    async cleanupOldEmails() {
        const now = Date.now();
        const cutoff = now - this.config.maxStorageAge;
        
        const folders = ['sent', 'failed', 'incoming'];
        let cleanedCount = 0;
        
        for (const folder of folders) {
            const folderPath = path.join(this.config.mailDir, folder);
            
            if (await fs.pathExists(folderPath)) {
                const items = await fs.readdir(folderPath);
                
                for (const item of items) {
                    const itemPath = path.join(folderPath, item);
                    const stats = await fs.stat(itemPath);
                    
                    if (stats.mtime.getTime() < cutoff) {
                        await fs.remove(itemPath);
                        cleanedCount++;
                    }
                }
            }
        }
        
        this.log(`Cleanup completed: removed ${cleanedCount} old email folders`);
    }
    
    async start() {
        // Wait for initialization to complete
        await this.initPromise;
        
        if (!this.server) {
            throw new Error('SMTP server not initialized properly');
        }
        
        return new Promise((resolve, reject) => {
            this.server.listen(this.config.port, this.config.hostname, (error) => {
                if (error) {
                    this.log(`Failed to start SMTP server: ${error.message}`, 'error');
                    reject(error);
                } else {
                    this.isRunning = true;
                    this.log(`SMTP Server started on ${this.config.hostname}:${this.config.port}`);
                    resolve();
                }
            });
        });
    }
    
    async stop() {
        return new Promise((resolve) => {
            if (this.server && this.isRunning) {
                this.server.close(() => {
                    this.isRunning = false;
                    this.log('SMTP Server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
    
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        
        console.log(logEntry);
        
        // Also write to log file
        fs.appendFile(this.config.logFile, logEntry + '\n').catch(err => {
            console.error('Failed to write to log file:', err);
        });
    }
    
    // Management API methods
    async getServerStats() {
        const stats = {
            isRunning: this.isRunning,
            port: this.config.port,
            hostname: this.config.hostname,
            connectionCount: this.connectionCount,
            queueSize: this.emailQueue.size,
            userCount: this.users.size,
            uptime: process.uptime(),
            
            // Storage stats
            emailCounts: {
                incoming: 0,
                sent: 0,
                failed: 0,
                queued: this.emailQueue.size
            }
        };
        
        // Count emails in storage
        const folders = ['incoming', 'sent', 'failed'];
        for (const folder of folders) {
            const folderPath = path.join(this.config.mailDir, folder);
            if (await fs.pathExists(folderPath)) {
                const items = await fs.readdir(folderPath);
                stats.emailCounts[folder] = items.length;
            }
        }
        
        return stats;
    }
    
    async getRecentEmails(limit = 50) {
        const emails = [];
        const folders = ['incoming', 'sent', 'failed'];
        
        for (const folder of folders) {
            const folderPath = path.join(this.config.mailDir, folder);
            
            if (await fs.pathExists(folderPath)) {
                const items = await fs.readdir(folderPath);
                
                for (const item of items) {
                    const metadataPath = path.join(folderPath, item, 'metadata.json');
                    
                    if (await fs.pathExists(metadataPath)) {
                        const metadata = await fs.readJson(metadataPath);
                        metadata.folder = folder;
                        emails.push(metadata);
                    }
                }
            }
        }
        
        // Sort by timestamp (newest first) and limit
        return emails
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
            .slice(0, limit);
    }
    
    async getUserList() {
        return Array.from(this.users.entries()).map(([username, user]) => ({
            username,
            isAdmin: user.isAdmin,
            created: user.created,
            lastLogin: user.lastLogin,
            emailsSent: user.emailsSent,
            active: user.active
        }));
    }
}

module.exports = CustomSMTPServer;