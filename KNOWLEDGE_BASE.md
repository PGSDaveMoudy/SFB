# SFB (Salesforce Form Builder) - Complete Knowledge Base

## Table of Contents
1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Backend Services](#backend-services)
4. [Frontend Components](#frontend-components)
5. [Database Schema](#database-schema)
6. [Authentication & Security](#authentication--security)
7. [Salesforce Integration](#salesforce-integration)
8. [Deployment & Configuration](#deployment--configuration)
9. [Developer Guide](#developer-guide)
10. [API Reference](#api-reference)

---

## System Overview

### What is SFB?
SFB (Salesforce Form Builder), branded as **PilotForms**, is an enterprise-grade form building platform that integrates seamlessly with Salesforce CRM systems. It provides a drag-and-drop interface for creating sophisticated multi-page forms with advanced features.

### Key Features
- **Visual Form Builder**: WYSIWYG drag-and-drop interface
- **Multi-Page Forms**: Complex form flows with conditional navigation
- **E-Signatures**: Legally compliant electronic signature capture
- **Salesforce Integration**: Direct record creation and updates
- **Multi-Organization Support**: Connect multiple Salesforce orgs
- **Auto-Save**: Automatic progress preservation
- **Mobile Responsive**: Optimized for all devices
- **Advanced Field Types**: 15+ field types including lookups and datatables
- **Conditional Logic**: Show/hide fields and pages based on conditions
- **Email Verification**: OTP-based user verification

### Technology Stack
- **Backend**: Node.js, Express.js, Sequelize ORM
- **Database**: SQLite (production-ready)
- **Frontend**: Vanilla JavaScript (ES6 modules), CSS3
- **Email**: Nodemailer, SendGrid integration
- **Process Manager**: PM2 for production
- **Security**: JWT, bcrypt, AES-256-GCM encryption

---

## Architecture

### System Architecture
```
┌─────────────────────────────────────────────────┐
│                   Frontend                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │  Form    │ │  Form    │ │   Admin      │    │
│  │ Builder  │ │  Viewer  │ │  Dashboard   │    │
│  └──────────┘ └──────────┘ └──────────────┘    │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              Backend (Node.js)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │   API    │ │  Auth    │ │  Salesforce  │    │
│  │ Endpoints│ │  System  │ │  Connector   │    │
│  └──────────┘ └──────────┘ └──────────────┘    │
└─────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│          Database (SQLite/Sequelize)             │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │  Users   │ │  Forms   │ │ Submissions  │    │
│  └──────────┘ └──────────┘ └──────────────┘    │
└─────────────────────────────────────────────────┘
```

### Module Architecture (Frontend)
```javascript
window.AppModules = {
    formBuilder,      // Core form building logic
    salesforce,       // Salesforce API integration
    fieldTypes,       // Field rendering engine
    dragDrop,         // Drag & drop interactions
    conditionalLogic, // Visibility logic engine
    formStorage,      // Form persistence layer
    autoSave,         // Auto-save functionality
    signature,        // E-signature handling
    multiPage,        // Multi-page navigation
    flowLogic,        // Advanced form flows
    mobile           // Mobile optimizations
}
```

---

## Backend Services

### Core Server (server.js)

#### Server Configuration
- **Port**: 8443 (internal), 443 (public via proxy)
- **Security**: Helmet.js, CORS, rate limiting
- **Session**: Express-session with Sequelize store
- **File Upload**: Multer with 10MB limit

#### Middleware Stack
```javascript
app.use(helmet())                    // Security headers
app.use(cors())                      // CORS configuration
app.use(express.json())              // JSON parsing
app.use(session())                   // Session management
app.use(rateLimiter)                 // Rate limiting
app.use(authenticateJWT)             // JWT authentication
```

### API Endpoints

#### Authentication Endpoints
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/auth/register` | User registration | No |
| POST | `/api/auth/login` | User login | No |
| GET | `/api/auth/me` | Get current user | JWT |
| POST | `/api/auth/logout` | User logout | JWT |
| POST | `/api/send-otp` | Send OTP email | No |
| POST | `/api/verify-otp` | Verify OTP code | No |

#### Organization Management
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/orgs` | List user organizations | JWT |
| POST | `/api/orgs/register` | Register new org | JWT |
| DELETE | `/api/orgs/:id` | Remove organization | JWT |
| GET | `/api/orgs/:id/select` | Select active org | JWT |

#### Salesforce Integration
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/salesforce/connect` | OAuth initiation | Session |
| GET | `/oauth/callback` | OAuth callback | Session |
| GET | `/api/salesforce/objects` | Get SF objects | Session |
| GET | `/api/salesforce/objects/:name/fields` | Get object fields | Session |
| POST | `/api/salesforce/lookup` | Perform lookup | Session |
| GET | `/api/salesforce/picklist-values` | Get picklist values | Session |

#### Form Management
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| GET | `/api/forms` | List forms | Session |
| POST | `/api/save-form` | Save form config | Session |
| GET | `/api/forms/:id` | Get form config | Optional |
| POST | `/api/forms/:id/publish` | Publish form | Session |
| GET | `/api/forms/:id/export` | Export form JSON | Session |
| POST | `/api/forms/:id/submit` | Submit form data | No |

#### File Management
| Method | Endpoint | Purpose | Auth Required |
|--------|----------|---------|---------------|
| POST | `/api/upload` | Upload file | Session |
| GET | `/uploads/:filename` | Retrieve file | No |

### Email Service

#### Configuration Options
```javascript
// Gmail SMTP
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=app-specific-password

// SendGrid API
SENDGRID_API_KEY=your-api-key
EMAIL_FROM_ADDRESS=noreply@domain.com

// Custom SMTP
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
```

#### OTP System
- **Code Generation**: 6-digit random numbers
- **Expiration**: 10 minutes
- **Rate Limiting**: 10-second cooldown
- **Storage**: In-memory with cleanup

---

## Frontend Components

### Page Structure

#### Main Application (index.html)
```html
<!-- Mobile Landing (< 1400px width) -->
<div id="mobile-landing">
    <h1>Desktop Access Required</h1>
    <p>Optimal experience at 1400px+ width</p>
</div>

<!-- Desktop Application -->
<div id="app-shell">
    <!-- Left Panel: Field Palette -->
    <div id="left-panel"></div>
    
    <!-- Center: Form Canvas -->
    <div id="canvas-area"></div>
    
    <!-- Right Panel: Properties -->
    <div id="right-panel"></div>
    
    <!-- FAB Menu -->
    <div id="actions-button"></div>
</div>
```

### Module System

#### FormBuilder Module
**Purpose**: Core form building functionality
```javascript
// Key Methods
renderFormCanvas()           // Render form structure
addField(fieldType)         // Add new field
selectField(fieldElement)   // Select for editing
deleteField(fieldId)        // Remove field
updateFieldProperty()       // Update field config
```

#### FieldTypes Module
**Supported Field Types**:
```javascript
const fieldTypes = {
    // Basic inputs
    text, email, phone, number, date, textarea,
    
    // Selection
    select, radio, checkbox,
    
    // Advanced
    lookup,           // Salesforce record lookup
    richtext,         // WYSIWYG editor
    signature,        // E-signature capture
    file,            // File upload
    datatable,       // Spreadsheet input
    
    // Special
    login,           // Authentication
    'email-verify',  // OTP verification
    display,         // Read-only text
    section,         // Container
    columns          // Multi-column layout
}
```

#### DragDrop Module
**Drag & Drop System**:
```javascript
// Drag sources
setupFieldPalette()         // Initialize draggable fields
handlePaletteDragStart()   // Start drag from palette

// Drop targets
setupDropZones()           // Initialize drop areas
handleCanvasDrop()         // Handle field drops
handleFieldReorder()       // Reorder existing fields
```

#### ConditionalLogic Module
**Visibility Engine**:
```javascript
// Condition evaluation
evaluateCondition(condition, formData)
evaluateAllConditions()
updateFieldVisibility(fieldId, visible)
updatePageVisibility(pageId, visible)

// Variable management
setVariable(name, value)
getVariable(name)
getAllVariables()
```

### UI Components

#### Modal System
```javascript
// Available modals
showIntroModal()           // Welcome/onboarding
showOrgManagerModal()      // Multi-org management
showVariablesModal()       // Variable manager
showPreviewModal()         // Form preview
showPublishModal()         // Publishing workflow
```

#### Toast Notifications
```javascript
showToast(message, type)   // type: 'success' | 'error' | 'info'
```

#### Theme System
```javascript
// Light/Dark mode
toggleTheme()
loadThemePreference()
saveThemePreference()
```

---

## Database Schema

### Tables and Models

#### Users Table
```sql
CREATE TABLE Users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,  -- bcrypt hashed
    firstName VARCHAR(100),
    lastName VARCHAR(100),
    isActive BOOLEAN DEFAULT true,
    emailVerified BOOLEAN DEFAULT false,
    lastLoginAt DATETIME,
    createdAt DATETIME,
    updatedAt DATETIME
);
```

#### SalesforceOrgs Table
```sql
CREATE TABLE SalesforceOrgs (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    orgId VARCHAR(255),
    clientId VARCHAR(255) NOT NULL,
    clientSecret TEXT,  -- AES-256-GCM encrypted
    loginUrl VARCHAR(255),
    environment VARCHAR(50),  -- 'production' | 'sandbox'
    isActive BOOLEAN DEFAULT true,
    createdAt DATETIME,
    updatedAt DATETIME
);
```

#### UserOrgAccess Table
```sql
CREATE TABLE UserOrgAccess (
    id UUID PRIMARY KEY,
    userId UUID REFERENCES Users(id),
    orgId UUID REFERENCES SalesforceOrgs(id),
    accessToken TEXT,    -- AES-256-GCM encrypted
    refreshToken TEXT,   -- AES-256-GCM encrypted
    instanceUrl VARCHAR(255),
    permissions JSON,
    expiresAt DATETIME,
    createdAt DATETIME,
    updatedAt DATETIME
);
```

#### FormSubmissions Table
```sql
CREATE TABLE FormSubmissions (
    id UUID PRIMARY KEY,
    formId VARCHAR(255),
    submissionData JSON,
    salesforceRecordId VARCHAR(255),
    status VARCHAR(50),  -- 'pending' | 'completed' | 'failed'
    submittedBy VARCHAR(255),
    ipAddress VARCHAR(45),
    userAgent TEXT,
    createdAt DATETIME,
    updatedAt DATETIME
);
```

### Encryption Strategy
```javascript
// AES-256-GCM encryption for sensitive data
const algorithm = 'aes-256-gcm';
const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

// Encrypted fields:
// - SalesforceOrgs.clientSecret
// - UserOrgAccess.accessToken
// - UserOrgAccess.refreshToken
```

---

## Authentication & Security

### Authentication Methods

#### JWT Authentication
```javascript
// Token generation
const token = jwt.sign(
    { userId, email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
);

// Token verification
jwt.verify(token, process.env.JWT_SECRET);
```

#### Session Authentication
```javascript
// Session configuration
session({
    secret: process.env.SESSION_SECRET,
    store: new SequelizeStore({ db: sequelize }),
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true,  // HTTPS only in production
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
    }
})
```

### Security Features

#### Password Security
- **Hashing**: bcrypt with salt rounds
- **Complexity**: Minimum 6 characters
- **Storage**: Never stored in plain text

#### API Security
- **Rate Limiting**: 5000 requests per 15 minutes
- **CORS**: Configured for specific origins
- **HTTPS**: Enforced in production
- **CSP**: Content Security Policy headers

#### Data Encryption
- **Algorithm**: AES-256-GCM
- **Key Management**: Environment variable storage
- **Encrypted Fields**: OAuth tokens, client secrets

---

## Salesforce Integration

### OAuth 2.1 Implementation

#### OAuth Flow
```javascript
// 1. Authorization request
GET /api/salesforce/connect
→ Redirect to Salesforce login

// 2. Authorization callback
GET /oauth/callback?code=xxx&state=xxx
→ Exchange code for tokens

// 3. Token storage
Encrypted storage in UserOrgAccess table
```

#### PKCE Support
```javascript
// Code verifier and challenge generation
const codeVerifier = generateRandomString(128);
const codeChallenge = base64url(sha256(codeVerifier));
```

### Salesforce APIs

#### Object Metadata
```javascript
// Get available objects
connection.describeGlobal()

// Get object fields
connection.sobject(objectName).describe()
```

#### Record Operations
```javascript
// Create record
connection.sobject(objectName).create(data)

// Update record
connection.sobject(objectName).update({ Id, ...data })

// Query records
connection.query(`SELECT ${fields} FROM ${object} WHERE ${conditions}`)
```

#### Lookup Functionality
```javascript
// Search records
const query = `
    SELECT Id, Name 
    FROM ${objectType} 
    WHERE Name LIKE '%${searchTerm}%' 
    LIMIT 10
`;
connection.query(query);
```

---

## Deployment & Configuration

### Environment Variables
```bash
# Required Environment Variables
ENCRYPTION_KEY=64-character-hex-key      # Critical for data encryption
JWT_SECRET=random-secret-key             # JWT token signing
SESSION_SECRET=random-session-key        # Session encryption
PORT=8443                                 # Application port
DOMAIN=your-domain.com                   # Production domain

# Salesforce Configuration
SALESFORCE_CLIENT_ID=your-consumer-key
SALESFORCE_CLIENT_SECRET=your-consumer-secret

# Email Configuration (choose one)
# Option 1: Gmail
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=app-specific-password

# Option 2: SendGrid
SENDGRID_API_KEY=your-api-key
EMAIL_FROM_ADDRESS=noreply@domain.com

# Option 3: Custom SMTP
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=smtp-username
EMAIL_PASS=smtp-password
```

### Production Deployment

#### Using Deploy Script
```bash
# Automated deployment
sudo ./deploy-production.sh

# What it does:
# 1. Installs system dependencies
# 2. Configures Nginx reverse proxy
# 3. Sets up SSL certificates
# 4. Configures email system
# 5. Starts application with PM2
```

#### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
    apps: [{
        name: 'sfb-prod',
        script: './server.js',
        instances: 4,
        exec_mode: 'cluster',
        max_memory_restart: '2G',
        env: {
            NODE_ENV: 'production',
            PORT: 8443
        }
    }]
};
```

#### Nginx Configuration
```nginx
server {
    listen 443 ssl http2;
    server_name pilotforms.com;

    location / {
        proxy_pass http://localhost:8443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Monitoring & Maintenance

#### Health Checks
```bash
# Application status
pm2 status

# Application logs
pm2 logs sfb-prod

# System resources
pm2 monit
```

#### Log Management
```bash
# Application logs
/root/.pm2/logs/sfb-prod-out.log
/root/.pm2/logs/sfb-prod-error.log

# Nginx logs
/var/log/nginx/access.log
/var/log/nginx/error.log

# Email logs
/var/log/mail.log
```

---

## Developer Guide

### Setting Up Development Environment

#### Prerequisites
```bash
# Node.js 14+ and npm 6+
node --version
npm --version

# Git for version control
git --version
```

#### Installation
```bash
# Clone repository
git clone https://github.com/your-repo/sfb.git
cd sfb

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### Code Organization

#### Directory Structure
```
SFB/
├── server.js              # Main server file
├── database.js            # Database models
├── emailService.js        # Email functionality
├── public/               # Frontend files
│   ├── index.html        # Main app
│   ├── login.html        # Authentication
│   ├── form-viewer.html  # Public forms
│   ├── js/              # JavaScript
│   │   ├── main.js      # App bootstrap
│   │   └── modules/     # ES6 modules
│   └── styles/          # CSS files
├── data/                # JSON storage
├── uploads/            # File uploads
└── package.json        # Dependencies
```

### Adding New Features

#### Adding a New Field Type
```javascript
// 1. Add to fieldTypes.js
renderNewFieldType(field) {
    const element = document.createElement('div');
    // Implementation
    return element;
}

// 2. Add to field palette
const fieldTypeConfig = {
    type: 'newfield',
    label: 'New Field',
    icon: '📝'
};

// 3. Add properties panel configuration
const properties = {
    basic: ['label', 'placeholder'],
    validation: ['required', 'pattern'],
    advanced: ['customOption']
};
```

#### Adding a New API Endpoint
```javascript
// In server.js
app.post('/api/new-endpoint', authenticateJWT, async (req, res) => {
    try {
        // Validation
        const { param } = req.body;
        if (!param) {
            return res.status(400).json({ error: 'Missing parameter' });
        }
        
        // Business logic
        const result = await processRequest(param);
        
        // Response
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

### Testing

#### Test Files
```
test-*.js files for various features:
- test-email-verify-api.js
- test-conditional-visibility.js
- test-mobile.js
- test-otp-flow-debug.js
```

#### Running Tests
```bash
# Run specific test
node test-email-verify-api.js

# Test email functionality
node test-real-email.js
```

### Debugging

#### Debug Mode
```javascript
// Enable debug logging
window.DEBUG = true;

// Debug specific modules
window.DEBUG_CONDITIONAL = true;
window.DEBUG_SALESFORCE = true;
```

#### Browser Console Commands
```javascript
// Access modules
window.AppModules.formBuilder

// Check form state
window.formConfig

// View variables
window.formVariables

// Trigger actions
window.AppModules.formBuilder.saveForm()
```

### Common Tasks

#### Updating Salesforce Credentials
```javascript
// 1. Update in .env file
SALESFORCE_CLIENT_ID=new-id
SALESFORCE_CLIENT_SECRET=new-secret

// 2. Restart server
pm2 restart sfb-prod
```

#### Database Migrations
```javascript
// Run migrations
node -e "require('./database').initialize()"

// Reset database (WARNING: Deletes all data)
rm salesforce-form-builder.db
node -e "require('./database').initialize()"
```

#### Clearing Cache
```bash
# Clear PM2 logs
pm2 flush

# Clear uploads
rm -rf uploads/*

# Clear form data
rm data/forms.json data/submissions.json
```

---

## API Reference

### Form Configuration Object
```javascript
{
    id: "unique-form-id",
    title: "Form Title",
    description: "Form description",
    salesforceObject: "Contact",
    submitButtonText: "Submit",
    successMessage: "Thank you!",
    pages: [
        {
            id: "page-1",
            title: "Page 1",
            salesforceObject: "Contact",
            fields: [
                {
                    id: "field-1",
                    type: "text",
                    label: "First Name",
                    required: true,
                    salesforceField: "FirstName"
                }
            ],
            conditionalVisibility: {
                enabled: false,
                conditions: []
            }
        }
    ],
    styling: {
        primaryColor: "#007bff",
        fontFamily: "Arial, sans-serif"
    }
}
```

### Form Submission Object
```javascript
{
    formId: "form-id",
    data: {
        "field-1": "value1",
        "field-2": "value2"
    },
    metadata: {
        submittedAt: "2025-01-01T00:00:00Z",
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0..."
    }
}
```

### Salesforce Record Creation
```javascript
// Request
POST /api/forms/:id/submit
{
    formData: {
        FirstName: "John",
        LastName: "Doe",
        Email: "john@example.com"
    }
}

// Response
{
    success: true,
    recordId: "003xx000000000",
    message: "Record created successfully"
}
```

### Error Response Format
```javascript
{
    error: true,
    message: "Human-readable error message",
    code: "ERROR_CODE",
    details: {}  // Optional additional information
}
```

---

## Troubleshooting

### Common Issues

#### Form Not Loading
```javascript
// Check console for errors
// Verify form ID in URL
// Check network tab for 404 errors
// Ensure user has permission to view form
```

#### Salesforce Connection Failed
```javascript
// Verify OAuth credentials in .env
// Check redirect URI matches Salesforce app
// Ensure user has API access in Salesforce
// Try reconnecting via org manager
```

#### Email Not Sending
```javascript
// Check email configuration in .env
// Verify SMTP credentials
// Check spam folder
// Review email logs: /var/log/mail.log
```

#### File Upload Issues
```javascript
// Check file size (max 10MB)
// Verify allowed file types
// Check uploads directory permissions
// Review server logs for errors
```

### Performance Optimization

#### Database Queries
```javascript
// Use indexed fields for queries
// Implement pagination for large datasets
// Cache frequently accessed data
// Use connection pooling
```

#### Frontend Performance
```javascript
// Minimize DOM manipulations
// Debounce user input events
// Lazy load non-critical resources
// Use CSS transforms for animations
```

---

## Best Practices

### Security
- Always use HTTPS in production
- Keep dependencies updated
- Validate all user input
- Use parameterized queries
- Implement rate limiting
- Regular security audits

### Code Quality
- Follow ES6 module pattern
- Use meaningful variable names
- Comment complex logic
- Handle errors gracefully
- Write unit tests
- Document API changes

### Performance
- Optimize database queries
- Implement caching strategies
- Use CDN for static assets
- Enable gzip compression
- Monitor memory usage
- Regular performance profiling

### User Experience
- Provide clear error messages
- Show loading indicators
- Implement auto-save
- Support keyboard navigation
- Ensure mobile responsiveness
- Test across browsers

---

## Support & Resources

### Documentation
- README.md - Quick start guide
- CLAUDE.md - AI assistant instructions
- Developer.html - Function reference

### Community
- GitHub Issues: Report bugs and request features
- GitHub Discussions: Ask questions and share ideas

### Version History
- v1.0.0 - Initial release with core features
- Latest updates: January 2025

---

*This knowledge base represents the complete technical documentation for the SFB (Salesforce Form Builder) system. It serves as a comprehensive reference for developers, administrators, and users working with the platform.*