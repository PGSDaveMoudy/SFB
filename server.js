

require('dotenv').config();
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const SequelizeStore = require('connect-session-sequelize')(session.Store);
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const jsforce = require('jsforce');
const jwt = require('jsonwebtoken');
const emailService = require('./emailService');
const { DatabaseManager, User, SalesforceOrg, UserOrgAccess, FormSubmission, sequelize } = require('./database');

// JWT secret key (should be in environment variable)
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

// Middleware to check if user is authenticated with JWT
const authenticateJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
        const token = authHeader.split(' ')[1]; // Bearer <token>
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = await DatabaseManager.getUserById(decoded.userId);
            if (req.user) {
                next();
            } else {
                res.status(401).json({ message: 'User not found' });
            }
        } catch (error) {
            res.status(403).json({ message: 'Invalid token' });
        }
    } else if (req.session.salesforceConnection && req.session.userInfo) {
        // Fallback to session authentication for backward compatibility
        next();
    } else {
        res.status(401).json({ message: 'Unauthorized: Please login or connect to Salesforce.' });
    }
};

// Old middleware for backward compatibility
const isAuthenticated = (req, res, next) => {
    if (req.session.salesforceConnection && req.session.userInfo) {
        next();
    } else {
        res.status(401).json({ message: 'Unauthorized: Please connect to Salesforce.' });
    }
};

// Initialize Express app
const app = express();

// Initialize database
(async () => {
    const dbInitialized = await DatabaseManager.initialize();
    if (!dbInitialized) {
        console.error('Failed to initialize database. Exiting...');
        process.exit(1);
    }
    
    try {
        const cleanedCount = await DatabaseManager.cleanupCorruptedOrgs();
        if (cleanedCount > 0) {
            console.log(`✅ Cleaned up ${cleanedCount} corrupted organizations`);
        }
    } catch (error) {
        console.error('Error cleaning up corrupted orgs:', error);
    }
})();

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'", "https:"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.quilljs.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "https://cdn.quilljs.com", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://login.salesforce.com", "https://test.salesforce.com", "*.force.com", "*.salesforce.com", "wss://*.salesforce.com"],
            frameSrc: ["'self'", "https://*.salesforce.com"],
            frameAncestors: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
        },
    },
    hsts: false, // Let Nginx handle HSTS to avoid duplication
    xssFilter: true,
    noSniff: true,
    frameguard: { action: 'sameorigin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

app.use(cors({
    origin: process.env.DOMAIN ? `https://${process.env.DOMAIN}` : '*',
    credentials: true
}));

// Additional security headers
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

// Trust proxy for rate limiting (behind nginx) - configured properly for security
app.set('trust proxy', 1); // Trust first proxy (nginx)

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Session configuration for multi-user support
const sessionStore = new SequelizeStore({
    db: sequelize,
    tableName: 'Sessions', // Optional: define a custom table name
});

app.use(session({
    secret: process.env.SESSION_SECRET || 'sfb-session-secret-key',
    resave: false,
    saveUninitialized: true, // Changed to true to persist sessions
    store: sessionStore,
    cookie: {
        secure: process.env.NODE_ENV === 'production' || process.env.HTTPS_ENABLED === 'true', // HTTPS only in production or when HTTPS enabled
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours for better session management
        sameSite: 'lax' // Less restrictive to allow OAuth redirects
    },
    name: 'sfb_session'
}));

sessionStore.sync(); // Sync the session store to create the table

// Middleware to ensure persistent user ID and session debugging
app.use((req, res, next) => {
    if (!req.session.userId) {
        // Generate a persistent user ID if not exists
        req.session.userId = 'user_' + crypto.randomBytes(16).toString('hex');
        console.log('Generated new persistent userId:', req.session.userId);
    }
    
    // Debug session state for important endpoints
    if (req.path.includes('/api/orgs') || req.path.includes('/oauth')) {
        console.log(`Session Debug [${req.method} ${req.path}]:`, {
            sessionId: req.sessionID,
            userId: req.session.userId,
            currentOrgId: req.session.currentOrgId,
            hasSalesforceConnection: !!req.session.salesforceConnection,
            hasUserInfo: !!req.session.userInfo
        });
    }
    
    next();
});

// Rate limiting with proper trust proxy configuration
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    trustProxy: true // Use X-Forwarded-For header from nginx
});
app.use('/api/', limiter);

// File upload configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = process.env.UPLOAD_DIR || './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
    },
    fileFilter: function (req, file, cb) {
        // Allow common document types
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|csv/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only documents and images are allowed.'));
        }
    }
});

// Static files with proper MIME types
app.use(express.static('public', {
    setHeaders: (res, p) => {
        if (p.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        } else if (p.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
    }
}));

// Database setup (JSON file storage for forms)
const dataDir = './data';
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Session-based Salesforce connections (no global pool needed)
// Each user's connection will be stored in their session

// Helper function to get Salesforce connection from session with automatic token refresh
function getSalesforceConnection(req) {
    console.log('getSalesforceConnection called. Session salesforceConnection:', req.session.salesforceConnection ? 'EXISTS' : 'DOES NOT EXIST');
    if (!req.session.salesforceConnection) {
        console.log('  No salesforceConnection found in session.');
        return null;
    }
    
    const sessionData = req.session.salesforceConnection;
    console.log('  Session data for salesforceConnection:', sessionData);
    
    try {
        const conn = new jsforce.Connection({
            instanceUrl: sessionData.instanceUrl,
            accessToken: sessionData.accessToken,
            refreshToken: sessionData.refreshToken,
            oauth2: {
                clientId: process.env.SALESFORCE_CLIENT_ID,
                clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
                redirectUri: `https://${process.env.DOMAIN}/oauth/callback`
            }
        });
        
        // Set up automatic token refresh
        conn.on('refresh', (accessToken, res) => {
            console.log('Token refreshed successfully. New access token received.');
            // Update session with new access token
            req.session.salesforceConnection.accessToken = accessToken;
            req.session.save((err) => {
                if (err) {
                    console.error('Error saving refreshed token to session:', err);
                } else {
                    console.log('Refreshed token saved to session successfully.');
                }
            });
        });
        
        console.log('  jsforce.Connection object created with refresh handler.');
        return conn;
    } catch (error) {
        console.error('Error creating jsforce.Connection from session data:', error);
        return null;
    }
}

// Get Salesforce connection for public forms using creator credentials
function getSalesforceConnectionForForm(formId) {
    try {
        const db = getFormsDB();
        const form = db.forms[formId];
        
        if (!form || !form.creatorConnection) {
            return null;
        }
        
        const creatorData = form.creatorConnection;
        const conn = new jsforce.Connection({
            instanceUrl: creatorData.instanceUrl,
            accessToken: creatorData.accessToken,
            refreshToken: creatorData.refreshToken,
            oauth2: {
                clientId: process.env.SALESFORCE_CLIENT_ID,
                clientSecret: process.env.SALESFORCE_CLIENT_SECRET,
                redirectUri: `https://${process.env.DOMAIN}/oauth/callback`
            }
        });
        
        // Set up automatic token refresh for public forms
        conn.on('refresh', (accessToken, res) => {
            console.log('Token refreshed for public form. New access token received.');
            // Update the stored creator connection with new access token
            try {
                const db = getFormsDB();
                if (db.forms[formId] && db.forms[formId].creatorConnection) {
                    db.forms[formId].creatorConnection.accessToken = accessToken;
                    saveFormsDB(db);
                    console.log('Refreshed token saved for public form successfully.');
                }
            } catch (error) {
                console.error('Error saving refreshed token for public form:', error);
            }
        });
        
        return conn;
    } catch (error) {
        console.error('Error getting Salesforce connection for form:', error);
        return null;
    }
}

// Helper functions
function getFormsDB() {
    const dbPath = process.env.DB_PATH || './data/forms.json';
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({ forms: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveFormsDB(data) {
    const dbPath = process.env.DB_PATH || './data/forms.json';
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

// Submissions database functions
function getSubmissionsDB() {
    const dbPath = process.env.SUBMISSIONS_DB_PATH || './data/submissions.json';
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify({ submissions: {} }, null, 2));
    }
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function saveSubmissionsDB(data) {
    const dbPath = process.env.SUBMISSIONS_DB_PATH || './data/submissions.json';
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function recordSubmission(formId, submissionData, salesforceResults = null, files = [], ipAddress = null, userAgent = null) {
    const submissionsDB = getSubmissionsDB();
    const submissionId = uuidv4();
    
    const submission = {
        id: submissionId,
        formId: formId,
        submissionData: submissionData,
        salesforceResults: salesforceResults,
        files: files.map(file => ({
            originalName: file.originalname,
            filename: file.filename,
            size: file.size,
            mimetype: file.mimetype,
            fieldname: file.fieldname
        })),
        submittedAt: new Date().toISOString(),
        ipAddress: ipAddress,
        userAgent: userAgent,
        status: salesforceResults ? 'success' : 'pending'
    };
    
    submissionsDB.submissions[submissionId] = submission;
    saveSubmissionsDB(submissionsDB);
    
    return submission;
}

// User Authentication Routes
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, firstName, lastName } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }
        
        // Check if user already exists
        const existingUser = await DatabaseManager.getUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }
        
        // Create new user
        const user = await DatabaseManager.createUser({
            email: email.toLowerCase(),
            password,
            firstName,
            lastName
        });
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }
        
        // Find user
        const user = await DatabaseManager.getUserByEmail(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Verify password
        const isPasswordValid = await user.verifyPassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        // Update last login
        await DatabaseManager.updateUserLastLogin(user.id);
        
        // Get user's organizations
        const organizations = await DatabaseManager.getUserOrganizations(user.id);
        
        // Generate JWT token
        const token = jwt.sign(
            { userId: user.id, email: user.email },
            JWT_SECRET,
            { expiresIn: '7d' }
        );
        
        // Store user info in session for backward compatibility
        req.session.user = {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
        };
        
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName
            },
            organizations
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
            return res.status(500).json({ success: false, error: 'Logout failed' });
        }
        res.clearCookie('connect.sid');
        res.json({ success: true, message: 'Logged out successfully' });
    });
});

app.get('/api/auth/me', authenticateJWT, async (req, res) => {
    try {
        const user = req.user;
        const organizations = await DatabaseManager.getUserOrganizations(user.id);
        
        res.json({
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName
            },
            organizations
        });
    } catch (error) {
        console.error('Error fetching user info:', error);
        res.status(500).json({ error: error.message });
    }
});

// Salesforce OAuth routes - Updated for multi-org support
app.get('/api/salesforce/auth-url', (req, res) => {
    const loginUrl = req.query.loginUrl || 'https://login.salesforce.com'; // Allow custom login URLs
    const authUrl = `${loginUrl}/services/oauth2/authorize`;
    const redirectUri = `https://${process.env.DOMAIN}/oauth/callback`;
    const state = crypto.randomBytes(16).toString('hex');
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    
    // Store PKCE verifier and login URL in session
    req.session.codeVerifier = codeVerifier;
    req.session.state = state;
    req.session.loginUrl = loginUrl;
    
    const params = new URLSearchParams({
        response_type: 'code',
        client_id: process.env.SALESFORCE_CLIENT_ID,
        redirect_uri: redirectUri,
        state: state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        scope: 'api id web refresh_token'
    });
    
    res.json({ authUrl: `${authUrl}?${params.toString()}` });
});

app.get('/oauth/callback', async (req, res) => {
    const { code, state } = req.query;
    
    // Verify state parameter
    if (!code || !state || state !== req.session.state) {
        return res.redirect('/?error=invalid_callback');
    }
    
    try {
        const loginUrl = req.session.loginUrl || 'https://login.salesforce.com';
        const tokenUrl = `${loginUrl}/services/oauth2/token`;
        const redirectUri = `https://${process.env.DOMAIN}/oauth/callback`;
        const targetOrgId = req.session.targetOrgId; // For multi-org flow
        
        let clientId, clientSecret;
        
        // Determine which credentials to use
        if (targetOrgId) {
            // Multi-org flow - use org-specific credentials
            const org = await DatabaseManager.getOrgById(targetOrgId);
            if (!org) {
                return res.redirect('/?error=org_not_found');
            }
            
            // Check if decryption failed
            if (org.hasDecryptionError || !org.decryptedClientSecret) {
                console.error('Org has decryption error, cannot connect:', targetOrgId);
                return res.redirect('/?error=org_corrupted');
            }
            
            clientId = org.clientId;
            clientSecret = org.decryptedClientSecret;
        } else {
            // Legacy single-org flow - use environment credentials
            clientId = process.env.SALESFORCE_CLIENT_ID;
            clientSecret = process.env.SALESFORCE_CLIENT_SECRET;
        }
        
        // Exchange code for tokens
        const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
                code_verifier: req.session.codeVerifier || ''
            }).toString()
        });
        
        const tokens = await response.json();
        
        if (tokens.access_token) {
            // Create jsforce connection
            const conn = new jsforce.Connection({
                instanceUrl: tokens.instance_url,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                oauth2: {
                    clientId: clientId,
                    clientSecret: clientSecret,
                    redirectUri: redirectUri
                }
            });
            
            // Get user info
            let userInfo;
            try {
                userInfo = await conn.identity();
            } catch (error) {
                console.warn('Could not fetch user info:', error);
                return res.redirect('/?error=user_info_failed');
            }
            
            // Store connection and user info in session
            req.session.salesforceConnection = {
                instanceUrl: tokens.instance_url,
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                loginUrl: loginUrl
            };
            
            req.session.userInfo = {
                userId: userInfo.user_id,
                username: userInfo.username,
                email: userInfo.email,
                displayName: userInfo.display_name,
                organizationId: userInfo.organization_id
            };
            
            console.log('OAuth callback: Token exchange successful.');
            console.log('Storing salesforceConnection in session:', req.session.salesforceConnection ? 'SUCCESS' : 'FAILURE');
            console.log('Storing userInfo in session:', req.session.userInfo ? 'SUCCESS' : 'FAILURE');
            
            // Handle multi-org specific logic
            if (targetOrgId) {
                req.session.currentOrgId = targetOrgId;
                
                // Store user-org access in database
                await DatabaseManager.storeUserOrgAccess(
                    userInfo.user_id,
                    targetOrgId,
                    {
                        accessToken: tokens.access_token,
                        refreshToken: tokens.refresh_token,
                        instanceUrl: tokens.instance_url,
                        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
                    }
                );
                
                // Update org last connected timestamp
                await DatabaseManager.updateOrgLastConnected(targetOrgId, userInfo.organization_id);
            } else {
                // For legacy single-org flow, set currentOrgId based on organization
                const legacyOrgId = 'legacy-org-' + userInfo.organization_id;
                req.session.currentOrgId = legacyOrgId;
                console.log('Setting currentOrgId for legacy org:', legacyOrgId);
            }
            
            // Clear OAuth temporary data
            delete req.session.codeVerifier;
            delete req.session.state;
            delete req.session.loginUrl;
            delete req.session.targetOrgId;
            
            // Redirect to main app
            req.session.save(() => {
                res.redirect('/?connected=true');
            });
        } else {
            console.error('Token exchange failed:', tokens);
            res.redirect('/?error=token_exchange_failed');
        }
    } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect('/?error=oauth_failed');
    }
});

// Username/password authentication fallback
app.post('/api/salesforce/connect', async (req, res) => {
    const { username, password, securityToken, loginUrl } = req.body;
    
    try {
        const conn = new jsforce.Connection({
            loginUrl: loginUrl || 'https://login.salesforce.com'
        });
        
        await conn.login(username, password + securityToken);
        
        // Store connection in session
        req.session.salesforceConnection = {
            instanceUrl: conn.instanceUrl,
            accessToken: conn.accessToken,
            refreshToken: conn.refreshToken,
            loginUrl: loginUrl || 'https://login.salesforce.com'
        };
        
        // Get user info
        try {
            const userInfo = await conn.identity();
            req.session.userInfo = {
                userId: userInfo.user_id,
                username: userInfo.username,
                email: userInfo.email,
                displayName: userInfo.display_name,
                organizationId: userInfo.organization_id
            };
        } catch (error) {
            console.warn('Could not fetch user info:', error);
        }
        
        res.json({ 
            success: true,
            userInfo: req.session.userInfo,
            instanceUrl: conn.instanceUrl
        });
    } catch (error) {
        console.error('Salesforce connection error:', error);
        res.status(400).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// Get Salesforce connection status
app.get('/api/salesforce/status', (req, res) => {
    const conn = getSalesforceConnection(req);
    
    res.json({
        connected: !!conn,
        instanceUrl: conn?.instanceUrl,
        userInfo: req.session.userInfo || null
    });
});

// Logout endpoint
app.post('/api/salesforce/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Session destruction error:', err);
            return res.status(500).json({ success: false, error: 'Logout failed' });
        }
        
        res.clearCookie('sfb_session');
        res.json({ success: true });
    });
});

// =============================================================================
// MULTI-ORG API ENDPOINTS
// =============================================================================

// Register a new Salesforce org (requires authentication)
app.post('/api/orgs/register', authenticateJWT, async (req, res) => {
    try {
        console.log('Received org registration request:', req.body);
        const { name, clientId, clientSecret, environment = 'production' } = req.body;
        const userId = req.user ? req.user.id : req.session.user?.id;
        
        if (!userId) {
            return res.status(401).json({
                error: 'You must be logged in to register an organization'
            });
        }
        
        // Validation
        if (!name || !clientId || !clientSecret) {
            return res.status(400).json({
                error: 'Organization name, Client ID, and Client Secret are required'
            });
        }

        // Determine login URL based on environment
        const loginUrl = environment === 'sandbox' 
            ? 'https://test.salesforce.com' 
            : 'https://login.salesforce.com';

        // Test the Connected App credentials before saving
        const testResult = await testConnectedApp(clientId, clientSecret, loginUrl);
        
        if (!testResult.valid) {
            return res.status(400).json({
                error: 'Invalid Connected App credentials. Please verify your Consumer Key and Secret.',
                details: testResult.error 
            });
        }

        // Create the org with the logged-in user as creator
        console.log('Creating org with userId:', userId);
        const org = await DatabaseManager.createOrg({
            name,
            clientId,
            clientSecret,
            loginUrl,
            environment,
            createdBy: userId
        });
        
        // Link the user to the org
        await DatabaseManager.linkUserToOrg(userId, org.id);

        console.log('Org created successfully:', org.id, org.name);

        res.json({
            success: true,
            org: {
                id: org.id,
                name: org.name,
                environment: org.environment,
                loginUrl: org.loginUrl
            }
        });

    } catch (error) {
        console.error('Error registering org:', error);
        
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                error: 'An organization with this configuration already exists'
            });
        }
        
        res.status(500).json({
            error: 'Failed to register organization. Please try again.' 
        });
    }
});

// Get orgs accessible to the current user (requires authentication)
app.get('/api/orgs', authenticateJWT, async (req, res) => {
    try {
        const userId = req.user ? req.user.id : req.session.user?.id;
        console.log('GET /api/orgs - userId:', userId);
        
        if (!userId) {
            return res.status(401).json({
                error: 'You must be logged in to view organizations'
            });
        }
        
        // Get orgs that the user has access to through UserOrgAccess
        const userOrgs = await DatabaseManager.getUserOrganizations(userId);
        console.log('User organizations:', userOrgs.length);
        
        // Return the user's organizations
        const validOrgs = userOrgs.map(org => ({
            id: org.id,
            name: org.name,
            environment: org.environment,
            loginUrl: org.loginUrl,
            lastConnectedAt: org.lastConnectedAt,
            createdAt: org.createdAt
        }));

        res.json({
            success: true,
            organizations: validOrgs
        });
        
    } catch (error) {
        console.error('Error fetching orgs:', error);
        res.status(500).json({
            error: 'Failed to fetch organizations' 
        });
    }
});

// Get OAuth URL for a specific org
app.get('/api/orgs/:orgId/auth-url', async (req, res) => {
    try {
        const { orgId } = req.params;
        
        const org = await DatabaseManager.getOrgById(orgId);
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        
        // Check if org has decryption errors
        if (org.hasDecryptionError || !org.decryptedClientSecret) {
            return res.status(400).json({
                error: 'Organization configuration is corrupted. Please re-register this organization.',
                corrupted: true
            });
        }

        // Generate PKCE parameters
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = generateCodeChallenge(codeVerifier);
        const state = generateState();

        // Build OAuth URL for this specific org
        const authUrl = `${org.loginUrl}/services/oauth2/authorize?` +
            `response_type=code&` +
            `client_id=${encodeURIComponent(org.clientId)}&` +
            `redirect_uri=${encodeURIComponent(`https://${process.env.DOMAIN || 'localhost:8443'}/oauth/callback`)}&` +
            `scope=api%20id%20web%20refresh_token&` +
            `state=${state}&` +
            `code_challenge=${codeChallenge}&` +
            `code_challenge_method=S256`;

        // Store PKCE verifier and org info in session
        req.session.codeVerifier = codeVerifier;
        req.session.state = state;
        req.session.targetOrgId = orgId;
        req.session.loginUrl = org.loginUrl;

        res.json({ authUrl });

    } catch (error) {
        console.error('Error generating org auth URL:', error);
        res.status(500).json({
            error: 'Failed to generate authorization URL' 
        });
    }
});

// Connect to a specific org (similar to existing connect but org-aware)
app.post('/api/orgs/:orgId/connect', async (req, res) => {
    try {
        const { orgId } = req.params;
        const { username, password, securityToken } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const org = await DatabaseManager.getOrgById(orgId);
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }

        // Create connection for this specific org
        const conn = new jsforce.Connection({
            loginUrl: org.loginUrl,
            version: '58.0'
        });

        const loginResult = await conn.login(username, password + (securityToken || ''));

        // Store connection in session with org context
        req.session.salesforceConnection = {
            accessToken: conn.accessToken,
            refreshToken: conn.refreshToken,
            instanceUrl: conn.instanceUrl,
            organizationId: loginResult.organizationId,
            userId: loginResult.id
        };

        req.session.currentOrgId = orgId;
        req.session.userInfo = {
            userId: loginResult.id,
            organizationId: loginResult.organizationId,
            username: username
        };

        // Store user-org access in database
        await DatabaseManager.storeUserOrgAccess(
            loginResult.id,
            orgId,
            {
                accessToken: conn.accessToken,
                refreshToken: conn.refreshToken,
                instanceUrl: conn.instanceUrl,
                expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours
            }
        );

        // Update org last connected timestamp
        await DatabaseManager.updateOrgLastConnected(orgId, loginResult.organizationId);

        res.json({
            success: true,
            instanceUrl: conn.instanceUrl,
            organizationId: loginResult.organizationId,
            userId: loginResult.id,
            userInfo: req.session.userInfo,
            orgInfo: {
                id: org.id,
                name: org.name,
                environment: org.environment
            }
        });

    } catch (error) {
        console.error('Org connection error:', error);
        res.status(401).json({
            error: 'Authentication failed. Please check your credentials.',
            details: error.message 
        });
    }
});

// Disconnect from current org
app.post('/api/orgs/disconnect', (req, res) => {
    req.session.salesforceConnection = null;
    req.session.currentOrgId = null;
    req.session.userInfo = null;
    
    res.json({ success: true });
});

// Delete an organization
app.delete('/api/orgs/:orgId', async (req, res) => {
    try {
        const { orgId } = req.params;
        const userId = req.session.userId;
        
        // Get the org to check ownership
        const org = await DatabaseManager.getOrgById(orgId);
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        
        // Check if user owns this org
        if (org.createdBy !== userId) {
            return res.status(403).json({ error: 'You can only delete organizations you created' });
        }
        
        // If user is currently connected to this org, disconnect them
        if (req.session.currentOrgId === orgId) {
            req.session.salesforceConnection = null;
            req.session.currentOrgId = null;
            req.session.userInfo = null;
        }
        
        // Delete the org
        await DatabaseManager.deleteOrg(orgId);
        
        res.json({
            success: true, 
            message: 'Organization deleted successfully',
            disconnected: req.session.currentOrgId === orgId
        });
        
    } catch (error) {
        console.error('Error deleting org:', error);
        res.status(500).json({
            error: 'Failed to delete organization',
            details: error.message 
        });
    }
});

// Admin endpoint to force cleanup corrupted orgs
app.post('/api/admin/cleanup-orgs', async (req, res) => {
    try {
        const cleanedCount = await DatabaseManager.cleanupCorruptedOrgs();
        res.json({
            success: true, 
            message: `Cleaned up ${cleanedCount} corrupted organizations` 
        });
    } catch (error) {
        console.error('Error in cleanup endpoint:', error);
        res.status(500).json({
            error: 'Failed to cleanup organizations',
            details: error.message 
        });
    }
});

// Get current org connection status
app.get('/api/orgs/current', async (req, res) => {
    try {
        console.log('API /api/orgs/current called.');
        const conn = getSalesforceConnection(req);
        let currentOrgId = req.session.currentOrgId;
        console.log('  conn exists:', !!conn);
        console.log('  currentOrgId:', currentOrgId);
        
        // Handle legacy org case - if we have connection but no currentOrgId
        if (conn && !currentOrgId && req.session.userInfo) {
            console.log('  Legacy org detected, setting currentOrgId');
            const legacyOrgId = 'legacy-org-' + req.session.userInfo.organization_id;
            req.session.currentOrgId = legacyOrgId;
            currentOrgId = legacyOrgId;
            console.log('  Set legacy currentOrgId:', currentOrgId);
        }
        
        if (!conn || !currentOrgId) {
            console.log('  No connection or currentOrgId, returning disconnected state');
            return res.json({
                connected: false,
                org: null
            });
        }

        const org = await DatabaseManager.getOrgById(currentOrgId);
        
        // For legacy orgs that might not be in database, create virtual org info
        let orgInfo = null;
        if (org) {
            orgInfo = {
                id: org.id,
                name: org.name,
                environment: org.environment
            };
        } else if (currentOrgId.startsWith('legacy-org-') && req.session.userInfo) {
            orgInfo = {
                id: currentOrgId,
                name: req.session.userInfo.display_name + "'s Org",
                environment: 'legacy'
            };
            console.log('  Created virtual org info for legacy connection:', orgInfo);
        }
        
        res.json({
            connected: true,
            instanceUrl: conn.instanceUrl,
            userInfo: req.session.userInfo,
            org: orgInfo
        });

    } catch (error) {
        console.error('Error getting current org:', error);
        res.json({
            connected: false,
            org: null
        });
    }
});

// Get Salesforce objects
app.get('/api/salesforce/objects', async (req, res) => {
    const conn = getSalesforceConnection(req);
    
    if (!conn) {
        return res.status(401).json({ error: 'Not connected to Salesforce' });
    }
    
    try {
        const result = await conn.describeGlobal();
        const createableObjects = result.sobjects
            .filter(obj => obj.createable)
            .map(obj => ({
                name: obj.name,
                label: obj.label,
                custom: obj.custom
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
        
        res.json(createableObjects);
    } catch (error) {
        console.error('Error fetching objects:', error);
        
        // Check if the error is due to an expired session
        if (error.message.includes('INVALID_SESSION_ID') || 
            error.message.includes('Session expired') ||
            error.message.includes('Invalid Session')) {
            // Clear the session
            req.session.salesforceConnection = null;
            req.session.userInfo = null;
            return res.status(401).json({
                error: 'Session expired. Please reconnect to Salesforce.',
                sessionExpired: true 
            });
        }
        
        res.status(500).json({ error: error.message });
    }
});

// Get object fields
app.get('/api/salesforce/objects/:objectName/fields', async (req, res) => {
    const conn = getSalesforceConnection(req);
    
    if (!conn) {
        return res.status(401).json({ error: 'Not connected to Salesforce' });
    }
    
    try {
        const { objectName } = req.params;
        const result = await conn.sobject(objectName).describe();
        
        const fields = result.fields
            .filter(field => field.createable || field.name === 'Id')
            .map(field => ({
                name: field.name,
                label: field.label,
                type: field.type,
                required: field.nillable === false && field.defaultValue === null,
                picklistValues: field.picklistValues,
                referenceTo: field.referenceTo,
                relationshipName: field.relationshipName,
                custom: field.custom
            }));
        
        res.json(fields);
    } catch (error) {
        console.error('Error fetching fields:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get picklist values
app.get('/api/salesforce/objects/:objectName/fields/:fieldName/picklist', async (req, res) => {
    const conn = getSalesforceConnection(req);
    
    if (!conn) {
        return res.status(401).json({ error: 'Not connected to Salesforce' });
    }
    
    try {
        const { objectName, fieldName } = req.params;
        const result = await conn.sobject(objectName).describe();
        const field = result.fields.find(f => f.name === fieldName);
        
        if (!field) {
            return res.status(404).json({ error: 'Field not found' });
        }
        
        const picklistValues = field.picklistValues
            .filter(value => value.active)
            .map(value => ({
                label: value.label,
                value: value.value
            }));
        
        res.json(picklistValues);
    } catch (error) {
        console.error('Error fetching picklist values:', error);
        res.status(500).json({ error: error.message });
    }
});

// Search records for lookup fields
app.get('/api/salesforce/objects/:objectName/search', async (req, res) => {
    let conn = getSalesforceConnection(req);
    
    // If no session connection, try to use form creator connection for public forms
    if (!conn) {
        const { formId } = req.query;
        if (formId) {
            conn = getSalesforceConnectionForForm(formId);
            console.log(`Using creator connection for lookup in public form ${formId}: ${conn ? 'SUCCESS' : 'FAILED'}`);
        }
    }
    
    if (!conn) {
        return res.status(401).json({ error: 'Not connected to Salesforce' });
    }
    
    try {
        const { objectName } = req.params;
        const { q, displayField = 'Name', searchField = 'Name', limit = 10, filters } = req.query;
        
        if (!q || q.length < 2) {
            return res.json([]);
        }
        
        // Build the WHERE clause
        let whereClause = `${searchField} LIKE '%${q.replace(/'/g, "\\'")}%'`;
        
        // Add filters if provided
        if (filters) {
            try {
                const parsedFilters = JSON.parse(filters);
                const filterClauses = parsedFilters
                    .filter(filter => filter.field && filter.operator)
                    .map(filter => {
                        const { field, operator, value } = filter;
                        const escapedField = field.replace(/[^a-zA-Z0-9_]/g, '');
                        
                        switch (operator) {
                            case 'equals':
                                return value ? `${escapedField} = '${value.replace(/'/g, "\\'")}'` : null;
                            case 'not_equals':
                                return value ? `${escapedField} != '${value.replace(/'/g, "\\'")}'` : null;
                            case 'contains':
                                return value ? `${escapedField} LIKE '%${value.replace(/'/g, "\\'")}%'` : null;
                            case 'starts_with':
                                return value ? `${escapedField} LIKE '${value.replace(/'/g, "\\'")}%'` : null;
                            case 'ends_with':
                                return value ? `${escapedField} LIKE '%${value.replace(/'/g, "\\'")}'` : null;
                            case 'greater_than':
                                return value ? `${escapedField} > '${value.replace(/'/g, "\\'")}'` : null;
                            case 'less_than':
                                return value ? `${escapedField} < '${value.replace(/'/g, "\\'")}'` : null;
                            case 'not_null':
                                return `${escapedField} != NULL`;
                            case 'is_null':
                                return `${escapedField} = NULL`;
                            default:
                                return null;
                        }
                    })
                    .filter(clause => clause !== null);
                
                if (filterClauses.length > 0) {
                    whereClause += ' AND ' + filterClauses.join(' AND ');
                }
            } catch (e) {
                console.warn('Error parsing filters:', e);
            }
        }
        
        // Get unique fields for SELECT clause
        const selectFields = new Set(['Id', displayField]);
        if (filters) {
            try {
                const parsedFilters = JSON.parse(filters);
                parsedFilters.forEach(filter => {
                    if (filter.field) {
                        selectFields.add(filter.field);
                    }
                });
            } catch (e) {
                // Ignore parsing errors
            }
        }
        
        const query = `SELECT ${Array.from(selectFields).join(', ')} FROM ${objectName} WHERE ${whereClause} LIMIT ${limit}`;
        console.log('Lookup query:', query);
        
        const result = await conn.query(query);
        
        const records = result.records.map(record => ({
            id: record.Id,
            display: record[displayField] || record.Id,
            record: record // Include full record for advanced use cases
        }));
        
        res.json(records);
    } catch (error) {
        console.error('Error searching records:', error);
        res.status(500).json({ error: error.message });
    }
});

app.patch('/api/salesforce/objects/:objectName/:id', isAuthenticated, async (req, res) => {
    const { objectName, id } = req.params;
    const recordData = req.body;
    const conn = req.session.salesforce.conn;

    try {
        const result = await conn.sobject(objectName).update({ Id: id, ...recordData });
        if (result.success) {
            res.status(200).json({ id: result.id, success: true });
        } else {
            res.status(400).json({ message: result.errors.join(', ') });
        }
    } catch (error) {
        console.error(`Error updating record in Salesforce for ${objectName} with ID ${id}:`, error);
        res.status(500).json({ message: error.message });
    }
});

// Save form draft (auto-save for form builder)
app.post('/api/save-draft', async (req, res) => {
    try {
        const formData = req.body;
        const userId = req.session.userInfo?.userId || 'anonymous';
        const organizationId = req.session.userInfo?.organizationId || 'unknown';
        
        // Generate a draft ID based on user and timestamp
        const draftId = formData.id || `draft_${userId}_${Date.now()}`;
        
        const db = getFormsDB();
        const existingForm = db.forms[draftId];
        
        db.forms[draftId] = {
            ...formData,
            id: draftId,
            userId: userId,
            organizationId: organizationId,
            isDraft: true,
            title: formData.title || 'Untitled Draft',
            updatedAt: new Date().toISOString(),
            createdAt: existingForm?.createdAt || new Date().toISOString(),
            // Preserve published status if form was already published
            published: existingForm?.published || false,
            publishedAt: existingForm?.publishedAt || null,
            publicUrl: existingForm?.publicUrl || null,
            // Preserve creator connection if it exists
            creatorConnection: existingForm?.creatorConnection || null
        };
        
        saveFormsDB(db);
        
        res.json({
            success: true, 
            draftId,
            draft: db.forms[draftId]
        });
    } catch (error) {
        console.error('Error saving draft:', error);
        res.status(500).json({
            success: false, 
            error: error.message 
        });
    }
});

// Helper function to load form data
function loadFormData(formId) {
    try {
        const db = getFormsDB();
        return db.forms[formId] || null;
    } catch (error) {
        console.error('Error loading form data:', error);
        return null;
    }
}

// Helper function to create custom email service based on form settings
async function createCustomEmailService(settings) {
    const nodemailer = require('nodemailer');
    
    // Create a custom email service class similar to the main EmailService
    class CustomEmailService {
        constructor(settings) {
            this.transporter = null;
            this.isConfigured = false;
            this.settings = settings;
            this.init();
        }

        init() {
            try {
                let transportConfig = {};
                
                switch (this.settings.emailProvider) {
                    case 'gmail':
                        if (this.settings.gmailUser && this.settings.gmailPass) {
                            transportConfig = {
                                service: 'gmail',
                                auth: {
                                    user: this.settings.gmailUser,
                                    pass: this.settings.gmailPass
                                }
                            };
                            console.log('Custom Gmail email service configured');
                        }
                        break;
                        
                    case 'sendgrid':
                        if (this.settings.sendgridKey) {
                            transportConfig = {
                                service: 'SendGrid',
                                auth: {
                                    user: 'apikey',
                                    pass: this.settings.sendgridKey
                                }
                            };
                            console.log('Custom SendGrid email service configured');
                        }
                        break;
                        
                    default: // smtp
                        if (this.settings.emailHost) {
                            transportConfig = {
                                host: this.settings.emailHost,
                                port: this.settings.emailPort || 587,
                                secure: this.settings.emailSecure || false,
                                auth: this.settings.emailUser && this.settings.emailPass ? {
                                    user: this.settings.emailUser,
                                    pass: this.settings.emailPass
                                } : undefined,
                                tls: {
                                    rejectUnauthorized: false
                                }
                            };
                            console.log('Custom SMTP email service configured');
                        }
                        break;
                }
                
                if (Object.keys(transportConfig).length > 0) {
                    this.transporter = nodemailer.createTransport(transportConfig);
                    this.isConfigured = true;
                }
                
            } catch (error) {
                console.error('Failed to configure custom email service:', error);
                this.isConfigured = false;
            }
        }

        async sendOTP(email, otp, contactName = null, formSettings = null) {
            if (!this.isConfigured || !this.transporter) {
                console.warn('Custom email service not configured - falling back to demo mode');
                return { success: false, demoOtp: otp };
            }

            try {
                const fromEmail = this.settings.emailFrom || 'noreply@example.com';
                const fromName = this.settings.emailFromName || 'Form Builder';
                
                const mailOptions = {
                    from: `${fromName} <${fromEmail}>`,
                    to: email,
                    subject: 'Your Verification Code',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #8b5cf6;">Your Verification Code</h2>
                            ${contactName ? `<p>Hello ${contactName},</p>` : '<p>Hello,</p>'}
                            <p>Your verification code is:</p>
                            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
                                <span style="font-size: 24px; font-weight: bold; color: #8b5cf6; letter-spacing: 3px;">${otp}</span>
                            </div>
                            <p>This code expires in 10 minutes.</p>
                            <hr style="margin: 30px 0;">
                            <p style="color: #6b7280; font-size: 14px;">
                                This email was sent from ${fromName}<br>
                                Time: ${new Date().toLocaleString()}
                            </p>
                        </div>
                    `
                };

                await this.transporter.sendMail(mailOptions);
                console.log(`🔐 Custom OTP email sent to ${email}`);
                return { success: true };
                
            } catch (error) {
                console.error('Custom email sending failed:', error);
                return { success: false, demoOtp: otp };
            }
        }
    }
    
    return new CustomEmailService(settings);
}

// Form management routes - Updated for multi-user support
app.post('/api/save-form', async (req, res) => {
    try {
        const formData = req.body;
        const formId = formData.id || uuidv4();
        const userId = req.session.userInfo?.userId || 'anonymous';
        const organizationId = req.session.userInfo?.organizationId || 'unknown';
        
        const db = getFormsDB();
        db.forms[formId] = {
            ...formData,
            id: formId,
            userId: userId,
            organizationId: organizationId,
            updatedAt: new Date().toISOString(),
            createdAt: db.forms[formId]?.createdAt || new Date().toISOString(),
            // Store creator's Salesforce connection for published form access
            creatorConnection: {
                accessToken: req.session.accessToken,
                refreshToken: req.session.refreshToken,
                instanceUrl: req.session.instanceUrl,
                userId: req.session.userInfo?.userId,
                organizationId: req.session.userInfo?.organizationId
            }
        };
        
        saveFormsDB(db);
        
        res.json({
            success: true, 
            formId,
            form: db.forms[formId]
        });
    } catch (error) {
        console.error('Error saving form:', error);
        res.status(500).json({
            success: false, 
            error: error.message 
        });
    }
});

// Get all forms - filtered by user
app.get('/api/forms', (req, res) => {
    try {
        const db = getFormsDB();
        const userId = req.session.userInfo?.userId;
        const organizationId = req.session.userInfo?.organizationId;
        
        let forms = Object.values(db.forms);
        
        // Filter forms by user and organization
        if (userId) {
            forms = forms.filter(form => 
                form.userId === userId && 
                form.organizationId === organizationId
            );
        } else {
            // If not logged in, return empty array
            forms = [];
        }
        
        forms.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        
        res.json(forms);
    } catch (error) {
        console.error('Error fetching forms:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get specific form
app.get('/api/forms/:formId', (req, res) => {
    try {
        const { formId } = req.params;
        const db = getFormsDB();
        const form = db.forms[formId];
        
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }
        
        // Check if form is published or user owns it
        const userId = req.session.userInfo?.userId;
        const organizationId = req.session.userInfo?.organizationId;
        
        if (!form.published && 
            (form.userId !== userId || form.organizationId !== organizationId)) {
            return res.status(403).json({ error: 'Access denied' });
        }
        
        res.json(form);
    } catch (error) {
        console.error('Error fetching form:', error);
        res.status(500).json({ error: error.message });
    }
});

// Publish form
app.post('/api/forms/:formId/publish', (req, res) => {
    try {
        const { formId } = req.params;
        const db = getFormsDB();
        const form = db.forms[formId];
        
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }
        
        // Check if user owns the form
        const userId = req.session.userInfo?.userId;
        const organizationId = req.session.userInfo?.organizationId;
        
        if (form.userId !== userId || form.organizationId !== organizationId) {
            return res.status(403).json({ error: 'Access denied. You can only publish your own forms.' });
        }
        
        // Store the creator's Salesforce connection for public form submissions
        const conn = getSalesforceConnection(req);
        let creatorConnection = null;
        
        if (conn && req.session.userInfo) {
            creatorConnection = {
                accessToken: conn.accessToken,
                refreshToken: conn.refreshToken,
                instanceUrl: conn.instanceUrl,
                userId: req.session.userInfo.userId,
                organizationId: req.session.userInfo.organizationId
            };
        }
        
        // If this is a draft with a draft ID, create a new clean ID for publishing
        let publishedFormId = formId;
        if (formId.startsWith('draft_')) {
            // Generate a clean UUID for the published form
            publishedFormId = require('crypto').randomUUID();
            
            // Create the published form with clean ID
            const publishedForm = {
                ...form,
                id: publishedFormId,
                published: true,
                publishedAt: new Date().toISOString(),
                publicUrl: `https://${process.env.DOMAIN}/form/${publishedFormId}`,
                isDraft: false,
                creatorConnection: creatorConnection,
                // Remove draft-specific properties
                title: undefined
            };
            
            // Add the published form
            db.forms[publishedFormId] = publishedForm;
            
            // Keep the original draft for editing
            form.published = true;
            form.publishedAt = publishedForm.publishedAt;
            form.publicUrl = publishedForm.publicUrl;
            form.creatorConnection = creatorConnection;
        } else {
            // Regular form, just update published status
            form.published = true;
            form.publishedAt = new Date().toISOString();
            form.publicUrl = `https://${process.env.DOMAIN}/form/${formId}`;
            form.creatorConnection = creatorConnection;
        }
        
        saveFormsDB(db);
        
        res.json({
            success: true, 
            publicUrl: form.publicUrl,
            publishedFormId: publishedFormId,
            form: publishedFormId !== formId ? db.forms[publishedFormId] : form
        });
    } catch (error) {
        console.error('Error publishing form:', error);
        res.status(500).json({ error: error.message });
    }
});

// Unpublish form
app.post('/api/forms/:formId/unpublish', (req, res) => {
    try {
        const { formId } = req.params;
        const db = getFormsDB();
        const form = db.forms[formId];
        
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }
        
        // Check if user owns the form
        const userId = req.session.userInfo?.userId;
        const organizationId = req.session.userInfo?.organizationId;
        
        if (form.userId !== userId || form.organizationId !== organizationId) {
            return res.status(403).json({ error: 'Access denied. You can only unpublish your own forms.' });
        }
        
        // Unpublish the form
        form.published = false;
        form.publishedAt = null;
        form.publicUrl = null;
        form.creatorConnection = null;
        
        saveFormsDB(db);
        
        res.json({
            success: true, 
            message: 'Form unpublished successfully',
            form: form
        });
    } catch (error) {
        console.error('Error unpublishing form:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete form
app.delete('/api/forms/:formId', (req, res) => {
    try {
        const { formId } = req.params;
        const db = getFormsDB();
        const form = db.forms[formId];
        
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }
        
        // Check if user owns the form
        const userId = req.session.userInfo?.userId;
        const organizationId = req.session.userInfo?.organizationId;
        
        if (form.userId !== userId || form.organizationId !== organizationId) {
            return res.status(403).json({ error: 'Access denied. You can only delete your own forms.' });
        }
        
        // Delete the form
        delete db.forms[formId];
        saveFormsDB(db);
        
        res.json({
            success: true, 
            message: 'Form deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting form:', error);
        res.status(500).json({ error: error.message });
    }
});



// Helper functions for signature integrity verification
function generateSignatureHash(base64Data) {
    return crypto.createHash('sha256').update(base64Data).digest('hex');
}

function generateDocumentHash(documentData) {
    return crypto.createHash('sha256').update(documentData).digest('hex');
}

// Helper function to handle file uploads and signature attachments
async function handleAttachments(conn, form, formData, results, uploadedFiles, req) {
    try {
        // Process file uploads
        if (uploadedFiles && uploadedFiles.length > 0) {
            for (const file of uploadedFiles) {
                // Find which page this file belongs to based on field mapping
                const targetRecord = findRecordForFile(form, file.fieldname, results);
                
                if (targetRecord) {
                    const contentVersion = {
                        Title: file.originalname,
                        PathOnClient: file.originalname,
                        VersionData: fs.readFileSync(file.path).toString('base64')
                    };
                    
                    const cvResult = await conn.sobject('ContentVersion').create(contentVersion);
                    
                    // Create ContentDocumentLink to attach to the record
                    if (cvResult.success) {
                        // Get the ContentDocumentId from ContentVersion
                        const cv = await conn.sobject('ContentVersion').findOne({ Id: cvResult.id });
                        
                        await conn.sobject('ContentDocumentLink').create({
                            ContentDocumentId: cv.ContentDocumentId,
                            LinkedEntityId: targetRecord.id,
                            ShareType: 'V'
                        });
                    }
                }
                
                // Clean up uploaded file
                try {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                        console.log(`Cleaned up temporary file: ${file.path}`);
                    }
                } catch (cleanupError) {
                    console.error(`Error cleaning up file ${file.path}:`, cleanupError);
                }
            }
        }
        
        // Process signature data
        console.log('Looking for signature fields across all pages...');
        console.log('Available formData keys:', Object.keys(formData));
        console.log('Available formData (full):', JSON.stringify(formData, null, 2));
        for (const page of form.pages) {
            const signatureFields = page.fields.filter(field => field.type === 'signature');
            console.log(`Page ${page.id} has ${signatureFields.length} signature fields:`, signatureFields.map(f => f.id));
            
            for (const field of signatureFields) {
                const signatureData = formData[field.id];
                console.log(`Signature field ${field.id} data:`, signatureData ? 'HAS DATA' : 'NO DATA');
                
                if (signatureData && signatureData !== '') {
                    // Find the record for this page
                    const pageResult = results.find(r => r.pageId === page.id);
                    
                    if (pageResult && pageResult.result && pageResult.result.id) {
                        let parsedSignatureData;
                        let base64Data;
                        
                        // Parse signature data (could be just base64 or JSON with metadata)
                        console.log('Processing signature for field:', field.id);
                        console.log('Signature data type:', typeof signatureData);
                        console.log('Signature data preview:', typeof signatureData === 'string' ? signatureData.substring(0, 100) + '...' : signatureData);
                        
                        try {
                            if (typeof signatureData === 'string' && signatureData.startsWith('{')) {
                                parsedSignatureData = JSON.parse(signatureData);
                                base64Data = parsedSignatureData.signature?.replace(/^data:image\/png;base64,/, '') || signatureData.replace(/^data:image\/png;base64,/, '');
                                console.log('Parsed signature as JSON, base64 length:', base64Data?.length);
                            } else if (typeof signatureData === 'object' && signatureData.signature) {
                                // Handle case where it's already parsed as object
                                parsedSignatureData = signatureData;
                                base64Data = parsedSignatureData.signature.replace(/^data:image\/png;base64,/, '');
                                console.log('Signature is object, base64 length:', base64Data?.length);
                            } else {
                                base64Data = signatureData.replace(/^data:image\/png;base64,/, '');
                                parsedSignatureData = { signature: signatureData };
                                console.log('Using signature as-is, base64 length:', base64Data?.length);
                            }
                        } catch (e) {
                            console.error('Error parsing signature data:', e);
                            base64Data = signatureData.replace(/^data:image\/png;base64,/, '');
                            parsedSignatureData = { signature: signatureData };
                        }
                        
                        const timestamp = new Date().toISOString();
                        const recordId = pageResult.result.id;
                        
                        // Enhanced legal compliance metadata
                        const legalComplianceData = {
                            // Document identification
                            documentId: form.id,
                            documentTitle: form.title || 'Form Submission',
                            recordId: recordId,
                            fieldId: field.id,
                            fieldLabel: field.label || 'Signature',
                            
                            // Signing event details
                            signedAt: timestamp,
                            serverTimestamp: timestamp,
                            signatureId: `sig_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                            
                            // Signer information (from client metadata)
                            signerMetadata: parsedSignatureData.metadata || {},
                            auditTrail: parsedSignatureData.auditTrail || {},
                            
                            // Server-side verification data
                            serverMetadata: {
                                ipAddress: req.ip || req.connection.remoteAddress,
                                userAgent: req.get('User-Agent'),
                                xForwardedFor: req.get('X-Forwarded-For'),
                                origin: req.get('Origin'),
                                referer: req.get('Referer'),
                                serverVersion: '1.0',
                                processingTimestamp: timestamp
                            },
                            
                            // Legal framework compliance
                            legalFramework: {
                                applicableLaws: ['ESIGN Act', 'UETA'],
                                consentToElectronicSignature: true,
                                signatureMethod: 'electronic_signature',
                                intentToSign: true,
                                documentIntegrity: 'verified',
                                signatureAuthentication: 'device_fingerprint_and_metadata'
                            },
                            
                            // Integrity verification
                            signatureHash: parsedSignatureData.auditTrail?.signatureHash || generateSignatureHash(base64Data),
                            documentHash: generateDocumentHash(JSON.stringify(formData)),
                            
                            // Compliance version
                            complianceVersion: '1.0',
                            generatedBy: 'Salesforce Form Builder'
                        };
                        
                        // Save signature image
                        const signatureCV = {
                            Title: `Signature_${field.label || 'Signature'}_${Date.now()}.png`,
                            PathOnClient: `Signature_${field.label || 'Signature'}.png`,
                            VersionData: base64Data
                        };
                        
                        const signatureCVResult = await conn.sobject('ContentVersion').create(signatureCV);
                        
                        // Save legal compliance metadata as JSON
                        const complianceCV = {
                            Title: `Signature_Legal_Compliance_${field.label || 'Signature'}_${Date.now()}.json`,
                            PathOnClient: `Signature_Legal_Compliance_${field.label || 'Signature'}.json`,
                            VersionData: Buffer.from(JSON.stringify(legalComplianceData, null, 2)).toString('base64')
                        };
                        
                        const complianceCVResult = await conn.sobject('ContentVersion').create(complianceCV);
                        
                        // Create ContentDocumentLinks for both files
                        if (signatureCVResult.success) {
                            const signatureCV = await conn.sobject('ContentVersion').findOne({ Id: signatureCVResult.id });
                            await conn.sobject('ContentDocumentLink').create({
                                ContentDocumentId: signatureCV.ContentDocumentId,
                                LinkedEntityId: recordId,
                                ShareType: 'V'
                            });
                        }
                        
                        if (complianceCVResult.success) {
                            const complianceCV = await conn.sobject('ContentVersion').findOne({ Id: complianceCVResult.id });
                            await conn.sobject('ContentDocumentLink').create({
                                ContentDocumentId: complianceCV.ContentDocumentId,
                                LinkedEntityId: recordId,
                                ShareType: 'V'
                            });
                        }
                        
                        console.log(`Processed signature with legal compliance for field ${field.id}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error handling attachments:', error);
        // Don't fail the entire submission if attachments fail
    }
}

// Helper function to find which record a file should be attached to
function findRecordForFile(form, fieldname, results) {
    for (const page of form.pages) {
        const fileFields = page.fields.filter(field => field.type === 'file');
        
        for (const field of fileFields) {
            if (field.id === fieldname) {
                const pageResult = results.find(r => r.pageId === page.id);
                return pageResult && pageResult.result ? pageResult.result : null;
            }
        }
    }
    
    // Fallback to first created record
    return results[0]?.result || null;
}

// Email lookup for flow logic
app.post('/api/contact-lookup', async (req, res) => {
    let conn = getSalesforceConnection(req);
    
    // If no session connection, try to use form creator connection for public forms
    if (!conn) {
        const { formId } = req.body;
        if (formId) {
            conn = getSalesforceConnectionForForm(formId);
            console.log(`Using creator connection for public form ${formId}: ${conn ? 'SUCCESS' : 'FAILED'}`);
        }
    }
    
    if (!conn) {
        return res.status(401).json({ error: 'Not connected to Salesforce' });
    }
    
    try {
        const { email } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        // Search for contact by email
        const query = `SELECT Id, Name, Email, FirstName, LastName, Phone, Title FROM Contact WHERE Email = '${email.replace(/'/g, "\\'")}' LIMIT 1`;
        const result = await conn.query(query);
        
        if (result.records && result.records.length > 0) {
            res.json({
                found: true,
                contact: result.records[0]
            });
        } else {
            res.json({
                found: false,
                contact: null
            });
        }
    } catch (error) {
        console.error('Error in contact lookup:', error);
        res.status(500).json({ error: error.message });
    }
});


// Send OTP for email verification
app.post('/api/send-otp', async (req, res) => {
    try {
        const { email, contactId, isResend = false, formId } = req.body;
        
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        
        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const sessionId = generateSessionId();
        
        // Store OTP in memory with expiration (in production, use Redis or database)
        if (!global.otpSessions) {
            global.otpSessions = new Map();
        }
        
        global.otpSessions.set(sessionId, {
            email,
            otp,
            contactId,
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
            attempts: 0
        });
        
        // Get form-specific email settings if formId is provided
        let customEmailService = null;
        let emailSettings = null;
        if (formId) {
            try {
                const formData = loadFormData(formId);
                const settings = formData?.settings;
                if (settings?.useCustomEmail) {
                    console.log(`📧 Creating CUSTOM EMAIL SERVICE for form ${formId}`);
                    console.log(`   Provider: ${settings.emailProvider}`);
                    console.log(`   From: ${settings.fromName} <${settings.fromAddress}>`);
                    // Create custom email service for this form
                    customEmailService = await createCustomEmailService(settings);
                } else {
                    console.log(`📧 Form ${formId} will use SYSTEM EMAIL SERVICE`);
                }
                emailSettings = settings;
            } catch (error) {
                console.warn(`Could not load form settings for ${formId}:`, error.message);
            }
        } else {
            console.log('📧 No formId provided - using SYSTEM EMAIL SERVICE');
        }
        
        // Send OTP via email service with timeout
        console.log(`Sending OTP for ${email}: ${otp} (Session: ${sessionId})`);
        console.log(`Using ${customEmailService ? 'CUSTOM TRANSPORTER' : 'SYSTEM TRANSPORTER'} email service`);
        
        // Add timeout to prevent 504 errors
        let emailPromise;
        
        if (customEmailService) {
            // Use custom email service with its own transporter
            emailPromise = customEmailService.sendOTP(email, otp, null, emailSettings);
        } else {
            // Use system email service but pass custom settings for branding/content
            emailPromise = emailService.sendOTP(email, otp, null, emailSettings);
        }
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Email sending timeout')), 30000)
        );
        
        const emailResult = await Promise.race([emailPromise, timeoutPromise]).catch(error => {
            console.error('Email sending failed:', error.message);
            return { success: false, message: error.message };
        });
        
        const response = {
            success: true,
            sessionId,
            message: isResend ? 'OTP resent successfully' : 'OTP sent successfully',
            emailSent: emailResult.success
        };
        
        // Include OTP in response if email service is not configured (demo mode)
        if (!emailResult.success) {
            response.demoOtp = otp;
            response.message += ' (Demo mode - check console for OTP)';
        }
        
        res.json(response);
        
    } catch (error) {
        console.error('Error sending OTP:', error);
        res.status(500).json({ error: error.message });
    }
});

// Verify OTP
app.post('/api/verify-otp', async (req, res) => {
    try {
        const { email, otp, sessionId } = req.body;
        
        if (!email || !otp || !sessionId) {
            return res.status(400).json({ error: 'Email, OTP, and session ID are required' });
        }
        
        if (!global.otpSessions) {
            return res.status(400).json({ error: 'No OTP sessions found' });
        }
        
        const session = global.otpSessions.get(sessionId);
        
        if (!session) {
            return res.status(400).json({ error: 'Invalid session ID' });
        }
        
        if (session.email !== email) {
            return res.status(400).json({ error: 'Email mismatch' });
        }
        
        if (new Date() > session.expiresAt) {
            global.otpSessions.delete(sessionId);
            return res.status(400).json({ error: 'OTP expired' });
        }
        
        session.attempts++;
        
        if (session.attempts > 5) {
            global.otpSessions.delete(sessionId);
            return res.status(400).json({ error: 'Too many attempts' });
        }
        
        if (session.otp !== otp) {
            return res.json({
                verified: false,
                message: 'Invalid OTP',
                attemptsRemaining: 5 - session.attempts
            });
        }
        
        // OTP verified successfully
        global.otpSessions.delete(sessionId);
        
        res.json({
            verified: true,
            contactId: session.contactId,
            message: 'OTP verified successfully'
        });
        
    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test email configuration
app.post('/api/test-email-config', async (req, res) => {
    try {
        console.log('📧 Test email config request received:', {
            body: req.body,
            hasEmailConfig: !!req.body?.emailConfig,
            hasTestEmail: !!req.body?.testEmail,
            hasTestEmailSettings: !!req.body?.testEmailSettings
        });
        
        // Handle new format (emailConfig, testEmail)
        if (req.body.emailConfig && req.body.testEmail) {
            const { emailConfig, testEmail } = req.body;
            
            if (!emailConfig || !testEmail) {
                return res.status(400).json({ success: false, error: 'Missing email configuration or test email' });
            }
            
            // Create temporary test email service
            const nodemailer = require('nodemailer');
            let testTransporter;
            
            switch (emailConfig.provider) {
                case 'gmail':
                    if (!emailConfig.gmailUser || !emailConfig.gmailPass) {
                        return res.status(400).json({ success: false, error: 'Gmail credentials missing' });
                    }
                    testTransporter = nodemailer.createTransport({
                        service: 'gmail',
                        auth: {
                            user: emailConfig.gmailUser,
                            pass: emailConfig.gmailPass
                        }
                    });
                    break;
                    
                case 'sendgrid':
                    if (!emailConfig.sendgridKey) {
                        return res.status(400).json({ success: false, error: 'SendGrid API key missing' });
                    }
                    testTransporter = nodemailer.createTransport({
                        service: 'SendGrid',
                        auth: {
                            user: 'apikey',
                            pass: emailConfig.sendgridKey
                        }
                    });
                    break;
                    
                default: // smtp
                    if (!emailConfig.host) {
                        return res.status(400).json({ success: false, error: 'SMTP host missing' });
                    }
                    testTransporter = nodemailer.createTransport({
                        host: emailConfig.host,
                        port: emailConfig.port || 587,
                        secure: emailConfig.secure || false,
                        auth: emailConfig.user && emailConfig.pass ? {
                            user: emailConfig.user,
                            pass: emailConfig.pass
                        } : undefined,
                        tls: {
                            rejectUnauthorized: false
                        }
                    });
                    break;
            }
            
            // Send test email
            const mailOptions = {
                from: `${emailConfig.fromName || 'Form Builder'} <${emailConfig.fromEmail}>`,
                to: testEmail,
                subject: 'Email Configuration Test - Salesforce Form Builder',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #8b5cf6;">Email Configuration Test Successful!</h2>
                        <p>This is a test email to verify your custom email configuration.</p>
                        <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3>Configuration Details:</h3>
                            <ul>
                                <li><strong>Provider:</strong> ${emailConfig.provider.toUpperCase()}</li>
                                <li><strong>From Email:</strong> ${emailConfig.fromEmail}</li>
                                <li><strong>From Name:</strong> ${emailConfig.fromName}</li>
                                ${emailConfig.provider === 'smtp' ? `<li><strong>SMTP Host:</strong> ${emailConfig.host}:${emailConfig.port}</li>` : ''}
                            </ul>
                        </div>
                        <p>Your email configuration is working correctly and ready to send OTP emails!</p>
                        <hr style="margin: 30px 0;">
                        <p style="color: #6b7280; font-size: 14px;">
                            This email was sent from Salesforce Form Builder<br>
                            Time: ${new Date().toLocaleString()}
                        </p>
                    </div>
                `
            };
            
            await testTransporter.sendMail(mailOptions);
            
            return res.json({ 
                success: true, 
                message: 'Test email sent successfully',
                provider: emailConfig.provider
            });
        }
        
        // Handle legacy format (testEmailSettings, fromAddress) - fallback for existing code
        const { testEmailSettings, formId } = req.body;
        
        if (!testEmailSettings || !testEmailSettings.fromAddress) {
            return res.status(400).json({ error: 'Email settings and fromAddress are required' });
        }
        
        // Generate a test message
        const testCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Send test email using the provided settings
        const emailResult = await emailService.sendEmailConfigTest(
            testEmailSettings.fromAddress,
            testCode,
            testEmailSettings
        );
        
        if (emailResult.success) {
            res.json({
                success: true,
                message: `Test email sent successfully to ${testEmailSettings.fromAddress}`,
                messageId: emailResult.messageId
            });
        } else {
            res.json({
                success: false,
                message: emailResult.message || 'Failed to send test email'
            });
        }
        
    } catch (error) {
        console.error('Error testing email configuration:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Server error while testing email configuration'
        });
    }
});

// Verify email address for from field
app.post('/api/verify-from-email', async (req, res) => {
    try {
        const { emailAddress, fromName } = req.body;
        
        if (!emailAddress) {
            return res.status(400).json({ error: 'Email address is required' });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailAddress)) {
            return res.status(400).json({ error: 'Invalid email address format' });
        }
        
        // Check if email service is configured
        if (!emailService.isReady()) {
            return res.json({
                success: false,
                message: 'Email service not configured. Please configure SMTP settings first.',
                canVerify: false
            });
        }
        
        // Generate verification code
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Prepare test email settings for verification
        const verificationSettings = {
            fromAddress: emailAddress,
            fromName: fromName || 'Sender Verification',
            otpSubject: 'Email Address Verification - Action Required',
            template: 'professional',
            footerText: 'This verification email was sent to confirm ownership of this email address.'
        };
        
        // Send verification email to the from address
        const emailResult = await emailService.sendOTP(
            emailAddress,
            verificationCode,
            null, // no contact name
            verificationSettings
        );
        
        if (emailResult.success) {
            // Store verification code in session or temporary storage
            // For simplicity, we'll return it to be verified on the client side
            res.json({
                success: true,
                message: `Verification email sent to ${emailAddress}. Please check your inbox and enter the code you receive.`,
                verificationId: crypto.createHash('md5').update(verificationCode + emailAddress).digest('hex'),
                messageId: emailResult.messageId,
                canVerify: true
            });
        } else {
            res.json({
                success: false,
                message: emailResult.message || 'Failed to send verification email',
                error: emailResult.error,
                canVerify: true
            });
        }
        
    } catch (error) {
        console.error('Error verifying from email:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Server error while verifying email address'
        });
    }
});

// Confirm email verification
app.post('/api/confirm-email-verification', async (req, res) => {
    try {
        const { emailAddress, verificationCode, verificationId } = req.body;
        
        if (!emailAddress || !verificationCode || !verificationId) {
            return res.status(400).json({ error: 'Email address, verification code, and verification ID are required' });
        }
        
        // Verify the code matches what we sent
        const expectedVerificationId = crypto.createHash('md5').update(verificationCode + emailAddress).digest('hex');
        
        if (verificationId === expectedVerificationId) {
            res.json({
                success: true,
                message: 'Email address verified successfully',
                verified: true
            });
        } else {
            res.json({
                success: false,
                message: 'Invalid verification code',
                verified: false
            });
        }
        
    } catch (error) {
        console.error('Error confirming email verification:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Server error while confirming email verification'
        });
    }
});

// SMTP Server Management Endpoints - REMOVED
// Using external SMTP server on portwoodglobalsolutions.com:2525

// SMTP Server Management Endpoints - REMOVED
// All OTP emails now route through external SMTP server at portwoodglobalsolutions.com:2525

// Helper function to generate session ID
function generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Submit form data
app.post('/api/forms/:formId/submit', upload.any(), async (req, res) => {
    try {
        const { formId } = req.params;
        console.log('🔍 [SUBMIT DEBUG] Form ID requested:', formId);
        
        const db = getFormsDB();
        console.log('🔍 [SUBMIT DEBUG] Forms DB loaded, forms count:', Object.keys(db.forms || {}).length);
        console.log('🔍 [SUBMIT DEBUG] Available form IDs:', Object.keys(db.forms || {}).slice(0, 5));
        
        const form = db.forms[formId];
        console.log('🔍 [SUBMIT DEBUG] Form found:', !!form);
        console.log('🔍 [SUBMIT DEBUG] Form published:', !!form?.published);
        
        if (!form || !form.published) {
            console.error('❌ [SUBMIT DEBUG] Form not found or not published');
            return res.status(404).json({ error: 'Form not found or not published' });
        }
        
        // Handle formData whether it comes as string or object
        console.log('Raw request body keys:', Object.keys(req.body));
        console.log('Raw request files:', req.files ? req.files.map(f => f.fieldname + ': ' + f.originalname) : 'No files');
        console.log('formData type:', typeof req.body.formData);
        console.log('formData value:', req.body.formData);
        
        // Debug file information
        if (req.files && req.files.length > 0) {
            console.log('File upload details:');
            req.files.forEach(file => {
                console.log(`  Field: ${file.fieldname}, Name: ${file.originalname}, Size: ${file.size}, Path: ${file.path}`);
            });
        }
        
        let formData;
        const submitterIp = req.ip || req.connection.remoteAddress;
        const userAgent = req.get('User-Agent');

        console.log('Received submission for formId:', formId);
        console.log('Submitter IP:', submitterIp);
        console.log('User Agent:', userAgent);
        console.log('Raw request body keys:', Object.keys(req.body));
        console.log('Raw request files:', req.files ? req.files.map(f => f.fieldname + ': ' + f.originalname) : 'No files');
        console.log('formData type:', typeof req.body.formData);
        console.log('formData value:', req.body.formData);
        
        // Debug file information
        if (req.files && req.files.length > 0) {
            console.log('File upload details:');
            req.files.forEach(file => {
                console.log(`  Field: ${file.fieldname}, Name: ${file.originalname}, Size: ${file.size}, Path: ${file.path}`);
            });
        }
        
        if (typeof req.body.formData === 'string') {
            try {
                // Clean up the string - sometimes multipart data has escaped quotes or extra characters
                let cleanFormData = req.body.formData;
                
                // Remove any leading/trailing quotes if present
                if (cleanFormData.startsWith('"') && cleanFormData.endsWith('"')) {
                    cleanFormData = cleanFormData.slice(1, -1);
                }
                
                // Unescape any escaped quotes
                cleanFormData = cleanFormData.replace(/\\"/g, '"');
                
                // Fix signature data JSON parsing issue - signature data contains nested JSON with quotes
                // This is a common issue when multipart form data contains complex JSON values
                try {
                    // First, try to parse as-is
                    formData = JSON.parse(cleanFormData);
                } catch (firstError) {
                    console.log('First JSON parse failed, attempting to fix signature field formatting...');
                    
                    // If that fails, try to fix signature field JSON formatting
                    // Replace unescaped quotes in signature field values with escaped quotes
                    let fixedFormData = cleanFormData;
                    
                    // Find all field_X values that look like signature JSON
                    const signaturePattern = /"(field_\d+)":"({.*?})"/g;
                    fixedFormData = fixedFormData.replace(signaturePattern, (match, fieldName, jsonValue) => {
                        try {
                            // Try to parse the inner JSON to validate it
                            JSON.parse(jsonValue);
                            // If it parses successfully, escape the quotes properly
                            const escapedJson = jsonValue.replace(/"/g, '\\"');
                            return `"${fieldName}":"${escapedJson}"`;
                        } catch (e) {
                            // If it doesn't parse, it might be malformed - leave it as is
                            return match;
                        }
                    });
                    
                    // Try parsing again with the fixed format
                    formData = JSON.parse(fixedFormData);
                }
                
                // If we get here without error, formData is already parsed successfully
                console.log('Successfully parsed formData:', Object.keys(formData));
            } catch (e) {
                console.error('Failed to parse formData JSON:', e);
                console.error('Original formData string:', req.body.formData);
                
                // If JSON parsing fails, try to extract data from the raw body
                formData = {};
                
                // Check if it's a simple form submission without proper JSON
                if (req.body && Object.keys(req.body).length > 1) {
                    // Use other body fields as formData
                    formData = { ...req.body };
                    delete formData.formData; // Remove the unparseable formData field
                    delete formData.submissionMetadata; // Remove metadata field if present
                    
                    // Filter out any file-related fields that shouldn't be in regular data
                    Object.keys(formData).forEach(key => {
                        const value = formData[key];
                        
                        if (typeof value === 'string') {
                            // Check if it's signature data (contains 'signature' and 'base64')
                            const isSignatureData = value.includes('signature') && value.includes('base64');
                            
                            // Only remove if it looks like a file path AND is not signature data
                            if (!isSignatureData && ((value.includes('\\') && value.includes(':')) || value.includes('fakepath'))) {
                                console.log('Removing suspected file path from formData:', key, value);
                                delete formData[key];
                            } else if (isSignatureData) {
                                console.log('Preserving signature data for:', key);
                            }
                        }
                    });
                }
            }
        } else {
            formData = req.body.formData || {};
        }
        
        // Handle submissionMetadata similarly
        let submissionMetadata = {};
        if (req.body.submissionMetadata) {
            if (typeof req.body.submissionMetadata === 'string') {
                try {
                    submissionMetadata = JSON.parse(req.body.submissionMetadata);
                } catch (e) {
                    console.error('Failed to parse submissionMetadata:', e);
                }
            } else {
                submissionMetadata = req.body.submissionMetadata;
            }
        }
        
        console.log('📋 Submission metadata:', submissionMetadata);
        
        // Enhanced form structure debugging
        console.log('🔍 [FORM DEBUG] Form found:', !!form);
        console.log('🔍 [FORM DEBUG] Form ID:', form?.id);
        console.log('🔍 [FORM DEBUG] Form name:', form?.name);
        console.log('🔍 [FORM DEBUG] Pages count:', form?.pages?.length);
        if (form?.pages) {
            form.pages.forEach((page, index) => {
                console.log(`🔍 [FORM DEBUG] Page ${index}: id="${page.id}", name="${page.name}", object="${page.salesforceObject}", fields=${page.fields?.length}, repeat=${!!page.repeatConfig?.enabled}`);
            });
        }
        
        // Check if this is a page-only processing request
        if (submissionMetadata.processPageOnly && submissionMetadata.pageId) {
            console.log(`📄 Processing only page: ${submissionMetadata.pageId}`);
            // Filter form pages to only process the requested page
            const targetPage = form.pages.find(page => page.id === submissionMetadata.pageId);
            if (targetPage) {
                form.pages = [targetPage]; // Temporarily override pages to process only this one
                console.log(`✅ Found target page for processing: ${targetPage.name} (${targetPage.id})`);
            } else {
                console.warn(`⚠️  Requested page ${submissionMetadata.pageId} not found in form`);
            }
        }
        
        // For form submissions, we need to use the form owner's Salesforce connection
        // not the current user's session (since forms are public)
        let conn = null;
        
        console.log('🔍 [CONNECT DEBUG] Form has creatorConnection:', !!form.creatorConnection);
        console.log('🔍 [CONNECT DEBUG] Has accessToken:', !!form.creatorConnection?.accessToken);
        
        // Try to use the form creator's stored connection first
        if (form.creatorConnection && form.creatorConnection.accessToken) {
            try {
                conn = new jsforce.Connection({
                    instanceUrl: form.creatorConnection.instanceUrl,
                    accessToken: form.creatorConnection.accessToken,
                    refreshToken: form.creatorConnection.refreshToken,
                    oauth2: {
                        clientId: process.env.SALESFORCE_CLIENT_ID,
                        clientSecret: process.env.SALESFORCE_CLIENT_SECRET
                    }
                });
                
                // Verify the connection works
                const identity = await conn.identity();
                console.log("✅ [CONNECT DEBUG] Using form creator's connection for form submission");
                console.log("🔍 [CONNECT DEBUG] Connected as:", identity.display_name);
            } catch (creatorConnError) {
                console.error('Form creator connection failed:', creatorConnError.message);
                conn = null;
            }
        }
        
        // For public forms, try to use service account credentials if creator connection fails
        if (!conn) {
            try {
                // Try to use environment credentials for service account
                if (process.env.SALESFORCE_USERNAME && process.env.SALESFORCE_PASSWORD) {
                    conn = new jsforce.Connection({
                        loginUrl: process.env.SALESFORCE_LOGIN_URL || 'https://login.salesforce.com'
                    });
                    
                    const password = process.env.SALESFORCE_SECURITY_TOKEN ? 
                        process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_SECURITY_TOKEN :
                        process.env.SALESFORCE_PASSWORD;
                        
                    await conn.login(process.env.SALESFORCE_USERNAME, password);
                    console.log('Using service account for form submission');
                }
            } catch (serviceError) {
                console.error('Service account login failed:', serviceError.message);
                conn = null;
            }
        }
        
        // Fallback to user session if service account fails
        if (!conn) {
            conn = getSalesforceConnection(req);
        }
        
        // If no connection available, return error
        if (!conn) {
            return res.status(401).json({
                error: 'Unable to connect to Salesforce. Please try again later or contact the form owner.',
                redirectToLogin: false
            });
        }
        
        const results = [];
        const parentRecords = {}; // Store created parent record IDs, e.g., { page_1: '001...A' }

        // --- PASS 1: Create/Update all parent records (non-repeating pages) ---
        console.log('--- PASS 1: Creating/Updating Parent Records ---');
        for (const page of form.pages) {
            if (page.repeatConfig?.enabled) {
                continue; // Skip repeating (child) pages in this pass
            }

            console.log(`🔍 [PASS 1] Processing parent page: ${page.id} (${page.salesforceObject})`);
            console.log(`🔍 [PASS 1] Page fields:`, page.fields.map(f => ({ id: f.id, salesforceField: f.salesforceField })));
            console.log(`🔍 [PASS 1] Available formData keys:`, Object.keys(formData));

            const record = {};
            let recordId = null;
            
            // Map fields from the main formData object
            for (const field of page.fields) {
                console.log(`🔍 [PASS 1] Checking field ${field.id} -> ${field.salesforceField}, value: ${formData[field.id]}`);
                if (field.salesforceField && formData[field.id] !== undefined && formData[field.id] !== null && formData[field.id] !== '') {
                    record[field.salesforceField] = formData[field.id];
                    console.log(`✅ [PASS 1] Mapped ${field.id} -> ${field.salesforceField} = ${formData[field.id]}`);
                } else {
                    console.log(`❌ [PASS 1] Skipped ${field.id} (salesforceField: ${field.salesforceField}, value: ${formData[field.id]}, type: ${typeof formData[field.id]})`);
                }
            }
            
            // Add hidden fields
            if (page.hiddenFields) {
                for (const hiddenField of page.hiddenFields) {
                    if (hiddenField.salesforceField && hiddenField.value) {
                        // Check if value is a variable reference
                        if (hiddenField.valueType === 'variable' && hiddenField.variable) {
                            // Get variable value from form submission metadata or formData
                            const variableValue = submissionMetadata.variables?.[hiddenField.variable] || formData[`var_${hiddenField.variable}`];
                            if (variableValue) {
                                record[hiddenField.salesforceField] = variableValue;
                                console.log(`Setting hidden field ${hiddenField.salesforceField} from variable ${hiddenField.variable}: ${variableValue}`);
                            }
                        } else {
                            record[hiddenField.salesforceField] = hiddenField.value;
                        }
                    }
                }
            }

            // Check if this is a query/get operation
            const isQuery = page.actionType === 'get';
            
            console.log('🔍 [PAGE DEBUG] Processing page:', {
                pageId: page.id,
                pageName: page.name,
                actionType: page.actionType,
                isQuery: isQuery,
                salesforceObject: page.salesforceObject
            });
            
            if (isQuery) {
                // Handle Get Records functionality
                try {
                    console.log(`🔍 [QUERY DEBUG] Executing SOQL query for ${page.salesforceObject}`);
                    
                    // Build SOQL query from page configuration
                    let soqlFields = 'Id'; // Always include Id
                    if (page.queryFields) {
                        soqlFields = page.queryFields.trim();
                        // Ensure Id is included if not already present
                        if (!soqlFields.toLowerCase().includes('id')) {
                            soqlFields = `Id, ${soqlFields}`;
                        }
                    }
                    
                    let soql = `SELECT ${soqlFields} FROM ${page.salesforceObject}`;
                    
                    // Add WHERE clause if configured
                    if (page.queryWhere) {
                        soql += ` WHERE ${page.queryWhere}`;
                    }
                    
                    // Add ORDER BY if configured
                    if (page.queryOrderBy) {
                        soql += ` ORDER BY ${page.queryOrderBy}`;
                    }
                    
                    // Add LIMIT if configured
                    const queryLimit = page.queryLimit || 100; // Default limit to prevent huge results
                    soql += ` LIMIT ${queryLimit}`;
                    
                    console.log(`Executing SOQL: ${soql}`);
                    
                    // Execute the query
                    const queryResult = await conn.query(soql);
                    console.log(`✅ Query returned ${queryResult.totalSize} records`);
                    
                    // Store query results as form variables for use by DataTable and other components
                    const queryVariables = {};
                    
                    console.log('📊 [QUERY DEBUG] Processing query results...');
                    console.log('📊 [QUERY DEBUG] Page ID:', page.id);
                    console.log('📊 [QUERY DEBUG] Query result:', {
                        totalSize: queryResult.totalSize,
                        recordsLength: queryResult.records ? queryResult.records.length : 0,
                        sampleRecord: queryResult.records && queryResult.records.length > 0 ? queryResult.records[0] : null
                    });
                    
                    // Store the full result set
                    const queryResultsVariable = `${page.id}_QueryResults`;
                    const queryCountVariable = `${page.id}_QueryCount`;
                    
                    queryVariables[queryResultsVariable] = JSON.stringify(queryResult.records);
                    queryVariables[queryCountVariable] = queryResult.totalSize.toString();
                    
                    console.log('📊 [QUERY DEBUG] Created primary variables:', {
                        [queryResultsVariable]: `JSON string with ${queryResult.records.length} records`,
                        [queryCountVariable]: queryResult.totalSize.toString()
                    });
                    
                    // Store individual field collections for easier access
                    if (queryResult.records && queryResult.records.length > 0) {
                        const sampleRecord = queryResult.records[0];
                        Object.keys(sampleRecord).forEach(fieldName => {
                            if (fieldName !== 'attributes') {
                                const fieldValues = queryResult.records.map(record => record[fieldName]).filter(val => val !== null && val !== undefined);
                                const listVariableName = `${page.id}_${fieldName}_List`;
                                queryVariables[listVariableName] = JSON.stringify(fieldValues);
                                console.log('📊 [QUERY DEBUG] Created field variable:', listVariableName, `with ${fieldValues.length} values`);
                            }
                        });
                    }
                    
                    // If page has a specific result variable name configured, use it
                    if (page.resultVariable) {
                        queryVariables[page.resultVariable] = JSON.stringify(queryResult.records);
                        console.log('📊 [QUERY DEBUG] Created result variable:', page.resultVariable);
                    }
                    
                    console.log('📊 [QUERY DEBUG] Total query variables created:', Object.keys(queryVariables));
                    
                    // Debug submission metadata before merging
                    console.log('📊 [QUERY DEBUG] submissionMetadata.variables before merge:', {
                        exists: !!submissionMetadata.variables,
                        keys: submissionMetadata.variables ? Object.keys(submissionMetadata.variables) : []
                    });
                    
                    // Merge query variables into submission metadata for next pages
                    if (!submissionMetadata.variables) {
                        submissionMetadata.variables = {};
                        console.log('📊 [QUERY DEBUG] Initialized submissionMetadata.variables');
                    }
                    
                    Object.assign(submissionMetadata.variables, queryVariables);
                    
                    console.log('📊 [QUERY DEBUG] submissionMetadata.variables after merge:', {
                        keys: Object.keys(submissionMetadata.variables),
                        count: Object.keys(submissionMetadata.variables).length,
                        queryVariablesAdded: Object.keys(queryVariables)
                    });
                    
                    console.log(`✅ Set query result variables:`, Object.keys(queryVariables));
                    
                    // Continue to next page - no record creation needed for query pages
                    continue;
                    
                } catch (error) {
                    console.error(`❌ FAILED to execute query on ${page.salesforceObject}:`, error.message);
                    throw new Error(`Failed to execute query on ${page.salesforceObject}: ${error.message}`);
                }
            }

            // Check if this is an update operation
            const isUpdate = page.actionType === 'update';
            
            if (isUpdate) {
                // For updates, we need to find the record ID from a variable or hidden field
                // PRIORITY 1: Check for page-specific record ID variable
                if (page.recordIdVariable && submissionMetadata.variables && submissionMetadata.variables[page.recordIdVariable]) {
                    recordId = submissionMetadata.variables[page.recordIdVariable];
                    console.log(`✅ Found record ID from page-specific variable "${page.recordIdVariable}": ${recordId}`);
                }
                
                // PRIORITY 2: Look for an ID field in the record data
                if (!recordId) {
                    const idFields = ['Id', 'id'];
                    for (const idField of idFields) {
                        if (record[idField]) {
                            recordId = record[idField];
                            delete record[idField]; // Remove ID from update payload
                            console.log(`✅ Found record ID from record data field "${idField}": ${recordId}`);
                            break;
                        }
                    }
                }
                
                // PRIORITY 3: Check for common ID variable patterns (fallback)
                if (!recordId && submissionMetadata.variables) {
                    const possibleIdVars = [`${page.salesforceObject}Id`, 'RecordId', 'Id'];
                    for (const varName of possibleIdVars) {
                        if (submissionMetadata.variables[varName]) {
                            recordId = submissionMetadata.variables[varName];
                            console.log(`✅ Found record ID from fallback variable "${varName}": ${recordId}`);
                            break;
                        }
                    }
                }
                
                if (!recordId) {
                    const errorMsg = page.recordIdVariable 
                        ? `UPDATE FAILED: Record ID variable "${page.recordIdVariable}" not found or has no value. Check that the variable is set by a Login field, lookup field, or manually created.`
                        : `UPDATE FAILED: No record ID found for ${page.salesforceObject} update. Configure a record ID variable in page properties or add a lookup field to store the record ID as a variable.`;
                    console.error(`❌ ${errorMsg}`);
                    throw new Error(errorMsg);
                }
            }

            // Only proceed if we have data for this object
            if (Object.keys(record).length > 0) {
                try {
                    if (isUpdate && recordId) {
                        console.log(`Updating ${page.salesforceObject} ID ${recordId} with payload:`, JSON.stringify(record, null, 2));
                        const result = await conn.sobject(page.salesforceObject).update({ Id: recordId, ...record });
                        console.log(`  ✅ Updated ${page.salesforceObject} with ID: ${recordId}`);
                        results.push({ pageId: page.id, result: { id: recordId, success: true } });
                        parentRecords[page.id] = recordId; // Store the record ID by its page ID
                    } else {
                        console.log(`Creating PARENT ${page.salesforceObject} with payload:`, JSON.stringify(record, null, 2));
                        const result = await conn.sobject(page.salesforceObject).create(record);
                        console.log(`  ✅ Created ${page.salesforceObject} with ID: ${result.id}`);
                        console.log(`  📋 Storing parent record ID: parentRecords["${page.id}"] = "${result.id}"`);
                        results.push({ pageId: page.id, result });
                        parentRecords[page.id] = result.id; // Store the created ID by its page ID
                    }
                } catch (e) {
                    const action = isUpdate ? 'update' : 'create';
                    console.error(`  ❌ FAILED to ${action} ${page.salesforceObject}:`, e.message);
                    // If a parent record fails, we cannot proceed with its children.
                    // We'll throw the error to stop the submission process.
                    throw new Error(`Failed to ${action} ${page.salesforceObject}: ${e.message}`);
                }
            }
        }

        // --- PASS 2: Create all child records (repeating pages) ---
        console.log('\n--- PASS 2: Creating Child Records ---');
        console.log('🔍 [PASS 2] Available parent records:', parentRecords);
        console.log('🔍 [PASS 2] formData keys:', Object.keys(formData));
        for (const page of form.pages) {
            if (!page.repeatConfig?.enabled) {
                continue; // Skip non-repeating (parent) pages
            }

            const instancesKey = `page_${page.id}_instances`;
            console.log(`DEBUG: Constructed instancesKey: '${instancesKey}'`);
            console.log(`DEBUG: Keys in formData:`, Object.keys(formData));
            console.log(`DEBUG: Does formData have this key? ${Object.prototype.hasOwnProperty.call(formData, instancesKey)}`);
            console.log(`DEBUG: Value of formData[instancesKey]:`, formData[instancesKey]);
            const instances = formData[instancesKey] || [];
            
            console.log(`DEBUG: Processing repeating page: ${page.id} (salesforceObject: ${page.salesforceObject})`);
            console.log(`DEBUG: Instances found: ${instances.length}`);

            // Find the parent record's ID - check both parentPageId and recordLinking.parentSource
            const parentPageId = page.parentPageId || page.recordLinking?.parentSource;
            const parentId = parentRecords[parentPageId];
            console.log(`DEBUG: Parent page ID: ${parentPageId} (from ${page.parentPageId ? 'parentPageId' : 'recordLinking.parentSource'}), Retrieved Parent ID: ${parentId}`);

            if (!parentId) {
                console.error(`  ⚠️  Could not find parent record ID for page ${page.id} (expected from page ${parentPageId}). Skipping child record creation.`);
                console.error(`  🔍  Available parent record IDs:`, Object.keys(parentRecords));
                continue;
            }

            console.log(`Found ${instances.length} instances for ${page.salesforceObject}. Parent ID: ${parentId}`);

            for (let i = 0; i < instances.length; i++) {
                const instanceData = instances[i];
                const record = {};

                // Map fields from the instance data
                for (const field of page.fields) {
                    if (field.salesforceField && instanceData[field.id]) {
                        record[field.salesforceField] = instanceData[field.id];
                    }
                }

                // Set the relationship to the parent record - check both parentField and recordLinking.relationshipField
                const parentField = page.parentField || page.recordLinking?.relationshipField;
                if (parentField) {
                    record[parentField] = parentId;
                    console.log(`DEBUG: Setting parentField ${parentField} (from ${page.parentField ? 'parentField' : 'recordLinking.relationshipField'}) to ${parentId} for instance ${i}`);
                } else {
                    console.error(`  ⚠️  Configuration error: parentField not defined for repeating page ${page.id}`);
                    console.error(`     Expected field like 'AccountId' to link ${page.salesforceObject} to parent record.`);
                    console.error(`     Please configure the relationship field in the form builder.`);
                    continue; // Skip this instance if mapping is incomplete
                }

                console.log(`  Creating CHILD ${page.salesforceObject} [${i+1}/${instances.length}] with payload:`, JSON.stringify(record, null, 2));
                try {
                    const result = await conn.sobject(page.salesforceObject).create(record);
                    console.log(`    ✅ Created ${page.salesforceObject} with ID: ${result.id}`);
                    results.push({ pageId: page.id, instance: i, result });
                } catch (e) {
                    console.error(`    ❌ FAILED to create ${page.salesforceObject} [${i+1}/${instances.length}]:`, e.message);
                    // We can choose to continue or fail the whole submission. For now, let's continue.
                }
            }
        }
        
        // Handle file uploads and signatures
        await handleAttachments(conn, form, formData, results, req.files, req);
        
        // Record submission for analytics and audit trail
        const submission = recordSubmission(formId, formData, results, req.files || []);
        submission.ipAddress = req.ip || req.connection.remoteAddress;
        submission.userAgent = req.get('User-Agent');
        
        // Update submission with IP and user agent
        const submissionsDB = getSubmissionsDB();
        submissionsDB.submissions[submission.id] = submission;
        saveSubmissionsDB(submissionsDB);
        
        // Enhanced debugging for variable return
        console.log('📨 [SERVER DEBUG] Preparing response...');
        console.log('📨 [SERVER DEBUG] submissionMetadata.variables:', {
            exists: !!submissionMetadata.variables,
            keys: submissionMetadata.variables ? Object.keys(submissionMetadata.variables) : [],
            count: submissionMetadata.variables ? Object.keys(submissionMetadata.variables).length : 0,
            preview: submissionMetadata.variables ? Object.fromEntries(
                Object.entries(submissionMetadata.variables).slice(0, 3).map(([key, value]) => [
                    key, 
                    typeof value === 'string' && value.length > 100 ? 
                        `${value.substring(0, 100)}...` : value
                ])
            ) : 'N/A'
        });
        
        const responseVariables = submissionMetadata.variables || {};
        console.log('📨 [SERVER DEBUG] Response variables:', Object.keys(responseVariables));
        
        const response = { 
            success: true, 
            results,
            submissionId: submission.id,
            redirectUrl: form.redirectUrl || '/thank-you',
            variables: responseVariables,
            serverDebugInfo: {
                timestamp: new Date().toISOString(),
                variablesProvided: Object.keys(responseVariables),
                hasSubmissionMetadataVariables: !!submissionMetadata.variables,
                debugMarker: "SERVER_CHANGES_ACTIVE"
            }
        };
        
        // Store submission in database for auditing purposes
        try {
            const submissionRecord = await FormSubmission.create({
                formId: formId,
                orgId: form.creatorOrgId, // Use the form creator's org ID
                salesforceRecordId: results.length > 0 ? results[0].result.id : null,
                salesforceObjectType: form.pages.length > 0 ? form.pages[0].salesforceObject : null,
                submissionData: {
                    formData: formData,
                    submissionMetadata: submissionMetadata,
                    fileUploads: req.files ? req.files.map(f => ({
                        fieldname: f.fieldname,
                        originalname: f.originalname,
                        size: f.size,
                        mimetype: f.mimetype
                    })) : [],
                    salesforceResults: results,
                    variables: responseVariables
                },
                submitterEmail: formData.email || formData.contactEmail || submissionMetadata.email || null,
                submitterIp: req.ip || req.connection.remoteAddress || null,
                userAgent: req.get('User-Agent') || null,
                submissionStatus: 'success'
            });
            
            console.log('📊 Submission stored for auditing with ID:', submissionRecord.id);
            
            // Add audit trail ID to response
            response.auditTrailId = submissionRecord.id;
            
        } catch (auditError) {
            console.error('Error storing submission for audit:', auditError);
            // Don't fail the submission if audit storage fails
            response.auditWarning = 'Submission succeeded but audit storage failed';
        }

        console.log('📨 [SERVER DEBUG] Final response structure:', {
            success: response.success,
            resultsCount: response.results ? response.results.length : 0,
            submissionId: response.submissionId,
            hasVariables: !!response.variables,
            variableCount: Object.keys(response.variables).length,
            variableKeys: Object.keys(response.variables),
            auditTrailId: response.auditTrailId
        });
        
        res.json(response);
        
    } catch (error) {
        console.error('Error submitting form:', error);
        
        // Store failed submission for auditing
        try {
            const db = getFormsDB();
            const form = db.forms[req.params.formId];
            
            await FormSubmission.create({
                formId: req.params.formId,
                orgId: form?.creatorOrgId || null,
                salesforceRecordId: null,
                salesforceObjectType: null,
                submissionData: {
                    formData: formData || req.body,
                    submissionMetadata: submissionMetadata || {},
                    fileUploads: req.files ? req.files.map(f => ({
                        fieldname: f.fieldname,
                        originalname: f.originalname,
                        size: f.size,
                        mimetype: f.mimetype
                    })) : [],
                    error: error.message,
                    errorStack: error.stack
                },
                submitterEmail: (formData && (formData.email || formData.contactEmail)) || null,
                submitterIp: req.ip || req.connection.remoteAddress || null,
                userAgent: req.get('User-Agent') || null,
                submissionStatus: 'failed',
                errorMessage: error.message
            });
            
            console.log('📊 Failed submission stored for auditing');
        } catch (auditError) {
            console.error('Error storing failed submission for audit:', auditError);
        }

        // Clean up any uploaded files on error
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                try {
                    if (fs.existsSync(file.path)) {
                        fs.unlinkSync(file.path);
                        console.log(`Cleaned up temporary file after error: ${file.path}`);
                    }
                } catch (cleanupError) {
                    console.error(`Error cleaning up file ${file.path}:`, cleanupError);
                }
            });
        }
        
        res.status(500).json({
            error: error.message,
            details: error.stack
        });
    }
});

// File upload route
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.json({
        success: true,
        file: {
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            path: `/uploads/${req.file.filename}`
        }
    });
});

// Form viewer route
app.get('/form/:formId', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'form-viewer.html'));
});

// Public form data endpoint (no authentication required for published forms)
app.get('/api/public/forms/:formId', (req, res) => {
    try {
        const { formId } = req.params;
        const db = getFormsDB();
        const form = db.forms[formId];
        
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }
        
        if (!form.published) {
            return res.status(404).json({ error: 'Form not found or not published' });
        }
        
        // Return the form data for public access
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.json(form);
    } catch (error) {
        console.error('Error fetching public form:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get form submissions (for form creators)
app.get('/api/forms/:formId/submissions', (req, res) => {
    try {
        const { formId } = req.params;
        const db = getFormsDB();
        const form = db.forms[formId];
        
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }
        
        // Check if user owns the form
        const userId = req.session.userInfo?.userId;
        const organizationId = req.session.userInfo?.organizationId;
        
        if (form.userId !== userId || form.organizationId !== organizationId) {
            return res.status(403).json({ error: 'Access denied. You can only view submissions for your own forms.' });
        }
        
        // Get submissions for this form
        const submissionsDB = getSubmissionsDB();
        const submissions = Object.values(submissionsDB.submissions)
            .filter(submission => submission.formId === formId)
            .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        
        res.json(submissions);
    } catch (error) {
        console.error('Error fetching submissions:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get submission analytics for a form
app.get('/api/forms/:formId/analytics', (req, res) => {
    try {
        const { formId } = req.params;
        const db = getFormsDB();
        const form = db.forms[formId];
        
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }
        
        // Check if user owns the form
        const userId = req.session.userInfo?.userId;
        const organizationId = req.session.userInfo?.organizationId;
        
        if (form.userId !== userId || form.organizationId !== organizationId) {
            return res.status(403).json({ error: 'Access denied.' });
        }
        
        // Get submissions for analytics
        const submissionsDB = getSubmissionsDB();
        const submissions = Object.values(submissionsDB.submissions)
            .filter(submission => submission.formId === formId);
        
        // Calculate analytics
        const analytics = {
            totalSubmissions: submissions.length,
            successfulSubmissions: submissions.filter(s => s.status === 'success').length,
            failedSubmissions: submissions.filter(s => s.status !== 'success').length,
            submissionsByDay: {},
            recentSubmissions: submissions
                .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
                .slice(0, 10),
            lastSubmittedAt: submissions.length > 0 ? 
                Math.max(...submissions.map(s => new Date(s.submittedAt))) : null
        };
        
        // Group submissions by day
        submissions.forEach(submission => {
            const date = new Date(submission.submittedAt).toISOString().split('T')[0];
            analytics.submissionsByDay[date] = (analytics.submissionsByDay[date] || 0) + 1;
        });
        
        res.json(analytics);
    } catch (error) {
        console.error('Error fetching analytics:', error);
        res.status(500).json({ error: error.message });
    }
});

// Export submissions as CSV
app.get('/api/forms/:formId/submissions/export', isAuthenticated, async (req, res) => {
    try {
        const { formId } = req.params;
        const { format = 'csv', status, startDate, endDate } = req.query;
        
        // Verify user has access to this form
        const db = getFormsDB();
        const form = db.forms[formId];
        
        if (!form) {
            return res.status(404).json({ error: 'Form not found' });
        }
        
        // Check if user owns the form
        const userId = req.session.userInfo?.userId;
        const organizationId = req.session.userInfo?.organizationId;
        
        if (form.userId !== userId || form.organizationId !== organizationId) {
            return res.status(403).json({ error: 'Access denied. You can only export submissions for your own forms.' });
        }
        
        // Build query conditions
        const whereConditions = { formId };
        
        if (status) {
            whereConditions.submissionStatus = status;
        }
        
        if (startDate || endDate) {
            whereConditions.createdAt = {};
            if (startDate) whereConditions.createdAt[Op.gte] = new Date(startDate);
            if (endDate) whereConditions.createdAt[Op.lte] = new Date(endDate);
        }
        
        // Get all submissions (no pagination for export)
        const submissions = await FormSubmission.findAll({
            where: whereConditions,
            order: [['createdAt', 'DESC']]
        });
        
        if (submissions.length === 0) {
            return res.status(404).json({ error: 'No submissions found for export' });
        }
        
        // Analyze form structure to get all possible field names
        const allFieldNames = new Set();
        const standardColumns = [
            'Submission ID',
            'Submission Date', 
            'Submission Status',
            'Submitter Email',
            'Submitter IP',
            'Salesforce Record ID',
            'Salesforce Object Type'
        ];
        
        // Collect all unique field names from all submissions
        submissions.forEach(submission => {
            const formData = submission.submissionData?.formData || {};
            Object.keys(formData).forEach(fieldName => {
                // Skip technical fields that start with page_ and end with _instances
                if (!fieldName.startsWith('page_') || !fieldName.endsWith('_instances')) {
                    allFieldNames.add(fieldName);
                }
            });
        });
        
        // Convert to sorted array for consistent column order
        const formFieldNames = Array.from(allFieldNames).sort();
        const allColumns = [...standardColumns, ...formFieldNames];
        
        if (format === 'csv') {
            // Generate CSV content
            let csvContent = '';
            
            // Add header row
            csvContent += allColumns.map(col => `"${col}"`).join(',') + '\n';
            
            // Add data rows
            submissions.forEach(submission => {
                const row = [];
                const formData = submission.submissionData?.formData || {};
                
                // Add standard columns
                row.push(`"${submission.id}"`);
                row.push(`"${submission.createdAt.toISOString()}"`);
                row.push(`"${submission.submissionStatus}"`);
                row.push(`"${submission.submitterEmail || ''}"`);
                row.push(`"${submission.submitterIp || ''}"`);
                row.push(`"${submission.salesforceRecordId || ''}"`);
                row.push(`"${submission.salesforceObjectType || ''}"`);
                
                // Add form field columns
                formFieldNames.forEach(fieldName => {
                    let value = formData[fieldName] || '';
                    
                    // Handle complex field values (objects, arrays)
                    if (typeof value === 'object') {
                        value = JSON.stringify(value);
                    }
                    
                    // Escape quotes in values
                    value = String(value).replace(/"/g, '""');
                    row.push(`"${value}"`);
                });
                
                csvContent += row.join(',') + '\n';
            });
            
            // Set response headers for CSV download
            const filename = `form_${formId}_submissions_${new Date().toISOString().split('T')[0]}.csv`;
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(csvContent);
            
        } else {
            // Return JSON format with structured data
            const exportData = {
                formId: formId,
                formName: form.name || 'Untitled Form',
                exportDate: new Date().toISOString(),
                totalSubmissions: submissions.length,
                columns: allColumns,
                submissions: submissions.map(submission => {
                    const formData = submission.submissionData?.formData || {};
                    const row = {
                        'Submission ID': submission.id,
                        'Submission Date': submission.createdAt.toISOString(),
                        'Submission Status': submission.submissionStatus,
                        'Submitter Email': submission.submitterEmail || '',
                        'Submitter IP': submission.submitterIp || '',
                        'Salesforce Record ID': submission.salesforceRecordId || '',
                        'Salesforce Object Type': submission.salesforceObjectType || ''
                    };
                    
                    // Add form field data
                    formFieldNames.forEach(fieldName => {
                        row[fieldName] = formData[fieldName] || '';
                    });
                    
                    return row;
                })
            };
            
            res.json(exportData);
        }
        
    } catch (error) {
        console.error('Error exporting submissions:', error);
        res.status(500).json({ error: error.message });
    }
});

// 404 handler
app.use((req, res) => {
    res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Error handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// =============================================================================
// HELPER FUNCTIONS FOR MULTI-ORG SUPPORT
// =============================================================================

// Test Connected App credentials
async function testConnectedApp(clientId, clientSecret, loginUrl) {
    console.log('Testing Connected App with:');
    console.log('  Client ID:', clientId);
    console.log('  Client Secret (first 5 chars): ', clientSecret ? clientSecret.substring(0, 5) + '...' : 'N/A');
    console.log('  Login URL:', loginUrl);
    
    // For now, we'll do basic validation and assume the credentials are valid
    // The real test will happen when the user tries to connect via OAuth
    if (!clientId || clientId.length < 10) {
        return { 
            valid: false, 
            error: 'Invalid Consumer Key format. Please verify your Connected App credentials.' 
        };
    }
    
    if (!clientSecret || clientSecret.length < 10) {
        return { 
            valid: false, 
            error: 'Invalid Consumer Secret format. Please verify your Connected App credentials.' 
        };
    }
    
    // Basic format validation for Salesforce client IDs (they typically start with 3MVG)
    if (!clientId.startsWith('3MVG')) {
        console.log('Warning: Consumer Key does not start with expected prefix "3MVG"');
    }
    
    console.log('Basic validation passed. Credentials appear to be properly formatted.');
    return { valid: true };
}

// PKCE helper functions
function generateCodeVerifier() {
    return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier) {
    return crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url');
}

function generateState() {
    return crypto.randomBytes(16).toString('hex');
}

// Start server
console.log('SSL_KEY_PATH:', process.env.SSL_KEY_PATH);
console.log('SSL_CERT_PATH:', process.env.SSL_CERT_PATH);
const PORT = process.env.PORT || 3000;

// SSL configuration
const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;

if (sslKeyPath && sslCertPath && fs.existsSync(sslKeyPath) && fs.existsSync(sslCertPath)) {
    let sslOptions;
    try {
        const keyContent = fs.readFileSync(sslKeyPath);
        const certContent = fs.readFileSync(sslCertPath);
        sslOptions = {
            key: keyContent,
            cert: certContent
        };
        console.log('✅ Successfully read SSL key and certificate files.');
    } catch (readError) {
        console.error('❌ Error reading SSL certificate files:', readError.message);
        console.log('⚠️ Falling back to HTTP server due to SSL file read error.');
    }

    if (sslOptions) {
        https.createServer(sslOptions, app).listen(PORT, () => {
            console.log(`✅ HTTPS Server running on port ${PORT}`);
            console.log(`   Public access at: https://${process.env.DOMAIN || 'localhost'}`);
        });
    } else {
        console.log('⚠️ Falling back to HTTP server because SSL options could not be set.');
        http.createServer(app).listen(PORT, () => {
            console.log(`✅ HTTP Server running on port ${PORT}`);
            console.log(`   Public access at: http://${process.env.DOMAIN || 'localhost'}:${PORT}`);
        });
    }
} else {
    console.log('⚠️ SSL certificates not found or not configured in .env. Starting HTTP server.');
    console.log('   To enable HTTPS, provide SSL_KEY_PATH and SSL_CERT_PATH.');
    http.createServer(app).listen(PORT, () => {
        console.log(`✅ HTTP Server running on port ${PORT}`);
        console.log(`   Public access at: http://${process.env.DOMAIN || 'localhost'}:${PORT}`);
    });
}