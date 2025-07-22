// Modern Interface Controller for Salesforce Form Builder
// Handles floating UI, FABs, dark mode, and magical popup system

// Magical Popup System Manager
class MagicalPopupManager {
    constructor() {
        this.activePopups = new Set();
        this.popupQueue = [];
        this.maxConcurrentPopups = 3;
        this.popupCounter = 0;
        this.init();
    }
    
    init() {
        // Create backdrop element
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'popup-backdrop';
        document.body.appendChild(this.backdrop);
        
        // Set up backdrop click handler
        this.backdrop.addEventListener('click', () => {
            this.closeAllPopups();
        });
        
        console.log('✨ Magical Popup System initialized');
    }
    
    // Create and show a toast notification
    showToast(message, type = 'info', options = {}) {
        const {
            duration = 3000,
            icon = this.getDefaultIcon(type),
            actions = [],
            persistent = false
        } = options;
        
        const toast = this.createPopup('magic-toast', type);
        
        toast.innerHTML = `
            <div class="toast-icon">${icon}</div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
                ${actions.length > 0 ? this.renderActions(actions) : ''}
            </div>
        `;
        
        if (!persistent) {
            toast.classList.add('auto-dismiss');
            setTimeout(() => this.removePopup(toast), duration);
        }
        
        this.addPopup(toast);
        return toast;
    }
    
    // Show connection status popup
    showConnectionStatus(status, message) {
        // Remove existing connection popups
        this.removePopupsByClass('connection-popup');
        
        const popup = this.createPopup('connection-popup', status);
        popup.innerHTML = `
            <div class="status-pulse"></div>
            <span>${message}</span>
        `;
        
        this.addPopup(popup);
        
        // Auto-hide after 3 seconds for connected status
        if (status === 'connected') {
            setTimeout(() => this.removePopup(popup), 3000);
        }
        
        return popup;
    }
    
    // Show floating save status
    showSaveStatus(status, message) {
        // Update existing or create new save bubble
        let saveBubble = document.querySelector('.save-bubble');
        if (!saveBubble) {
            saveBubble = this.createPopup('save-bubble', status);
            this.addPopup(saveBubble);
        }
        
        saveBubble.className = `magic-popup save-bubble ${status} show`;
        saveBubble.innerHTML = `
            <div class="save-icon">${status === 'saving' ? '⏳' : '✅'}</div>
            <span>${message}</span>
        `;
        
        if (status === 'saved') {
            setTimeout(() => this.removePopup(saveBubble), 2000);
        }
        
        return saveBubble;
    }
    
    // Show contextual help bubble
    showHelpBubble(title, content, position, options = {}) {
        const {
            actions = [{ text: 'Got it', primary: true }],
            persistent = true
        } = options;
        
        const helpBubble = this.createPopup('help-bubble', 'info');
        helpBubble.style.top = `${position.y}px`;
        helpBubble.style.left = `${position.x}px`;
        
        helpBubble.innerHTML = `
            <div class="help-bubble-title">
                <span>💡</span>
                ${title}
            </div>
            <div class="help-bubble-content">${content}</div>
            <div class="help-bubble-actions">
                ${actions.map(action => `
                    <button class="help-bubble-btn ${action.primary ? 'primary' : ''}" 
                            onclick="${action.onClick || 'this.closest(\'.magic-popup\').remove()'}">
                        ${action.text}
                    </button>
                `).join('')}
            </div>
        `;
        
        this.addPopup(helpBubble);
        this.showBackdrop();
        
        return helpBubble;
    }
    
    // Show field quick actions popup
    showFieldActions(fieldId, position) {
        // Remove existing field action popups
        this.removePopupsByClass('field-actions-popup');
        
        const actionsPopup = this.createPopup('field-actions-popup', 'info');
        actionsPopup.style.top = `${position.y}px`;
        actionsPopup.style.left = `${position.x}px`;
        
        actionsPopup.innerHTML = `
            <button class="field-action-btn" data-tooltip="Edit Properties" onclick="editFieldProperties('${fieldId}')">⚙️</button>
            <button class="field-action-btn" data-tooltip="Duplicate Field" onclick="duplicateField('${fieldId}')">📋</button>
            <button class="field-action-btn" data-tooltip="Move Up" onclick="moveFieldUp('${fieldId}')">⬆️</button>
            <button class="field-action-btn" data-tooltip="Move Down" onclick="moveFieldDown('${fieldId}')">⬇️</button>
            <button class="field-action-btn" data-tooltip="Delete Field" onclick="deleteField('${fieldId}')" style="color: var(--accent-red)">🗑️</button>
        `;
        
        this.addPopup(actionsPopup);
        
        // Auto-hide after 10 seconds of no interaction
        setTimeout(() => this.removePopup(actionsPopup), 10000);
        
        return actionsPopup;
    }
    
    // Show keyboard shortcuts popup
    showKeyboardShortcuts() {
        const shortcutsPopup = this.createPopup('shortcuts-popup', 'info');
        
        const shortcuts = [
            { action: 'Add Field', keys: ['⌘', 'K'] },
            { action: 'Properties Panel', keys: ['⌘', ';'] },
            { action: 'Save Form', keys: ['⌘', 'S'] },
            { action: 'Preview Form', keys: ['⌘', 'P'] },
            { action: 'Toggle Theme', keys: ['⌘', 'D'] },
            { action: 'Close Panels', keys: ['Esc'] },
            { action: 'Show Shortcuts', keys: ['⌘', '/'] }
        ];
        
        shortcutsPopup.innerHTML = `
            <div class="shortcuts-title">⌨️ Keyboard Shortcuts</div>
            <div class="shortcuts-grid">
                ${shortcuts.map(shortcut => `
                    <div class="shortcut-action">${shortcut.action}</div>
                    <div class="shortcut-keys">
                        ${shortcut.keys.map(key => `<span class="shortcut-key">${key}</span>`).join('')}
                    </div>
                `).join('')}
            </div>
            <div class="help-bubble-actions">
                <button class="help-bubble-btn primary" onclick="this.closest('.magic-popup').remove()">
                    Got it!
                </button>
            </div>
        `;
        
        this.addPopup(shortcutsPopup);
        this.showBackdrop();
        
        return shortcutsPopup;
    }
    
    // Show page navigation bubble
    showPageNavigation(currentPage, totalPages) {
        // Remove existing page nav bubbles
        this.removePopupsByClass('page-nav-bubble');
        
        const navBubble = this.createPopup('page-nav-bubble', 'info');
        navBubble.innerHTML = `
            <button class="page-nav-btn" onclick="previousPage()" ${currentPage <= 0 ? 'disabled' : ''}>
                ←
            </button>
            <div class="page-nav-info">Page ${currentPage + 1} of ${totalPages}</div>
            <button class="page-nav-btn" onclick="nextPage()" ${currentPage >= totalPages - 1 ? 'disabled' : ''}>
                →
            </button>
        `;
        
        this.addPopup(navBubble);
        
        // Auto-hide after 5 seconds
        setTimeout(() => this.removePopup(navBubble), 5000);
        
        return navBubble;
    }
    
    // Show success celebration popup
    showCelebration(message, options = {}) {
        const {
            emoji = '🎉',
            duration = 4000,
            confetti = true
        } = options;
        
        const celebration = this.createPopup('magic-toast', 'success');
        celebration.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        celebration.style.color = 'white';
        celebration.style.fontWeight = '700';
        
        celebration.innerHTML = `
            <div class="celebration-icon" style="font-size: 1.5rem;">${emoji}</div>
            <div class="celebration-message">${message}</div>
        `;
        
        // Add special animation class
        celebration.classList.add('celebration-popup');
        
        if (confetti) {
            this.triggerConfetti();
        }
        
        this.addPopup(celebration);
        setTimeout(() => this.removePopup(celebration), duration);
        
        return celebration;
    }
    
    // Helper methods
    createPopup(className, type) {
        const popup = document.createElement('div');
        popup.className = `magic-popup ${className} ${type}`;
        popup.dataset.popupId = ++this.popupCounter;
        return popup;
    }
    
    addPopup(popup) {
        document.body.appendChild(popup);
        this.activePopups.add(popup);
        
        // Trigger show animation
        requestAnimationFrame(() => {
            popup.classList.add('show');
        });
        
        // Stack toasts vertically
        if (popup.classList.contains('magic-toast')) {
            this.stackToasts();
        }
    }
    
    removePopup(popup) {
        if (!popup || !document.body.contains(popup)) return;
        
        popup.classList.remove('show');
        this.activePopups.delete(popup);
        
        setTimeout(() => {
            if (document.body.contains(popup)) {
                document.body.removeChild(popup);
            }
        }, 300);
        
        // Restack remaining toasts
        if (popup.classList.contains('magic-toast')) {
            setTimeout(() => this.stackToasts(), 100);
        }
        
        // Hide backdrop if no popups with backdrop
        if (this.shouldHideBackdrop()) {
            this.hideBackdrop();
        }
    }
    
    removePopupsByClass(className) {
        const popups = document.querySelectorAll(`.${className}`);
        popups.forEach(popup => this.removePopup(popup));
    }
    
    closeAllPopups() {
        this.activePopups.forEach(popup => this.removePopup(popup));
        this.hideBackdrop();
    }
    
    stackToasts() {
        const toasts = document.querySelectorAll('.magic-toast.show');
        toasts.forEach((toast, index) => {
            toast.style.top = `${100 + (index * 80)}px`;
        });
    }
    
    showBackdrop() {
        this.backdrop.classList.add('show');
    }
    
    hideBackdrop() {
        this.backdrop.classList.remove('show');
    }
    
    shouldHideBackdrop() {
        const backdropPopups = document.querySelectorAll('.help-bubble.show, .shortcuts-popup.show');
        return backdropPopups.length === 0;
    }
    
    getDefaultIcon(type) {
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }
    
    renderActions(actions) {
        return `
            <div class="toast-actions">
                ${actions.map(action => `
                    <button class="toast-action-btn" onclick="${action.onClick}">
                        ${action.text}
                    </button>
                `).join('')}
            </div>
        `;
    }
    
    triggerConfetti() {
        // Simple confetti effect using emoji
        const confettiEmojis = ['🎉', '🎊', '✨', '🌟', '⭐'];
        
        for (let i = 0; i < 15; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.textContent = confettiEmojis[Math.floor(Math.random() * confettiEmojis.length)];
                confetti.style.cssText = `
                    position: fixed;
                    top: -20px;
                    left: ${Math.random() * 100}vw;
                    font-size: ${Math.random() * 20 + 20}px;
                    z-index: 10000;
                    pointer-events: none;
                    animation: fall ${Math.random() * 2 + 3}s linear forwards;
                `;
                
                document.body.appendChild(confetti);
                
                setTimeout(() => {
                    if (document.body.contains(confetti)) {
                        document.body.removeChild(confetti);
                    }
                }, 5000);
            }, i * 100);
        }
        
        // Add confetti animation if not already present
        if (!document.querySelector('#confetti-animation')) {
            const style = document.createElement('style');
            style.id = 'confetti-animation';
            style.textContent = `
                @keyframes fall {
                    to {
                        transform: translateY(100vh) rotate(720deg);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// Magical popup system instance
let magicalPopups;

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
        // Initialize magical popup system
        magicalPopups = new MagicalPopupManager();
        
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
        
        // Show welcome popup
        setTimeout(() => {
            this.showWelcomePopup();
        }, 1000);
        
        console.log('🚀 Modern Interface initialized with Magical Popups');
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
                magicalPopups?.showSaveStatus('saving', 'Saving form...');
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
        
        // Cmd/Ctrl + D to toggle theme
        if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
            e.preventDefault();
            this.toggleTheme();
        }
        
        // Cmd/Ctrl + / to show keyboard shortcuts
        if ((e.metaKey || e.ctrlKey) && e.key === '/') {
            e.preventDefault();
            magicalPopups?.showKeyboardShortcuts();
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
    
    // Magical Popup Integration Methods
    showWelcomePopup() {
        if (this.isModernMode && !localStorage.getItem('sfb-welcome-shown')) {
            magicalPopups?.showToast(
                'Welcome to the Modern Interface! ✨', 
                'success',
                {
                    duration: 5000,
                    icon: '🚀',
                    actions: [
                        {
                            text: 'Show Shortcuts',
                            onClick: 'magicalPopups.showKeyboardShortcuts()'
                        }
                    ]
                }
            );
            localStorage.setItem('sfb-welcome-shown', 'true');
        }
    }
    
    showConnectionSuccess() {
        magicalPopups?.showConnectionStatus('connected', 'Connected to Salesforce');
        magicalPopups?.showCelebration('🎉 Connected to Salesforce!');
    }
    
    showConnectionError(message) {
        magicalPopups?.showConnectionStatus('error', 'Connection failed');
        magicalPopups?.showToast(message || 'Failed to connect to Salesforce', 'error');
    }
    
    showSaveSuccess() {
        magicalPopups?.showSaveStatus('saved', 'Form saved');
        magicalPopups?.showToast('Form saved successfully', 'success', { duration: 2000 });
    }
    
    showPublishSuccess() {
        magicalPopups?.showCelebration('🚀 Form published successfully!', {
            confetti: true,
            emoji: '🎊'
        });
    }
    
    showContextualHelp(element, title, content) {
        const rect = element.getBoundingClientRect();
        const position = {
            x: rect.right + 10,
            y: rect.top
        };
        
        // Adjust position for mobile
        if (window.innerWidth <= 768) {
            position.x = rect.left;
            position.y = rect.bottom + 10;
        }
        
        magicalPopups?.showHelpBubble(title, content, position);
    }
    
    showFieldContextMenu(fieldId, event) {
        event.preventDefault();
        const position = {
            x: event.clientX,
            y: event.clientY
        };
        
        magicalPopups?.showFieldActions(fieldId, position);
    }
    
    showPageNavigationIfNeeded() {
        const formBuilder = window.AppModules?.formBuilder;
        if (formBuilder && formBuilder.currentForm?.pages?.length > 1) {
            magicalPopups?.showPageNavigation(
                formBuilder.currentPageIndex || 0,
                formBuilder.currentForm.pages.length
            );
        }
    }
    
    // Enhanced field selection with popup
    selectField(fieldId) {
        // Remove selection from all fields
        document.querySelectorAll('.modern-form-field').forEach(field => {
            field.classList.remove('selected');
        });
        
        // Select the clicked field
        const field = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (field) {
            field.classList.add('selected');
            
            // Show quick help for first-time users
            if (!localStorage.getItem('sfb-field-help-shown')) {
                this.showContextualHelp(
                    field, 
                    'Field Selected',
                    'Right-click for quick actions, or use the Properties panel to customize this field.'
                );
                localStorage.setItem('sfb-field-help-shown', 'true');
            }
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
        
        // Show field selected toast
        magicalPopups?.showToast(`Field selected: ${fieldId}`, 'info', { duration: 1500 });
    }
    
    // Enhanced add field with better feedback
    addFieldFromModernPaletteEnhanced(fieldType) {
        const formBuilder = window.AppModules?.formBuilder;
        
        if (!formBuilder || !formBuilder.getCurrentPage()) {
            magicalPopups?.showToast('Please connect to Salesforce first', 'warning');
            return;
        }
        
        // Show loading state
        magicalPopups?.showToast('Adding field...', 'info', { duration: 1000 });
        
        try {
            const newFieldId = formBuilder.generateFieldId();
            const newField = formBuilder.createFieldFromType(fieldType, newFieldId);
            
            // Add to the current page's fields
            const currentPage = formBuilder.getCurrentPage();
            if (!currentPage.fields) {
                currentPage.fields = [];
            }
            currentPage.fields.push(newField);
            
            // Render the updated form and select the new field
            this.renderModernFormCanvas();
            this.selectField(newFieldId);
            
            // Close palette after adding field
            this.closeFieldPalette();
            
            // Show success with celebration
            const fieldName = fieldType.charAt(0).toUpperCase() + fieldType.slice(1);
            magicalPopups?.showCelebration(`${fieldName} field added! 🎉`, { 
                duration: 2500,
                emoji: '✨'
            });
            
            // Show contextual help for first field
            if (currentPage.fields.length === 1) {
                setTimeout(() => {
                    magicalPopups?.showToast(
                        'Great! Now configure your field in the Properties panel', 
                        'info',
                        { duration: 4000 }
                    );
                }, 1000);
            }
            
        } catch (error) {
            magicalPopups?.showToast('Failed to add field', 'error');
            console.error('Error adding field:', error);
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
        modernInterface.addFieldFromModernPaletteEnhanced(fieldType);
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

// Additional magical popup functions
function showMagicToast(message, type = 'info', options = {}) {
    if (magicalPopups) {
        magicalPopups.showToast(message, type, options);
    }
}

function showCelebration(message, options = {}) {
    if (magicalPopups) {
        magicalPopups.showCelebration(message, options);
    }
}

function showConnectionStatus(status, message) {
    if (modernInterface) {
        if (status === 'connected') {
            modernInterface.showConnectionSuccess();
        } else {
            modernInterface.showConnectionError(message);
        }
    }
}

function showSaveStatus(status) {
    if (modernInterface) {
        if (status === 'saved') {
            modernInterface.showSaveSuccess();
        } else {
            magicalPopups?.showSaveStatus('saving', 'Saving form...');
        }
    }
}

function showPublishSuccess() {
    if (modernInterface) {
        modernInterface.showPublishSuccess();
    }
}

function showFieldContextMenu(fieldId, event) {
    if (modernInterface) {
        modernInterface.showFieldContextMenu(fieldId, event);
    }
}

function editFieldProperties(fieldId) {
    if (modernInterface) {
        modernInterface.selectField(fieldId);
        modernInterface.togglePropertiesPanel();
    }
}

function duplicateField(fieldId) {
    const formBuilder = window.AppModules?.formBuilder;
    if (formBuilder && formBuilder.duplicateField) {
        formBuilder.duplicateField(fieldId);
        magicalPopups?.showToast('Field duplicated!', 'success');
    }
}

function moveFieldUp(fieldId) {
    const formBuilder = window.AppModules?.formBuilder;
    if (formBuilder && formBuilder.moveFieldUp) {
        formBuilder.moveFieldUp(fieldId);
        magicalPopups?.showToast('Field moved up', 'info', { duration: 1000 });
    }
}

function moveFieldDown(fieldId) {
    const formBuilder = window.AppModules?.formBuilder;
    if (formBuilder && formBuilder.moveFieldDown) {
        formBuilder.moveFieldDown(fieldId);
        magicalPopups?.showToast('Field moved down', 'info', { duration: 1000 });
    }
}

function deleteField(fieldId) {
    if (confirm('Are you sure you want to delete this field?')) {
        const formBuilder = window.AppModules?.formBuilder;
        if (formBuilder && formBuilder.deleteField) {
            formBuilder.deleteField(fieldId);
            magicalPopups?.showToast('Field deleted', 'info');
        }
    }
}

function previousPage() {
    const formBuilder = window.AppModules?.formBuilder;
    if (formBuilder && formBuilder.previousPage) {
        formBuilder.previousPage();
        magicalPopups?.showToast('Previous page', 'info', { duration: 1000 });
    }
}

function nextPage() {
    const formBuilder = window.AppModules?.formBuilder;
    if (formBuilder && formBuilder.nextPage) {
        formBuilder.nextPage();
        magicalPopups?.showToast('Next page', 'info', { duration: 1000 });
    }
}

// Enhanced existing functions with popups
const originalSaveForm = window.saveForm;
window.saveForm = function() {
    magicalPopups?.showSaveStatus('saving', 'Saving form...');
    if (originalSaveForm) {
        originalSaveForm();
        setTimeout(() => {
            modernInterface?.showSaveSuccess();
        }, 500);
    }
};

const originalPublishForm = window.publishForm;
window.publishForm = function() {
    magicalPopups?.showToast('Publishing form...', 'info', { duration: 2000 });
    if (originalPublishForm) {
        originalPublishForm();
        setTimeout(() => {
            modernInterface?.showPublishSuccess();
        }, 1000);
    }
};

// Hook into connection events
document.addEventListener('salesforce-connected', () => {
    modernInterface?.showConnectionSuccess();
});

document.addEventListener('salesforce-connection-error', (event) => {
    modernInterface?.showConnectionError(event.detail?.message);
});

// Hook into form events
document.addEventListener('form-saved', () => {
    modernInterface?.showSaveSuccess();
});

document.addEventListener('form-published', () => {
    modernInterface?.showPublishSuccess();
});

document.addEventListener('field-added', (event) => {
    const fieldType = event.detail?.fieldType;
    if (fieldType) {
        magicalPopups?.showCelebration(`${fieldType} field added! ✨`, { duration: 2000 });
    }
});

// Add contextual help triggers
document.addEventListener('DOMContentLoaded', () => {
    // Add help triggers for first-time users
    setTimeout(() => {
        const firstTimeUser = !localStorage.getItem('sfb-user-onboarded');
        if (firstTimeUser && modernInterface?.isModernMode) {
            // Show onboarding sequence
            setTimeout(() => {
                magicalPopups?.showToast(
                    'Tip: Use Cmd+K to quickly add fields! ⌨️', 
                    'info',
                    { duration: 5000 }
                );
            }, 3000);
            
            setTimeout(() => {
                magicalPopups?.showToast(
                    'Press Cmd+/ to see all keyboard shortcuts', 
                    'info',
                    { duration: 5000 }
                );
            }, 8000);
            
            localStorage.setItem('sfb-user-onboarded', 'true');
        }
    }, 2000);
});

// Export for module usage
window.ModernInterface = ModernInterface;
window.MagicalPopupManager = MagicalPopupManager;