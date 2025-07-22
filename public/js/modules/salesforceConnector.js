// SalesforceConnector Module - Handles all Salesforce API interactions

export class SalesforceConnector {
    constructor() {
        this.baseUrl = '';
        this.objects = [];
        this.fieldCache = new Map();
        this.picklistCache = new Map();
    }
    
    // Helper method to handle API responses and detect session expiration
    async handleApiResponse(response) {
        if (!response.ok) {
            const errorData = await response.json();
            
            // Check if session expired
            if (response.status === 401 && errorData.sessionExpired) {
                console.log('Session expired, clearing connection state');
                window.AppState.salesforceConnected = false;
                window.AppState.userInfo = null;
                
                // Update UI to show disconnected state
                this.updateConnectionUI();
                
                // Show user-friendly message
                alert('Your Salesforce session has expired. Please reconnect.');
                
                throw new Error('Session expired');
            }
            
            throw new Error(errorData.error || 'API request failed');
        }
        
        return response;
    }
    
    async initialize() {
        console.log('Initializing SalesforceConnector module...');
        
        // Check connection status on load
        await this.checkConnectionStatus();
        
        // Update UI based on connection status
        this.updateConnectionUI();
        
        // Set up periodic connection check (every 5 minutes)
        this.startConnectionMonitoring();
    }
    
    startConnectionMonitoring() {
        // Clear any existing interval
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }
        
        // Check connection every 5 minutes
        this.connectionCheckInterval = setInterval(async () => {
            if (window.AppState.salesforceConnected) {
                console.log('Performing periodic connection check...');
                const stillConnected = await this.checkConnectionStatus();
                if (!stillConnected) {
                    console.log('Connection lost during periodic check');
                    this.updateConnectionUI();
                }
            }
        }, 5 * 60 * 1000); // 5 minutes
    }
    
    async checkConnectionStatus() {
        try {
            const response = await fetch('/api/salesforce/status', {
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            window.AppState.salesforceConnected = data.connected;
            window.AppState.userInfo = data.userInfo;
            
            if (data.connected) {
                this.baseUrl = data.instanceUrl;
                await this.loadObjects();
            }
            
            return data.connected;
        } catch (error) {
            console.error('Error checking Salesforce connection:', error);
            window.AppState.salesforceConnected = false;
            return false;
        }
    }
    
    updateConnectionUI() {
        // Check if we're in the form builder (has connection UI elements)
        const statusEl = document.getElementById('connectionStatus');
        if (!statusEl) {
            // We're likely in the form viewer, skip UI updates
            console.log('💡 SalesforceConnector: Connection UI elements not found, skipping UI update (likely in form viewer)');
            return;
        }
        
        const statusText = statusEl.querySelector('.status-text');
        const buildingBlocks = document.getElementById('buildingBlocks');
        const formActions = document.getElementById('formActions');
        const connectBtn = document.getElementById('connectBtn');
        const connectUsernameBtn = document.getElementById('connectUsernameBtn');
        
        if (window.AppState.salesforceConnected) {
            statusEl.classList.remove('disconnected');
            statusEl.classList.add('connected');
            
            // Show user information if available
            const userInfo = window.AppState.userInfo;
            if (userInfo) {
                statusText.innerHTML = `Connected as<br><strong>${userInfo.displayName || userInfo.username}</strong>`;
            } else {
                statusText.textContent = 'Connected';
            }
            
            // Hide connect buttons and show disconnect button
            connectBtn.style.display = 'none';
            connectUsernameBtn.style.display = 'none';
            
            // Show disconnect button if it doesn't exist
            let disconnectBtn = document.getElementById('disconnectBtn');
            if (!disconnectBtn) {
                disconnectBtn = document.createElement('button');
                disconnectBtn.id = 'disconnectBtn';
                disconnectBtn.className = 'button button-secondary';
                disconnectBtn.textContent = 'Disconnect';
                disconnectBtn.onclick = window.disconnectFromSalesforce;
                connectUsernameBtn.parentNode.appendChild(disconnectBtn);
            } else {
                disconnectBtn.style.display = 'block';
            }
            
            buildingBlocks.style.display = 'block';
            formActions.style.display = 'block';
        } else {
            statusEl.classList.remove('connected');
            statusEl.classList.add('disconnected');
            statusText.textContent = 'Not Connected';
            
            // Show connect buttons and hide disconnect button
            connectBtn.style.display = 'block';
            connectUsernameBtn.style.display = 'block';
            
            const disconnectBtn = document.getElementById('disconnectBtn');
            if (disconnectBtn) {
                disconnectBtn.style.display = 'none';
            }
            
            buildingBlocks.style.display = 'none';
            formActions.style.display = 'none';
        }
    }
    
    async connectWithOAuth() {
        try {
            const response = await fetch('/api/salesforce/auth-url');
            const data = await response.json();
            
            if (data.authUrl) {
                // Redirect to Salesforce OAuth
                window.location.href = data.authUrl;
            }
        } catch (error) {
            console.error('Error initiating OAuth:', error);
            alert('Failed to connect to Salesforce. Please try again.');
        }
    }
    
    async connectWithUsername(username, password, token) {
        try {
            const response = await fetch('/api/salesforce/connect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    username,
                    password,
                    securityToken: token
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                window.AppState.salesforceConnected = true;
                window.AppState.userInfo = data.userInfo;
                this.baseUrl = data.instanceUrl;
                
                await this.loadObjects();
                this.updateConnectionUI();
                
                alert('Successfully connected to Salesforce!');
            } else {
                throw new Error(data.error || 'Connection failed');
            }
        } catch (error) {
            console.error('Error connecting with username/password:', error);
            alert(`Failed to connect: ${error.message}`);
        }
    }
    
    async loadObjects() {
        try {
            this.objects = await this.getObjects();
            console.log(`Loaded ${this.objects.length} Salesforce objects`);
        } catch (error) {
            console.error('Error loading Salesforce objects:', error);
        }
    }
    
    async getObjects() {
        if (!window.AppState.salesforceConnected) {
            return [];
        }
        
        try {
            const response = await fetch('/api/salesforce/objects', {
                credentials: 'same-origin'
            });
            
            await this.handleApiResponse(response);
            
            return await response.json();
        } catch (error) {
            console.error('Error fetching Salesforce objects:', error);
            return [];
        }
    }
    
    async getObjectFields(objectName) {
        if (!window.AppState.salesforceConnected || !objectName) {
            return [];
        }
        
        // Check cache
        if (this.fieldCache.has(objectName)) {
            return this.fieldCache.get(objectName);
        }
        
        try {
            const response = await fetch(`/api/salesforce/objects/${objectName}/fields`, {
                credentials: 'same-origin'
            });
            
            await this.handleApiResponse(response);
            
            const fields = await response.json();
            
            // Cache the result
            this.fieldCache.set(objectName, fields);
            
            return fields;
        } catch (error) {
            console.error(`Error fetching fields for ${objectName}:`, error);
            return [];
        }
    }
    
    async getPicklistValues(objectName, fieldName) {
        if (!window.AppState.salesforceConnected || !objectName || !fieldName) {
            return [];
        }
        
        const cacheKey = `${objectName}.${fieldName}`;
        
        // Check cache
        if (this.picklistCache.has(cacheKey)) {
            return this.picklistCache.get(cacheKey);
        }
        
        try {
            const response = await fetch(
                `/api/salesforce/objects/${objectName}/fields/${fieldName}/picklist`, {
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch picklist values');
            }
            
            const values = await response.json();
            
            // Cache the result
            this.picklistCache.set(cacheKey, values);
            
            return values;
        } catch (error) {
            console.error(`Error fetching picklist values for ${objectName}.${fieldName}:`, error);
            return [];
        }
    }
    
    async searchRecords(objectName, query, displayField = 'Name', searchField = 'Name', filters = [], limit = 10) {
        if (!window.AppState.salesforceConnected || !objectName || !query) {
            return [];
        }
        
        try {
            const params = new URLSearchParams({
                q: query,
                displayField,
                searchField,
                limit: limit.toString()
            });
            
            // Add filters if provided
            if (filters && filters.length > 0) {
                params.append('filters', JSON.stringify(filters));
            }
            
            // Add formId for public forms (if available)
            if (window.currentFormId) {
                params.append('formId', window.currentFormId);
            }
            
            const response = await fetch(
                `/api/salesforce/objects/${objectName}/search?${params}`, {
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error('Failed to search records');
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error searching ${objectName} records:`, error);
            return [];
        }
    }
    
    async createRecord(objectName, data) {
        if (!window.AppState.salesforceConnected || !objectName) {
            throw new Error('Not connected to Salesforce');
        }
        
        try {
            const response = await fetch(`/api/salesforce/objects/${objectName}/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': window.AppState.sessionId
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to create record');
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error creating ${objectName} record:`, error);
            throw error;
        }
    }
    
    async updateRecord(objectName, recordId, data) {
        if (!window.AppState.salesforceConnected || !objectName || !recordId) {
            throw new Error('Invalid parameters for record update');
        }
        
        try {
            const response = await fetch(`/api/salesforce/objects/${objectName}/${recordId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': window.AppState.sessionId
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to update record');
            }
            
            return await response.json();
        } catch (error) {
            console.error(`Error updating ${objectName} record:`, error);
            throw error;
        }
    }
    
    async query(soql) {
        if (!window.AppState.salesforceConnected) {
            throw new Error('Not connected to Salesforce');
        }
        
        try {
            const response = await fetch('/api/salesforce/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-ID': window.AppState.sessionId
                },
                body: JSON.stringify({ query: soql })
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Query failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error executing SOQL query:', error);
            throw error;
        }
    }
    
    clearCache() {
        this.fieldCache.clear();
        this.picklistCache.clear();
    }
    
    async refreshConnection() {
        this.clearCache();
        await this.checkConnectionStatus();
        this.updateConnectionUI();
    }
    
    async disconnect() {
        try {
            await fetch('/api/salesforce/logout', {
                method: 'POST',
                credentials: 'same-origin'
            });
        } catch (error) {
            console.error('Error during logout:', error);
        }
        
        window.AppState.salesforceConnected = false;
        window.AppState.userInfo = null;
        this.baseUrl = '';
        this.objects = [];
        this.clearCache();
        this.updateConnectionUI();
    }
    
    // Helper method to get object metadata
    getObjectMetadata(objectName) {
        return this.objects.find(obj => obj.name === objectName);
    }
    
    // Helper method to check if object supports specific features
    supportsFeature(objectName, feature) {
        const metadata = this.getObjectMetadata(objectName);
        if (!metadata) return false;
        
        switch (feature) {
            case 'create':
                return metadata.createable !== false;
            case 'update':
                return metadata.updateable !== false;
            case 'delete':
                return metadata.deletable !== false;
            default:
                return false;
        }
    }
}