// SendGrid Email Service Integration
// Alternative to SMTP for better email delivery and spam prevention

const sgMail = require('@sendgrid/mail');

class SendGridEmailService {
    constructor() {
        this.isConfigured = false;
        this.init();
    }

    init() {
        if (process.env.SENDGRID_API_KEY) {
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            this.isConfigured = true;
            console.log('SendGrid email service configured successfully');
        } else {
            console.warn('SendGrid API key not found. Add SENDGRID_API_KEY to .env file');
        }
    }

    async sendOTP(email, otp, contactName = null) {
        if (!this.isConfigured) {
            console.log(`SendGrid not configured. OTP for ${email}: ${otp}`);
            return { success: false, message: 'SendGrid not configured' };
        }

        const greeting = contactName ? `Hello ${contactName}` : 'Hello';
        
        const msg = {
            to: email,
            from: {
                email: process.env.EMAIL_FROM_ADDRESS || 'noreply@portwoodglobalsolutions.com',
                name: 'Portwood Global Solutions'
            },
            subject: 'Your Login Verification Code - Portwood Global Solutions',
            text: this.generateOTPEmailText(otp, greeting),
            html: this.generateOTPEmailHTML(otp, greeting),
            // SendGrid specific options for better delivery
            trackingSettings: {
                clickTracking: {
                    enable: false
                },
                openTracking: {
                    enable: false
                }
            },
            mailSettings: {
                sandboxMode: {
                    enable: process.env.NODE_ENV === 'test'
                }
            },
            // Custom headers for spam prevention
            headers: {
                'X-Priority': '1',
                'X-MSMail-Priority': 'High',
                'Importance': 'high'
            }
        };

        try {
            const [response] = await sgMail.send(msg);
            console.log('✅ OTP email sent via SendGrid:', response.statusCode);
            console.log('   Message ID:', response.headers['x-message-id']);
            
            return {
                success: true,
                messageId: response.headers['x-message-id'],
                message: 'OTP email sent successfully via SendGrid'
            };
        } catch (error) {
            console.error('SendGrid error:', error);
            if (error.response) {
                console.error('SendGrid response error:', error.response.body);
            }
            return {
                success: false,
                error: error.message,
                message: 'Failed to send OTP email via SendGrid'
            };
        }
    }

    generateOTPEmailHTML(otp, greeting) {
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
            </style>
        </head>
        <body>
            <div class="header">
                <h1>🔐 Login Verification</h1>
                <p>Portwood Global Solutions</p>
            </div>
            <div class="content">
                <p>${greeting},</p>
                
                <p>We received a request to verify your identity for accessing our form. Please use the verification code below to complete your login:</p>
                
                <div class="otp-code">${otp}</div>
                
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
                <strong>Portwood Global Solutions Team</strong></p>
            </div>
            <div class="footer">
                <p>This is an automated message. Please do not reply to this email.</p>
                <p>© 2025 Portwood Global Solutions. All rights reserved.</p>
                <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                <p style="font-size: 10px; color: #999;">
                    Portwood Global Solutions<br>
                    123 Business Street, Suite 100<br>
                    Your City, State 12345<br>
                    <a href="https://portwoodglobalsolutions.com/unsubscribe" style="color: #999;">Unsubscribe</a> | 
                    <a href="https://portwoodglobalsolutions.com/privacy" style="color: #999;">Privacy Policy</a>
                </p>
            </div>
        </body>
        </html>
        `;
    }

    generateOTPEmailText(otp, greeting) {
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
Portwood Global Solutions Team

This is an automated message. Please do not reply to this email.
© 2025 Portwood Global Solutions. All rights reserved.

Portwood Global Solutions
123 Business Street, Suite 100
Your City, State 12345

To unsubscribe: https://portwoodglobalsolutions.com/unsubscribe
Privacy Policy: https://portwoodglobalsolutions.com/privacy
        `.trim();
    }

    isReady() {
        return this.isConfigured;
    }
}

module.exports = SendGridEmailService;