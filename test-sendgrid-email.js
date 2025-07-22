// SendGrid Email Test
const sgMail = require('@sendgrid/mail');

async function testSendGrid() {
    console.log('🧪 Testing SendGrid Email Service\n');
    
    // Check if API key is configured
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
        console.log('❌ SENDGRID_API_KEY not found in environment variables');
        console.log('   Please add your SendGrid API key to .env file');
        console.log('   Get your API key from: https://app.sendgrid.com/settings/api_keys\n');
        return;
    }
    
    // Configure SendGrid
    sgMail.setApiKey(apiKey);
    console.log('✅ SendGrid API key configured');
    
    // Test email data
    const testEmail = {
        to: 'test@example.com', // Change this to your email for testing
        from: {
            email: process.env.EMAIL_FROM_ADDRESS || 'noreply@portwoodglobalsolutions.com',
            name: process.env.EMAIL_FROM_NAME || 'Portwood Global Solutions'
        },
        subject: 'Test Email - SendGrid Integration',
        text: `
Hello,

This is a test email to verify SendGrid integration is working correctly.

Test OTP: 123456

If you receive this email, SendGrid is configured properly!

Best regards,
Portwood Global Solutions Team
        `.trim(),
        html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>SendGrid Test Email</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .otp-code { background: #fff; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #22c55e; }
                .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>✅ SendGrid Test Email</h1>
                <p>Portwood Global Solutions</p>
            </div>
            <div class="content">
                <p>Hello,</p>
                
                <p>This is a test email to verify SendGrid integration is working correctly.</p>
                
                <div class="otp-code">123456</div>
                
                <p><strong>✅ SendGrid Integration Status:</strong></p>
                <ul>
                    <li>API Key: Configured</li>
                    <li>From Address: ${process.env.EMAIL_FROM_ADDRESS || 'noreply@portwoodglobalsolutions.com'}</li>
                    <li>Email Service: Active</li>
                    <li>Spam Prevention: Automatic</li>
                </ul>
                
                <p>If you receive this email, SendGrid is configured properly!</p>
                
                <p>Best regards,<br>
                <strong>Portwood Global Solutions Team</strong></p>
            </div>
            <div class="footer">
                <p>This is an automated test message from SendGrid integration.</p>
                <p>© 2025 Portwood Global Solutions. All rights reserved.</p>
            </div>
        </body>
        </html>
        `,
        // SendGrid specific settings
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
        }
    };
    
    try {
        console.log('📤 Sending test email via SendGrid...');
        console.log(`   To: ${testEmail.to}`);
        console.log(`   From: ${testEmail.from.name} <${testEmail.from.email}>`);
        console.log(`   Subject: ${testEmail.subject}`);
        
        const [response] = await sgMail.send(testEmail);
        
        console.log('\n✅ Email sent successfully!');
        console.log(`   Status: ${response.statusCode}`);
        console.log(`   Message ID: ${response.headers['x-message-id']}`);
        
        if (process.env.NODE_ENV === 'test') {
            console.log('   ⚠️  Sandbox mode enabled - email not actually delivered');
        } else {
            console.log('   📬 Email delivered to recipient');
        }
        
        console.log('\n🎉 SendGrid integration is working correctly!');
        console.log('   You can now use SendGrid for OTP and other emails.');
        
    } catch (error) {
        console.log('\n❌ SendGrid test failed:');
        
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Error: ${JSON.stringify(error.response.body, null, 2)}`);
            
            if (error.response.status === 401) {
                console.log('\n💡 Fix: Check your SendGrid API key');
            } else if (error.response.status === 403) {
                console.log('\n💡 Fix: Verify sender identity in SendGrid dashboard');
            }
        } else {
            console.log(`   Error: ${error.message}`);
        }
        
        console.log('\nTroubleshooting:');
        console.log('1. Verify SendGrid API key is correct');
        console.log('2. Verify sender email in SendGrid dashboard');
        console.log('3. Check SendGrid account status');
    }
}

// Run the test
testSendGrid();