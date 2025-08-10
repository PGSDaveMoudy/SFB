// Email Spam Prevention Configuration
// This file contains recommendations to prevent emails from being marked as spam

const spamPreventionGuide = {
    // 1. DNS Configuration (CRITICAL - Must be done by domain administrator)
    dns: {
        spf: {
            record: "v=spf1 ip4:159.196.64.152 include:_spf.google.com ~all",
            type: "TXT",
            host: "@",
            description: "Add this SPF record to allow your server IP to send emails"
        },
        dkim: {
            description: "DKIM requires email server configuration. Contact your hosting provider.",
            alternativeWithSendGrid: "SendGrid automatically handles DKIM when configured properly"
        },
        dmarc: {
            record: "v=DMARC1; p=none; rua=mailto:dmarc@portwoodglobalsolutions.com",
            type: "TXT", 
            host: "_dmarc",
            description: "DMARC policy for email authentication"
        }
    },

    // 2. Email Headers to Add
    emailHeaders: {
        'List-Unsubscribe': '<mailto:unsubscribe@portwoodglobalsolutions.com>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        'Precedence': 'bulk',
        'X-Mailer': 'PilotForms v1.0',
        'X-Priority': '3',
        'X-MSMail-Priority': 'Normal'
    },

    // 3. Content Best Practices
    contentGuidelines: {
        subject: [
            "Avoid ALL CAPS",
            "Avoid excessive punctuation!!!",
            "Avoid spam trigger words (free, winner, act now)",
            "Keep under 50 characters",
            "Be specific and clear"
        ],
        body: [
            "Include both HTML and plain text versions",
            "Avoid excessive images",
            "Include physical address in footer",
            "Add unsubscribe link",
            "Avoid spam trigger phrases",
            "Maintain good text-to-image ratio"
        ]
    },

    // 4. Server Configuration
    serverConfig: {
        reverseIPLookup: "Ensure server1.portwoodglobalsolutions.com resolves to 159.196.64.152",
        senderReputation: "Gradually increase sending volume to build reputation",
        dedicatedIP: "Consider dedicated IP for better reputation control"
    }
};

// Enhanced Email Service Configuration
const enhancedEmailConfig = {
    // Add these to nodemailer transport options
    transportOptions: {
        // For sendmail transport
        sendmail: {
            path: '/usr/sbin/sendmail',
            args: ['-f', 'noreply@portwoodglobalsolutions.com', '-t', '-oi']
        },
        
        // For SMTP transport
        smtp: {
            host: 'smtp.gmail.com', // or your SMTP server
            port: 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            tls: {
                rejectUnauthorized: false
            },
            // Additional SMTP options for better delivery
            pool: true,
            maxConnections: 5,
            maxMessages: 100,
            rateDelta: 1000,
            rateLimit: 5
        }
    },

    // SendGrid Alternative (Recommended for production)
    sendgridConfig: {
        apiKey: process.env.SENDGRID_API_KEY,
        benefits: [
            "Automatic SPF/DKIM configuration",
            "Built-in reputation management",
            "Detailed delivery analytics",
            "Automatic spam score checking"
        ]
    }
};

// Instructions for Implementation
console.log(`
=== EMAIL SPAM PREVENTION GUIDE ===

1. DNS Configuration (MOST IMPORTANT):
   - Add SPF record: ${spamPreventionGuide.dns.spf.record}
   - Configure DKIM with your email provider
   - Add DMARC record: ${spamPreventionGuide.dns.dmarc.record}

2. Consider SendGrid Integration:
   - Sign up at https://sendgrid.com
   - Get API key and add to .env: SENDGRID_API_KEY=your-key
   - SendGrid handles authentication automatically

3. Test Your Configuration:
   - Use mail-tester.com to check spam score
   - Test with different email providers
   - Monitor delivery rates

4. Quick Wins:
   - Add unsubscribe link to emails
   - Include physical address in footer
   - Use proper reply-to address
   - Avoid spam trigger words
`);

module.exports = {
    spamPreventionGuide,
    enhancedEmailConfig
};