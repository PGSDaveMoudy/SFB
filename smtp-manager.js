#!/usr/bin/env node

// SMTP Server Manager
// Command-line interface for managing the custom SMTP server

const CustomSMTPServer = require('./smtpServer');
const readline = require('readline');
const fs = require('fs-extra');
const path = require('path');

class SMTPManager {
    constructor() {
        this.server = null;
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }
    
    async start() {
        console.log('🚀 Portwood Global Solutions SMTP Server Manager');
        console.log('================================================\n');
        
        // Check if this is first run
        const configFile = path.join(__dirname, 'smtp-config.json');
        let config = {};
        
        if (await fs.pathExists(configFile)) {
            config = await fs.readJson(configFile);
            console.log('✅ Loaded existing SMTP configuration\n');
        } else {
            console.log('🔧 First time setup - configuring SMTP server...\n');
            config = await this.setupInitialConfig();
            await fs.writeJson(configFile, config, { spaces: 2 });
        }
        
        // Initialize server
        this.server = new CustomSMTPServer(config);
        
        // Show main menu
        await this.showMainMenu();
    }
    
    async setupInitialConfig() {
        console.log('📧 SMTP Server Configuration Setup');
        console.log('----------------------------------\n');
        
        const config = {};
        
        // Server settings
        config.port = await this.prompt('SMTP Port (default: 2525): ', '2525');
        config.hostname = await this.prompt('Hostname (default: localhost): ', 'localhost');
        config.secure = (await this.prompt('Use TLS encryption? (y/N): ', 'n')).toLowerCase() === 'y';
        
        // Security settings
        config.allowInsecureAuth = (await this.prompt('Allow insecure authentication? (Y/n): ', 'y')).toLowerCase() === 'y';
        config.authOptional = (await this.prompt('Make authentication optional? (y/N): ', 'n')).toLowerCase() === 'y';
        
        // Banner
        config.banner = await this.prompt('Server banner (default: Portwood Global Solutions SMTP): ', 'Portwood Global Solutions SMTP');
        
        console.log('\n✅ Configuration saved!\n');
        
        return config;
    }
    
    async showMainMenu() {
        while (true) {
            console.log('\n📋 SMTP Server Management Menu');
            console.log('===============================');
            console.log('1. Start SMTP Server');
            console.log('2. Stop SMTP Server');
            console.log('3. Server Status');
            console.log('4. View Recent Emails');
            console.log('5. Manage Users');
            console.log('6. View Server Logs');
            console.log('7. Configuration');
            console.log('8. Test Email Sending');
            console.log('9. Exit');
            
            const choice = await this.prompt('\nSelect option (1-9): ');
            
            try {
                switch (choice) {
                    case '1':
                        await this.startServer();
                        break;
                    case '2':
                        await this.stopServer();
                        break;
                    case '3':
                        await this.showServerStatus();
                        break;
                    case '4':
                        await this.showRecentEmails();
                        break;
                    case '5':
                        await this.manageUsers();
                        break;
                    case '6':
                        await this.viewLogs();
                        break;
                    case '7':
                        await this.configurationMenu();
                        break;
                    case '8':
                        await this.testEmailSending();
                        break;
                    case '9':
                        await this.exit();
                        return;
                    default:
                        console.log('❌ Invalid option. Please try again.');
                }
            } catch (error) {
                console.error('❌ Error:', error.message);
            }
        }
    }
    
    async startServer() {
        if (this.server.isRunning) {
            console.log('⚠️  SMTP Server is already running');
            return;
        }
        
        console.log('🚀 Starting SMTP Server...');
        
        try {
            await this.server.start();
            console.log('✅ SMTP Server started successfully');
            console.log(`📧 Server listening on ${this.server.config.hostname}:${this.server.config.port}`);
        } catch (error) {
            console.error('❌ Failed to start server:', error.message);
        }
    }
    
    async stopServer() {
        if (!this.server.isRunning) {
            console.log('⚠️  SMTP Server is not running');
            return;
        }
        
        console.log('🛑 Stopping SMTP Server...');
        
        try {
            await this.server.stop();
            console.log('✅ SMTP Server stopped successfully');
        } catch (error) {
            console.error('❌ Failed to stop server:', error.message);
        }
    }
    
    async showServerStatus() {
        console.log('\n📊 Server Status');
        console.log('================');
        
        const stats = await this.server.getServerStats();
        
        console.log(`Status: ${stats.isRunning ? '🟢 Running' : '🔴 Stopped'}`);
        console.log(`Address: ${stats.hostname}:${stats.port}`);
        console.log(`Active Connections: ${stats.connectionCount}`);
        console.log(`Queue Size: ${stats.queueSize}`);
        console.log(`Registered Users: ${stats.userCount}`);
        console.log(`Uptime: ${Math.round(stats.uptime)} seconds`);
        
        console.log('\n📧 Email Counts:');
        console.log(`  Incoming: ${stats.emailCounts.incoming}`);
        console.log(`  Sent: ${stats.emailCounts.sent}`);
        console.log(`  Failed: ${stats.emailCounts.failed}`);
        console.log(`  Queued: ${stats.emailCounts.queued}`);
    }
    
    async showRecentEmails() {
        console.log('\n📬 Recent Emails');
        console.log('================');
        
        const emails = await this.server.getRecentEmails(20);
        
        if (emails.length === 0) {
            console.log('📭 No emails found');
            return;
        }
        
        emails.forEach((email, index) => {
            const fromAddr = email.from?.[0]?.address || 'Unknown';
            const toAddr = email.to?.map(t => t.address).join(', ') || 'Unknown';
            const timestamp = new Date(email.timestamp).toLocaleString();
            const status = email.folder === 'sent' ? '✅' : email.folder === 'failed' ? '❌' : '📥';
            
            console.log(`${index + 1}. ${status} [${timestamp}]`);
            console.log(`   From: ${fromAddr}`);
            console.log(`   To: ${toAddr}`);
            console.log(`   Subject: ${email.subject || '(no subject)'}`);
            console.log(`   Status: ${email.folder}`);
            console.log('');
        });
    }
    
    async manageUsers() {
        while (true) {
            console.log('\n👥 User Management');
            console.log('==================');
            console.log('1. List Users');
            console.log('2. Create User');
            console.log('3. Reset User Password');
            console.log('4. Deactivate User');
            console.log('5. Back to Main Menu');
            
            const choice = await this.prompt('\nSelect option (1-5): ');
            
            switch (choice) {
                case '1':
                    await this.listUsers();
                    break;
                case '2':
                    await this.createUser();
                    break;
                case '3':
                    await this.resetUserPassword();
                    break;
                case '4':
                    await this.deactivateUser();
                    break;
                case '5':
                    return;
                default:
                    console.log('❌ Invalid option');
            }
        }
    }
    
    async listUsers() {
        console.log('\n👤 Registered Users');
        console.log('===================');
        
        const users = await this.server.getUserList();
        
        if (users.length === 0) {
            console.log('👤 No users found');
            return;
        }
        
        users.forEach((user, index) => {
            const status = user.active ? '🟢' : '🔴';
            const admin = user.isAdmin ? '👑' : '👤';
            const lastLogin = user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never';
            
            console.log(`${index + 1}. ${status} ${admin} ${user.username}`);
            console.log(`   Created: ${new Date(user.created).toLocaleString()}`);
            console.log(`   Last Login: ${lastLogin}`);
            console.log(`   Emails Sent: ${user.emailsSent}`);
            console.log('');
        });
    }
    
    async createUser() {
        console.log('\n➕ Create New User');
        console.log('==================');
        
        const username = await this.prompt('Username: ');
        const password = await this.prompt('Password: ');
        const isAdmin = (await this.prompt('Admin privileges? (y/N): ', 'n')).toLowerCase() === 'y';
        
        try {
            await this.server.createUser(username, password, isAdmin);
            console.log(`✅ User '${username}' created successfully`);
        } catch (error) {
            console.error('❌ Failed to create user:', error.message);
        }
    }
    
    async resetUserPassword() {
        console.log('\n🔒 Reset User Password');
        console.log('======================');
        
        const username = await this.prompt('Username: ');
        const newPassword = await this.prompt('New Password: ');
        
        const user = this.server.users.get(username);
        if (!user) {
            console.log('❌ User not found');
            return;
        }
        
        try {
            const bcrypt = require('bcryptjs');
            user.password = await bcrypt.hash(newPassword, 12);
            await this.server.saveUsers();
            console.log(`✅ Password reset for user '${username}'`);
        } catch (error) {
            console.error('❌ Failed to reset password:', error.message);
        }
    }
    
    async deactivateUser() {
        console.log('\n🚫 Deactivate User');
        console.log('==================');
        
        const username = await this.prompt('Username: ');
        
        const user = this.server.users.get(username);
        if (!user) {
            console.log('❌ User not found');
            return;
        }
        
        user.active = false;
        await this.server.saveUsers();
        console.log(`✅ User '${username}' deactivated`);
    }
    
    async viewLogs() {
        console.log('\n📄 Server Logs (last 50 lines)');
        console.log('================================');
        
        const logFile = this.server.config.logFile;
        
        if (await fs.pathExists(logFile)) {
            const logContent = await fs.readFile(logFile, 'utf8');
            const lines = logContent.trim().split('\n');
            const recentLines = lines.slice(-50);
            
            recentLines.forEach(line => console.log(line));
        } else {
            console.log('📭 No log file found');
        }
        
        await this.prompt('\nPress Enter to continue...');
    }
    
    async configurationMenu() {
        console.log('\n⚙️  Server Configuration');
        console.log('========================');
        console.log('Current configuration:');
        console.log(`Port: ${this.server.config.port}`);
        console.log(`Hostname: ${this.server.config.hostname}`);
        console.log(`Secure: ${this.server.config.secure}`);
        console.log(`Banner: ${this.server.config.banner}`);
        
        await this.prompt('\nPress Enter to continue...');
    }
    
    async testEmailSending() {
        console.log('\n📧 Test Email Sending');
        console.log('=====================');
        
        if (!this.server.isRunning) {
            console.log('❌ SMTP Server must be running to test email sending');
            return;
        }
        
        console.log('This will test sending an email through your SMTP server');
        console.log('Make sure your main application is configured to use:');
        console.log(`  HOST: ${this.server.config.hostname}`);
        console.log(`  PORT: ${this.server.config.port}`);
        console.log(`  USER: admin (or your created user)`);
        console.log(`  PASS: smtp-admin-2025 (or your user password)`);
        
        const testEmail = await this.prompt('Test email address: ');
        
        // Create a test with nodemailer
        const nodemailer = require('nodemailer');
        
        const transporter = nodemailer.createTransport({
            host: this.server.config.hostname,
            port: this.server.config.port,
            secure: this.server.config.secure,
            auth: {
                user: 'admin',
                pass: 'smtp-admin-2025'
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        try {
            console.log('📤 Sending test email...');
            
            const info = await transporter.sendMail({
                from: '"SMTP Test" <test@localhost>',
                to: testEmail,
                subject: 'SMTP Server Test Email',
                text: 'This is a test email from your custom SMTP server!',
                html: '<h1>SMTP Server Test</h1><p>This is a test email from your custom SMTP server!</p>'
            });
            
            console.log('✅ Test email sent successfully!');
            console.log(`Message ID: ${info.messageId}`);
            
        } catch (error) {
            console.error('❌ Failed to send test email:', error.message);
        }
    }
    
    async exit() {
        console.log('\n👋 Shutting down...');
        
        if (this.server && this.server.isRunning) {
            console.log('🛑 Stopping SMTP server...');
            await this.server.stop();
        }
        
        this.rl.close();
        console.log('✅ Goodbye!');
        process.exit(0);
    }
    
    prompt(question, defaultValue = '') {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim() || defaultValue);
            });
        });
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n🛑 Received shutdown signal...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n\n🛑 Received termination signal...');
    process.exit(0);
});

// Start the manager
if (require.main === module) {
    const manager = new SMTPManager();
    manager.start().catch(error => {
        console.error('Failed to start SMTP Manager:', error);
        process.exit(1);
    });
}

module.exports = SMTPManager;