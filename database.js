// Database Configuration for Multi-Org Support
const { Sequelize, DataTypes } = require('sequelize');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const path = require('path');

// Initialize Sequelize with SQLite for simplicity (can be changed to PostgreSQL/MySQL for production)
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'salesforce-form-builder.db'),
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
        timestamps: true,
        underscored: false
    }
});

// Encryption key for sensitive data (ensure it's always hex and correct length)
let ENCRYPTION_KEY;
if (process.env.ENCRYPTION_KEY) {
    // If provided, ensure it's 64 hex chars (32 bytes) for AES-256
    ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
    if (ENCRYPTION_KEY.length !== 64) {
        console.error('='.repeat(80));
        console.error('ERROR: ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).');
        console.error('Your key length:', ENCRYPTION_KEY.length);
        console.error('='.repeat(80));
        process.exit(1); // Exit to prevent data corruption
    }
} else {
    // Generate new key but warn strongly
    console.error('='.repeat(80));
    console.error('CRITICAL: No ENCRYPTION_KEY found in environment!');
    console.error('');
    console.error('Without a persistent encryption key, all org data will be lost on server restart.');
    console.error('');
    console.error('To fix this:');
    console.error('1. Generate a key: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    console.error('2. Add to .env file: ENCRYPTION_KEY=<your-generated-key>');
    console.error('3. Restart the server');
    console.error('');
    console.error('WARNING: Using temporary key - ALL DATA WILL BE LOST ON RESTART!');
    console.error('='.repeat(80));
    
    ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
}
const ALGORITHM = 'aes-256-gcm';

// Encryption utilities
function encrypt(text) {
    if (!text) return null;
    
    const iv = crypto.randomBytes(16);
    // Use createCipheriv instead of deprecated createCipher
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
        encrypted,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex')
    };
}

function decrypt(encryptedData) {
    if (!encryptedData || !encryptedData.encrypted) return null;
    
    try {
        // Use createDecipheriv instead of deprecated createDecipher
        const decipher = crypto.createDecipheriv(
            ALGORITHM, 
            Buffer.from(ENCRYPTION_KEY, 'hex'), 
            Buffer.from(encryptedData.iv, 'hex')
        );
        decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
        
        let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

// Define Models

// Salesforce Organizations table
const SalesforceOrg = sequelize.define('SalesforceOrg', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [1, 255]
        }
    },
    orgId: {
        type: DataTypes.STRING(18),
        allowNull: true, // Will be populated after first successful connection
        unique: true
    },
    clientId: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    clientSecret: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    loginUrl: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'https://login.salesforce.com',
        validate: {
            isUrl: true
        }
    },
    environment: {
        type: DataTypes.ENUM('production', 'sandbox'),
        allowNull: false,
        defaultValue: 'production'
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    lastConnectedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    createdBy: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'salesforce_orgs',
    indexes: [
        {
            unique: true,
            fields: ['orgId']
        },
        {
            fields: ['name']
        },
        {
            fields: ['environment']
        }
    ]
});

// User table for authentication
const User = sequelize.define('User', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    },
    firstName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    lastName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    verificationToken: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'users',
    indexes: [
        {
            unique: true,
            fields: ['email']
        }
    ],
    hooks: {
        beforeCreate: async (user) => {
            if (user.password) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        },
        beforeUpdate: async (user) => {
            if (user.changed('password')) {
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
            }
        }
    }
});

// Add instance method to verify password
User.prototype.verifyPassword = async function(password) {
    return await bcrypt.compare(password, this.password);
};

// User-Org Access table (stores OAuth tokens per user per org)
const UserOrgAccess = sequelize.define('UserOrgAccess', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    orgId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: SalesforceOrg,
            key: 'id'
        }
    },
    accessToken: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    refreshToken: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    instanceUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    tokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    lastAccessedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'user_org_access',
    indexes: [
        {
            unique: true,
            fields: ['userId', 'orgId']
        },
        {
            fields: ['userId']
        },
        {
            fields: ['orgId']
        }
    ]
});

// Form Submissions table (enhanced for analytics)
const FormSubmission = sequelize.define('FormSubmission', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    formId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    orgId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: SalesforceOrg,
            key: 'id'
        }
    },
    salesforceRecordId: {
        type: DataTypes.STRING(18),
        allowNull: true
    },
    salesforceObjectType: {
        type: DataTypes.STRING,
        allowNull: true
    },
    submissionData: {
        type: DataTypes.TEXT,
        allowNull: false,
        get() {
            const rawValue = this.getDataValue('submissionData');
            return rawValue ? JSON.parse(rawValue) : null;
        },
        set(value) {
            this.setDataValue('submissionData', JSON.stringify(value));
        }
    },
    submitterEmail: {
        type: DataTypes.STRING,
        allowNull: true
    },
    submitterIp: {
        type: DataTypes.STRING,
        allowNull: true
    },
    userAgent: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    submissionStatus: {
        type: DataTypes.ENUM('success', 'failed', 'partial'),
        allowNull: false,
        defaultValue: 'success'
    },
    errorMessage: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    processingTime: {
        type: DataTypes.INTEGER, // milliseconds
        allowNull: true
    }
}, {
    tableName: 'form_submissions',
    indexes: [
        {
            fields: ['formId']
        },
        {
            fields: ['orgId']
        },
        {
            fields: ['salesforceRecordId']
        },
        {
            fields: ['submitterEmail']
        },
        {
            fields: ['createdAt']
        }
    ]
});

// Define associations
User.hasMany(UserOrgAccess, { foreignKey: 'userId', as: 'orgAccess' });
UserOrgAccess.belongsTo(User, { foreignKey: 'userId', as: 'user' });

User.hasMany(SalesforceOrg, { foreignKey: 'createdBy', as: 'createdOrgs' });
SalesforceOrg.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

SalesforceOrg.hasMany(UserOrgAccess, { foreignKey: 'orgId', as: 'userAccess' });
UserOrgAccess.belongsTo(SalesforceOrg, { foreignKey: 'orgId', as: 'org' });

SalesforceOrg.hasMany(FormSubmission, { foreignKey: 'orgId', as: 'submissions' });
FormSubmission.belongsTo(SalesforceOrg, { foreignKey: 'orgId', as: 'org' });

// Database utilities
class DatabaseManager {
    static async initialize() {
        try {
            await sequelize.authenticate();
            console.log('✅ Database connection established successfully.');
            
            // Disable foreign key constraints temporarily for SQLite
            if (sequelize.getDialect() === 'sqlite') {
                await sequelize.query('PRAGMA foreign_keys = OFF;');
            }
            
            // Create tables - use force: false to avoid dropping existing tables
            try {
                await sequelize.sync({ alter: true });
                console.log('✅ Database tables synchronized.');
            } catch (syncError) {
                console.log('⚠️ Sync with alter failed, trying basic sync...');
                await sequelize.sync({ force: false });
                console.log('✅ Database tables created/updated.');
            }
            
            // Re-enable foreign key constraints
            if (sequelize.getDialect() === 'sqlite') {
                await sequelize.query('PRAGMA foreign_keys = ON;');
            }
            
            return true;
        } catch (error) {
            console.error('❌ Unable to connect to the database:', error);
            return false;
        }
    }

    // Org Management
    static async createOrg(orgData) {
        try {
            console.log('DatabaseManager.createOrg called with:', {
                name: orgData.name,
                clientId: orgData.clientId ? orgData.clientId.substring(0, 10) + '...' : 'N/A',
                loginUrl: orgData.loginUrl,
                environment: orgData.environment,
                createdBy: orgData.createdBy
            });
            
            // Encrypt sensitive data
            const encryptedClientSecret = encrypt(orgData.clientSecret);
            
            const org = await SalesforceOrg.create({
                name: orgData.name,
                clientId: orgData.clientId,
                clientSecret: JSON.stringify(encryptedClientSecret),
                loginUrl: orgData.loginUrl,
                environment: orgData.environment,
                createdBy: orgData.createdBy
            });

            console.log('Org created in database with ID:', org.id);
            return org;
        } catch (error) {
            console.error('Error creating org:', error.message);
            console.error('Full error:', error);
            throw error;
        }
    }

    static async getOrgs(activeOnly = true) {
        try {
            const where = activeOnly ? { isActive: true } : {};
            const orgs = await SalesforceOrg.findAll({
                where,
                attributes: ['id', 'name', 'environment', 'loginUrl', 'lastConnectedAt', 'createdAt', 'createdBy'],
                order: [['name', 'ASC']]
            });
            console.log('DatabaseManager.getOrgs found', orgs.length, 'orgs');
            return orgs;
        } catch (error) {
            console.error('Error fetching orgs:', error);
            throw error;
        }
    }

    static async getOrgById(orgId) {
        try {
            const org = await SalesforceOrg.findByPk(orgId);
            if (org && org.clientSecret) {
                try {
                    // Decrypt client secret
                    const encryptedData = JSON.parse(org.clientSecret);
                    org.decryptedClientSecret = decrypt(encryptedData);
                } catch (decryptError) {
                    console.error('Error decrypting client secret for org:', orgId, decryptError.message);
                    // Mark org as having decryption issues but don't throw
                    org.hasDecryptionError = true;
                    org.decryptedClientSecret = null;
                }
            }
            return org;
        } catch (error) {
            console.error('Error fetching org by ID:', error);
            throw error;
        }
    }

    static async cleanupCorruptedOrgs() {
        // CRITICAL WARNING: This function is permanently disabled to prevent data loss.
        // It was deleting orgs when the encryption key changed.
        console.error('='.repeat(80));
        console.error('WARNING: cleanupCorruptedOrgs() is permanently disabled.');
        console.error('This function is a high-risk operation and should not be used.');
        console.error('='.repeat(80));
        return { deletedCount: 0, message: 'Function permanently disabled for safety' };
    }
    
    static async updateOrgLastConnected(orgId, salesforceOrgId = null) {
        try {
            const updateData = { lastConnectedAt: new Date() };
            if (salesforceOrgId) {
                updateData.orgId = salesforceOrgId;
            }
            
            await SalesforceOrg.update(updateData, {
                where: { id: orgId }
            });
        } catch (error) {
            console.error('Error updating org last connected:', error);
            throw error;
        }
    }
    
    static async deleteOrg(orgId) {
        try {
            const org = await SalesforceOrg.findByPk(orgId);
            if (org) {
                console.log(`Deleting org: ${org.name} (${orgId})`);
                await org.destroy();
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error deleting org:', error);
            throw error;
        }
    }

    // User-Org Access Management
    static async storeUserOrgAccess(userId, orgId, tokenData) {
        try {
            const encryptedAccessToken = encrypt(tokenData.accessToken);
            const encryptedRefreshToken = encrypt(tokenData.refreshToken);

            const [userAccess, created] = await UserOrgAccess.upsert({
                userId,
                orgId,
                accessToken: JSON.stringify(encryptedAccessToken),
                refreshToken: JSON.stringify(encryptedRefreshToken),
                instanceUrl: tokenData.instanceUrl,
                tokenExpiresAt: tokenData.expiresAt,
                lastAccessedAt: new Date(),
                isActive: true
            });

            return userAccess;
        } catch (error) {
            console.error('Error storing user org access:', error);
            throw error;
        }
    }

    static async getUserOrgAccess(userId, orgId) {
        try {
            const access = await UserOrgAccess.findOne({
                where: { userId, orgId, isActive: true },
                include: [{
                    model: SalesforceOrg,
                    as: 'org',
                    attributes: ['id', 'name', 'loginUrl', 'environment']
                }]
            });

            if (access && access.accessToken && access.refreshToken) {
                // Decrypt tokens
                const encryptedAccessToken = JSON.parse(access.accessToken);
                const encryptedRefreshToken = JSON.parse(access.refreshToken);
                
                access.decryptedAccessToken = decrypt(encryptedAccessToken);
                access.decryptedRefreshToken = decrypt(encryptedRefreshToken);
            }

            return access;
        } catch (error) {
            console.error('Error fetching user org access:', error);
            throw error;
        }
    }

    static async getUserOrgs(userId) {
        try {
            const userAccess = await UserOrgAccess.findAll({
                where: { userId, isActive: true },
                include: [{
                    model: SalesforceOrg,
                    as: 'org',
                    where: { isActive: true },
                    attributes: ['id', 'name', 'environment', 'loginUrl', 'lastConnectedAt']
                }],
                order: [[{ model: SalesforceOrg, as: 'org' }, 'name', 'ASC']]
            });

            return userAccess.map(access => ({
                orgId: access.orgId,
                hasValidTokens: !!(access.accessToken && access.refreshToken),
                lastAccessed: access.lastAccessedAt,
                ...access.org.toJSON()
            }));
        } catch (error) {
            console.error('Error fetching user orgs:', error);
            throw error;
        }
    }

    // Form Submissions
    static async recordSubmission(submissionData) {
        try {
            return await FormSubmission.create(submissionData);
        } catch (error) {
            console.error('Error recording form submission:', error);
            throw error;
        }
    }

    static async getFormSubmissions(formId, orgId, options = {}) {
        try {
            const { limit = 50, offset = 0, startDate, endDate } = options;
            
            const where = { formId, orgId };
            
            if (startDate || endDate) {
                where.createdAt = {};
                if (startDate) where.createdAt[Op.gte] = startDate;
                if (endDate) where.createdAt[Op.lte] = endDate;
            }

            return await FormSubmission.findAndCountAll({
                where,
                limit,
                offset,
                order: [['createdAt', 'DESC']],
                include: [{
                    model: SalesforceOrg,
                    as: 'org',
                    attributes: ['name', 'environment']
                }]
            });
        } catch (error) {
            console.error('Error fetching form submissions:', error);
            throw error;
        }
    }

    static async getFormAnalytics(formId, orgId, timeRange = '30d') {
        try {
            const days = parseInt(timeRange.replace('d', ''));
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const [totalSubmissions, successfulSubmissions, failedSubmissions] = await Promise.all([
                FormSubmission.count({
                    where: { formId, orgId, createdAt: { [Op.gte]: startDate } }
                }),
                FormSubmission.count({
                    where: { formId, orgId, submissionStatus: 'success', createdAt: { [Op.gte]: startDate } }
                }),
                FormSubmission.count({
                    where: { formId, orgId, submissionStatus: 'failed', createdAt: { [Op.gte]: startDate } }
                })
            ]);

            // Get daily submission counts for the time range
            const dailyStats = await FormSubmission.findAll({
                where: { formId, orgId, createdAt: { [Op.gte]: startDate } },
                attributes: [
                    [sequelize.fn('DATE', sequelize.col('createdAt')), 'date'],
                    [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
                    [sequelize.fn('COUNT', sequelize.literal("CASE WHEN submissionStatus = 'success' THEN 1 END")), 'successful']
                ],
                group: [sequelize.fn('DATE', sequelize.col('createdAt'))],
                order: [[sequelize.fn('DATE', sequelize.col('createdAt')), 'ASC']]
            });

            return {
                totalSubmissions,
                successfulSubmissions,
                failedSubmissions,
                successRate: totalSubmissions > 0 ? (successfulSubmissions / totalSubmissions * 100).toFixed(2) : 0,
                dailyStats: dailyStats.map(stat => ({
                    date: stat.getDataValue('date'),
                    total: stat.getDataValue('count'),
                    successful: stat.getDataValue('successful')
                })),
                timeRange: `${days} days`
            };
        } catch (error) {
            console.error('Error fetching form analytics:', error);
            throw error;
        }
    }

    // User Management Methods
    static async createUser(userData) {
        try {
            const user = await User.create(userData);
            return user;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    static async getUserByEmail(email) {
        try {
            const user = await User.findOne({
                where: { email: email.toLowerCase() }
            });
            return user;
        } catch (error) {
            console.error('Error fetching user by email:', error);
            throw error;
        }
    }

    static async getUserById(userId) {
        try {
            const user = await User.findByPk(userId);
            return user;
        } catch (error) {
            console.error('Error fetching user by ID:', error);
            throw error;
        }
    }

    static async updateUserLastLogin(userId) {
        try {
            await User.update(
                { lastLoginAt: new Date() },
                { where: { id: userId } }
            );
        } catch (error) {
            console.error('Error updating user last login:', error);
            throw error;
        }
    }

    static async getUserOrganizations(userId) {
        try {
            const userOrgAccess = await UserOrgAccess.findAll({
                where: { userId, isActive: true },
                include: [{
                    model: SalesforceOrg,
                    as: 'org',
                    where: { isActive: true }
                }]
            });
            return userOrgAccess.map(access => access.org);
        } catch (error) {
            console.error('Error fetching user organizations:', error);
            throw error;
        }
    }

    static async linkUserToOrg(userId, orgId) {
        try {
            const [userOrgAccess, created] = await UserOrgAccess.findOrCreate({
                where: { userId, orgId },
                defaults: { isActive: true }
            });
            
            if (!created && !userOrgAccess.isActive) {
                userOrgAccess.isActive = true;
                await userOrgAccess.save();
            }
            
            return userOrgAccess;
        } catch (error) {
            console.error('Error linking user to org:', error);
            throw error;
        }
    }
}

module.exports = {
    sequelize,
    User,
    SalesforceOrg,
    UserOrgAccess,
    FormSubmission,
    DatabaseManager,
    encrypt,
    decrypt
};