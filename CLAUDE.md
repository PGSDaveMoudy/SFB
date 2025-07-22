# Salesforce Form Builder - Complete Implementation Guide

## 🔄 Version Control Instructions

**IMPORTANT**: This project uses Git version control. Before making any changes:

1. **Pull Latest Changes**: Always pull the latest code before starting work
   ```bash
   git pull origin main
   ```

2. **Make Your Changes**: Edit files as needed

3. **Commit Changes**: After making changes, commit them with a descriptive message
   ```bash
   git add .
   git commit -m "Description of changes made"
   ```

4. **Push Changes**: Push your commits to GitHub
   ```bash
   git push origin main
   ```

5. **Handle Conflicts**: If there are conflicts, resolve them before pushing

**Repository**: https://github.com/PGSDaveMoudy/SFB

## Overview
A production-ready, full-stack web application that creates custom forms with advanced drag-and-drop functionality, seamless Salesforce integration, and a modern interface. Features include conditional field visibility, real-time Salesforce picklist sync, lookup fields with advanced filtering, comprehensive form management, enterprise-grade electronic signature capabilities, and robust page reordering functionality.

## Server Configuration
- **Domain**: www.portwoodglobalsolutions.com (clean URLs, no ports)
- **IP Address**: 159.196.64.152
- **Hostname**: server1.portwoodglobalsolutions.com
- **Platform**: Ubuntu with Webuzo
- **Reverse Proxy**: Nginx with SSL termination
- **Application Port**: 8443 (internal), 443 (public via proxy)

## Salesforce Configuration
- **Consumer Key**: [REMOVED - See environment variables]
- **Consumer Secret**: [REMOVED - See environment variables]
- **OAuth Redirect URI**: https://www.portwoodglobalsolutions.com/oauth/callback
- **Authentication**: PKCE-enabled OAuth 2.1 with fallback to username/password

## 🚀 Latest Features (January 2025)

### 🔧 **Variables Management System (NEW)**
- **Centralized Variables Manager Modal** accessible via "🔧 Variables" button
- **Real-time Variable Monitoring** with type detection and visual formatting
- **Manual Variable Creation** with JSON parsing support
- **Export/Import Functionality** for backup and debugging
- **Debug Tools** including console logging and variable inspection
- **Professional UI** with organized sections and modern styling

#### Variables Manager Features:
- **📊 Current Variables** - Live display of all active variables with types
- **➕ Add New Variable** - Manual variable creation with value parsing
- **📝 Variable Sources** - Info about automatic variable sources (Login, Lookup, etc.)
- **🛠️ Debug Actions** - Console logging, JSON export, and clear all functions

### 🔐 **Login Building Block Conditional Visibility (NEW)**
- **Fixed Login Variable Integration** - Login variables now properly show in conditional visibility dropdowns
- **Automatic Properties Refresh** - Form builder updates when Login variables are set
- **Quick Setup Buttons** - One-click "🔐 Require Login" buttons for Next/Submit buttons
- **Real-time Integration** - Navigation buttons update immediately after login

#### Available Login Variables:
- **`isLoggedIn`** - Set to "true" after successful authentication
- **`loggedIn`** - Alternative login status variable
- **`userEmail`** - Contains authenticated user's email
- **`userName`** - Contains contact's name or email
- **Custom Variables** - Any variables configured in Login field settings

### 📝 **Smart Dropdown Enhancements (NEW)**
- **RecordId Variable Picklist** - Update Existing Record now uses smart dropdown with available variables
- **Relationship Field Picklist** - Repeat configuration loads Salesforce relationship fields dynamically
- **Dynamic Field Discovery** - Real-time loading of Salesforce fields for configuration
- **Custom Field Creation** - Options to create custom field names when needed

### ⚡ **Performance Optimizations (NEW)**
- **Auto-save Optimization** - Increased from 500ms to 3 seconds to reduce server load
- **Server-friendly Intervals** - Prevents DDOS-like behavior while maintaining data protection
- **Enhanced Logging** - Better debugging output for troubleshooting

### 🛡️ **Enhanced Security & Data Protection (NEW)**
- **Persistent Encryption Key** - Added ENCRYPTION_KEY to prevent org data loss on server restart
- **Disabled Dangerous Cleanup** - Prevented automatic org deletion from encryption errors
- **Enhanced Error Messages** - Clear guidance for configuration issues
- **Secure Org Management** - Better protection against accidental data loss

## Core Features

### 🎨 **Modern Design System**
- **Modern Interface**: Clean, block-based design with professional styling
- **Dual Themes**: Light and dark themes with persistent preference
- **Responsive Grid**: Professional 3-column layout (sidebar, canvas, properties)
- **Micro-animations**: Subtle hover effects and smooth transitions

### 🔧 **Advanced Form Building**
- **WYSIWYG Builder**: Form builder matches exact appearance of published forms
- **Drag-and-Drop Reordering**: Both fields and pages can be reordered by dragging
- **Enhanced Field Types**: Text, Email, Phone, Number, Date, Select, Textarea, Checkbox, Radio, Lookup, Rich Text, Display Text, File Upload, E-Signature, Login, Email Verify
- **Rich Text Editor**: Full Quill.js integration with formatting, links, and images
- **File Upload**: Direct file attachment to Salesforce records with preview
- **Conditional Visibility**: Smart show/hide logic with global variable support
- **Real-time Preview**: Live form preview with working conditional logic

### 🔄 **Advanced Workflow Features**
- **Page Conditional Visibility**: Show/hide entire pages based on field values
- **Repeat Page Functionality**: Multiple instances of pages for creating multiple related records
- **Smart Navigation**: Intelligent page flow that skips hidden pages automatically
- **Navigation Button Controls**: Per-page Next and Submit button conditional visibility
- **Variable Management**: Global variable system for cross-page data sharing
- **Login Building Block**: Email-based contact lookup with OTP verification

### 📧 **Email Service Integration**
- **Production Email Sending**: Real OTP delivery via SMTP/SendGrid
- **Multiple Provider Support**: Gmail, SendGrid, custom SMTP servers
- **Professional Email Templates**: HTML/text templates with company branding
- **Demo Mode Fallback**: Automatic fallback if email not configured
- **Security Features**: 10-minute OTP expiration, rate limiting, session management

### 🛡️ **Enterprise E-Signature System**
- **Legally Compliant E-Signatures**: Full ESIGN Act and UETA compliant
- **Digital Audit Trails**: Complete signing history with timestamps and geolocation
- **Canvas-based Capture**: Touch and mouse-friendly signature pads
- **Advanced Configuration**: Customizable legal text, colors, sizing
- **Mobile-Optimized**: Responsive signature capture for all devices

### 🏢 **Multi-Org SaaS Architecture**
- **Complete Multi-Tenant Platform**: Support for ANY Salesforce organization
- **Database-Driven Management**: SQLite database with encrypted credential storage
- **Session-Based Security**: Independent user workspaces per browser session
- **Dynamic OAuth Integration**: Org-specific authentication with PKCE security
- **Management Dashboard**: Complete org registration and management interface

## Technical Architecture

### 🏗️ **Modular JavaScript Architecture**
- **ES6 Modules**: Clean separation with modern module system
- **Module Communication**: Centralized `window.AppModules` for cross-module access
- **Event-Driven**: Custom events for module communication and state updates
- **Error Handling**: Comprehensive error handling and user feedback

### 📊 **State Management**
- **Global Variables**: Universal variable system accessible across all modules
- **Form State**: Complete form configuration persistence
- **Navigation State**: Smart tracking of user navigation history
- **Auto-Save State**: Intelligent form data preservation with 3-second debounce
- **Conditional State**: Real-time evaluation of visibility conditions

## Environment Configuration

### Required Environment Variables
```bash
# Encryption Key for Multi-Org Database (CRITICAL)
ENCRYPTION_KEY=your-64-character-hex-key-here

# Salesforce Configuration
SALESFORCE_CLIENT_ID=your-salesforce-consumer-key
SALESFORCE_CLIENT_SECRET=your-salesforce-consumer-secret

# Server Configuration
PORT=8080
DOMAIN=your-domain.com
SESSION_SECRET=your-session-secret

# Email Configuration (Choose one)
# Gmail SMTP
EMAIL_SERVICE=gmail
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASS=your-app-password

# OR SendGrid API
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM_ADDRESS=noreply@yourdomain.com
```

## Key Improvements (2025)

### **Enhanced User Experience**
- Smart dropdowns replace manual text entry
- Real-time field discovery from Salesforce
- Comprehensive variable management with visual feedback
- Professional UI with organized sections and clear labeling
- One-click setup for common scenarios (like requiring login)

### **Improved Performance**
- Optimized auto-save reduces server load by 6x
- Efficient variable management with smart caching
- Reduced API calls through better state management
- Enhanced logging for troubleshooting

### **Better Security**
- Persistent encryption key ensures data survives server restarts
- Better error handling prevents accidental data deletion
- Clear warnings and documentation for critical configuration
- Enhanced org protection mechanisms

### **Developer Experience**
- Enhanced debugging tools for variables and conditions
- Better error messages with actionable guidance
- Consolidated code with reduced duplication
- Comprehensive logging system

## Usage Instructions

### **Setting Up Login-Required Navigation**
1. **Quick Method**: Click "🔐 Require Login" buttons in Navigation Button Controls
2. **Manual Method**: Add condition where `isLoggedIn` equals `true`

### **Managing Variables**
1. Click "🔧 Variables" button to open Variables Manager
2. View all current variables with their types and values
3. Add new variables manually or let Login/Lookup fields create them automatically
4. Export variables for debugging or backup

### **Configuring Relationship Fields**
1. Select Salesforce object for your page
2. Enable repeat functionality
3. Choose relationship field from dynamically loaded dropdown
4. Or create custom relationship field if needed

---

## 📚 Developer Documentation

**Complete Function Library**: For comprehensive developer documentation with 300+ functions across 13 modules, see `Developer.html`

### Quick Function Reference

#### Core Modules & Key Functions
- **Main App**: `initializeApp()`, `connectToSalesforce()`, `registerOrganization()`
- **Form Builder**: `newForm()`, `addField()`, `renderFormCanvas()`, `saveForm()`
- **Field Types**: `renderField()`, `renderColumnsField()`, `renderSignatureField()`
- **Drag & Drop**: `setupFieldPalette()`, `handleContainerDrop()`, `setupTouchEvents()`
- **Form Storage**: `saveForm()`, `publishForm()`, `exportForm()`, `loadSubmissions()`
- **Conditional Logic**: `evaluateAllConditions()`, `addCondition()`, `updateFieldVisibility()`
- **Salesforce Connector**: `connectWithOAuth()`, `createRecord()`, `performLookup()`
- **Auto Save**: `scheduleAutoSave()`, `detectCrashRecovery()`, `saveUserData()`
- **Signature**: `initializeSignaturePad()`, `generateAuditTrail()`, `finalizeSignature()`
- **Multi Page**: `nextPage()`, `addRepeatInstance()`, `validateCurrentPage()`
- **Flow Logic**: `performEmailLookup()`, `sendOTPEmail()`, `handleSuccessfulOTPVerification()`
- **Mobile**: `setupSwipeGestures()`, `toggleMobileMode()`, `optimizeModalForMobile()`

#### Architecture Patterns
- **Module System**: ES6 modules with `window.AppModules` registry
- **Event-Driven**: Custom events for module communication
- **State Management**: Global variables + form-specific state
- **Error Handling**: Comprehensive try-catch with user feedback
- **Security**: OAuth 2.1 + PKCE, encrypted credential storage

#### API Endpoints (Server-side)
- `POST /api/save-form` - Save form configuration
- `POST /api/forms/:id/publish` - Publish form for public access  
- `GET /api/forms/:id/export` - Export form as JSON
- `POST /api/forms/:id/submit` - Submit form data to Salesforce
- `GET /api/salesforce/objects` - Get Salesforce object metadata
- `POST /api/salesforce/records` - Create Salesforce records
- `GET /api/salesforce/lookup` - Perform lookup searches

---

**This documentation represents the current state of the Salesforce Form Builder as of January 2025.**