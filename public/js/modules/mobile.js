// Mobile Module - Handles mobile-specific functionality

const { debugError, debugWarn, debugInfo, debugDebug, debugVerbose } = window.SFBDebug;

export class Mobile {
    constructor() {
        this.isMobile = window.innerWidth <= 768;
        this.activePage = null;
        this.touchStartPos = null;
        this.touchThreshold = 50; // Minimum distance for swipe
    }

    async initialize() {
        debugInfo('Mobile', 'Initializing Mobile module...');
        
        // Set up responsive detection
        this.setupResponsiveDetection();
        
        // Initialize mobile navigation
        this.setupMobileNavigation();
        
        // Enhanced touch support for drag and drop
        this.setupEnhancedTouch();
        
        // Mobile-specific optimizations
        this.setupMobileOptimizations();
        
        // Initial setup based on screen size
        this.handleResize();
    }

    setupResponsiveDetection() {
        window.addEventListener('resize', () => {
            this.handleResize();
        });

        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                this.handleResize();
            }, 100);
        });
    }

    handleResize() {
        const wasMobile = this.isMobile;
        this.isMobile = window.innerWidth <= 768;

        if (this.isMobile !== wasMobile) {
            this.toggleMobileMode(this.isMobile);
        }
    }

    toggleMobileMode(isMobile) {
        const sidebar = document.querySelector('.sidebar');
        const propertiesPanel = document.querySelector('.properties-panel');
        
        if (isMobile) {
            // Enable mobile mode
            this.closeMobilePanels();
            debugInfo('Mobile', '📱 Mobile mode enabled');
        } else {
            // Disable mobile mode
            this.closeMobilePanels();
            sidebar.classList.remove('mobile-open');
            propertiesPanel.classList.remove('mobile-open');
            debugInfo('Mobile', '💻 Desktop mode enabled');
        }
    }

    setupMobileNavigation() {
        const mobileSidebarBtn = document.getElementById('mobileSidebarBtn');
        const mobilePropertiesBtn = document.getElementById('mobilePropertiesBtn');
        const mobilePreviewBtn = document.getElementById('mobilePreviewBtn');
        const mobileOverlay = document.getElementById('mobileOverlay');

        // Sidebar toggle
        mobileSidebarBtn?.addEventListener('click', () => {
            this.toggleMobilePanel('sidebar');
        });

        // Properties toggle
        mobilePropertiesBtn?.addEventListener('click', () => {
            this.toggleMobilePanel('properties');
        });

        // Preview toggle
        mobilePreviewBtn?.addEventListener('click', () => {
            this.showMobilePreview();
        });

        // Overlay click to close
        mobileOverlay?.addEventListener('click', () => {
            this.closeMobilePanels();
        });

        // ESC key to close panels
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isMobile) {
                this.closeMobilePanels();
            }
        });

        // Swipe gestures
        this.setupSwipeGestures();
    }

    toggleMobilePanel(panelType) {
        const sidebar = document.querySelector('.sidebar');
        const propertiesPanel = document.querySelector('.properties-panel');
        const overlay = document.getElementById('mobileOverlay');
        const sidebarBtn = document.getElementById('mobileSidebarBtn');
        const propertiesBtn = document.getElementById('mobilePropertiesBtn');

        // Close all panels first
        sidebar.classList.remove('mobile-open');
        propertiesPanel.classList.remove('mobile-open');
        sidebarBtn.classList.remove('active');
        propertiesBtn.classList.remove('active');

        // Open requested panel
        if (panelType === 'sidebar') {
            sidebar.classList.add('mobile-open');
            sidebarBtn.classList.add('active');
            overlay.classList.add('active');
        } else if (panelType === 'properties') {
            propertiesPanel.classList.add('mobile-open');
            propertiesBtn.classList.add('active');
            overlay.classList.add('active');
        }

        this.activePage = panelType === 'sidebar' || panelType === 'properties' ? panelType : null;
    }

    closeMobilePanels() {
        const sidebar = document.querySelector('.sidebar');
        const propertiesPanel = document.querySelector('.properties-panel');
        const overlay = document.getElementById('mobileOverlay');
        const sidebarBtn = document.getElementById('mobileSidebarBtn');
        const propertiesBtn = document.getElementById('mobilePropertiesBtn');

        sidebar?.classList.remove('mobile-open');
        propertiesPanel?.classList.remove('mobile-open');
        overlay?.classList.remove('active');
        sidebarBtn?.classList.remove('active');
        propertiesBtn?.classList.remove('active');

        this.activePage = null;
    }

    showMobilePreview() {
        // Use existing preview functionality
        if (window.AppModules.formBuilder) {
            window.AppModules.formBuilder.previewForm();
        }
    }

    setupSwipeGestures() {
        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let currentY = 0;

        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchmove', (e) => {
            if (!startX || !startY) return;
            
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        }, { passive: true });

        document.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;

            const diffX = startX - currentX;
            const diffY = startY - currentY;

            // Check if it's a horizontal swipe (not vertical)
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > this.touchThreshold) {
                if (diffX > 0) {
                    // Swipe left - close panels or open properties
                    if (this.activePage === 'sidebar') {
                        this.toggleMobilePanel('properties');
                    } else if (this.activePage) {
                        this.closeMobilePanels();
                    }
                } else {
                    // Swipe right - close panels or open sidebar
                    if (this.activePage === 'properties') {
                        this.toggleMobilePanel('sidebar');
                    } else if (this.activePage) {
                        this.closeMobilePanels();
                    } else {
                        this.toggleMobilePanel('sidebar');
                    }
                }
            }

            // Reset
            startX = 0;
            startY = 0;
        }, { passive: true });
    }

    setupEnhancedTouch() {
        // Enhanced drag and drop for mobile
        this.setupMobileDragDrop();
        
        // Better form field interaction
        this.setupMobileFormInteraction();
        
        // Mobile-friendly modals
        this.setupMobileModals();
    }

    setupMobileDragDrop() {
        // Use the existing touch support from dragDrop module
        if (window.AppModules.dragDrop) {
            window.AppModules.dragDrop.setupTouchSupport();
        }

        // Add visual feedback for mobile drag operations
        document.addEventListener('dragstart', () => {
            if (this.isMobile) {
                document.body.classList.add('mobile-dragging');
            }
        });

        document.addEventListener('dragend', () => {
            if (this.isMobile) {
                document.body.classList.remove('mobile-dragging');
            }
        });
    }

    setupMobileFormInteraction() {
        // Double-tap to edit field properties on mobile
        let lastTap = 0;
        
        document.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            
            if (tapLength < 500 && tapLength > 0) {
                // Double tap detected
                const field = e.target.closest('.form-field');
                if (field && this.isMobile) {
                    e.preventDefault();
                    
                    // Select field and open properties panel
                    if (window.AppModules.formBuilder) {
                        window.AppModules.formBuilder.selectField(field);
                        this.toggleMobilePanel('properties');
                    }
                }
            }
            lastTap = currentTime;
        });
    }

    setupMobileModals() {
        // Auto-adjust modal sizes for mobile
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE && 
                        node.classList.contains('modal') && 
                        this.isMobile) {
                        this.optimizeModalForMobile(node);
                    }
                });
            });
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    optimizeModalForMobile(modal) {
        const modalContent = modal.querySelector('.modal-content');
        if (modalContent && this.isMobile) {
            modalContent.style.width = '95vw';
            modalContent.style.maxWidth = '95vw';
            modalContent.style.height = 'auto';
            modalContent.style.maxHeight = '90vh';
            modalContent.style.margin = '5vh auto';
            modalContent.style.overflow = 'auto';
        }
    }

    setupMobileOptimizations() {
        // Prevent zoom on focus for form inputs
        const inputs = document.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('focus', () => {
                if (this.isMobile) {
                    const viewport = document.querySelector('meta[name=viewport]');
                    if (viewport) {
                        viewport.setAttribute('content', 
                            'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
                    }
                }
            });

            input.addEventListener('blur', () => {
                if (this.isMobile) {
                    const viewport = document.querySelector('meta[name=viewport]');
                    if (viewport) {
                        viewport.setAttribute('content', 
                            'width=device-width, initial-scale=1.0');
                    }
                }
            });
        });

        // Optimize scrolling performance
        if (this.isMobile) {
            document.body.style.webkitOverflowScrolling = 'touch';
            
            const scrollableElements = document.querySelectorAll(
                '.sidebar, .properties-panel, .main-content, .modal-content'
            );
            
            scrollableElements.forEach(element => {
                element.style.webkitOverflowScrolling = 'touch';
            });
        }

        // Fix + button functionality on mobile
        this.setupMobileFabButtons();
    }

    setupMobileFabButtons() {
        // Enhanced + button functionality for mobile devices
        // Use a slight delay to ensure buttons are fully rendered
        setTimeout(() => {
            const fabButtons = document.querySelectorAll('.main-fab, .unified-fab-main');
            
            if (fabButtons.length === 0) {
                debugWarn('Mobile', 'No FAB buttons found, retrying in 500ms...');
                // Retry once more if buttons aren't found initially
                setTimeout(() => this.setupMobileFabButtons(), 500);
                return;
            }
            
            fabButtons.forEach(button => {
                // Remove existing event listeners by cloning the button
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                
                debugInfo('Mobile', `Setting up mobile FAB button: ${newButton.className}`);
                
                // Add mobile-friendly touch events
                newButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Add visual feedback
                    newButton.style.transform = 'scale(0.95)';
                    newButton.style.transition = 'transform 0.1s ease';
                    
                    if (navigator.vibrate) {
                        navigator.vibrate(50);
                    }
                }, { passive: false });

                newButton.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Remove visual feedback
                    newButton.style.transform = 'scale(1)';
                    
                    // Trigger the appropriate function
                    if (newButton.classList.contains('main-fab')) {
                        debugInfo('Mobile', 'Triggering main FAB menu');
                        if (typeof toggleFabMenu === 'function') {
                            toggleFabMenu();
                        } else if (window.modernInterface && typeof window.modernInterface.toggleFabMenu === 'function') {
                            window.modernInterface.toggleFabMenu();
                        } else {
                            debugError('Mobile', 'toggleFabMenu function not found');
                        }
                    } else if (newButton.classList.contains('unified-fab-main')) {
                        debugInfo('Mobile', 'Triggering unified FAB menu');
                        if (typeof toggleUnifiedFabMenu === 'function') {
                            toggleUnifiedFabMenu();
                        } else if (window.unifiedController && typeof window.unifiedController.toggleFabMenu === 'function') {
                            window.unifiedController.toggleFabMenu();
                        } else {
                            debugError('Mobile', 'toggleUnifiedFabMenu function not found');
                        }
                    }
                }, { passive: false });

                // Also handle regular click events for desktop compatibility
                newButton.addEventListener('click', (e) => {
                    if (!this.isMobile) {
                        // Let the original onclick handlers work on desktop
                        return;
                    }
                    
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // On mobile, we handle this through touch events above
                });
            });
            
            debugInfo('Mobile', `Mobile FAB buttons setup completed for ${fabButtons.length} buttons`);
            
            // Also setup touch events for FAB menu actions
            this.setupFabActionButtons();
        }, 100);
    }
    
    setupFabActionButtons() {
        // Setup touch events for FAB action buttons
        setTimeout(() => {
            const actionButtons = document.querySelectorAll('.unified-fab-action, .fab-action');
            
            actionButtons.forEach(button => {
                // Clone to remove existing listeners
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);
                
                // Add touch event handlers
                newButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Visual feedback
                    newButton.style.transform = 'scale(0.95)';
                    
                    if (navigator.vibrate) {
                        navigator.vibrate(30);
                    }
                }, { passive: false });
                
                newButton.addEventListener('touchend', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Reset visual feedback
                    newButton.style.transform = 'scale(1)';
                    
                    // Get the onclick handler and execute it
                    const onclickAttr = newButton.getAttribute('onclick');
                    if (onclickAttr) {
                        try {
                            // Execute the onclick function
                            eval(onclickAttr);
                            
                            // Close the FAB menu after action
                            if (window.unifiedController) {
                                window.unifiedController.toggleFabMenu();
                            }
                        } catch (error) {
                            debugError('Mobile', `Error executing FAB action: ${error.message}`);
                        }
                    }
                }, { passive: false });
                
                // Prevent default click on mobile
                newButton.addEventListener('click', (e) => {
                    if (this.isMobile) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                });
            });
            
            debugInfo('Mobile', `FAB action buttons setup completed for ${actionButtons.length} buttons`);
        }, 200);
    }

    // Utility methods for other modules
    isMobileDevice() {
        return this.isMobile;
    }

    // Public method to reinitialize FAB buttons (useful for dynamic content)
    reinitializeFabButtons() {
        if (this.isMobile) {
            this.setupMobileFabButtons();
        }
    }

    showMobileMessage(message, type = 'info') {
        // Mobile-optimized toast notifications
        const toast = document.createElement('div');
        toast.className = `mobile-toast mobile-toast-${type}`;
        toast.textContent = message;
        
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--notion-gray-800);
            color: white;
            padding: var(--space-3) var(--space-4);
            border-radius: var(--radius-lg);
            z-index: 10000;
            font-size: 0.9rem;
            max-width: 90vw;
            text-align: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

        document.body.appendChild(toast);

        // Auto remove after 3 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 3000);
    }
}