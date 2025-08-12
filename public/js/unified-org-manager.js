// Unified Organization Manager
// Handles all org management functionality in the main interface

// Override the showOrgManager function to use unified modal
window.showOrgManager = function() {
    const modal = document.getElementById('unifiedOrgModal');
    if (modal) {
        modal.style.display = 'block';
        loadOrganizations();
        checkCurrentConnection();
    }
};

// Load all organizations
async function loadOrganizations() {
    try {
        // Get auth headers
        const headers = window.Auth ? window.Auth.getHeaders() : { 'Content-Type': 'application/json' };
        
        const response = await fetch('/api/orgs', {
            method: 'GET',
            credentials: 'same-origin', // Important for including session cookies
            headers: headers
        });
        
        if (!response.ok) {
            console.error('Failed to load orgs:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const orgCards = document.getElementById('orgCards');
        if (!orgCards) return;
        
        // Extract organizations from the API response
        let orgsList = [];
        if (data && data.success && data.organizations) {
            // Use the organizations array from the response
            orgsList = Array.isArray(data.organizations) ? data.organizations : [];
        } else if (data && data.success) {
            // Combine userOrgs and availableOrgs (legacy support)
            const userOrgs = Array.isArray(data.userOrgs) ? data.userOrgs : [];
            const availableOrgs = Array.isArray(data.availableOrgs) ? data.availableOrgs : [];
            orgsList = [...userOrgs, ...availableOrgs];
        } else if (Array.isArray(data)) {
            // Fallback if direct array is returned
            orgsList = data;
        }
        
        if (orgsList.length === 0) {
            orgCards.innerHTML = `
                <div style="padding: 40px; text-align: center; background: #f9fafb; border-radius: 8px; grid-column: 1 / -1;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🏢</div>
                    <h3 style="color: #374151; margin-bottom: 8px;">No Organizations Yet</h3>
                    <p style="color: #6b7280;">Register your first Salesforce organization to get started.</p>
                </div>
            `;
        } else {
            orgCards.innerHTML = orgsList.map(org => `
                <div style="padding: 20px; background: white; border: 2px solid ${org.connected ? '#10b981' : '#e5e7eb'}; border-radius: 8px; position: relative;">
                    ${org.connected ? '<div style="position: absolute; top: 8px; right: 8px; width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></div>' : ''}
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <h4 style="margin: 0 0 8px 0; color: #111827; font-weight: 600;">${org.name || 'Unnamed Org'}</h4>
                            <div style="color: #6b7280; font-size: 14px;">
                                <div>Type: ${org.type || 'Production'}</div>
                                <div style="font-size: 12px; margin-top: 4px;">ID: ${org.id}</div>
                                ${org.instanceUrl ? `<div style="margin-top: 4px; font-size: 12px; word-break: break-all;">${org.instanceUrl}</div>` : ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; flex-shrink: 0;">
                            ${org.connected ? 
                                `<button onclick="switchToOrg('${org.id}')" style="padding: 6px 12px; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
                                    Use
                                </button>` :
                                `<button onclick="connectToOrg('${org.id}')" style="padding: 6px 12px; background: #10b981; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
                                    Connect
                                </button>`
                            }
                            <button onclick="deleteOrg('${org.id}')" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; font-size: 13px; cursor: pointer;">
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading organizations:', error);
        const orgCards = document.getElementById('orgCards');
        if (orgCards) {
            orgCards.innerHTML = `
                <div style="padding: 20px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; grid-column: 1 / -1;">
                    <p style="color: #dc2626; margin: 0;">Failed to load organizations. Please try again.</p>
                </div>
            `;
        }
    }
}

// Check current connection status
async function checkCurrentConnection() {
    try {
        const headers = window.Auth ? window.Auth.getHeaders() : { 'Content-Type': 'application/json' };
        const response = await fetch('/api/orgs/current', {
            method: 'GET',
            credentials: 'same-origin', // Include session cookies
            headers: headers
        });
        
        if (!response.ok) {
            console.error('Failed to check connection:', response.status, response.statusText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const orgDetails = document.getElementById('orgDetails');
        
        if (data.connected && data.org) {
            statusIndicator.style.background = '#10b981';
            statusText.textContent = 'Connected to Salesforce';
            orgDetails.textContent = `${data.org.name || 'Organization'} • ${data.org.username || 'No username'}`;
        } else {
            statusIndicator.style.background = '#ef4444';
            statusText.textContent = 'Not Connected';
            orgDetails.textContent = 'Connect to a Salesforce organization to start building forms';
        }
    } catch (error) {
        console.error('Error checking connection:', error);
        const statusIndicator = document.getElementById('statusIndicator');
        const statusText = document.getElementById('statusText');
        const orgDetails = document.getElementById('orgDetails');
        
        if (statusIndicator) statusIndicator.style.background = '#fbbf24';
        if (statusText) statusText.textContent = 'Connection status unknown';
        if (orgDetails) orgDetails.textContent = 'Unable to check connection status';
    }
}

// Close modal
window.closeUnifiedOrgModal = function() {
    const modal = document.getElementById('unifiedOrgModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Show registration form
window.showRegisterOrgForm = function() {
    document.getElementById('registerOrgForm').style.display = 'block';
    document.getElementById('quickConnectForm').style.display = 'none';
};

// Hide registration form
window.hideRegisterForm = function() {
    document.getElementById('registerOrgForm').style.display = 'none';
};

// Show connect form
window.showConnectForm = function() {
    document.getElementById('quickConnectForm').style.display = 'block';
    document.getElementById('registerOrgForm').style.display = 'none';
};

// Hide connect form
window.hideConnectForm = function() {
    document.getElementById('quickConnectForm').style.display = 'none';
};

// Register new organization
window.registerNewOrg = async function() {
    const name = document.getElementById('regOrgName').value.trim();
    const clientId = document.getElementById('regClientId').value.trim();
    const clientSecret = document.getElementById('regClientSecret').value.trim();
    const type = document.getElementById('regOrgType').value;
    const instanceUrl = document.getElementById('regInstanceUrl').value.trim();
    
    // Validate required fields
    if (!name) {
        alert('Please enter an organization name');
        document.getElementById('regOrgName').focus();
        return;
    }
    
    if (!clientId) {
        alert('Please enter the Client ID (Consumer Key) from your Salesforce Connected App');
        document.getElementById('regClientId').focus();
        return;
    }
    
    if (!clientSecret) {
        alert('Please enter the Client Secret (Consumer Secret) from your Salesforce Connected App');
        document.getElementById('regClientSecret').focus();
        return;
    }
    
    try {
        // Get auth headers
        const headers = window.Auth ? window.Auth.getHeaders() : { 'Content-Type': 'application/json' };
        
        const response = await fetch('/api/orgs/register', {
            method: 'POST',
            credentials: 'same-origin', // Include session cookies
            headers: headers,
            body: JSON.stringify({ 
                name, 
                clientId,
                clientSecret,
                type, 
                instanceUrl 
            })
        });
        
        const result = await response.json();
        if (result.success) {
            alert('Organization registered successfully! Now connect to it using OAuth.');
            hideRegisterForm();
            loadOrganizations();
            // Clear form
            document.getElementById('regOrgName').value = '';
            document.getElementById('regClientId').value = '';
            document.getElementById('regClientSecret').value = '';
            document.getElementById('regInstanceUrl').value = '';
            
            // If we got an orgId, offer to connect immediately
            if (result.orgId) {
                if (confirm('Would you like to connect to this organization now?')) {
                    connectToOrg(result.orgId);
                }
            }
        } else {
            alert('Failed to register organization: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error registering org:', error);
        alert('Failed to register organization. Please check your network connection and try again.');
    }
};

// Quick connect with credentials
window.quickConnect = async function() {
    const username = document.getElementById('unifiedSfUsername').value;
    const password = document.getElementById('unifiedSfPassword').value;
    const token = document.getElementById('unifiedSfToken').value;
    
    if (!username || !password) {
        alert('Please enter username and password');
        return;
    }
    
    try {
        const response = await fetch('/api/connect', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                username, 
                password: password + (token || '')
            })
        });
        
        const result = await response.json();
        if (result.success) {
            alert('Connected successfully!');
            hideConnectForm();
            checkCurrentConnection();
            loadOrganizations();
            // Clear form
            document.getElementById('unifiedSfUsername').value = '';
            document.getElementById('unifiedSfPassword').value = '';
            document.getElementById('unifiedSfToken').value = '';
            
            // Reload the page to refresh the interface
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            alert('Connection failed: ' + (result.error || 'Invalid credentials'));
        }
    } catch (error) {
        console.error('Error connecting:', error);
        alert('Failed to connect to Salesforce');
    }
};

// Connect to organization via OAuth
window.connectToOrg = async function(orgId) {
    try {
        // Get OAuth URL for the org
        const headers = window.Auth ? window.Auth.getHeaders() : { 'Content-Type': 'application/json' };
        const response = await fetch(`/api/orgs/${orgId}/auth-url`, {
            headers: headers,
            credentials: 'same-origin'
        });
        const data = await response.json();
        
        if (data.authUrl) {
            // Save current state
            sessionStorage.setItem('connectingOrgId', orgId);
            // Open OAuth window
            window.location.href = data.authUrl;
        } else {
            alert('Failed to get authorization URL. Make sure the organization is properly registered.');
        }
    } catch (error) {
        console.error('Error connecting to org:', error);
        alert('Failed to connect to organization');
    }
};

// Switch to a different connected org
window.switchToOrg = async function(orgId) {
    try {
        const headers = window.Auth ? window.Auth.getHeaders() : { 'Content-Type': 'application/json' };
        const response = await fetch(`/api/orgs/${orgId}/connect`, {
            method: 'POST',
            headers: headers,
            credentials: 'same-origin'
        });
        
        const result = await response.json();
        if (result.success) {
            alert('Switched to organization successfully!');
            closeUnifiedOrgModal();
            // Reload to refresh the interface
            window.location.reload();
        } else {
            alert('Failed to switch organization: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error switching org:', error);
        alert('Failed to switch organization');
    }
};

// Delete organization
window.deleteOrg = async function(orgId) {
    if (!confirm('Are you sure you want to delete this organization? This cannot be undone.')) {
        return;
    }
    
    try {
        const headers = window.Auth ? window.Auth.getHeaders() : { 'Content-Type': 'application/json' };
        const response = await fetch(`/api/orgs/${orgId}`, {
            method: 'DELETE',
            headers: headers,
            credentials: 'same-origin'
        });
        
        const result = await response.json();
        if (result.success) {
            alert('Organization deleted successfully');
            loadOrganizations();
            checkCurrentConnection();
        } else {
            alert('Failed to delete organization: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error deleting org:', error);
        alert('Failed to delete organization');
    }
};

// Refresh organization list
window.refreshOrgList = function() {
    loadOrganizations();
    checkCurrentConnection();
};

// Check if returning from OAuth
window.addEventListener('load', function() {
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    const orgId = sessionStorage.getItem('connectingOrgId');
    
    if (connected === 'true' && orgId) {
        sessionStorage.removeItem('connectingOrgId');
        // Show success message
        setTimeout(() => {
            alert('Successfully connected to Salesforce organization!');
        }, 500);
    } else if (connected === 'false') {
        sessionStorage.removeItem('connectingOrgId');
        setTimeout(() => {
            alert('Failed to connect to Salesforce. Please check your credentials and try again.');
        }, 500);
    }
});

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('unifiedOrgModal');
    if (event.target === modal) {
        closeUnifiedOrgModal();
    }
});