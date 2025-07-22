// Modern Interface Controller for Salesforce Form Builder
// Handles floating UI, FABs, dark mode, and modern interactions

class ModernInterface {
    constructor() {
        this.isModernMode = false;
        this.isDarkMode = false;
        this.fabMenuOpen = false;
        this.fieldPaletteOpen = false;
        this.propertiesOpen = false;
        this.currentTheme = 'light';
        
        this.init();
    }
    
    init() {
        // Check if modern mode should be enabled (based on screen size or user preference)
        this.checkModernMode();
        
        // Initialize theme from localStorage
        this.initializeTheme();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize interface
        if (this.isModernMode) {
            this.enableModernInterface();
        }
        
        console.log('🚀 Modern Interface initialized');
    }
    
    checkModernMode() {
        // Enable modern mode by default on touch devices or if user prefers it
        const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        const userPreference = localStorage.getItem('sfb-modern-mode');
        const isSmallScreen = window.innerWidth < 1024;
        
        this.isModernMode = userPreference === 'true' || isTouchDevice || isSmallScreen;
    }
    
    initializeTheme() {
        const savedTheme = localStorage.getItem('sfb-theme') || 'light';
        this.setTheme(savedTheme);
    }
    
    setupEventListeners() {
        // Window resize handler
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
        
        // Click outside to close panels
        document.addEventListener('click', (e) => {
            this.handleOutsideClick(e);
        });
        
        // Escape key to close panels
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllPanels();
            }
        });
    }
    
    enableModernInterface() {
        const legacyContainer = document.querySelector('.container');
        const modernShell = document.getElementById('modernAppShell');
        const legacyHeader = document.querySelector('.top-header');
        const legacyFooter = document.getElementById('bottomFooter');
        
        if (legacyContainer) legacyContainer.style.display = 'none';
        if (legacyHeader) legacyHeader.style.display = 'none';
        if (legacyFooter) legacyFooter.style.display = 'none';
        if (modernShell) modernShell.style.display = 'block';
        
        // Add modern mode class to body
        document.body.classList.add('modern-mode');
        
        // Update connection status in modern interface
        this.updateConnectionStatus();
        
        console.log('✨ Modern interface enabled');
    }
    
    disableModernInterface() {
        const legacyContainer = document.querySelector('.container');
        const modernShell = document.getElementById('modernAppShell');
        const legacyHeader = document.querySelector('.top-header');
        const legacyFooter = document.getElementById('bottomFooter');
        
        if (legacyContainer) legacyContainer.style.display = 'block';
        if (legacyHeader) legacyHeader.style.display = 'flex';
        if (legacyFooter) legacyFooter.style.display = 'flex';
        if (modernShell) modernShell.style.display = 'none';
        
        // Remove modern mode class from body
        document.body.classList.remove('modern-mode');
        
        console.log('📋 Legacy interface enabled');
    }
    
    toggleModernMode() {
        this.isModernMode = !this.isModernMode;
        localStorage.setItem('sfb-modern-mode', this.isModernMode.toString());
        
        if (this.isModernMode) {
            this.enableModernInterface();
        } else {
            this.disableModernInterface();
        }
    }
    
    setTheme(theme) {
        this.currentTheme = theme;
        this.isDarkMode = theme === 'dark';
        
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('sfb-theme', theme);
        
        // Update theme toggle button
        const themeBtn = document.querySelector('[onclick="toggleTheme()"]');
        if (themeBtn) {
            themeBtn.textContent = this.isDarkMode ? '☀️' : '🌙';
        }
        
        console.log(`🎨 Theme set to: ${theme}`);
    }
    
    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }
    
    updateConnectionStatus() {
        const isConnected = window.AppState?.salesforceConnected || false;
        const modernStatus = document.getElementById('modernConnectionStatus');
        const legacyStatus = document.getElementById('connectionStatus');
        
        if (modernStatus) {
            if (isConnected) {
                modernStatus.className = 'connection-indicator connected';
                modernStatus.querySelector('.status-text').textContent = 'Connected';
            } else {
                modernStatus.className = 'connection-indicator disconnected';
                modernStatus.querySelector('.status-text').textContent = 'Not Connected';
            }
        }
        
        // Keep legacy status in sync
        if (legacyStatus) {
            if (isConnected) {
                legacyStatus.className = 'connection-status connected';
                legacyStatus.querySelector('.status-text').textContent = 'Connected';
            } else {
                legacyStatus.className = 'connection-status disconnected';
                legacyStatus.querySelector('.status-text').textContent = 'Not Connected';
            }
        }
    }
    
    toggleFabMenu() {
        const fabMenu = document.getElementById('fabMenu');
        const mainFab = document.querySelector('.main-fab');
        
        this.fabMenuOpen = !this.fabMenuOpen;
        
        if (fabMenu) {
            fabMenu.classList.toggle('active', this.fabMenuOpen);
        }
        
        if (mainFab) {
            mainFab.classList.toggle('active', this.fabMenuOpen);
        }
        
        // Add haptic feedback on supported devices
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }
    
    toggleFieldPalette() {
        const palette = document.getElementById('modernFieldPalette');
        this.fieldPaletteOpen = !this.fieldPaletteOpen;
        
        if (palette) {
            palette.classList.toggle('active', this.fieldPaletteOpen);
        }
        
        // Close other panels
        if (this.fieldPaletteOpen) {
            this.closePropertiesPanel();
        }
        
        // Add body class for backdrop
        document.body.classList.toggle('palette-open', this.fieldPaletteOpen);
    }
    
    togglePropertiesPanel() {
        const properties = document.getElementById('modernPropertiesCard');
        this.propertiesOpen = !this.propertiesOpen;
        
        if (properties) {
            properties.classList.toggle('active', this.propertiesOpen);
        }
        
        // Close other panels
        if (this.propertiesOpen) {
            this.closeFieldPalette();
        }
        
        // Add body class for backdrop
        document.body.classList.toggle('properties-open', this.propertiesOpen);
    }
    
    closeFieldPalette() {
        const palette = document.getElementById('modernFieldPalette');
        this.fieldPaletteOpen = false;
        
        if (palette) {
            palette.classList.remove('active');
        }
        
        document.body.classList.remove('palette-open');
    }
    
    closePropertiesPanel() {
        const properties = document.getElementById('modernPropertiesCard');
        this.propertiesOpen = false;
        
        if (properties) {
            properties.classList.remove('active');
        }
        
        document.body.classList.remove('properties-open');
    }
    
    closeAllPanels() {
        this.closeFieldPalette();
        this.closePropertiesPanel();
        
        // Close FAB menu
        if (this.fabMenuOpen) {
            this.toggleFabMenu();
        }
    }
    
    handleOutsideClick(e) {
        const palette = document.getElementById('modernFieldPalette');
        const properties = document.getElementById('modernPropertiesCard');
        const fab = document.querySelector('.fab-container');
        
        // Close palette if clicking outside
        if (this.fieldPaletteOpen && palette && !palette.contains(e.target)) {
            this.closeFieldPalette();
        }
        
        // Close properties if clicking outside
        if (this.propertiesOpen && properties && !properties.contains(e.target)) {
            this.closePropertiesPanel();
        }
        
        // Close FAB menu if clicking outside
        if (this.fabMenuOpen && fab && !fab.contains(e.target)) {
            this.toggleFabMenu();
        }
    }
    
    handleResize() {
        // Re-check modern mode on resize
        const wasModern = this.isModernMode;
        this.checkModernMode();
        
        if (wasModern !== this.isModernMode) {
            if (this.isModernMode) {
                this.enableModernInterface();
            } else {
                this.disableModernInterface();
            }
        }
    }
    
    handleKeyboardShortcuts(e) {
        // Cmd/Ctrl + K to open field palette
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            this.toggleFieldPalette();
        }
        
        // Cmd/Ctrl + ; to open properties
        if ((e.metaKey || e.ctrlKey) && e.key === ';') {
            e.preventDefault();
            this.togglePropertiesPanel();
        }
        
        // Cmd/Ctrl + S to save
        if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            if (window.saveForm) {
                window.saveForm();
            }
        }
        
        // Cmd/Ctrl + P to preview
        if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
            e.preventDefault();
            if (window.previewForm) {
                window.previewForm();
            }
        }
    }
    
    addFieldFromModernPalette(fieldType) {
        // Use the existing drag and drop functionality
        const dragDrop = window.AppModules?.dragDrop;
        const formBuilder = window.AppModules?.formBuilder;
        
        if (formBuilder && formBuilder.getCurrentPage()) {
            const newFieldId = formBuilder.generateFieldId();
            const newField = formBuilder.createFieldFromType(fieldType, newFieldId);
            
            // Add to the current page's fields
            const currentPage = formBuilder.getCurrentPage();
            if (!currentPage.fields) {
                currentPage.fields = [];
            }
            currentPage.fields.push(newField);
            
            // Visual feedback
            this.showFieldAddedFeedback(fieldType);
            
            // Render the updated form and select the new field
            this.renderModernFormCanvas();
            formBuilder.selectField(newFieldId);
            
            // Close palette after adding field
            this.closeFieldPalette();
            
            // Open properties panel to configure the new field
            if (!this.propertiesOpen) {
                this.togglePropertiesPanel();
            }
            
            console.log(`✅ Field ${fieldType} added via modern palette`);
        } else {
            console.error('❌ Cannot add field - no current page or form builder');
            this.showErrorFeedback('Please connect to Salesforce and create a form first');
        }
    }
    
    showFieldAddedFeedback(fieldType) {
        // Create a toast notification
        const toast = document.createElement('div');
        toast.className = 'modern-toast success';
        toast.innerHTML = `
            <div class="toast-icon">✅</div>
            <div class="toast-message">${fieldType} field added!</div>
        `;
        
        // Add toast styles if not already added
        if (!document.querySelector('#modern-toast-styles')) {
            const style = document.createElement('style');
            style.id = 'modern-toast-styles';
            style.textContent = `
                .modern-toast {
                    position: fixed;
                    top: 100px;
                    right: 24px;
                    background: white;
                    border: 1px solid var(--gray-200);
                    border-radius: var(--radius-xl);
                    box-shadow: var(--shadow-xl);
                    padding: 16px 20px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    z-index: 10000;
                    font-weight: 600;
                    animation: slideInRight 0.3s ease-out, fadeOutRight 0.3s ease-out 2s forwards;
                }
                
                .modern-toast.success {
                    border-left: 4px solid var(--secondary-500);
                }
                
                .modern-toast.error {
                    border-left: 4px solid var(--accent-red);
                }
                
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                
                @keyframes fadeOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                
                [data-theme="dark"] .modern-toast {
                    background: var(--dark-bg-secondary);
                    border-color: var(--gray-700);
                    color: var(--dark-text-primary);
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 2500);
    }
    
    showErrorFeedback(message) {
        const toast = document.createElement('div');
        toast.className = 'modern-toast error';
        toast.innerHTML = `
            <div class="toast-icon">❌</div>
            <div class="toast-message">${message}</div>
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 3000);
    }
    
    renderModernFormCanvas() {
        const canvas = document.getElementById('modernFormCanvas');
        const formBuilder = window.AppModules?.formBuilder;
        
        if (!canvas || !formBuilder) return;
        
        const currentPage = formBuilder.getCurrentPage();
        if (!currentPage || !currentPage.fields || currentPage.fields.length === 0) {
            // Show empty state
            canvas.innerHTML = `
                <div class="empty-canvas-state">
                    <div class="empty-canvas-icon">✨</div>
                    <h2 class="empty-canvas-title">Start Building Your Form</h2>
                    <p class="empty-canvas-description">
                        Connect to Salesforce and use the floating action button to add fields, 
                        or click the + button to access the field palette.
                    </p>
                </div>
            `;
            return;
        }
        
        // Render fields with modern styling
        let fieldsHTML = '';
        currentPage.fields.forEach(field => {
            fieldsHTML += this.renderModernField(field);
        });
        
        canvas.innerHTML = `
            <div class="modern-form-fields">
                ${fieldsHTML}
            </div>
        `;
        
        // Set up click handlers for field selection
        this.setupFieldClickHandlers();
    }
    
    renderModernField(field) {
        const fieldTypes = window.AppModules?.fieldTypes;
        if (!fieldTypes) return '';
        
        const fieldHTML = fieldTypes.renderField(field);
        
        return `
            <div class="modern-form-field" data-field-id="${field.id}" onclick="selectModernField('${field.id}')">
                ${fieldHTML}
            </div>
        `;
    }
    
    setupFieldClickHandlers() {
        const fields = document.querySelectorAll('.modern-form-field');
        fields.forEach(field => {
            field.addEventListener('click', (e) => {
                e.stopPropagation();
                const fieldId = field.dataset.fieldId;
                this.selectField(fieldId);
            });
        });
    }
    
    selectField(fieldId) {
        // Remove selection from all fields
        document.querySelectorAll('.modern-form-field').forEach(field => {
            field.classList.remove('selected');
        });
        
        // Select the clicked field
        const field = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (field) {
            field.classList.add('selected');
        }
        
        // Update form builder selection
        const formBuilder = window.AppModules?.formBuilder;
        if (formBuilder) {
            formBuilder.selectField(fieldId);
        }
        
        // Open properties panel if not already open
        if (!this.propertiesOpen) {
            this.togglePropertiesPanel();
        }
        
        console.log(`🎯 Selected field: ${fieldId}`);
    }
    
    updateModernPageTabs() {
        const tabsContainer = document.getElementById('modernPageTabs');
        const formBuilder = window.AppModules?.formBuilder;
        
        if (!tabsContainer || !formBuilder || !formBuilder.currentForm?.pages) return;
        
        const pages = formBuilder.currentForm.pages;
        if (pages.length <= 1) {
            tabsContainer.style.display = 'none';
            return;
        }
        
        tabsContainer.style.display = 'flex';
        
        let tabsHTML = '';
        pages.forEach((page, index) => {
            const isActive = index === formBuilder.currentPageIndex;
            tabsHTML += `
                <button class="page-tab ${isActive ? 'active' : ''}" onclick="switchToModernPage(${index})">
                    ${page.name || `Page ${index + 1}`}
                </button>
            `;
        });
        
        tabsContainer.innerHTML = tabsHTML;
    }
    
    switchToPage(pageIndex) {
        const formBuilder = window.AppModules?.formBuilder;
        if (formBuilder) {
            formBuilder.switchToPage(pageIndex);
            this.updateModernPageTabs();
            this.renderModernFormCanvas();
        }
    }
}

// Global functions for the modern interface
let modernInterface;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    modernInterface = new ModernInterface();
});

// Global function wrappers
function toggleTheme() {
    if (modernInterface) {
        modernInterface.toggleTheme();
    }
}

function toggleFabMenu() {
    if (modernInterface) {
        modernInterface.toggleFabMenu();
    }
}

function toggleFieldPalette() {
    if (modernInterface) {
        modernInterface.toggleFieldPalette();
    }
}

function togglePropertiesPanel() {
    if (modernInterface) {
        modernInterface.togglePropertiesPanel();
    }
}

function addFieldFromModernPalette(fieldType) {
    if (modernInterface) {
        modernInterface.addFieldFromModernPalette(fieldType);
    }
}

function selectModernField(fieldId) {
    if (modernInterface) {
        modernInterface.selectField(fieldId);
    }
}

function switchToModernPage(pageIndex) {
    if (modernInterface) {
        modernInterface.switchToPage(pageIndex);
    }
}

function toggleModernMode() {
    if (modernInterface) {
        modernInterface.toggleModernMode();
    }
}

// Hook into existing app state changes
if (window.AppState) {
    const originalSetConnected = window.AppState.setConnected;
    window.AppState.setConnected = function(connected) {
        if (originalSetConnected) {
            originalSetConnected.call(this, connected);
        }
        if (modernInterface) {
            modernInterface.updateConnectionStatus();
        }
    };
}

// Export for module usage
window.ModernInterface = ModernInterface;