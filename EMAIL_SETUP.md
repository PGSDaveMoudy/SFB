# Email Service Setup for OTP Functionality

The Login building block requires email service configuration to send OTP (One-Time Password) codes to users. Without email configuration, the system will run in demo mode and display OTP codes in the console/UI.

## Quick Setup Options

### Option 1: Gmail SMTP (Recommended for Testing)

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Generate an App Password**:
   - Go to Google Account Settings → Security
   - Under "Signing in to Google", select "App passwords"
   - Generate a new app password for "Mail"
   - Copy the 16-character password

3. **Update your .env file**:
```env
EMAIL_SERVICE=gmail
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-16-character-app-password
EMAIL_FROM_NAME=Portwood Global Solutions
EMAIL_FROM_ADDRESS=your-gmail@gmail.com
```

### Option 2: SendGrid (Recommended for Production)

1. **Sign up for SendGrid** at https://sendgrid.com
2. **Create an API Key**:
   - Go to Settings → API Keys
   - Create a new API key with "Mail Send" permissions
   - Copy the API key

3. **Update your .env file**:
```env
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
EMAIL_FROM_NAME=Portwood Global Solutions
```

### Option 3: Custom SMTP Server

If you have your own email server or use another provider (Office 365, etc.):

```env
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=noreply@yourdomain.com
EMAIL_PASS=your-smtp-password
EMAIL_FROM_NAME=Portwood Global Solutions
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
```

## Testing Email Configuration

1. **Restart the server** after updating .env
2. **Check the console** for email service status:
   - ✅ "Email service configured successfully"
   - ✅ "Email server connection verified"
   - ❌ "Email service not configured - OTP will only be logged to console"

3. **Test OTP sending**:
   - Add a Login field to a form
   - Enter an email address that exists in Salesforce
   - Check if you receive the OTP email

## Email Template Features

The OTP emails include:
- 🎨 **Professional HTML design** with company branding
- 🔢 **Large, clearly displayed OTP code**
- ⏰ **10-minute expiration notice**
- 🔒 **Security warnings and best practices**
- 📱 **Mobile-responsive design**

## Troubleshooting

### Common Issues:

1. **"Authentication failed"**
   - For Gmail: Ensure you're using an App Password, not your regular password
   - For other providers: Check username/password combination

2. **"Connection timeout"**
   - Check EMAIL_HOST and EMAIL_PORT settings
   - Verify firewall doesn't block SMTP ports

3. **"Self signed certificate"**
   - The service handles this automatically with `rejectUnauthorized: false`

4. **Emails going to spam**
   - Use a verified domain for EMAIL_FROM_ADDRESS
   - Consider using SendGrid or similar service for better deliverability

### Demo Mode Fallback:

If email service fails to configure, the system automatically falls back to demo mode:
- OTP codes are logged to server console
- OTP codes are displayed in the form UI
- Users can still test the Login functionality

## Production Recommendations

1. **Use SendGrid or similar service** for reliable email delivery
2. **Set up SPF, DKIM, and DMARC records** for your domain
3. **Use a dedicated email address** (like noreply@yourdomain.com)
4. **Monitor email delivery rates** and spam complaints
5. **Remove demoOtp from responses** in production

## Security Considerations

- ✅ OTP codes expire after 10 minutes
- ✅ Maximum 3 verification attempts per session
- ✅ Secure session management with unique IDs
- ✅ Email addresses are never exposed in client-side code
- ✅ All email communication is logged for debugging

## Advanced Configuration

### Custom Email Templates

Modify `emailService.js` to customize:
- Email subject lines
- HTML/text templates
- Company branding
- Additional security warnings

### Rate Limiting

The system includes built-in rate limiting:
- Max 5 OTP requests per minute per IP
- Prevents spam and abuse
- Configurable in server.js

### Multiple Email Providers

You can implement failover by modifying emailService.js to try multiple providers if the primary fails.

---

**Need help?** Check the server console for detailed error messages and email service status information.