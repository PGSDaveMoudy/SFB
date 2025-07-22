// SMTP Server Integration for Salesforce Form Builder
// Connects the custom SMTP server with the existing email service

const CustomSMTPServer = require('./smtpServer');
const fs = require('fs-extra');
const path = require('path');

class SMTPIntegration {
    constructor() {
        this.smtpServer = null;
        this.isIntegrated = false;
        this.config = {
            autoStart: true,
            port: 2525,
            hostname: 'localhost',
            credentials: {
                username: 'sfb-mailer',
                password: 'sfb-smtp-2025'
            }
        };
    }
    
    async initialize() {
        try {
            console.log('🔗 Initializing SMTP Server Integration...');
            
            // Load or create configuration
            await this.loadConfiguration();
            
            // Initialize SMTP server
            this.smtpServer = new CustomSMTPServer({
                port: this.config.port,
                hostname: this.config.hostname,
                secure: false,
                allowInsecureAuth: true,
                authOptional: false,
                banner: 'SFB Integrated SMTP Server'
            });
            
            // Create integration user account
            await this.setupIntegrationUser();
            
            // Start server if auto-start is enabled
            if (this.config.autoStart) {
                await this.startIntegratedServer();
            }
            
            this.isIntegrated = true;
            console.log('✅ SMTP Server Integration initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize SMTP integration:', error.message);
            throw error;
        }
    }
    
    async loadConfiguration() {
        const configFile = path.join(__dirname, 'smtp-integration-config.json');
        
        if (await fs.pathExists(configFile)) {
            const savedConfig = await fs.readJson(configFile);
            this.config = { ...this.config, ...savedConfig };
            console.log('📄 Loaded SMTP integration configuration');
        } else {
            await this.saveConfiguration();
            console.log('📄 Created default SMTP integration configuration');
        }
    }
    
    async saveConfiguration() {
        const configFile = path.join(__dirname, 'smtp-integration-config.json');
        await fs.writeJson(configFile, this.config, { spaces: 2 });
    }
    
    async setupIntegrationUser() {
        // Create a dedicated user for the form builder integration
        const { username, password } = this.config.credentials;
        
        try {
            await this.smtpServer.createUser(username, password, false);
            console.log(`👤 Created SMTP integration user: ${username}`);
        } catch (error) {
            // User might already exist
            console.log(`👤 SMTP integration user exists: ${username}`);
        }
    }
    
    async startIntegratedServer() {
        if (this.smtpServer.isRunning) {
            console.log('⚠️  SMTP server is already running');
            return;
        }
        
        try {
            await this.smtpServer.start();
            console.log(`🚀 Integrated SMTP server started on ${this.config.hostname}:${this.config.port}`);
            return true;
        } catch (error) {
            console.error('❌ Failed to start integrated SMTP server:', error.message);
            return false;
        }
    }
    
    async stopIntegratedServer() {
        if (!this.smtpServer.isRunning) {
            console.log('⚠️  SMTP server is not running');
            return;
        }
        
        try {
            await this.smtpServer.stop();
            console.log('🛑 Integrated SMTP server stopped');
            return true;
        } catch (error) {
            console.error('❌ Failed to stop integrated SMTP server:', error.message);
            return false;
        }
    }
    
    getEmailServiceConfig() {
        // Returns configuration that can be used to update the main email service
        return {
            EMAIL_HOST: this.config.hostname,
            EMAIL_PORT: this.config.port.toString(),
            EMAIL_SECURE: 'false',
            EMAIL_USER: this.config.credentials.username,
            EMAIL_PASS: this.config.credentials.password
        };
    }
    
    async updateEnvironmentConfig() {
        // Update the .env file with SMTP server settings
        const envFile = path.join(__dirname, '.env');
        
        if (await fs.pathExists(envFile)) {
            let envContent = await fs.readFile(envFile, 'utf8');
            const config = this.getEmailServiceConfig();
            
            // Update or add email configuration
            const emailConfigLines = [
                '# Custom SMTP Server Configuration (Auto-generated)',
                `EMAIL_HOST=${config.EMAIL_HOST}`,
                `EMAIL_PORT=${config.EMAIL_PORT}`,
                `EMAIL_SECURE=${config.EMAIL_SECURE}`,
                `EMAIL_USER=${config.EMAIL_USER}`,
                `EMAIL_PASS=${config.EMAIL_PASS}`,
                `EMAIL_FROM_ADDRESS=${config.EMAIL_USER}@localhost`,
                `EMAIL_FROM_NAME=Portwood Global Solutions`
            ];
            
            // Remove existing email configuration
            envContent = envContent.replace(/^EMAIL_.*$/gm, '');
            envContent = envContent.replace(/^# Custom SMTP.*$/gm, '');
            
            // Clean up empty lines
            envContent = envContent.replace(/\n\n+/g, '\n\n');
            
            // Add new configuration
            envContent += '\n\n' + emailConfigLines.join('\n') + '\n';
            
            await fs.writeFile(envFile, envContent);
            console.log('📝 Updated .env file with SMTP server configuration');
            
            return true;
        } else {
            console.log('⚠️  .env file not found');
            return false;
        }
    }
    
    async getServerStatus() {
        if (!this.smtpServer) {
            return { integrated: false, running: false };
        }
        
        const stats = await this.smtpServer.getServerStats();
        return {
            integrated: this.isIntegrated,
            running: stats.isRunning,
            config: this.config,
            stats: stats,
            emailConfig: this.getEmailServiceConfig()
        };
    }
    
    async testIntegration() {
        console.log('🧪 Testing SMTP Server Integration...');
        
        if (!this.smtpServer || !this.smtpServer.isRunning) {
            console.log('❌ SMTP server is not running');
            return false;
        }
        
        // Test with nodemailer
        const nodemailer = require('nodemailer');
        const config = this.getEmailServiceConfig();
        
        const transporter = nodemailer.createTransport({
            host: config.EMAIL_HOST,
            port: parseInt(config.EMAIL_PORT),
            secure: config.EMAIL_SECURE === 'true',
            auth: {
                user: config.EMAIL_USER,
                pass: config.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            }
        });
        
        try {
            // Test connection
            await transporter.verify();
            console.log('✅ SMTP connection test successful');
            
            // Send test email
            const testInfo = await transporter.sendMail({
                from: `"SFB Test" <${config.EMAIL_USER}@localhost>`,
                to: 'test@example.com',
                subject: 'SMTP Integration Test',
                text: 'This is a test email from the integrated SMTP server.',
                html: '<h1>SMTP Integration Test</h1><p>This is a test email from the integrated SMTP server.</p>'
            });
            
            console.log('✅ Test email sent successfully');
            console.log(`📧 Message ID: ${testInfo.messageId}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ SMTP integration test failed:', error.message);
            return false;
        }
    }
}

// Auto-initialize if this module is loaded by the main server
let smtpIntegration = null;

async function getIntegration() {
    if (!smtpIntegration) {
        smtpIntegration = new SMTPIntegration();
        
        // Initialize in background
        smtpIntegration.initialize().catch(error => {
            console.error('SMTP Integration initialization failed:', error.message);
        });
    }
    
    return smtpIntegration;
}

module.exports = {
    SMTPIntegration,
    getIntegration
};