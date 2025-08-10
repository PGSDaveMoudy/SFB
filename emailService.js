// Email Service - Handles sending emails for OTP and notifications
const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = null;
        this.isConfigured = false;
        this.init();
    }

    init() {
        try {
            // Check if sendmail is available (for local mail server)
            const fs = require('fs');
            const sendmailPath = '/usr/sbin/sendmail';
            
            if (fs.existsSync(sendmailPath)) {
                // Use sendmail transport for local mail server
                this.transporter = nodemailer.createTransport({
                    sendmail: true,
                    newline: 'unix',
                    path: sendmailPath,
                    args: ['-f', process.env.EMAIL_FROM_ADDRESS || 'noreply@portwoodglobalsolutions.com']
                });
                console.log('Email service configured with local sendmail transport (via exim)');
            } else if (process.env.EMAIL_HOST) {
                // Fallback to SMTP configuration
                const transportConfig = {
                    host: process.env.EMAIL_HOST,
                    port: parseInt(process.env.EMAIL_PORT) || 587,
                    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
                    tls: {
                        rejectUnauthorized: false // Allow self-signed certificates for development
                    }
                };

                // Add authentication if credentials are provided
                if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
                    transportConfig.auth = {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    };
                    console.log('Email service using authenticated SMTP');
                } else {
                    console.log('Email service using unauthenticated local SMTP');
                }

                this.transporter = nodemailer.createTransport(transportConfig);
            } else {
                console.warn('Email service not configured - OTP will only be logged to console');
                return;
            }

            this.isConfigured = true;
            console.log('Email service configured successfully');
            
            // Test connection
            this.testConnection();
            
        } catch (error) {
            console.error('Failed to configure email service:', error);
            this.isConfigured = false;
        }
    }

    async testConnection() {
        if (!this.transporter) return;
        
        try {
            // Only verify SMTP connections, sendmail doesn't support verify()
            if (this.transporter.options && this.transporter.options.host) {
                await this.transporter.verify();
                console.log('Email server connection verified');
            } else {
                console.log('Sendmail transport configured - no connection test needed');
            }
        } catch (error) {
            console.error('Email server connection failed:', error.message);
            this.isConfigured = false;
        }
    }

    async sendOTP(email, otp, contactName = null, formEmailSettings = null) {
        if (!this.isConfigured) {
            console.log(`Email service not configured. OTP for ${email}: ${otp}`);
            return { success: false, message: 'Email service not configured' };
        }

        // Log OTP for debugging
        console.log(`📧 Preparing OTP email - OTP: ${otp}, Email: ${email}, Custom Settings:`, formEmailSettings ? 'YES' : 'NO');

        try {
            // SYSTEM EMAIL SETTINGS - Default fallback
            const systemEmailSettings = {
                fromName: 'Portwood Global Solutions',
                fromAddress: 'noreply@portwoodglobalsolutions.com',
                otpSubject: 'Your Login Verification Code - Portwood Global Solutions',
                template: 'professional',
                footerText: '© 2025 Portwood Global Solutions. All rights reserved.',
                logoUrl: '', // Can be configured later
                replyTo: 'support@portwoodglobalsolutions.com'
            };

            // Use custom email settings if provided, otherwise fall back to system settings
            let fromName, fromAddress, subject, replyTo;
            
            if (formEmailSettings && formEmailSettings.useCustomEmail) {
                console.log('📧 Using CUSTOM email settings for OTP');
                fromName = formEmailSettings.fromName || systemEmailSettings.fromName;
                fromAddress = formEmailSettings.fromAddress || systemEmailSettings.fromAddress;
                subject = formEmailSettings.otpSubject || 'Your Login Verification Code';
                replyTo = formEmailSettings.replyTo || formEmailSettings.fromAddress;
            } else {
                console.log('📧 Using SYSTEM email settings for OTP');
                fromName = process.env.EMAIL_FROM_NAME || systemEmailSettings.fromName;
                fromAddress = process.env.EMAIL_FROM_ADDRESS || systemEmailSettings.fromAddress;
                subject = systemEmailSettings.otpSubject;
                replyTo = systemEmailSettings.replyTo;
            }
            
            const greeting = contactName ? `Hello ${contactName}` : 'Hello';
            
            const mailOptions = {
                from: `"${fromName}" <${fromAddress}>`,
                to: email,
                subject: subject,
                html: this.generateOTPEmailHTML(otp, greeting, formEmailSettings || systemEmailSettings),
                text: this.generateOTPEmailText(otp, greeting, formEmailSettings || systemEmailSettings),
                headers: {
                    'List-Unsubscribe': '<mailto:unsubscribe@portwoodglobalsolutions.com>',
                    'X-Priority': '1',
                    'X-MSMail-Priority': 'High',
                    'Importance': 'high',
                    'X-Mailer': 'PilotForms v1.0'
                }
            };

            // Use custom or system reply-to
            mailOptions.replyTo = replyTo;

            const info = await this.transporter.sendMail(mailOptions);
            const routingType = formEmailSettings && formEmailSettings.useCustomEmail ? 'CUSTOM' : 'SYSTEM';
            console.log(`🔐 LOGIN/OTP email sent via ${routingType} ROUTING:`, info.messageId);
            console.log(`   From: ${fromName} <${fromAddress}>`);
            console.log(`   To: ${email}`);
            console.log(`   Subject: ${subject}`);
            
            return { 
                success: true, 
                messageId: info.messageId,
                message: 'OTP email sent successfully'
            };
            
        } catch (error) {
            console.error('Failed to send OTP email:', error);
            return { 
                success: false, 
                error: error.message,
                message: 'Failed to send OTP email'
            };
        }
    }


    generateOTPEmailHTML(otp, greeting, emailSettings = null) {
        // Always use system settings for OTP emails to ensure consistent branding
        const systemSettings = {
            template: 'professional',
            fromName: 'Portwood Global Solutions',
            logoUrl: '',
            footerText: '© 2025 Portwood Global Solutions. All rights reserved.'
        };

        // For OTP emails, always use system branding
        const template = emailSettings?.template || systemSettings.template;
        const fromName = process.env.EMAIL_FROM_NAME || systemSettings.fromName;
        const logoUrl = emailSettings?.logoUrl || systemSettings.logoUrl;
        const footerText = emailSettings?.footerText || systemSettings.footerText;

        return this.generateEmailTemplate(template, {
            otp,
            greeting,
            fromName,
            logoUrl,
            footerText
        });
    }

    generateEmailTemplate(template, data) {
        const { otp, greeting, fromName, logoUrl, footerText } = data;

        const logoSection = logoUrl ? `
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="${logoUrl}" alt="${fromName}" style="max-height: 50px; max-width: 200px;">
            </div>
        ` : '';

        switch (template) {
            case 'minimal':
                return this.generateMinimalTemplate(otp, greeting, fromName, footerText);
            case 'branded':
                return this.generateBrandedTemplate(otp, greeting, fromName, logoUrl, footerText);
            default: // 'professional'
                return this.generateProfessionalTemplate(otp, greeting, fromName, logoUrl, footerText);
        }
    }

    generateProfessionalTemplate(otp, greeting, fromName, logoUrl, footerText) {
        const logoSection = logoUrl ? `
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="${logoUrl}" alt="${fromName}" style="max-height: 50px; max-width: 200px;">
            </div>
        ` : '';

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login Verification Code</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .otp-code { background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #667eea; }
                .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin: 20px 0; color: #856404; }
                .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
                .button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                ${logoSection}
                <h1>🔐 Login Verification</h1>
                <p>${fromName}</p>
            </div>
            <div class="content">
                <p>${greeting},</p>
                
                <p>We received a request to verify your identity for accessing our form. Please use the verification code below to complete your login:</p>
                
                <div class="otp-code">${otp || 'ERROR: NO OTP'}</div>
                
                <div class="warning">
                    <strong>Important:</strong>
                    <ul>
                        <li>This code expires in 10 minutes</li>
                        <li>Enter this code exactly as shown</li>
                        <li>Don't share this code with anyone</li>
                    </ul>
                </div>
                
                <p>If you didn't request this verification code, please ignore this email. Your account remains secure.</p>
                
                <p>Best regards,<br>
                <strong>${fromName} Team</strong></p>
            </div>
            <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>${footerText}</p>
                <p style="font-size: 10px; color: #999; margin-top: 20px;">
                    Portwood Global Solutions<br>
                    123 Business Street, Suite 100<br>
                    Your City, State 12345<br>
                    <a href="mailto:unsubscribe@portwoodglobalsolutions.com" style="color: #999;">Unsubscribe</a>
                </p>
            </div>
        </body>
        </html>
        `;
    }

    generateMinimalTemplate(otp, greeting, fromName, footerText) {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login Verification Code</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 500px; margin: 40px auto; padding: 20px; }
                .content { background: #fff; padding: 40px; border: 1px solid #ddd; border-radius: 4px; }
                .otp-code { background: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 20px; text-align: center; margin: 20px 0; font-size: 28px; font-weight: bold; letter-spacing: 2px; color: #333; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; border-top: 1px solid #eee; padding-top: 20px; }
            </style>
        </head>
        <body>
            <div class="content">
                <h2>Verification Code</h2>
                <p>${greeting},</p>
                <p>Your verification code is:</p>
                <div class="otp-code">${otp || 'ERROR: NO OTP'}</div>
                <p>This code expires in 10 minutes.</p>
                <p>Best regards,<br>${fromName}</p>
            </div>
            <div class="footer">
                <p>${footerText}</p>
            </div>
        </body>
        </html>
        `;
    }

    generateBrandedTemplate(otp, greeting, fromName, logoUrl, footerText) {
        const logoSection = logoUrl ? `
            <div style="text-align: center; margin-bottom: 30px;">
                <img src="${logoUrl}" alt="${fromName}" style="max-height: 60px; max-width: 250px;">
            </div>
        ` : `
            <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #2563eb; margin: 0; font-size: 28px;">${fromName}</h1>
            </div>
        `;

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login Verification Code</title>
            <style>
                body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 650px; margin: 0 auto; padding: 20px; background: #f8fafc; }
                .container { background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
                .header { background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 40px; text-align: center; }
                .content { padding: 40px; }
                .otp-code { background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%); border: 2px solid #2563eb; border-radius: 12px; padding: 25px; text-align: center; margin: 30px 0; font-size: 36px; font-weight: bold; letter-spacing: 6px; color: #2563eb; }
                .highlight-box { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0; }
                .footer { background: #f8fafc; padding: 30px; text-align: center; font-size: 14px; color: #64748b; border-top: 1px solid #e2e8f0; }
                .cta-button { display: inline-block; background: #2563eb; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    ${logoSection}
                    <h1 style="margin: 0; font-size: 24px;">🔐 Secure Login Verification</h1>
                </div>
                <div class="content">
                    <p style="font-size: 18px;">${greeting},</p>
                    
                    <p>We've received a request to verify your identity. To ensure the security of your account, please use the verification code below:</p>
                    
                    <div class="otp-code">${otp || 'ERROR: NO OTP'}</div>
                    
                    <div class="highlight-box">
                        <strong>🔒 Security Notice:</strong>
                        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                            <li>This code expires in 10 minutes</li>
                            <li>Only use this code on our official website</li>
                            <li>Never share this code with anyone</li>
                        </ul>
                    </div>
                    
                    <p>If you didn't request this verification, you can safely ignore this email. Your account security is not compromised.</p>
                    
                    <p style="margin-top: 30px;">Thank you for trusting us with your security,<br>
                    <strong>The ${fromName} Team</strong></p>
                </div>
                <div class="footer">
                    <p>${footerText}</p>
                    <p style="margin-top: 10px;">This is an automated security message. Please do not reply to this email.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    generateOTPEmailText(otp, greeting, emailSettings = null) {
        // Always use system settings for OTP emails
        const systemSettings = {
            fromName: 'Portwood Global Solutions',
            footerText: '© 2025 Portwood Global Solutions. All rights reserved.'
        };

        const fromName = process.env.EMAIL_FROM_NAME || systemSettings.fromName;
        const footerText = emailSettings?.footerText || systemSettings.footerText;

        return `
${greeting},

We received a request to verify your identity for accessing our form. 

Your verification code is: ${otp}

Important:
- This code expires in 10 minutes
- Enter this code exactly as shown
- Don't share this code with anyone

If you didn't request this verification code, please ignore this email.

Best regards,
${fromName} Team

This is an automated message. Please do not reply to this email.
${footerText}
        `.trim();
    }

    async sendEmailConfigTest(email, testCode, testEmailSettings) {
        if (!this.isConfigured) {
            console.log(`Email service not configured. Test would be sent to ${email}: ${testCode}`);
            return { success: false, message: 'Email service not configured - cannot test email sending' };
        }

        try {
            const fromName = testEmailSettings.fromName || 'Email Configuration Test';
            const fromAddress = testEmailSettings.fromAddress || process.env.EMAIL_USER;
            const subject = 'Email Configuration Test - Verification Successful';
            
            const mailOptions = {
                from: `"${fromName}" <${fromAddress}>`,
                to: email,
                subject: subject,
                html: this.generateTestEmailHTML(testCode, fromName, testEmailSettings),
                text: this.generateTestEmailText(testCode, fromName, testEmailSettings)
            };

            // Add reply-to if specified
            if (testEmailSettings.replyTo) {
                mailOptions.replyTo = testEmailSettings.replyTo;
            }

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Test email sent successfully:', info.messageId);
            
            return { 
                success: true, 
                messageId: info.messageId,
                message: 'Test email sent successfully'
            };
            
        } catch (error) {
            console.error('Failed to send test email:', error);
            return { 
                success: false, 
                error: error.message,
                message: 'Failed to send test email: ' + error.message
            };
        }
    }

    generateTestEmailHTML(testCode, fromName, testEmailSettings) {
        const footerText = testEmailSettings.footerText || '© 2025 Portwood Global Solutions. All rights reserved.';
        const logoUrl = testEmailSettings.logoUrl || '';
        
        const logoSection = logoUrl ? `
            <div style="text-align: center; margin-bottom: 20px;">
                <img src="${logoUrl}" alt="${fromName}" style="max-height: 50px; max-width: 200px;">
            </div>
        ` : '';

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Configuration Test</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .test-code { background: #fff; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #22c55e; }
                .success-box { background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 4px; padding: 15px; margin: 20px 0; color: #15803d; }
                .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                ${logoSection}
                <h1>✅ Email Configuration Test</h1>
                <p>${fromName}</p>
            </div>
            <div class="content">
                <p>Congratulations!</p>
                
                <p>Your email configuration is working correctly. This test email was sent successfully from your configured email address.</p>
                
                <div class="test-code">${testCode}</div>
                
                <div class="success-box">
                    <strong>✅ Configuration Verified:</strong>
                    <ul style="margin: 10px 0 0 0; padding-left: 20px;">
                        <li>SMTP connection established</li>
                        <li>Authentication successful</li>
                        <li>Email delivery working</li>
                        <li>From address verified</li>
                    </ul>
                </div>
                
                <p>You can now use this email configuration for sending OTP verification codes and other form-related emails.</p>
                
                <p>Best regards,<br>
                <strong>PilotForms Team</strong></p>
            </div>
            <div class="footer">
                <p>This is an automated test message from your form builder email configuration.</p>
                <p>${footerText}</p>
            </div>
        </body>
        </html>
        `;
    }

    generateTestEmailText(testCode, fromName, testEmailSettings) {
        const footerText = testEmailSettings.footerText || '© 2025 Portwood Global Solutions. All rights reserved.';

        return `
Email Configuration Test - SUCCESS

Congratulations!

Your email configuration is working correctly. This test email was sent successfully from your configured email address.

Test Code: ${testCode}

Configuration Verified:
- SMTP connection established
- Authentication successful  
- Email delivery working
- From address verified

You can now use this email configuration for sending OTP verification codes and other form-related emails.

Best regards,
PilotForms Team

This is an automated test message from your form builder email configuration.
${footerText}
        `.trim();
    }

    async sendWelcomeEmail(email, formName, contactName = null) {
        if (!this.isConfigured) {
            console.log(`Welcome email would be sent to ${email} for form: ${formName}`);
            return { success: false, message: 'Email service not configured' };
        }

        try {
            const fromName = process.env.EMAIL_FROM_NAME || 'Portwood Global Solutions';
            const fromAddress = process.env.EMAIL_FROM_ADDRESS || process.env.EMAIL_USER;
            const greeting = contactName ? `Hello ${contactName}` : 'Hello';

            const mailOptions = {
                from: `"${fromName}" <${fromAddress}>`,
                to: email,
                subject: `Welcome! Your ${formName} submission received`,
                html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h2 style="color: #667eea;">Thank you for your submission!</h2>
                    <p>${greeting},</p>
                    <p>We have successfully received your <strong>${formName}</strong> submission.</p>
                    <p>Our team will review your information and get back to you soon.</p>
                    <p>Best regards,<br><strong>Portwood Global Solutions Team</strong></p>
                </div>
                `,
                text: `${greeting}, we have successfully received your ${formName} submission. Our team will review your information and get back to you soon. Best regards, Portwood Global Solutions Team`
            };

            const info = await this.transporter.sendMail(mailOptions);
            console.log('Welcome email sent successfully:', info.messageId);
            
            return { 
                success: true, 
                messageId: info.messageId,
                message: 'Welcome email sent successfully'
            };
            
        } catch (error) {
            console.error('Failed to send welcome email:', error);
            return { 
                success: false, 
                error: error.message,
                message: 'Failed to send welcome email'
            };
        }
    }

    isReady() {
        return this.isConfigured;
    }
}

module.exports = new EmailService();