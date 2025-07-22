// Main entry point for Salesforce Form Builder
// This file loads and initializes all modules

import { FormBuilder } from './modules/formBuilder.js';
import { SalesforceConnector } from './modules/salesforceConnector.js';
import { DragDrop } from './modules/dragDrop.js';
import { FieldTypes } from './modules/fieldTypes.js';
import { ConditionalLogic } from './modules/conditionalLogic.js';
import { FormStorage } from './modules/formStorage.js';
import { AutoSave } from './modules/autoSave.js';
import { Signature } from './modules/signature.js';
import { MultiPage } from './modules/multiPage.js';
import { FlowLogic } from './modules/flowLogic.js';
import { Mobile } from './modules/mobile.js';

const { debugError, debugWarn, debugInfo, debugDebug, debugVerbose } = window.SFBDebug;

// Global state management
window.AppState = {
    salesforceConnected: false,
    userInfo: null,
    currentForm: null,
    selectedField: null,
    forms: new Map(),
    isDirty: false
};

// Initialize modules
const modules = {
    formBuilder: null,
    salesforce: null,
    dragDrop: null,
    fieldTypes: null,
    conditionalLogic: null,
    formStorage: null,
    autoSave: null,
    signature: null,
    multiPage: null,
    flowLogic: null,
    mobile: null,
    theme: null
};

// Application initialization
async function initializeApp() {
    debugInfo('Main', 'Initializing Salesforce Form Builder...');
    
    // Check for connection status in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const connected = urlParams.get('connected');
    
    
    // Initialize core modules
    modules.salesforce = new SalesforceConnector();
    modules.formBuilder = new FormBuilder();
    modules.fieldTypes = new FieldTypes();
    modules.dragDrop = new DragDrop();
    modules.conditionalLogic = new ConditionalLogic();
    modules.formStorage = new FormStorage();
    modules.autoSave = new AutoSave();
    modules.signature = new Signature();
    modules.multiPage = new MultiPage();
    modules.flowLogic = new FlowLogic();
    modules.mobile = new Mobile();
    
    // Initialize all modules
    await Promise.all([
        modules.salesforce.initialize(),
        modules.formBuilder.initialize(),
        modules.fieldTypes.initialize(),
        modules.dragDrop.initialize(),
        modules.conditionalLogic.initialize(),
        modules.formStorage.initialize(),
        modules.autoSave.initialize(),
        modules.signature.initialize(),
        modules.multiPage.initialize(),
        modules.flowLogic.initialize(),
        modules.mobile.initialize(),
    ]);
    
    // Make modules globally available
    window.AppModules = {
        salesforce: modules.salesforce,
        formBuilder: modules.formBuilder,
        fieldTypes: modules.fieldTypes,
        dragDrop: modules.dragDrop,
        conditionalLogic: modules.conditionalLogic,
        formStorage: modules.formStorage,
        autoSave: modules.autoSave,
        signature: modules.signature,
        multiPage: modules.multiPage,
        flowLogic: modules.flowLogic,
        mobile: modules.mobile,
    };
    
    // Set up global event listeners
    setupGlobalEventListeners();
    
    // Initialize org management
    await initializeOrgManagement();
    
    // Show welcome modal on first visit
    checkFirstVisit();
    
    // Clean up URL params
    if (connected) {
        window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    debugInfo('Main', 'Application initialized successfully');
}

// Global event listeners
function setupGlobalEventListeners() {
    // Form dirty state tracking
    document.addEventListener('formChanged', () => {
        window.AppState.isDirty = true;
    });
    
    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (window.AppState.isDirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
    
    // Handle window resize
    window.addEventListener('resize', debounce(() => {
        document.dispatchEvent(new Event('windowResized'));
    }, 250));
}

// Check first visit
function checkFirstVisit() {
    if (!localStorage.getItem('sfb_visited')) {
        document.getElementById('introModal').style.display = 'block';
        localStorage.setItem('sfb_visited', 'true');
    }
}

// Intro modal functions
window.closeIntroModal = function(showTutorial = false) {
    document.getElementById('introModal').style.display = 'none';
    if (showTutorial) {
        // Could add tutorial highlights here in the future
        debugInfo('Main', 'Tutorial mode enabled');
    }
};

// Global functions exposed to HTML
window.connectToSalesforce = async function() {
    await modules.salesforce.connectWithOAuth();
};

window.showUsernameLogin = function() {
    document.getElementById('usernameModal').style.display = 'block';
};

window.closeUsernameModal = function() {
    document.getElementById('usernameModal').style.display = 'none';
};

window.closeWelcomeModal = function() {
    document.getElementById('welcomeModal').style.display = 'none';
};

window.saveForm = async function() {
    await modules.formStorage.saveForm();
    // Show visual feedback
    const indicator = document.getElementById('autoSaveIndicator');
    const text = indicator.querySelector('.save-text');
    text.textContent = 'Draft saved';
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 2000);
};

window.publishForm = async function() {
    try {
        // First save the form
        debugInfo('Main', '🚀 Starting form publish process...');
        const savedForm = await modules.formStorage.saveForm();
        
        debugInfo('Main', '🔍 Saved form result:', savedForm);
        debugInfo('Main', '🔍 Saved form ID:', savedForm?.id);
        
        if (!savedForm || !savedForm.id) {
            debugError('Main', '❌ No valid form ID found');
            alert('Please save the form first before publishing.');
            return;
        }
        
        // Store the form ID for later use
        window.pendingPublishFormId = savedForm.id;
        debugInfo('Main', '✅ Set pendingPublishFormId to:', window.pendingPublishFormId);
        
        // Show publish settings modal
        document.getElementById('publishSettingsModal').style.display = 'block';
        
        // Set default dates (start now, end in 30 days)
        const now = new Date();
        const thirtyDaysLater = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
        
        document.getElementById('publishStartDate').value = formatDateTimeLocal(now);
        document.getElementById('publishEndDate').value = formatDateTimeLocal(thirtyDaysLater);
        
    } catch (error) {
        debugError('Main', 'Error preparing form for publishing:', error);
        alert('Failed to prepare form for publishing. Please try again.');
    }
};

window.newForm = function() {
    modules.formStorage.newForm();
};

window.showMyForms = async function() {
    await modules.formStorage.showMyForms();
};

window.closeMyFormsModal = function() {
    document.getElementById('myFormsModal').style.display = 'none';
};

// Forms search and filter functions
window.clearFormsSearch = function() {
    const searchInput = document.getElementById('formsSearchInput');
    const clearBtn = document.querySelector('.search-clear-btn');
    searchInput.value = '';
    clearBtn.style.display = 'none';
    if (modules.formStorage) {
        modules.formStorage.filterForms();
    }
};

// Setup forms search functionality when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('formsSearchInput');
    const statusFilter = document.getElementById('formsStatusFilter');
    const sortOrder = document.getElementById('formsSortOrder');
    const clearBtn = document.querySelector('.search-clear-btn');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            if (clearBtn) {
                clearBtn.style.display = e.target.value ? 'block' : 'none';
            }
            if (modules.formStorage) {
                modules.formStorage.filterForms();
            }
        });
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => {
            if (modules.formStorage) {
                modules.formStorage.filterForms();
            }
        });
    }

    if (sortOrder) {
        sortOrder.addEventListener('change', () => {
            if (modules.formStorage) {
                modules.formStorage.filterForms();
            }
        });
    }
});

window.previewForm = function() {
    modules.formBuilder.previewForm();
};

window.closePreviewModal = function() {
    document.getElementById('previewModal').style.display = 'none';
};




function showCopyFeedback(message) {
    const indicator = document.getElementById('autoSaveIndicator');
    const text = indicator.querySelector('.save-text');
    text.textContent = message;
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 2000);
}

window.addNewPage = function() {
    modules.multiPage.addPage();
};

window.disconnectFromSalesforce = async function() {
    if (confirm('Are you sure you want to disconnect from Salesforce? Any unsaved changes will be lost.')) {
        await modules.salesforce.disconnect();
    }
};

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Handle username/password form submission and button clicks
document.addEventListener('DOMContentLoaded', () => {
    const usernameForm = document.getElementById('usernameForm');
    if (usernameForm) {
        usernameForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('sfUsername').value;
            const password = document.getElementById('sfPassword').value;
            const token = document.getElementById('sfToken').value;
            
            await modules.salesforce.connectWithUsername(username, password, token);
            closeUsernameModal();
        });
    }
    
    // Add event listeners for connection buttons
    const connectBtn = document.getElementById('connectBtn');
    const connectUsernameBtn = document.getElementById('connectUsernameBtn');
    
    if (connectBtn) {
        connectBtn.addEventListener('click', connectToSalesforce);
    }
    
    if (connectUsernameBtn) {
        connectUsernameBtn.addEventListener('click', showUsernameLogin);
    }
});

// =============================================================================
// MULTI-ORG FUNCTIONALITY
// =============================================================================

// Org management state
window.AppState.orgs = [];
window.AppState.currentOrg = null;

// Initialize org management
async function initializeOrgManagement() {
    await loadAvailableOrgs();
    await checkCurrentOrgConnection();
    setupOrgEventListeners();
    updateOrgInterface();
}

// Load available organizations
async function loadAvailableOrgs() {
    try {
        const response = await fetch('/api/orgs');
        const data = await response.json();
        
        if (data.success) {
            window.AppState.orgs = data.availableOrgs || [];
            populateOrgSelector();
        }
    } catch (error) {
        debugError('Main', 'Error loading orgs:', error);
    }
}

// Check current org connection
async function checkCurrentOrgConnection() {
    try {
        const response = await fetch('/api/orgs/current');
        const data = await response.json();
        
        if (data.connected && data.org) {
            window.AppState.currentOrg = data.org;
            window.AppState.salesforceConnected = true;
            window.AppState.userInfo = data.userInfo;
        } else {
            window.AppState.currentOrg = null;
            window.AppState.salesforceConnected = false;
            window.AppState.userInfo = null;
        }
    } catch (error) {
        debugError('Main', 'Error checking current org:', error);
    }
}

// Populate org selector dropdown
function populateOrgSelector() {
    const orgSelector = document.getElementById('orgSelector');
    if (!orgSelector) return;
    
    // Clear existing options except the first one
    orgSelector.innerHTML = '<option value="">Choose Salesforce Org...</option>';
    
    // Add org options
    window.AppState.orgs.forEach(org => {
        const option = document.createElement('option');
        option.value = org.id;
        option.textContent = `${org.name} (${org.environment === 'sandbox' ? 'Sandbox' : 'Production'})`;
        orgSelector.appendChild(option);
    });
    
    // Select current org if connected
    if (window.AppState.currentOrg) {
        orgSelector.value = window.AppState.currentOrg.id;
    }
}

// Setup org-related event listeners
function setupOrgEventListeners() {
    const orgSelector = document.getElementById('orgSelector');
    const connectToOrgBtn = document.getElementById('connectToOrgBtn');
    const disconnectOrgBtn = document.getElementById('disconnectOrgBtn');
    
    if (orgSelector) {
        orgSelector.addEventListener('change', (e) => {
            const connectBtn = document.getElementById('connectToOrgBtn');
            if (connectBtn) {
                connectBtn.disabled = !e.target.value;
            }
        });
    }
    
    if (connectToOrgBtn) {
        connectToOrgBtn.addEventListener('click', connectToSelectedOrg);
    }
    
    if (disconnectOrgBtn) {
        disconnectOrgBtn.addEventListener('click', disconnectFromOrg);
    }
}

// Connect to selected org
async function connectToSelectedOrg() {
    const orgSelector = document.getElementById('orgSelector');
    const selectedOrgId = orgSelector?.value;
    
    if (!selectedOrgId) {
        alert('Please select an organization first.');
        return;
    }
    
    try {
        const response = await fetch(`/api/orgs/${selectedOrgId}/auth-url`);
        const data = await response.json();
        
        if (data.authUrl) {
            // Redirect to Salesforce OAuth
            window.location.href = data.authUrl;
        } else {
            alert('Failed to generate authorization URL. Please try again.');
        }
    } catch (error) {
        debugError('Main', 'Error connecting to org:', error);
        alert('Failed to connect to organization. Please try again.');
    }
}

// Disconnect from current org
async function disconnectFromOrg() {
    try {
        const response = await fetch('/api/orgs/disconnect', {
            method: 'POST'
        });
        
        if (response.ok) {
            window.AppState.currentOrg = null;
            window.AppState.salesforceConnected = false;
            window.AppState.userInfo = null;
            
            updateOrgInterface();
            updateConnectionStatus();
            
            // Hide form builder sections
            hideConnectedSections();
            
            alert('Disconnected successfully');
        } else {
            alert('Failed to disconnect. Please try again.');
        }
    } catch (error) {
        debugError('Main', 'Error disconnecting:', error);
        alert('Failed to disconnect. Please try again.');
    }
}

// Update org interface based on connection status
function updateOrgInterface() {
    const orgSelection = document.getElementById('orgSelection');
    const currentOrgStatus = document.getElementById('currentOrgStatus');
    const connectionStatus = document.getElementById('connectionStatus');
    const buildingBlocks = document.getElementById('buildingBlocks');
    
    if (window.AppState.currentOrg) {
        // Connected to an org
        if (orgSelection) orgSelection.style.display = 'none';
        if (currentOrgStatus) {
            currentOrgStatus.style.display = 'block';
            
            const orgName = document.getElementById('currentOrgName');
            const orgType = document.getElementById('currentOrgType');
            
            if (orgName) orgName.textContent = window.AppState.currentOrg.name;
            if (orgType) {
                orgType.textContent = window.AppState.currentOrg.environment === 'sandbox' 
                    ? '🧪 Sandbox Environment' 
                    : '🏢 Production Environment';
            }
        }
        
        if (connectionStatus) {
            connectionStatus.className = 'connection-status connected';
            connectionStatus.querySelector('.status-text').textContent = 'Connected';
        }
        
        if (buildingBlocks) buildingBlocks.style.display = 'block';
        
    } else {
        // Not connected
        if (window.AppState.orgs.length > 0) {
            // Show org selection if orgs are available
            if (orgSelection) orgSelection.style.display = 'block';
            if (currentOrgStatus) currentOrgStatus.style.display = 'none';
        } else {
            // No orgs available, show legacy connection
            if (orgSelection) orgSelection.style.display = 'none';
            if (currentOrgStatus) currentOrgStatus.style.display = 'none';
        }
        
        if (connectionStatus) {
            connectionStatus.className = 'connection-status disconnected';
            connectionStatus.querySelector('.status-text').textContent = 'Not Connected';
        }
        
        if (buildingBlocks) buildingBlocks.style.display = 'none';
    }
}

// Hide sections that require connection
function hideConnectedSections() {
    const buildingBlocks = document.getElementById('buildingBlocks');
    if (buildingBlocks) buildingBlocks.style.display = 'none';
}

// Update connection status display
function updateConnectionStatus() {
    const status = document.getElementById('connectionStatus');
    const bottomFooter = document.getElementById('bottomFooter');
    const buildingBlocks = document.getElementById('buildingBlocks');
    
    if (!status) return;
    
    if (window.AppState.salesforceConnected && window.AppState.currentOrg) {
        status.className = 'connection-status connected';
        status.querySelector('.status-text').textContent = 'Connected';
        
        // Show form building interface
        if (bottomFooter) bottomFooter.style.display = 'block';
        if (buildingBlocks) buildingBlocks.style.display = 'block';
    } else {
        status.className = 'connection-status disconnected';
        status.querySelector('.status-text').textContent = 'Not Connected';
        
        // Hide form building interface
        if (bottomFooter) bottomFooter.style.display = 'none';
        if (buildingBlocks) buildingBlocks.style.display = 'none';
    }
}

// Export modules for debugging
window.AppModules = modules;

// Global Variables Manager functions
window.showVariablesManager = function() {
    if (modules.formBuilder) {
        modules.formBuilder.showVariablesManager();
    }
};

window.closeVariablesModal = function() {
    if (modules.formBuilder) {
        modules.formBuilder.closeVariablesManager();
    }
};

window.refreshVariables = function() {
    if (modules.formBuilder) {
        modules.formBuilder.refreshVariablesList();
    }
};

window.addVariable = function() {
    if (modules.formBuilder) {
        modules.formBuilder.addVariable();
    }
};

window.debugConsole = function() {
    if (modules.formBuilder) {
        modules.formBuilder.debugConsole();
    }
};

window.exportVariables = function() {
    if (modules.formBuilder) {
        modules.formBuilder.exportVariables();
    }
};

window.clearAllVariables = function() {
    if (modules.formBuilder) {
        modules.formBuilder.clearAllVariables();
    }
};

// Login requirement utility functions
window.setupRequireLoginForNext = function() {
    if (modules.formBuilder) {
        modules.formBuilder.setupRequireLoginForButton('next');
    }
};

window.setupRequireLoginForSubmit = function() {
    if (modules.formBuilder) {
        modules.formBuilder.setupRequireLoginForButton('submit');
    }
};


// Export org management functions
window.OrgManager = {
    loadAvailableOrgs,
    checkCurrentOrgConnection,
    connectToSelectedOrg,
    disconnectFromOrg,
    updateOrgInterface
};

// Publish Success Modal Functions
window.closePublishSuccessModal = function() {
    const modal = document.getElementById('publishSuccessModal');
    if (modal) {
        modal.style.display = 'none';
        // Clear the inputs
        const linkInput = document.getElementById('formLinkInput');
        const embedInput = document.getElementById('embedCodeInput');
        if (linkInput) linkInput.value = '';
        if (embedInput) embedInput.value = '';
    }
};

// Helper function to format date for datetime-local input
window.formatDateTimeLocal = function(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

window.toggleDateRangeFields = function(enabled) {
    document.getElementById('dateRangeFields').style.display = enabled ? 'block' : 'none';
};

window.closePublishSettingsModal = function() {
    document.getElementById('publishSettingsModal').style.display = 'none';
    window.pendingPublishFormId = null;
};

window.confirmPublish = async function() {
    try {
        if (!window.pendingPublishFormId) {
            alert('No form selected for publishing.');
            return;
        }
        
        const publishSettings = {
            enableDateRange: document.getElementById('enableDateRange').checked
        };
        
        if (publishSettings.enableDateRange) {
            publishSettings.startDate = document.getElementById('publishStartDate').value;
            publishSettings.endDate = document.getElementById('publishEndDate').value;
            publishSettings.expirationMessage = document.getElementById('expirationMessage').value;
            
            // Validate dates
            if (!publishSettings.startDate || !publishSettings.endDate) {
                alert('Please specify both start and end dates.');
                return;
            }
            
            if (new Date(publishSettings.startDate) >= new Date(publishSettings.endDate)) {
                alert('End date must be after start date.');
                return;
            }
        }
        
        // Store the form ID before closing modal (since closeModal sets it to null)
        const formIdToPublish = window.pendingPublishFormId;
        debugInfo('Main', '🔍 Form ID to publish:', formIdToPublish);
        
        // Close settings modal
        closePublishSettingsModal();
        
        // Publish with settings using stored ID
        const result = await modules.formStorage.publishForm(formIdToPublish, publishSettings);
        
        if (result && result.publicUrl) {
            // Store form ID for export functionality
            window.lastPublishedFormId = formIdToPublish;
            modules.formStorage.showPublishSuccessModal(result.publicUrl);
        }
        
    } catch (error) {
        debugError('Main', 'Error publishing form:', error);
        alert('Failed to publish form. Please try again.');
    }
};

window.copyFormLink = async function() {
    const linkInput = document.getElementById('formLinkInput');
    if (linkInput && linkInput.value) {
        try {
            await navigator.clipboard.writeText(linkInput.value);
            showCopyFeedback('Form link copied to clipboard!');
        } catch (err) {
            // Fallback for older browsers
            linkInput.select();
            document.execCommand('copy');
            showCopyFeedback('Form link copied to clipboard!');
        }
    }
};

window.copyEmbedCode = async function() {
    const embedInput = document.getElementById('embedCodeInput');
    if (embedInput && embedInput.value) {
        try {
            await navigator.clipboard.writeText(embedInput.value);
            showCopyFeedback('Embed code copied to clipboard!');
        } catch (err) {
            // Fallback for older browsers
            embedInput.select();
            document.execCommand('copy');
            showCopyFeedback('Embed code copied to clipboard!');
        }
    }
};

window.closePublishSuccessModal = function() {
    document.getElementById('publishSuccessModal').style.display = 'none';
    // Clear the inputs
    document.getElementById('formLinkInput').value = '';
    document.getElementById('embedCodeInput').value = '';
    // Clear stored form ID
    window.lastPublishedFormId = null;
};

window.exportPublishedForm = function() {
    if (window.lastPublishedFormId && modules.formStorage) {
        modules.formStorage.exportForm(window.lastPublishedFormId);
    } else {
        alert('No form available for export');
    }
};

// Bulk actions for forms
window.updateBulkActionsVisibility = function() {
    const checkboxes = document.querySelectorAll('.form-select-checkbox:checked');
    const bulkActions = document.querySelector('.bulk-actions');
    
    if (bulkActions) {
        bulkActions.style.display = checkboxes.length > 0 ? 'flex' : 'none';
    }
};



window.selectAllForms = function() {
    const checkboxes = document.querySelectorAll('.form-select-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = true;
    });
    updateBulkActionsVisibility();
};

window.clearFormSelection = function() {
    const checkboxes = document.querySelectorAll('.form-select-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    updateBulkActionsVisibility();
};

window.bulkDeleteSelectedForms = async function() {
    const checkboxes = document.querySelectorAll('.form-select-checkbox:checked');
    if (checkboxes.length === 0) {
        alert('Please select forms to delete.');
        return;
    }
    
    const formIds = Array.from(checkboxes).map(cb => cb.dataset.formId);
    const formNames = Array.from(checkboxes).map(cb => {
        const card = cb.closest('.form-card');
        const titleElement = card.querySelector('.form-card-title');
        return titleElement ? titleElement.textContent.trim() : 'Unknown Form';
    });
    
    const confirmMessage = `Are you sure you want to delete ${formIds.length} form${formIds.length > 1 ? 's' : ''}?\n\nForms to be deleted:\n${formNames.join('\n')}\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    try {
        await modules.formStorage.bulkDeleteForms(formIds);
        // Clear selection and refresh
        clearFormSelection();
        // Refresh forms list
        await modules.formStorage.showMyForms();
    } catch (error) {
        debugError('Main', 'Error during bulk delete:', error);
        alert('Failed to delete some forms. Please try again.');
    }
};

// Collapsible sections functionality
function initializeCollapsibleSections() {
    // Add click handlers to all section headers
    document.addEventListener('click', function(e) {
        const sectionHeader = e.target.closest('.section h3');
        if (!sectionHeader) return;
        
        const section = sectionHeader.closest('.section');
        if (!section) return;
        
        // Toggle collapsed state
        section.classList.toggle('collapsed');
        
        // Save collapsed state to localStorage
        const sectionId = getSectionId(section);
        if (sectionId) {
            const collapsedSections = JSON.parse(localStorage.getItem('collapsedSections') || '[]');
            if (section.classList.contains('collapsed')) {
                if (!collapsedSections.includes(sectionId)) {
                    collapsedSections.push(sectionId);
                }
            } else {
                const index = collapsedSections.indexOf(sectionId);
                if (index > -1) {
                    collapsedSections.splice(index, 1);
                }
            }
            localStorage.setItem('collapsedSections', JSON.stringify(collapsedSections));
        }
    });
    
    // Restore collapsed states from localStorage
    function restoreCollapsedStates() {
        const collapsedSections = JSON.parse(localStorage.getItem('collapsedSections') || '[]');
        collapsedSections.forEach(sectionId => {
            const section = document.querySelector(`[data-section-id="${sectionId}"]`);
            if (section) {
                section.classList.add('collapsed');
            }
        });
    }
    
    // Helper function to get section ID
    function getSectionId(section) {
        // Try to get from data attribute first
        if (section.dataset.sectionId) {
            return section.dataset.sectionId;
        }
        
        // Generate ID from section header text
        const header = section.querySelector('h3');
        if (header) {
            const text = header.textContent.trim().replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
            section.dataset.sectionId = text;
            return text;
        }
        
        return null;
    }
    
    // Initial setup
    setTimeout(restoreCollapsedStates, 100);
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        initializeApp();
        initializeCollapsibleSections();
    });
} else {
    initializeApp();
    initializeCollapsibleSections();
}