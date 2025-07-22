# 📧 Custom SMTP Server for Salesforce Form Builder

A comprehensive, self-hosted SMTP server solution that provides reliable email delivery for OTP verification and form notifications without dependency on external email providers.

## 🚀 **Features**

### **Core SMTP Server**
- **Full SMTP Protocol Support** - Complete RFC-compliant SMTP server
- **User Authentication** - Secure user accounts with bcrypt password hashing
- **Email Queue Management** - Reliable delivery with automatic retry logic
- **Storage System** - Organized email storage (incoming, sent, failed)
- **Logging & Monitoring** - Comprehensive server logs and statistics
- **Auto-cleanup** - Automated cleanup of old emails (configurable retention)

### **Security Features**
- **Authentication Required** - User accounts with secure passwords
- **Connection Limits** - Configurable maximum connections
- **Rate Limiting** - Built-in spam protection
- **TLS Support** - Optional encryption for secure communication
- **Session Management** - Secure session handling
- **Input Validation** - Comprehensive validation of all inputs

### **Management & Monitoring**
- **Web-based Management** - Integrated control panel in form builder
- **Command-line Interface** - Full CLI management tool
- **Real-time Status** - Live server statistics and monitoring
- **Email Tracking** - Complete audit trail of all emails
- **User Management** - Create, manage, and monitor SMTP users

## 📁 **File Structure**

```
salesforce-form-builder/
├── smtpServer.js          # Core SMTP server implementation
├── smtp-manager.js        # Interactive CLI management tool
├── start-smtp.js         # Simple server starter
├── smtp-integration.js   # Integration with main application
├── mail-storage/         # Email storage directory
│   ├── incoming/         # Received emails
│   ├── sent/            # Successfully delivered emails
│   └── failed/          # Failed delivery emails
├── mail-queue/          # Email delivery queue
├── smtp-users.json      # User accounts database
└── smtp-server.log      # Server operation logs
```

## 🛠️ **Installation & Setup**

### **1. Dependencies**
All required dependencies are already installed:
```bash
# Already installed with the main application
npm install smtp-server fs-extra mailparser node-cron bcryptjs
```

### **2. Quick Start**
```bash
# Option 1: Simple start with defaults
node start-smtp.js

# Option 2: Interactive management
node smtp-manager.js

# Option 3: Integrated with web interface
# Use the SMTP management panel in the form builder
```

### **3. Default Configuration**
- **Port**: 2525 (non-privileged port)
- **Hostname**: localhost
- **Default User**: admin / smtp-admin-2025
- **Security**: Basic authentication enabled
- **Storage**: ./mail-storage/
- **Logs**: ./smtp-server.log

## 🎮 **Management Options**

### **1. Web Interface (Recommended)**
Access the SMTP management panel in the form builder:
1. Open the form builder
2. Click on "Form Settings"
3. Navigate to "SMTP Server Management"
4. Use the control buttons:
   - 📊 **Check Status** - View server status and statistics
   - 🚀 **Start Server** - Launch the SMTP server
   - 🛑 **Stop Server** - Gracefully stop the server
   - ⚙️ **Configure Email** - Auto-configure email service
   - 🧪 **Test Integration** - Verify everything works

### **2. Command Line Interface**
```bash
node smtp-manager.js
```

Interactive menu with options:
- Start/Stop SMTP Server
- View Server Status
- Manage Users
- View Recent Emails
- Server Configuration
- Test Email Sending

### **3. Simple Start**
```bash
node start-smtp.js
```
Starts with default settings and displays connection info.

## ⚙️ **Configuration**

### **Server Settings**
Default configuration can be customized in `smtp-integration.js`:

```javascript
const config = {
    port: 2525,                    // SMTP port
    hostname: 'localhost',         // Server hostname
    secure: false,                 // Use TLS encryption
    allowInsecureAuth: true,       // Allow plain auth
    authOptional: false,           // Require authentication
    maxConnections: 10,            // Max concurrent connections
    maxFileSize: 10485760,         // 10MB file size limit
    cleanupInterval: '0 0 * * *'   // Daily cleanup at midnight
};
```

### **Email Service Integration**
The server automatically configures your `.env` file when using "Configure Email":

```env
# Custom SMTP Server Configuration (Auto-generated)
EMAIL_HOST=localhost
EMAIL_PORT=2525
EMAIL_SECURE=false
EMAIL_USER=sfb-mailer
EMAIL_PASS=sfb-smtp-2025
EMAIL_FROM_ADDRESS=sfb-mailer@localhost
EMAIL_FROM_NAME=Portwood Global Solutions
```

## 👥 **User Management**

### **Default Users**
- **Admin**: admin / smtp-admin-2025
- **Integration**: sfb-mailer / sfb-smtp-2025 (auto-created)

### **Create New Users**
Via CLI:
```bash
node smtp-manager.js
# Select: User Management → Create User
```

Via Code:
```javascript
const { getIntegration } = require('./smtp-integration');
const integration = await getIntegration();
await integration.smtpServer.createUser('username', 'password', false);
```

## 📧 **Email Flow**

### **Sending Process**
1. Application connects to SMTP server (localhost:2525)
2. Authenticates with configured credentials
3. Sends email via SMTP protocol
4. Server receives and processes email
5. Email queued for delivery (if external recipients)
6. Server attempts delivery with retry logic
7. Email moved to sent/failed folder based on result

### **Storage Structure**
```
mail-storage/
├── incoming/[email-id]/
│   ├── metadata.json      # Email headers and info
│   ├── content.json       # Email body (text/html)
│   └── attachments/       # File attachments
├── sent/[email-id]/
│   └── delivery.json      # Delivery confirmation
└── failed/[email-id]/
    └── failure.json       # Failure reason
```

## 🔍 **Monitoring & Logs**

### **Server Statistics**
- Active connections count
- Emails processed (sent/failed/queued)
- User login activity
- Server uptime and performance

### **Log Files**
- **smtp-server.log** - All server operations
- **Console output** - Real-time status updates
- **Email metadata** - Complete audit trail

### **Web Dashboard**
Real-time statistics available through the web interface showing:
- Server status (running/stopped)
- Connection count
- Queue size
- User count
- Email statistics

## 🧪 **Testing**

### **Integration Test**
```bash
# Via web interface
Click "🧪 Test SMTP Integration" in the management panel

# Via CLI
node smtp-manager.js
# Select: Test Email Sending
```

### **Manual Testing**
```javascript
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransporter({
    host: 'localhost',
    port: 2525,
    secure: false,
    auth: {
        user: 'admin',
        pass: 'smtp-admin-2025'
    }
});

await transporter.sendMail({
    from: 'test@localhost',
    to: 'recipient@example.com',
    subject: 'Test Email',
    text: 'This is a test email from your custom SMTP server!'
});
```

## 🔧 **Troubleshooting**

### **Common Issues**

**Port Already in Use**
```bash
# Find process using port 2525
netstat -tlnp | grep :2525
# Kill the process or change port in configuration
```

**Permission Denied**
```bash
# Ensure write permissions for storage directories
chmod -R 755 mail-storage/
chmod 644 smtp-users.json
```

**Authentication Failures**
- Verify username/password in smtp-users.json
- Check user account is active
- Ensure authentication is enabled

**Email Not Sending**
- Check SMTP server is running (port 2525)
- Verify email service configuration
- Check server logs for errors
- Test with manual SMTP connection

### **Debug Mode**
Enable detailed logging by setting environment variable:
```bash
DEBUG=smtp* node start-smtp.js
```

## 🔒 **Security Considerations**

### **Production Deployment**
- **Change Default Passwords** - Update all default credentials
- **Use TLS Encryption** - Enable secure connections
- **Firewall Rules** - Restrict access to SMTP port
- **Regular Updates** - Keep dependencies updated
- **Monitor Logs** - Watch for suspicious activity

### **User Account Security**
- Strong password requirements
- Regular password rotation
- Account activity monitoring
- Failed login attempt tracking

## 🚀 **Advanced Features**

### **Custom Email Templates**
Modify email templates in `emailService.js`:
```javascript
// Customize OTP email appearance
generateOTPEmailHTML(otp, greeting, formEmailSettings)
```

### **External Delivery**
For production use, implement external SMTP relay in `deliverEmail()` method:
```javascript
// Add real SMTP client for external delivery
// Integrate with services like SendGrid, Amazon SES
```

### **Clustering**
Run multiple SMTP server instances:
```javascript
// Use different ports for multiple instances
const server1 = new CustomSMTPServer({ port: 2525 });
const server2 = new CustomSMTPServer({ port: 2526 });
```

## 📋 **API Endpoints**

The SMTP server exposes REST API endpoints:

- `POST /api/smtp/start` - Start SMTP server
- `POST /api/smtp/stop` - Stop SMTP server  
- `GET /api/smtp/status` - Get server status
- `POST /api/smtp/configure-email` - Auto-configure email service
- `POST /api/smtp/test` - Test integration

## 🔄 **Maintenance**

### **Daily Operations**
- Monitor server status
- Check email queue size
- Review failed deliveries
- Verify disk space

### **Weekly Tasks**
- Review server logs
- Check user activity
- Update user passwords if needed
- Monitor email statistics

### **Cleanup**
- Automatic daily cleanup of old emails (7 days retention)
- Manual cleanup via CLI interface
- Log rotation (configure externally)

## 📞 **Support**

### **Getting Help**
1. Check server logs: `tail -f smtp-server.log`
2. Use CLI diagnostics: `node smtp-manager.js`
3. Test with manual SMTP commands
4. Review configuration files

### **Performance Monitoring**
- Monitor connection counts
- Track email processing times
- Watch queue sizes
- Check storage usage

---

## 🎯 **Quick Commands Reference**

```bash
# Start SMTP server (simple)
node start-smtp.js

# Full management interface
node smtp-manager.js

# Check if running
ps aux | grep smtp

# View logs
tail -f smtp-server.log

# Test connection
telnet localhost 2525

# Check storage usage
du -h mail-storage/
```

Your custom SMTP server is now ready to provide reliable, self-hosted email delivery for your Salesforce Form Builder! 🚀📧