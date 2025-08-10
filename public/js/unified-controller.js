/* ==========================================================================
   UNIFIED EXPERIENCE CONTROLLER
   Complete integration with existing Form Builder functionality
   ========================================================================== */

// Unified Experience Controller Class
class UnifiedExperienceController {
    constructor() {
        this.isUnifiedMode = true;
        this.fieldPaletteOpen = false;
        this.propertiesOpen = false;
        this.fabMenuOpen = false;
        this.currentSelectedField = null;
        
        this.init();
    }
    
    init() {
        // Wait for DOM to be ready and existing modules to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupController());
        } else {
            this.setupController();
        }
    }
    
    setupController() {
        
        // Hide legacy interface
        this.toggleInterface();
        
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize panels
        this.initializePanels();
        
        // Integrate with existing modules
        this.integrateWithExistingModules();
        
        // Set up field palette drag/drop
        this.setupFieldPaletteDragDrop();
        
    }
    
    toggleInterface() {
        // Hide legacy interface, show unified
        const legacyContainer = document.querySelector('.container');
        const unifiedContainer = document.getElementById('unifiedContainer');
        
        if (legacyContainer) {
            legacyContainer.style.display = 'none';
        }
        
        if (unifiedContainer) {
            unifiedContainer.style.display = 'block';
        }
        
    }
    
    setupEventListeners() {
        // FAB menu toggle
        const fabMain = document.getElementById('unifiedFabMain');
        if (fabMain) {
            fabMain.addEventListener('click', () => this.toggleFabMenu());
        }
        
        // Panel backdrop click
        const backdrop = document.getElementById('panelBackdrop');
        if (backdrop) {
            backdrop.addEventListener('click', () => this.closeAllPanels());
        }
        
        // Escape key to close panels
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllPanels();
            }
        });
        
        // Theme toggle
        const themeToggle = document.getElementById('themeToggleUnified');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }
        
    }
    
    initializePanels() {
        // Set up initial panel states
        this.closeAllPanels();
        
        // Update connection status
        this.updateConnectionStatus();
        
    }
    
    integrateWithExistingModules() {
        // Hook into existing form builder when it's available
        const checkModules = () => {
            if (window.AppModules && window.AppModules.formBuilder) {
                this.formBuilder = window.AppModules.formBuilder;
                this.setupFormBuilderIntegration();
            } else {
                setTimeout(checkModules, 100);
            }
        };
        checkModules();
    }
    
    setupFormBuilderIntegration() {
        // Override form canvas to use unified canvas
        const originalRenderFormCanvas = this.formBuilder.renderFormCanvas;
        this.formBuilder.renderFormCanvas = () => {
            this.renderUnifiedFormCanvas();
            if (originalRenderFormCanvas) {
                originalRenderFormCanvas.call(this.formBuilder);
            }
        };
        
        // Override field selection to use unified properties panel
        const originalSelectField = this.formBuilder.selectField;
        this.formBuilder.selectField = (fieldId) => {
            this.selectFieldUnified(fieldId);
            if (originalSelectField) {
                originalSelectField.call(this.formBuilder, fieldId);
            }
        };
    }
    
    setupFieldPaletteDragDrop() {
        const fieldBlocks = document.querySelectorAll('.field-palette-unified .field-block');
        
        fieldBlocks.forEach(block => {
            // Make draggable
            block.draggable = true;
            
            // Add drag events
            block.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', block.dataset.fieldType);
                block.classList.add('dragging');
            });
            
            block.addEventListener('dragend', () => {
                block.classList.remove('dragging');
            });
            
            // Add touch events for mobile
            block.addEventListener('touchstart', (e) => {
                this.handleTouchStart(e, block);
            });
            
            block.addEventListener('touchmove', (e) => {
                this.handleTouchMove(e);
            });
            
            block.addEventListener('touchend', (e) => {
                this.handleTouchEnd(e);
            });
        });
        
        // Set up drop zone on canvas
        const canvas = document.getElementById('formCanvasUnified');
        if (canvas) {
            canvas.addEventListener('dragover', (e) => {
                e.preventDefault();
                canvas.classList.add('drag-over');
            });
            
            canvas.addEventListener('dragleave', () => {
                canvas.classList.remove('drag-over');
            });
            
            canvas.addEventListener('drop', (e) => {
                e.preventDefault();
                canvas.classList.remove('drag-over');
                const fieldType = e.dataTransfer.getData('text/plain');
                this.addFieldToForm(fieldType);
            });
        }
        
    }
    
    // ==========================================================================
    // FAB MENU FUNCTIONALITY
    // ==========================================================================
    
    toggleFabMenu() {
        this.fabMenuOpen = !this.fabMenuOpen;
        const fabMenu = document.getElementById('unifiedFabMenu');
        const fabMain = document.getElementById('unifiedFabMain');
        
        if (fabMenu) {
            fabMenu.classList.toggle('active', this.fabMenuOpen);
        }
        
        if (fabMain) {
            fabMain.classList.toggle('active', this.fabMenuOpen);
            const span = fabMain.querySelector('span');
            if (span) {
                span.textContent = this.fabMenuOpen ? '×' : '+';
                span.style.transform = this.fabMenuOpen ? 'rotate(45deg)' : 'rotate(0deg)';
                span.style.transition = 'transform 0.2s ease';
            }
        }
        
        
        // If on mobile and menu opened, setup action buttons
        if (this.fabMenuOpen && window.AppModules && window.AppModules.mobile && window.AppModules.mobile.isMobileDevice()) {
            setTimeout(() => {
                window.AppModules.mobile.setupFabActionButtons();
            }, 100);
        }
    }
    
    // ==========================================================================
    // PANEL MANAGEMENT
    // ==========================================================================
    
    openFieldPalette() {
        this.fieldPaletteOpen = true;
        this.propertiesOpen = false;
        
        const palette = document.getElementById('fieldPalettePanel');
        const properties = document.getElementById('propertiesPanelUnified');
        const backdrop = document.getElementById('panelBackdrop');
        
        if (palette) palette.classList.add('active');
        if (properties) properties.classList.remove('active');
        if (backdrop) backdrop.classList.add('active');
        
        // Close FAB menu
        this.fabMenuOpen = false;
        this.toggleFabMenu();
        
    }
    
    openPropertiesPanel() {
        this.propertiesOpen = true;
        this.fieldPaletteOpen = false;
        
        const properties = document.getElementById('propertiesPanelUnified');
        const palette = document.getElementById('fieldPalettePanel');
        const backdrop = document.getElementById('panelBackdrop');
        
        if (properties) properties.classList.add('active');
        if (palette) palette.classList.remove('active');
        if (backdrop) backdrop.classList.add('active');
        
        // Close FAB menu
        this.fabMenuOpen = false;
        this.toggleFabMenu();
        
    }
    
    closeFieldPalette() {
        this.fieldPaletteOpen = false;
        const palette = document.getElementById('fieldPalettePanel');
        if (palette) palette.classList.remove('active');
        
        this.updateBackdrop();
    }
    
    closePropertiesPanel() {
        this.propertiesOpen = false;
        const properties = document.getElementById('propertiesPanelUnified');
        if (properties) properties.classList.remove('active');
        
        this.updateBackdrop();
    }
    
    closeAllPanels() {
        this.fieldPaletteOpen = false;
        this.propertiesOpen = false;
        
        const palette = document.getElementById('fieldPalettePanel');
        const properties = document.getElementById('propertiesPanelUnified');
        const backdrop = document.getElementById('panelBackdrop');
        
        if (palette) palette.classList.remove('active');
        if (properties) properties.classList.remove('active');
        if (backdrop) backdrop.classList.remove('active');
        
    }
    
    updateBackdrop() {
        const backdrop = document.getElementById('panelBackdrop');
        if (backdrop) {
            const showBackdrop = this.fieldPaletteOpen || this.propertiesOpen;
            backdrop.classList.toggle('active', showBackdrop);
        }
    }
    
    // ==========================================================================
    // FIELD MANAGEMENT
    // ==========================================================================
    
    addFieldFromPalette(fieldType) {
        this.addFieldToForm(fieldType);
        
        // Show success feedback
        if (window.magicalPopups) {
            const fieldName = fieldType.charAt(0).toUpperCase() + fieldType.slice(1);
            window.magicalPopups.showToast(`${fieldName} field added! ✨`, 'success');
        }
        
        // Close field palette on mobile
        if (window.innerWidth <= 768) {
            this.closeFieldPalette();
        }
    }
    
    addFieldToForm(fieldType) {
        try {
            // Check if we have access to form builder
            if (!this.formBuilder) {
                console.warn('⚠️ Form Builder not available');
                if (window.magicalPopups) {
                    window.magicalPopups.showToast('Please connect to Salesforce first', 'warning');
                }
                return;
            }
            
            // Generate new field ID
            const newFieldId = this.formBuilder.generateFieldId ? 
                this.formBuilder.generateFieldId() : 
                `field_${Date.now()}`;
            
            // Create field using existing form builder
            const newField = this.formBuilder.createFieldFromType ? 
                this.formBuilder.createFieldFromType(fieldType, newFieldId) :
                this.createBasicField(fieldType, newFieldId);
            
            // Add to current page
            const currentPage = this.formBuilder.getCurrentPage ? 
                this.formBuilder.getCurrentPage() :
                this.formBuilder.currentForm?.pages?.[0];
            
            if (currentPage) {
                if (!currentPage.fields) {
                    currentPage.fields = [];
                }
                currentPage.fields.push(newField);
                
                // Re-render form
                this.renderUnifiedFormCanvas();
                
                // Auto-select the new field
                this.selectFieldUnified(newFieldId);
                
            } else {
                console.error('❌ No current page available');
                if (window.magicalPopups) {
                    window.magicalPopups.showToast('No form page available', 'error');
                }
            }
            
        } catch (error) {
            console.error('❌ Error adding field:', error);
            if (window.magicalPopups) {
                window.magicalPopups.showToast('Failed to add field', 'error');
            }
        }
    }
    
    createBasicField(fieldType, fieldId) {
        // Fallback field creation if form builder method not available
        const fieldLabels = {
            text: 'Text Field',
            email: 'Email Field',
            phone: 'Phone Field',
            number: 'Number Field',
            date: 'Date Field',
            select: 'Select List',
            textarea: 'Text Area',
            checkbox: 'Checkbox',
            radio: 'Radio Button',
            lookup: 'Lookup Field',
            richtext: 'Rich Text',
            display: 'Display Text',
            file: 'File Upload',
            signature: 'E-Signature',
            login: 'Login Field',
            emailverify: 'Email Verify'
        };
        
        return {
            id: fieldId,
            type: fieldType,
            label: fieldLabels[fieldType] || 'Field',
            required: false,
            placeholder: '',
            helpText: '',
            defaultValue: '',
            options: fieldType === 'select' || fieldType === 'radio' ? [] : undefined,
            validation: {},
            conditionalVisibility: {
                enabled: false,
                conditions: []
            },
            customStyles: {}
        };
    }
    
    // ==========================================================================
    // FORM RENDERING
    // ==========================================================================
    
    renderUnifiedFormCanvas() {
        const canvas = document.getElementById('formCanvasUnified');
        if (!canvas) return;
        
        try {
            // Get current page from form builder
            const currentPage = this.formBuilder?.getCurrentPage?.() || 
                this.formBuilder?.currentForm?.pages?.[0];
            
            if (!currentPage || !currentPage.fields || currentPage.fields.length === 0) {
                // Show empty state
                canvas.innerHTML = `
                    <div class="empty-canvas-state">
                        <div class="empty-canvas-icon" style="font-size: 4rem; margin-bottom: var(--space-6);">✨</div>
                        <h2 style="font-size: var(--text-3xl); font-weight: var(--font-bold); color: var(--gray-800); margin-bottom: var(--space-4);">Start Building Your Form</h2>
                        <p style="font-size: var(--text-lg); color: var(--gray-600); text-align: center; max-width: 500px;">
                            Connect to Salesforce and use the floating action button to add fields. 
                            Click the + button to access the field palette and start building!
                        </p>
                    </div>
                `;
                return;
            }
            
            // Render fields
            let fieldsHTML = '<div class="unified-form-fields">';
            
            currentPage.fields.forEach((field, index) => {
                fieldsHTML += this.renderUnifiedField(field, index);
            });
            
            fieldsHTML += '</div>';
            canvas.innerHTML = fieldsHTML;
            
            // Add click handlers for field selection
            this.setupFieldClickHandlers();
            
            
        } catch (error) {
            console.error('❌ Error rendering form canvas:', error);
        }
    }
    
    renderUnifiedField(field, index) {
        // Use existing field renderer if available
        if (window.AppModules?.fieldTypes?.renderField) {
            const fieldHTML = window.AppModules.fieldTypes.renderField(field);
            return `
                <div class="unified-field-wrapper" data-field-id="${field.id}" data-field-index="${index}">
                    ${fieldHTML}
                    <div class="unified-field-controls">
                        <button class="unified-field-control" onclick="unifiedController.editField('${field.id}')" title="Edit Field">⚙️</button>
                        <button class="unified-field-control" onclick="unifiedController.deleteField('${field.id}')" title="Delete Field">🗑️</button>
                        <button class="unified-field-control" onclick="unifiedController.duplicateField('${field.id}')" title="Duplicate Field">📄</button>
                    </div>
                </div>
            `;
        } else {
            // Fallback basic renderer
            return `
                <div class="unified-field-wrapper unified-card" data-field-id="${field.id}" data-field-index="${index}" style="margin-bottom: var(--space-4); padding: var(--space-4);">
                    <div class="field-content">
                        <label style="font-weight: var(--font-semibold); margin-bottom: var(--space-2); display: block;">
                            ${field.label} ${field.required ? '<span style="color: var(--accent-red);">*</span>' : ''}
                        </label>
                        ${this.renderBasicFieldInput(field)}
                        ${field.helpText ? `<div class="field-help" style="font-size: var(--text-sm); color: var(--gray-600); margin-top: var(--space-1);">${field.helpText}</div>` : ''}
                    </div>
                    <div class="unified-field-controls" style="display: flex; gap: var(--space-2); margin-top: var(--space-3);">
                        <button class="unified-btn unified-btn-secondary" onclick="unifiedController.editField('${field.id}')" style="min-height: auto; padding: var(--space-1) var(--space-2);" title="Edit Field">⚙️</button>
                        <button class="unified-btn unified-btn-secondary" onclick="unifiedController.duplicateField('${field.id}')" style="min-height: auto; padding: var(--space-1) var(--space-2);" title="Duplicate Field">📄</button>
                        <button class="unified-btn unified-btn-secondary" onclick="unifiedController.deleteField('${field.id}')" style="min-height: auto; padding: var(--space-1) var(--space-2);" title="Delete Field">🗑️</button>
                    </div>
                </div>
            `;
        }
    }
    
    renderBasicFieldInput(field) {
        const inputStyles = 'width: 100%; padding: var(--space-3); border: 2px solid var(--gray-200); border-radius: var(--radius-lg); font-size: var(--text-base);';
        
        switch (field.type) {
            case 'textarea':
                return `<textarea class="unified-input" placeholder="${field.placeholder || ''}" style="${inputStyles} min-height: 80px;" disabled></textarea>`;
            case 'select':
                const options = field.options?.map(opt => `<option value="${opt.value || opt}">${opt.label || opt}</option>`).join('') || '';
                return `<select class="unified-input" style="${inputStyles}" disabled><option value="">${field.placeholder || 'Choose an option'}</option>${options}</select>`;
            case 'checkbox':
                return `<label style="display: flex; align-items: center; gap: var(--space-2);"><input type="checkbox" disabled> ${field.label}</label>`;
            case 'radio':
                const radioOptions = field.options?.map(opt => 
                    `<label style="display: flex; align-items: center; gap: var(--space-2); margin-bottom: var(--space-1);">
                        <input type="radio" name="${field.id}" value="${opt.value || opt}" disabled> ${opt.label || opt}
                    </label>`
                ).join('') || '';
                return `<div>${radioOptions}</div>`;
            case 'date':
                return `<input type="date" class="unified-input" placeholder="${field.placeholder || ''}" style="${inputStyles}" disabled>`;
            case 'email':
                return `<input type="email" class="unified-input" placeholder="${field.placeholder || 'Enter email address'}" style="${inputStyles}" disabled>`;
            case 'phone':
                return `<input type="tel" class="unified-input" placeholder="${field.placeholder || 'Enter phone number'}" style="${inputStyles}" disabled>`;
            case 'number':
                return `<input type="number" class="unified-input" placeholder="${field.placeholder || 'Enter number'}" style="${inputStyles}" disabled>`;
            default:
                return `<input type="text" class="unified-input" placeholder="${field.placeholder || ''}" style="${inputStyles}" disabled>`;
        }
    }
    
    setupFieldClickHandlers() {
        const fieldWrappers = document.querySelectorAll('.unified-field-wrapper');
        fieldWrappers.forEach(wrapper => {
            wrapper.addEventListener('click', (e) => {
                if (!e.target.closest('.unified-field-controls')) {
                    const fieldId = wrapper.dataset.fieldId;
                    this.selectFieldUnified(fieldId);
                }
            });
        });
    }
    
    // ==========================================================================
    // FIELD SELECTION AND PROPERTIES
    // ==========================================================================
    
    selectFieldUnified(fieldId) {
        
        // Remove selection from all fields
        document.querySelectorAll('.unified-field-wrapper').forEach(wrapper => {
            wrapper.classList.remove('selected');
        });
        
        // Select the clicked field
        const fieldWrapper = document.querySelector(`[data-field-id="${fieldId}"]`);
        if (fieldWrapper) {
            fieldWrapper.classList.add('selected');
        }
        
        // Update current selection
        this.currentSelectedField = fieldId;
        
        // Show properties panel
        this.showFieldProperties(fieldId);
        
        // Open properties panel on mobile
        if (window.innerWidth <= 768 && !this.propertiesOpen) {
            this.openPropertiesPanel();
        }
    }
    
    showFieldProperties(fieldId) {
        try {
            // Get field from form builder
            const field = this.getFieldById(fieldId);
            if (!field) {
                console.error(`❌ Field not found: ${fieldId}`);
                return;
            }
            
            const propertiesContent = document.getElementById('propertiesPanelContentUnified');
            if (!propertiesContent) return;
            
            // Use existing properties renderer if available
            if (window.AppModules?.formBuilder?.renderProperties) {
                propertiesContent.innerHTML = window.AppModules.formBuilder.renderProperties(field);
            } else {
                // Fallback basic properties
                propertiesContent.innerHTML = this.renderBasicFieldProperties(field);
            }
            
            
        } catch (error) {
            console.error('❌ Error showing field properties:', error);
        }
    }
    
    renderBasicFieldProperties(field) {
        return `
            <div class="unified-properties">
                <div class="unified-card" style="margin-bottom: var(--space-4);">
                    <div class="unified-card-header">
                        <h3 style="margin: 0;">Basic Properties</h3>
                    </div>
                    <div class="unified-card-content">
                        <div style="margin-bottom: var(--space-4);">
                            <label style="display: block; font-weight: var(--font-semibold); margin-bottom: var(--space-2);">Field Label</label>
                            <input type="text" class="unified-input" value="${field.label}" onchange="unifiedController.updateFieldProperty('${field.id}', 'label', this.value)">
                        </div>
                        
                        <div style="margin-bottom: var(--space-4);">
                            <label style="display: block; font-weight: var(--font-semibold); margin-bottom: var(--space-2);">Placeholder Text</label>
                            <input type="text" class="unified-input" value="${field.placeholder || ''}" onchange="unifiedController.updateFieldProperty('${field.id}', 'placeholder', this.value)">
                        </div>
                        
                        <div style="margin-bottom: var(--space-4);">
                            <label style="display: block; font-weight: var(--font-semibold); margin-bottom: var(--space-2);">Help Text</label>
                            <input type="text" class="unified-input" value="${field.helpText || ''}" onchange="unifiedController.updateFieldProperty('${field.id}', 'helpText', this.value)">
                        </div>
                        
                        <div style="margin-bottom: var(--space-4);">
                            <label style="display: flex; align-items: center; gap: var(--space-2);">
                                <input type="checkbox" ${field.required ? 'checked' : ''} onchange="unifiedController.updateFieldProperty('${field.id}', 'required', this.checked)">
                                <span style="font-weight: var(--font-semibold);">Required Field</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="unified-card">
                    <div class="unified-card-header">
                        <h3 style="margin: 0;">Field Actions</h3>
                    </div>
                    <div class="unified-card-content">
                        <div style="display: flex; flex-direction: column; gap: var(--space-2);">
                            <button class="unified-btn unified-btn-secondary" onclick="unifiedController.duplicateField('${field.id}')">
                                📄 Duplicate Field
                            </button>
                            <button class="unified-btn unified-btn-secondary" onclick="unifiedController.moveFieldUp('${field.id}')">
                                ⬆️ Move Up
                            </button>
                            <button class="unified-btn unified-btn-secondary" onclick="unifiedController.moveFieldDown('${field.id}')">
                                ⬇️ Move Down
                            </button>
                            <button class="unified-btn unified-btn-danger" onclick="unifiedController.deleteField('${field.id}')">
                                🗑️ Delete Field
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // ==========================================================================
    // FIELD OPERATIONS
    // ==========================================================================
    
    editField(fieldId) {
        this.selectFieldUnified(fieldId);
        if (!this.propertiesOpen) {
            this.openPropertiesPanel();
        }
    }
    
    duplicateField(fieldId) {
        try {
            const field = this.getFieldById(fieldId);
            if (!field) return;
            
            const newField = { 
                ...field, 
                id: `field_${Date.now()}`,
                label: `${field.label} Copy`
            };
            
            const currentPage = this.formBuilder?.getCurrentPage?.() || 
                this.formBuilder?.currentForm?.pages?.[0];
                
            if (currentPage) {
                const fieldIndex = currentPage.fields.findIndex(f => f.id === fieldId);
                currentPage.fields.splice(fieldIndex + 1, 0, newField);
                this.renderUnifiedFormCanvas();
                
                if (window.magicalPopups) {
                    window.magicalPopups.showToast('Field duplicated!', 'success');
                }
            }
        } catch (error) {
            console.error('❌ Error duplicating field:', error);
        }
    }
    
    deleteField(fieldId) {
        if (confirm('Are you sure you want to delete this field?')) {
            try {
                const currentPage = this.formBuilder?.getCurrentPage?.() || 
                    this.formBuilder?.currentForm?.pages?.[0];
                    
                if (currentPage) {
                    currentPage.fields = currentPage.fields.filter(f => f.id !== fieldId);
                    this.renderUnifiedFormCanvas();
                    
                    // Clear properties panel if this field was selected
                    if (this.currentSelectedField === fieldId) {
                        this.currentSelectedField = null;
                        this.showEmptyProperties();
                    }
                    
                    if (window.magicalPopups) {
                        window.magicalPopups.showToast('Field deleted', 'info');
                    }
                }
            } catch (error) {
                console.error('❌ Error deleting field:', error);
            }
        }
    }
    
    moveFieldUp(fieldId) {
        try {
            const currentPage = this.formBuilder?.getCurrentPage?.() || 
                this.formBuilder?.currentForm?.pages?.[0];
                
            if (currentPage) {
                const fieldIndex = currentPage.fields.findIndex(f => f.id === fieldId);
                if (fieldIndex > 0) {
                    const field = currentPage.fields.splice(fieldIndex, 1)[0];
                    currentPage.fields.splice(fieldIndex - 1, 0, field);
                    this.renderUnifiedFormCanvas();
                    
                    if (window.magicalPopups) {
                        window.magicalPopups.showToast('Field moved up', 'info', { duration: 1000 });
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error moving field up:', error);
        }
    }
    
    moveFieldDown(fieldId) {
        try {
            const currentPage = this.formBuilder?.getCurrentPage?.() || 
                this.formBuilder?.currentForm?.pages?.[0];
                
            if (currentPage) {
                const fieldIndex = currentPage.fields.findIndex(f => f.id === fieldId);
                if (fieldIndex < currentPage.fields.length - 1) {
                    const field = currentPage.fields.splice(fieldIndex, 1)[0];
                    currentPage.fields.splice(fieldIndex + 1, 0, field);
                    this.renderUnifiedFormCanvas();
                    
                    if (window.magicalPopups) {
                        window.magicalPopups.showToast('Field moved down', 'info', { duration: 1000 });
                    }
                }
            }
        } catch (error) {
            console.error('❌ Error moving field down:', error);
        }
    }
    
    updateFieldProperty(fieldId, property, value) {
        try {
            const field = this.getFieldById(fieldId);
            if (field) {
                field[property] = value;
                this.renderUnifiedFormCanvas();
                
                // Re-select the field to maintain selection
                setTimeout(() => {
                    this.selectFieldUnified(fieldId);
                }, 100);
                
            }
        } catch (error) {
            console.error('❌ Error updating field property:', error);
        }
    }
    
    // ==========================================================================
    // HELPER METHODS
    // ==========================================================================
    
    getFieldById(fieldId) {
        const currentPage = this.formBuilder?.getCurrentPage?.() || 
            this.formBuilder?.currentForm?.pages?.[0];
            
        if (currentPage && currentPage.fields) {
            return currentPage.fields.find(f => f.id === fieldId);
        }
        return null;
    }
    
    showEmptyProperties() {
        const propertiesContent = document.getElementById('propertiesPanelContentUnified');
        if (propertiesContent) {
            propertiesContent.innerHTML = `
                <div style="text-align: center; padding: var(--space-8); color: var(--gray-500);">
                    <div style="font-size: 3rem; margin-bottom: var(--space-4);">⚙️</div>
                    <h3 style="margin-bottom: var(--space-3);">Select a Field</h3>
                    <p>Select a field from your form to view and edit its properties.</p>
                </div>
            `;
        }
    }
    
    updateConnectionStatus() {
        const statusElements = document.querySelectorAll('#connectionStatusUnified .status-indicator');
        
        statusElements.forEach(indicator => {
            const isConnected = window.AppState?.isConnected || false;
            const orgName = window.AppState?.currentOrg?.name || 'Unknown Org';
            
            if (isConnected) {
                indicator.className = 'status-indicator connected';
                indicator.innerHTML = `
                    <div class="status-dot"></div>
                    <span class="status-text">Connected to ${orgName}</span>
                `;
            } else {
                indicator.className = 'status-indicator disconnected';
                indicator.innerHTML = `
                    <div class="status-dot"></div>
                    <span class="status-text">Not Connected</span>
                `;
            }
        });
    }
    
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme-preference', newTheme);
        
        // Update theme toggle button
        const themeToggle = document.getElementById('themeToggleUnified');
        if (themeToggle) {
            themeToggle.textContent = newTheme === 'dark' ? '☀️' : '🌙';
        }
        
    }
    
    // ==========================================================================
    // TOUCH HANDLERS FOR MOBILE
    // ==========================================================================
    
    handleTouchStart(e, block) {
        this.touchStartTime = Date.now();
        this.touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this.isDragging = false;
    }
    
    handleTouchMove(e) {
        if (this.touchStartTime && Date.now() - this.touchStartTime > 300) {
            this.isDragging = true;
            e.preventDefault();
        }
    }
    
    handleTouchEnd(e) {
        if (this.isDragging) {
            // Handle drop logic for touch
            const canvas = document.getElementById('formCanvasUnified');
            const touch = e.changedTouches[0];
            const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
            
            if (canvas && (elementBelow === canvas || canvas.contains(elementBelow))) {
                const fieldType = e.target.closest('.field-block')?.dataset.fieldType;
                if (fieldType) {
                    this.addFieldToForm(fieldType);
                }
            }
        }
        
        this.touchStartTime = null;
        this.touchStartPos = null;
        this.isDragging = false;
    }
}

// ==========================================================================
// GLOBAL FUNCTIONS FOR HTML INTEGRATION
// ==========================================================================

// Initialize unified controller
let unifiedController;

// Global functions that HTML can call
function toggleUnifiedFabMenu() {
    if (unifiedController) unifiedController.toggleFabMenu();
}

function openFieldPalette() {
    if (unifiedController) unifiedController.openFieldPalette();
}

function openPropertiesPanel() {
    if (unifiedController) unifiedController.openPropertiesPanel();
}

function closeFieldPalette() {
    if (unifiedController) unifiedController.closeFieldPalette();
}

function closePropertiesPanel() {
    if (unifiedController) unifiedController.closePropertiesPanel();
}

function closeAllPanels() {
    if (unifiedController) unifiedController.closeAllPanels();
}

function addFieldFromPalette(fieldType) {
    if (unifiedController) unifiedController.addFieldFromPalette(fieldType);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    unifiedController = new UnifiedExperienceController();
});

// Export for external access
window.UnifiedExperienceController = UnifiedExperienceController;