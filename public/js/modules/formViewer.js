// FormViewer Module - Handles public form display and submission

const { debugError, debugWarn, debugInfo, debugDebug, debugVerbose } = window.SFBDebug;

export class FormViewer {
    constructor() {
        this.formId = null;
        this.formData = null;
        this.currentPage = 0;
        this.submissionData = {};
    }
    
    async initialize() {
        debugInfo('FormViewer', 'Initializing FormViewer module...');
        
        // Extract form ID from URL
        this.formId = this.extractFormId();
        
        if (!this.formId) {
            this.showError('Invalid form URL');
            return;
        }
        
        // Make formId globally available for API calls
        window.currentFormId = this.formId;
        
        // Load and render form
        await this.loadForm();
        this.setupEventListeners();
    }
    
    extractFormId() {
        const path = window.location.pathname;
        const match = path.match(/\/form\/([^\/]+)/);
        return match ? match[1] : null;
    }
    
    async loadForm() {
        try {
            const response = await fetch(`/api/public/forms/${this.formId}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    this.showError('Form not found');
                } else {
                    this.showError('Error loading form');
                }
                return;
            }
            
            this.formData = await response.json();
            
            if (!this.formData.published) {
                this.showError('This form is not published');
                return;
            }
            
            // Render the form first, then setup conditional logic
            await this.renderForm();
        } catch (error) {
            debugError('FormViewer'('Error loading form:', error);
            this.showError('Failed to load form');
        }
    }
    
    async renderForm() {
        // Set proper page title - remove (Test Copy) suffix if present
        const formName = this.formData.name || 'Form';
        const cleanFormName = formName.replace(/\s*\(Test Copy\)$/, '').trim();
        document.title = cleanFormName;
        
        // Apply custom styling if provided
        this.applyCustomStyling();
        
        // Render form structure
        const container = document.getElementById('formContainer') || document.body;
        container.innerHTML = this.generateFormHTML();
        
        // Initialize modules for the rendered form
        await this.initializeFormModules();
        
        // Setup auto-save
        this.setupAutoSave();
        
        // Setup field change listeners for conditional logic
        this.setupConditionalLogicListeners();
        
        // Dispatch formRendered event for any modules listening for it
        document.dispatchEvent(new CustomEvent('formRendered', {
            detail: { formId: this.formId, formData: this.formData }
        }));
        
        debugInfo('FormViewer', 'Form rendered successfully');
    }
    
    generateFormHTML() {
        const form = this.formData;
        // Clean form name for display
        const cleanFormName = (form.name || 'Form').replace(/\s*\(Test Copy\)$/, '').trim();
        let html = `
            <div class="form-viewer-container">
                <div class="form-header">
                    <h1 class="form-title">${this.escapeHtml(cleanFormName)}</h1>
                    ${form.description ? `<p class="form-description">${this.escapeHtml(form.description)}</p>` : ''}
                </div>
                
                <form id="publicForm" class="public-form" novalidate>
        `;
        
        // Render pages
        form.pages.forEach((page, pageIndex) => {
            const isVisible = pageIndex === 0 ? 'block' : 'none';
            
            html += `
                <div class="form-page" 
                     data-page-id="${page.id}" 
                     data-page-index="${pageIndex}"
                     style="display: ${isVisible}">
                    
                    ${form.pages.length > 1 ? `<h2 class="page-title">${this.escapeHtml(page.name)}</h2>` : ''}
                    
                    <div class="page-fields">
            `;
            
            // Render fields
            page.fields.forEach(field => {
                html += this.renderField(field);
            });
            
            html += `
                    </div>
                    
                    ${page.repeatConfig?.enabled ? (() => {
                        debugInfo('FormViewer', `Rendering repeat controls for page ${page.id}`);
                        return this.renderRepeatControls(page);
                    })() : ''}
                </div>
            `;
        });
        
        // Navigation and submit buttons
        html += this.renderFormNavigation();
        
        html += `
                </form>
                
                <div id="submissionMessage" class="submission-message" style="display: none;">
                    <h2>Thank you!</h2>
                    <p>${this.escapeHtml(form.settings.successMessage || 'Your submission has been received.')}</p>
                </div>
            </div>
        `;
        
        return html;
    }
    
    renderField(field) {
        const isConditional = field.conditionalVisibility?.enabled;
        const displayStyle = isConditional ? 'none' : 'block';
        
        return `
            <div class="form-field-container" 
                 data-field-id="${field.id}"
                 data-field-type="${field.type}"
                 ${isConditional ? 'data-conditional="true"' : ''}
                 style="display: ${displayStyle}">
                
                <label class="field-label" for="${field.id}">
                    ${this.escapeHtml(field.label)}
                    ${field.required ? '<span class="field-required">*</span>' : ''}
                </label>
                
                ${this.renderFieldInput(field)}
                
                ${field.helpText ? `<div class="field-help">${this.escapeHtml(field.helpText)}</div>` : ''}
                
                <div class="field-error" style="display: none;"></div>
            </div>
        `;
    }
    
    renderFieldInput(field) {
        // Use the fieldTypes module to render the field
        const fieldTypes = window.AppModules?.fieldTypes;
        if (fieldTypes) {
            return fieldTypes.renderField(field);
        }
        
        // Fallback rendering
        switch (field.type) {
            case 'text':
            case 'email':
            case 'phone':
            case 'number':
            case 'date':
                return `<input type="${field.type}" id="${field.id}" name="${field.id}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} class="form-input">`;
            
            case 'textarea':
                return `<textarea id="${field.id}" name="${field.id}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''} class="form-textarea"></textarea>`;
            
            case 'select':
                return `
                    <select id="${field.id}" name="${field.id}" ${field.required ? 'required' : ''} class="form-select">
                        <option value="">Choose...</option>
                        ${(field.options || []).map(opt => 
                            `<option value="${this.escapeHtml(opt.value)}">${this.escapeHtml(opt.label)}</option>`
                        ).join('')}
                    </select>
                `;
            
            case 'checkbox':
                return `
                    <label class="checkbox-label">
                        <input type="checkbox" id="${field.id}" name="${field.id}" value="true" ${field.required ? 'required' : ''} class="form-checkbox">
                        <span>${this.escapeHtml(field.checkboxLabel || 'Check this box')}</span>
                    </label>
                `;
            
            case 'radio':
                return `
                    <div class="radio-group">
                        ${(field.options || []).map((opt, idx) => `
                            <label class="radio-label">
                                <input type="radio" name="${field.id}" value="${this.escapeHtml(opt.value)}" ${idx === 0 && field.required ? 'required' : ''} class="form-radio">
                                <span>${this.escapeHtml(opt.label)}</span>
                            </label>
                        `).join('')}
                    </div>
                `;
            
            default:
                return `<div class="field-placeholder">Unsupported field type: ${field.type}</div>`;
        }
    }
    
    renderRepeatControls(page) {
        const minInstances = page.repeatConfig.min || 1;
        const maxInstances = page.repeatConfig.max || 10;
        
        return `
            <div class="repeat-controls">
                <div class="repeat-instructions">
                    <p class="help-text">
                        <strong>Multiple entries allowed:</strong> You can add between ${minInstances} and ${maxInstances} entries.
                        Fill out the form above and click "${page.repeatConfig.addButtonText || 'Add Another'}" to save each entry.
                        When you're done adding entries, click "Next" to continue.
                    </p>
                </div>
                <button type="button" class="button button-secondary add-repeat-btn" data-page-id="${page.id}">
                    ${page.repeatConfig.addButtonText || 'Add Another'}
                </button>
                <div class="collected-items" id="collected-items-${page.id}" style="display: none;">
                    <h4>Added Items: <span class="item-count" id="item-count-${page.id}">0</span></h4>
                    <div class="items-list" id="items-list-${page.id}"></div>
                </div>
                <input type="hidden" id="collected-data-${page.id}" name="collected-data-${page.id}" value="[]">
                <div class="repeat-status" id="repeat-status-${page.id}" style="margin-top: 10px;">
                    <span class="status-text"></span>
                </div>
            </div>
        `;
    }
    
    renderFormNavigation() {
        if (this.formData.pages.length <= 1) {
            return `
                <div class="form-navigation single-page">
                    <button type="submit" class="button button-primary submit-btn">
                        ${this.formData.settings.submitButtonText || 'Submit'}
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="form-navigation multi-page">
                <button type="button" id="prevPageBtn" class="button button-secondary" style="display: none;">
                    Previous
                </button>
                <button type="button" id="nextPageBtn" class="button button-primary">
                    Next
                </button>
                <button type="submit" id="submitBtn" class="button button-primary" style="display: none;">
                    ${this.formData.settings.submitButtonText || 'Submit'}
                </button>
            </div>
        `;
    }
    
    applyCustomStyling() {
        const settings = this.formData.settings;
        
        if (settings.customCSS) {
            const style = document.createElement('style');
            style.textContent = settings.customCSS;
            document.head.appendChild(style);
        }
        
    }
    
    setupEventListeners() {
        const form = document.getElementById('publicForm');
        if (!form) return;
        
        // Form submission
        form.addEventListener('submit', (e) => this.handleFormSubmission(e));
        
        // Page navigation
        const nextBtn = document.getElementById('nextPageBtn');
        const prevBtn = document.getElementById('prevPageBtn');
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextPage());
        }
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previousPage());
        }
        
        // Field change events for conditional logic and auto-save
        form.addEventListener('input', (e) => this.handleFieldChange(e));
        form.addEventListener('change', (e) => this.handleFieldChange(e));
        
        // Repeat functionality event listeners
        form.addEventListener('click', (e) => {
            if (e.target.matches('.add-repeat-btn')) {
                e.preventDefault();
                this.handleAddRepeatInstance(e.target.dataset.pageId);
            } else if (e.target.matches('.remove-repeat-btn')) {
                e.preventDefault();
                this.handleRemoveRepeatInstance(e.target.dataset.pageId, e.target.dataset.instanceIndex);
            }
        });
    }
    
    async initializeFormModules() {
        // Initialize field types first as other modules may depend on it
        const fieldTypes = window.AppModules?.fieldTypes;
        if (fieldTypes) {
            fieldTypes.initializeAllFields();
        }
        
        // Initialize signature pads
        const signature = window.AppModules?.signature;
        if (signature) {
            const signatureFields = document.querySelectorAll('[data-field-type="signature"]');
            signatureFields.forEach(field => {
                const canvas = field.querySelector('canvas');
                const hiddenInput = field.querySelector('input[type="hidden"]');
                if (canvas && hiddenInput) {
                    signature.initializeSignaturePad(hiddenInput.id, canvas.id, {});
                }
            });
        }
        
        // Initialize multi-page functionality
        const multiPage = window.AppModules?.multiPage;
        if (multiPage) {
            multiPage.initializePreview();
            
            // Sync current page index between form viewer and multiPage module
            multiPage.currentPageIndex = this.currentPage;
            debugInfo('FormViewer', `🔄 FORM VIEWER: Synced multiPage currentPageIndex to ${this.currentPage}`);
        }
        
        // Initialize conditional logic AFTER other modules
        const conditionalLogic = window.AppModules?.conditionalLogic;
        if (conditionalLogic) {
            debugInfo('FormViewer', '🔄 FORM VIEWER: Initializing conditional logic module');
            conditionalLogic.initializePreview();
            
            // Setup conditional logic configuration
            debugInfo('FormViewer', '🔄 FORM VIEWER: Setting up conditional logic configuration');
            conditionalLogic.setupConditionalLogic();
        }
        
        // Update navigation buttons for multi-page forms
        if (this.formData.pages.length > 1) {
            this.updateNavigationButtons();
        }
        
        // Initialize repeat functionality for pages that have it enabled
        this.initializeRepeatPages();
    }
    
    setupAutoSave() {
        const autoSave = window.AppModules?.autoSave;
        if (autoSave) {
            // Check for previously saved data to restore after form is fully rendered
            setTimeout(() => {
                autoSave.checkRestorationNeeded();
            }, 100);
            debugInfo('FormViewer', 'Auto-save enabled for form viewer');
        }
    }
    
    handleFieldChange(e) {
        const field = e.target;
        const fieldId = field.name || field.id;
        
        if (fieldId) {
            this.submissionData[fieldId] = this.getFieldValue(field);
            
            // Trigger conditional logic evaluation
            const conditionalLogic = window.AppModules?.conditionalLogic;
            if (conditionalLogic) {
                conditionalLogic.handleFieldChange(field);
            }
        }
    }
    
    getFieldValue(field) {
        switch (field.type) {
            case 'checkbox':
                return field.checked;
            case 'radio':
                return field.checked ? field.value : null;
            case 'file':
                return Array.from(field.files).map(file => ({
                    name: file.name,
                    size: file.size,
                    type: file.type
                }));
            default:
                return field.value;
        }
    }
    
    async nextPage() {
        if (!this.validateCurrentPage()) {
            return;
        }
        
        // Process current page data before navigating
        const currentPageData = this.formData.pages[this.currentPage];
        
        // Check if current page is a Get Records query page - we need to process it
        if (currentPageData && currentPageData.actionType === 'get') {
            debugInfo('FormViewer', `📊 Processing Get Records page ${this.currentPage} before navigation`);
            await this.processGetRecordsPage(currentPageData);
        }
        
        // Check if current page is a repeat page with unsaved data
        debugInfo('FormViewer', `nextPage: Checking page ${this.currentPage}, repeat enabled: ${currentPageData?.repeatConfig?.enabled}`);
        if (currentPageData && currentPageData.repeatConfig?.enabled) {
            // Check if there's any data in the current form fields
            const currentData = this.collectCurrentPageData(currentPageData.id);
            debugInfo('FormViewer', 'Current page data:', currentData);
            if (Object.keys(currentData).length > 0) {
                // There's unsaved data - collect it before moving on
                debugInfo('FormViewer', '✅ Collecting unsaved repeat data before navigation');
                this.addToCollectedData(currentPageData.id, currentData);
                this.clearPageFields(currentPageData.id);
                this.updateCollectedItemsDisplay(currentPageData.id);
                
                // Log the collected data to verify it was saved
                const collectedData = this.getCollectedData(currentPageData.id);
                debugInfo('FormViewer', `Total collected data for page ${currentPageData.id}:`, collectedData);
            } else {
                debugInfo('FormViewer', '❌ No unsaved data found on repeat page');
            }
        }
        
        if (this.currentPage < this.formData.pages.length - 1) {
            this.currentPage++;
            this.updatePageVisibility();
            
            // Keep multiPage module in sync
            const multiPage = window.AppModules.multiPage;
            if (multiPage) {
                multiPage.currentPageIndex = this.currentPage;
            }
            
            this.updateNavigationButtons();
        }
    }
    
    previousPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.updatePageVisibility();
            
            // Keep multiPage module in sync
            const multiPage = window.AppModules.multiPage;
            if (multiPage) {
                multiPage.currentPageIndex = this.currentPage;
            }
            
            this.updateNavigationButtons();
        }
    }
    
    updatePageVisibility() {
        const pages = document.querySelectorAll('.form-page');
        const multiPage = window.AppModules.multiPage;
        
        pages.forEach((page, index) => {
            if (index === this.currentPage) {
                // Show current page only if it's not conditionally hidden
                const pageId = page.dataset.pageId;
                const isConditionallyVisible = !multiPage || multiPage.isPageVisible(pageId);
                page.style.display = isConditionallyVisible ? 'block' : 'none';
            } else {
                // Hide all other pages
                page.style.display = 'none';
            }
        });
    }
    
    updateNavigationButtons() {
        debugInfo('FormViewer', '🔄 FORM VIEWER: Updating navigation buttons with conditional logic support');
        
        // Delegate to multiPage module which has conditional logic support
        const multiPage = window.AppModules.multiPage;
        if (multiPage) {
            debugInfo('FormViewer', '🔄 FORM VIEWER: Using multiPage module for navigation button updates');
            multiPage.updateNavigationButtons();
        } else {
            // Fallback to simple logic if multiPage not available
            debugWarn('FormViewer'('🔄 FORM VIEWER: multiPage module not available, using fallback navigation logic');
            const prevBtn = document.getElementById('prevPageBtn');
            const nextBtn = document.getElementById('nextPageBtn');
            const submitBtn = document.getElementById('submitBtn');
            
            if (prevBtn) {
                prevBtn.style.display = this.currentPage > 0 ? 'inline-block' : 'none';
            }
            
            if (nextBtn && submitBtn) {
                if (this.currentPage < this.formData.pages.length - 1) {
                    nextBtn.style.display = 'inline-block';
                    submitBtn.style.display = 'none';
                } else {
                    nextBtn.style.display = 'none';
                    submitBtn.style.display = 'inline-block';
                }
            }
        }
    }
    
    handleAddRepeatInstance(pageId) {
        debugInfo('FormViewer', 'Adding repeat instance for page:', pageId);
        
        const page = this.formData.pages.find(p => p.id === pageId);
        if (!page || !page.repeatConfig?.enabled) {
            debugInfo('FormViewer', 'Page not found or repeat not enabled');
            return;
        }
        
        // Validate current form data before adding
        if (!this.validateCurrentPageFields(pageId)) {
            alert('Please fill in all required fields before adding another item.');
            return;
        }
        
        // Collect current form data
        const currentData = this.collectCurrentPageData(pageId);
        if (Object.keys(currentData).length === 0) {
            alert('Please fill in at least one field before adding an item.');
            return;
        }
        
        // Add to collected data
        this.addToCollectedData(pageId, currentData);
        
        // Clear the form for next entry
        this.clearPageFields(pageId);
        
        // Update display of collected items
        this.updateCollectedItemsDisplay(pageId);
        
        // Check if we've reached the maximum number of instances
        const collectedData = this.getCollectedData(pageId);
        const addButton = document.querySelector(`[data-page-id="${pageId}"] .add-repeat-btn`);
        if (addButton && collectedData.length >= page.repeatConfig.max) {
            addButton.disabled = true;
            addButton.textContent = 'Maximum items reached';
        }
    }
    
    handleRemoveRepeatInstance(pageId, instanceIndex) {
        debugInfo('FormViewer', 'Removing repeat instance:', instanceIndex, 'for page:', pageId);
        
        const page = this.formData.pages.find(p => p.id === pageId);
        if (!page || !page.repeatConfig?.enabled) return;
        
        // Remove from collected data
        const collectedData = this.getCollectedData(pageId);
        if (collectedData.length <= page.repeatConfig.min) {
            alert(`Minimum ${page.repeatConfig.min} items required`);
            return;
        }
        
        collectedData.splice(instanceIndex, 1);
        this.setCollectedData(pageId, collectedData);
        
        // Update display
        this.updateCollectedItemsDisplay(pageId);
        
        // Re-enable add button if we're below max
        if (collectedData.length < page.repeatConfig.max) {
            document.querySelector(`[data-page-id="${pageId}"] .add-repeat-btn`).disabled = false;
        }
    }
    
    validateCurrentPageFields(pageId) {
        const pageElement = document.querySelector(`[data-page-id="${pageId}"]`);
        if (!pageElement) return false;
        
        const requiredFields = pageElement.querySelectorAll('input[required], select[required], textarea[required]');
        
        for (let field of requiredFields) {
            if (!field.value || field.value.trim() === '') {
                field.focus();
                return false;
            }
        }
        
        return true;
    }
    
    collectCurrentPageData(pageId) {
        const pageElement = document.querySelector(`[data-page-id="${pageId}"]`);
        if (!pageElement) return {};
        
        const page = this.formData.pages.find(p => p.id === pageId);
        if (!page) return {};
        
        const data = {};
        const fields = pageElement.querySelectorAll('.page-fields input, .page-fields select, .page-fields textarea');
        
        debugInfo('FormViewer', `Collecting data for page ${pageId} with ${page.fields.length} form fields and ${fields.length} DOM fields`);
        debugInfo('FormViewer', 'Form field definitions:', page.fields.map(f => ({ id: f.id, label: f.label, salesforceField: f.salesforceField })));
        debugInfo('FormViewer', 'DOM field names:', Array.from(fields).map(f => f.name).filter(Boolean));
        
        fields.forEach(domField => {
            if (domField.name && domField.value !== '') {
                // Skip the collected data hidden field
                if (domField.name.startsWith('collected-data-')) return;
                
                // Find the corresponding form field definition to get the correct field ID
                const formField = page.fields.find(f => f.id === domField.name || f.id === domField.id);
                
                if (formField) {
                    // Use the form field ID as the key (this is what the server expects)
                    const fieldValue = this.getFieldValue(domField);
                    data[formField.id] = fieldValue;
                    debugInfo('FormViewer', `Mapped DOM field ${domField.name} → form field ${formField.id} (SF: ${formField.salesforceField}): ${fieldValue}`);
                } else {
                    // Fallback: use the DOM field name if no form field found
                    data[domField.name] = this.getFieldValue(domField);
                    debugInfo('FormViewer', `No form field mapping found for DOM field ${domField.name}, using as-is: ${data[domField.name]}`);
                }
            }
        });
        
        // Include signature data - these should already have the correct field IDs
        const signatureModule = window.AppModules?.signature;
        if (signatureModule) {
            const signatures = signatureModule.getAllSignatureData();
            debugInfo('FormViewer', 'Adding signature data:', signatures);
            Object.assign(data, signatures);
        }
        
        debugInfo('FormViewer', `Final collected data for page ${pageId}:`, data);
        return data;
    }
    
    clearPageFields(pageId) {
        const pageElement = document.querySelector(`[data-page-id="${pageId}"]`);
        if (!pageElement) return;
        
        const fields = pageElement.querySelectorAll('.page-fields input, .page-fields select, .page-fields textarea');
        
        fields.forEach(field => {
            // Skip the collected data hidden field
            if (field.name && field.name.startsWith('collected-data-')) return;
            
            if (field.type === 'checkbox' || field.type === 'radio') {
                field.checked = false;
            } else {
                field.value = '';
            }
        });
        
        // Clear signature pads
        const signatureModule = window.AppModules?.signature;
        if (signatureModule) {
            const signatureFields = pageElement.querySelectorAll('[data-field-type="signature"]');
            signatureFields.forEach(field => {
                const hiddenInput = field.querySelector('input[type="hidden"]');
                if (hiddenInput) {
                    signatureModule.clearSignature(hiddenInput.id);
                }
            });
        }
        
        // Clear Quill editors
        const fieldTypes = window.AppModules?.fieldTypes;
        if (fieldTypes && fieldTypes.quillInstances) {
            pageElement.querySelectorAll('[data-field-type="richtext"]').forEach(field => {
                const editorDiv = field.querySelector('[id$="_editor"]');
                if (editorDiv && fieldTypes.quillInstances.has(editorDiv.id)) {
                    const quill = fieldTypes.quillInstances.get(editorDiv.id);
                    quill.setContents([]);
                }
            });
        }
    }
    
    addToCollectedData(pageId, data) {
        const collectedData = this.getCollectedData(pageId);
        collectedData.push(data);
        this.setCollectedData(pageId, collectedData);
    }
    
    getCollectedData(pageId) {
        const hiddenField = document.getElementById(`collected-data-${pageId}`);
        if (!hiddenField) return [];
        
        try {
            return JSON.parse(hiddenField.value);
        } catch (e) {
            return [];
        }
    }
    
    setCollectedData(pageId, data) {
        const hiddenField = document.getElementById(`collected-data-${pageId}`);
        if (hiddenField) {
            hiddenField.value = JSON.stringify(data);
        }
    }
    
    updateCollectedItemsDisplay(pageId) {
        const collectedData = this.getCollectedData(pageId);
        const itemsList = document.getElementById(`items-list-${pageId}`);
        const collectedItems = document.getElementById(`collected-items-${pageId}`);
        const itemCount = document.getElementById(`item-count-${pageId}`);
        const statusElement = document.getElementById(`repeat-status-${pageId}`);
        
        if (!itemsList || !collectedItems) return;
        
        // Update item count
        if (itemCount) {
            itemCount.textContent = collectedData.length;
        }
        
        // Find the page definition to get field labels and config
        const page = this.formData.pages.find(p => p.id === pageId);
        const minRequired = page?.repeatConfig?.min || 1;
        const maxAllowed = page?.repeatConfig?.max || 10;
        
        // Update status message
        if (statusElement) {
            const statusText = statusElement.querySelector('.status-text');
            if (statusText) {
                if (collectedData.length < minRequired) {
                    statusText.innerHTML = `<span style="color: #d73a49;">⚠️ Please add at least ${minRequired - collectedData.length} more item(s)</span>`;
                } else if (collectedData.length >= maxAllowed) {
                    statusText.innerHTML = `<span style="color: #28a745;">✓ Maximum of ${maxAllowed} items reached</span>`;
                } else {
                    statusText.innerHTML = `<span style="color: #0366d6;">✓ ${collectedData.length} of ${maxAllowed} items added</span>`;
                }
            }
        }
        
        if (collectedData.length === 0) {
            collectedItems.style.display = 'none';
            return;
        }
        
        collectedItems.style.display = 'block';
        
        itemsList.innerHTML = collectedData.map((item, index) => {
            const summary = this.createItemSummary(item, page);
            return `
                <div class="collected-item">
                    <span class="item-summary">${summary}</span>
                    <button type="button" class="button button-small remove-repeat-btn" 
                            data-page-id="${pageId}" data-instance-index="${index}">
                        ${page?.repeatConfig?.removeButtonText || 'Remove'}
                    </button>
                </div>
            `;
        }).join('');
    }
    
    createItemSummary(item, page) {
        const summaryFields = [];
        
        // Get the first few non-empty fields for summary
        for (const field of page.fields) {
            if (item[field.id] && summaryFields.length < 3) {
                summaryFields.push(`${field.label}: ${item[field.id]}`);
            }
        }
        
        // If no mapped fields found, try to show any data we have
        if (summaryFields.length === 0) {
            const itemKeys = Object.keys(item).filter(key => item[key] && !key.startsWith('_'));
            if (itemKeys.length > 0) {
                // Try to find meaningful field names
                itemKeys.slice(0, 3).forEach(key => {
                    const field = page.fields.find(f => f.id === key);
                    const label = field ? field.label : key;
                    summaryFields.push(`${label}: ${item[key]}`);
                });
            }
        }
        
        return summaryFields.length > 0 ? summaryFields.join(', ') : `Item (${Object.keys(item).length} fields)`;
    }
    
    initializeRepeatPages() {
        // No complex initialization needed with the new approach
        // The repeat controls are already rendered with the page
        debugInfo('FormViewer', '=== INITIALIZING REPEAT PAGES ===');
        
        this.formData.pages.forEach(page => {
            if (page.repeatConfig?.enabled) {
                debugInfo('FormViewer', `Checking repeat page: ${page.id} (${page.name})`);
                
                const pageElement = document.querySelector(`[data-page-id="${page.id}"]`);
                const addButton = pageElement?.querySelector('.add-repeat-btn');
                const hiddenField = document.getElementById(`collected-data-${page.id}`);
                
                debugInfo('FormViewer', `Page element found: ${!!pageElement}`);
                debugInfo('FormViewer', `Add button found: ${!!addButton}`);
                debugInfo('FormViewer', `Hidden field found: ${!!hiddenField}`);
                
                if (!addButton) {
                    debugError('FormViewer'(`❌ Add Another button NOT FOUND for repeat page ${page.id}`);
                } else {
                    debugInfo('FormViewer', `✅ Add Another button found for page ${page.id}`);
                }
            }
        });
        
        debugInfo('FormViewer', 'Repeat pages initialization complete');
    }
    
    validateCurrentPage() {
        const currentPageElement = document.querySelector(`[data-page-index="${this.currentPage}"]`);
        if (!currentPageElement) return true;
        
        // First check if this is a repeat page
        const currentPageData = this.formData.pages[this.currentPage];
        if (currentPageData && currentPageData.repeatConfig?.enabled) {
            // For repeat pages, check minimum instances
            const collectedData = this.getCollectedData(currentPageData.id);
            const minRequired = currentPageData.repeatConfig.min || 1;
            
            if (collectedData.length < minRequired) {
                alert(`Please add at least ${minRequired} item(s) before continuing. You currently have ${collectedData.length}.`);
                return false;
            }
        }
        
        // Then validate regular fields
        const fields = currentPageElement.querySelectorAll('input, select, textarea');
        let isValid = true;
        
        fields.forEach(field => {
            if (field.hasAttribute('required') && !field.disabled) {
                const value = this.getFieldValue(field);
                
                if (!value || value === '' || (Array.isArray(value) && value.length === 0)) {
                    this.showFieldError(field, 'This field is required');
                    isValid = false;
                } else {
                    this.hideFieldError(field);
                }
            }
        });
        
        return isValid;
    }
    
    showFieldError(field, message) {
        const container = field.closest('.form-field-container');
        if (container) {
            const errorDiv = container.querySelector('.field-error');
            if (errorDiv) {
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
            }
            container.classList.add('has-error');
        }
    }
    
    hideFieldError(field) {
        const container = field.closest('.form-field-container');
        if (container) {
            const errorDiv = container.querySelector('.field-error');
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }
            container.classList.remove('has-error');
        }
    }
    
    async handleFormSubmission(e) {
        e.preventDefault();
        
        if (!this.validateAllPages()) {
            alert('Please complete all required fields before submitting.');
            return;
        }
        
        try {
            this.showSubmissionProgress();
            
            const formData = this.collectFormData();
            const response = await this.submitFormData(formData);
            
            if (response.success) {
                // Update global variables with any variables returned from server
                if (response.variables && window.FormVariables) {
                    debugInfo('FormViewer', '📨 FORM SUBMISSION: Received variables from server:', Object.keys(response.variables));
                    window.FormVariables.setMultiple(response.variables);
                    
                    // Force refresh all DataTables to display the new data
                    setTimeout(() => {
                        debugInfo('FormViewer', '🔄 FORM SUBMISSION: Refreshing DataTables after receiving variables');
                        if (window.AppModules?.fieldTypes) {
                            window.AppModules.fieldTypes.refreshAllDataTables();
                        }
                    }, 100);
                }
                
                this.showSubmissionSuccess();
                this.clearAutoSavedData();
                
                // Redirect if specified
                if (this.formData.settings.redirectUrl) {
                    setTimeout(() => {
                        window.location.href = this.formData.settings.redirectUrl;
                    }, 2000);
                }
            } else {
                throw new Error(response.error || 'Submission failed');
            }
        } catch (error) {
            debugError('FormViewer'('Form submission error:', error);
            this.showSubmissionError(error.message);
        }
    }
    
    validateAllPages() {
        let allValid = true;
        
        for (let i = 0; i < this.formData.pages.length; i++) {
            const originalPage = this.currentPage;
            this.currentPage = i;
            this.updatePageVisibility();
            
            if (!this.validateCurrentPage()) {
                allValid = false;
                if (originalPage !== i) {
                    // Stay on the first page with errors
                    return false;
                }
            }
        }
        
        return allValid;
    }
    
    collectFormData() {
        const data = {};
        const files = [];

        debugInfo('FormViewer', '=== Starting Form Data Collection (v8) ===');

        this.formData.pages.forEach(page => {
            debugInfo('FormViewer', `Processing page ${page.id} (${page.name}), repeat enabled: ${page.repeatConfig?.enabled}`);
            if (page.repeatConfig?.enabled) {
                // For repeating pages, get data ONLY from the hidden input
                const collectedDataInput = document.getElementById(`collected-data-${page.id}`);
                debugInfo('FormViewer', `Hidden input field for page ${page.id}:`, collectedDataInput);
                debugInfo('FormViewer', `Hidden input value:`, collectedDataInput?.value);
                if (collectedDataInput && collectedDataInput.value) {
                    try {
                        const instances = JSON.parse(collectedDataInput.value);
                        if (instances && instances.length > 0) {
                            data[`page_${page.id}_instances`] = instances;
                            debugInfo('FormViewer', `✅ Collected ${instances.length} instances for page_${page.id}_instances from hidden field`);
                            debugInfo('FormViewer', 'Instance data:', instances);
                        } else {
                            debugInfo('FormViewer', `❌ No instances found in hidden field for page ${page.id}`);
                        }
                    } catch (e) {
                        debugError('FormViewer'(`Could not parse collected data for ${page.id}`, e);
                    }
                } else {
                    debugInfo('FormViewer', `❌ No hidden input found or empty value for page ${page.id}`);
                }
            } else {
                // For standard pages, collect data directly from fields
                const pageElement = document.querySelector(`[data-page-id="${page.id}"]`);
                if (pageElement) {
                    page.fields.forEach(field => {
                        const inputElement = pageElement.querySelector(`[name="${field.id}"]`) || pageElement.querySelector(`[id="${field.id}"]`);
                        if (inputElement) {
                            // Handle file inputs separately
                            if (inputElement.type === 'file') {
                                if (inputElement.files && inputElement.files.length > 0) {
                                    for (let i = 0; i < inputElement.files.length; i++) {
                                        files.push({ key: inputElement.name, file: inputElement.files[i] });
                                    }
                                }
                            } else {
                                data[field.id] = this.getFieldValue(inputElement);
                            }
                        }
                    });
                }
            }
        });

        // Include signature data - these should already have the correct field IDs
        const signatureModule = window.AppModules?.signature;
        if (signatureModule) {
            const signatures = signatureModule.getAllSignatureData();
            debugInfo('FormViewer', 'Adding signature data:', signatures);
            Object.assign(data, signatures);
        }
        
        debugInfo('FormViewer', '--- Final Submission Data (from formViewer.js) ---');
        debugInfo('FormViewer', 'Data object:', JSON.stringify(data, null, 2));
        debugInfo('FormViewer', `Files: ${files.length}`);
        files.forEach(file => debugInfo('FormViewer', `  - File: ${file.key}, Name: ${file.file.name}, Size: ${file.file.size}`));
        
        return { data, files };
    }
    
    async submitFormData(formResult) {
        const { data, files } = formResult;

        debugInfo('FormViewer', '--- Submitting Form Data (from formViewer.js) ---');
        debugInfo('FormViewer', 'Payload Data:', JSON.stringify(data, null, 2));
        debugInfo('FormViewer', 'Payload Files:', files.map(f => f.file.name));

        // Check if we have files to upload
        const hasFiles = files && files.length > 0;

        if (hasFiles) {
            // Use FormData for multipart submission
            const formData = new FormData();

            debugInfo('FormViewer', 'Creating multipart submission with files:', files.length);
            debugInfo('FormViewer', 'Regular data to submit:', data);

            // Add regular form data as JSON string
            formData.append('formData', JSON.stringify(data));

            // Add metadata
            formData.append('submissionMetadata', JSON.stringify({
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                referrer: document.referrer,
                formVersion: this.formData.version || '1.0'
            }));

            // Add files with proper field names
            files.forEach(({ key, file }) => {
                debugInfo('FormViewer', 'Adding file to FormData:', key, file.name, file.size);
                formData.append(key, file);
            });

            // Debug: Log all FormData entries
            debugInfo('FormViewer', 'Final FormData entries:');
            for (const [key, value] of formData.entries()) {
                debugInfo('FormViewer', 'FormData entry:', key, typeof value, value instanceof File ? `File: ${value.name}` : value);
            }

            // Submit as multipart/form-data (don't set Content-Type header, let browser set it)
            const response = await fetch(`/api/forms/${this.formId}/submit`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                debugError('FormViewer'(`Server responded with status ${response.status}:`, errorText);
                throw new Error(`Submission failed: ${response.statusText || 'Server Error'}. Details: ${errorText.substring(0, 100)}...`);
            }
            
            return await response.json();
        } else {
            // Submit as JSON for forms without files
            const response = await fetch(`/api/forms/${this.formId}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    formData: data,
                    submissionMetadata: {
                        timestamp: new Date().toISOString(),
                        userAgent: navigator.userAgent,
                        referrer: document.referrer,
                        formVersion: this.formData.version || '1.0'
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                debugError('FormViewer'(`Server responded with status ${response.status}:`, errorText);
                throw new Error(`Submission failed: ${response.statusText || 'Server Error'}. Details: ${errorText.substring(0, 100)}...`);
            }
            
            return await response.json();
        }
    }
    
    showSubmissionProgress() {
        const submitBtn = document.querySelector('[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Submitting...';
        }
    }
    
    showSubmissionSuccess() {
        const form = document.getElementById('publicForm');
        const message = document.getElementById('submissionMessage');
        
        if (form) form.style.display = 'none';
        if (message) message.style.display = 'block';
        
        // Scroll to top
        window.scrollTo(0, 0);
    }
    
    showSubmissionError(errorMessage) {
        alert(`Submission failed: ${errorMessage}`);
        
        // Re-enable submit button
        const submitBtn = document.querySelector('[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = this.formData.settings.submitButtonText || 'Submit';
        }
    }
    
    clearAutoSavedData() {
        const autoSave = window.AppModules?.autoSave;
        if (autoSave) {
            autoSave.clearUserData(this.formId);
        }
    }
    
    showError(message) {
        document.body.innerHTML = `
            <div class="error-container">
                <h1>Error</h1>
                <p>${this.escapeHtml(message)}</p>
                <a href="/" class="button button-primary">Go Home</a>
            </div>
        `;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    setupConditionalLogicListeners() {
        debugInfo('FormViewer', '🔄 FORM VIEWER: Setting up conditional logic field listeners');
        
        const conditionalLogic = window.AppModules.conditionalLogic;
        if (!conditionalLogic) {
            debugWarn('FormViewer'('ConditionalLogic module not available');
            return;
        }
        
        // Find all form fields and add change listeners
        const formFields = document.querySelectorAll('input, select, textarea');
        
        formFields.forEach(field => {
            const events = ['change', 'input', 'keyup'];
            
            events.forEach(eventType => {
                field.addEventListener(eventType, () => {
                    debugInfo('FormViewer', '🔄 FIELD CHANGE: Field changed:', field.name || field.id, 'Value:', field.value);
                    conditionalLogic.handleFieldChange(field);
                });
            });
        });
        
        // Initial evaluation of all conditions
        debugInfo('FormViewer', '🔄 FORM VIEWER: Performing initial conditional logic evaluation');
        conditionalLogic.evaluateAllConditions();
        
        debugInfo('FormViewer', '🔄 FORM VIEWER: Conditional logic listeners setup complete');
    }
    
    async processGetRecordsPage(page) {
        debugInfo('FormViewer', `📊 Processing Get Records for page ${page.id} (${page.name})`);
        
        try {
            // Collect current form data to get any filter variables
            const currentFormData = this.collectFormData();
            
            // Submit just this page's data to execute the Get Records query
            const response = await fetch(`/api/forms/${this.formId}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    formData: currentFormData.data,
                    submissionMetadata: {
                        timestamp: new Date().toISOString(),
                        userAgent: navigator.userAgent,
                        referrer: document.referrer,
                        pageId: page.id,
                        processPageOnly: true, // Flag to indicate we only want to process this specific page
                        variables: window.FormVariables ? window.FormVariables.getAll() : {}
                    }
                })
            });
            
            if (!response.ok) {
                throw new Error(`Failed to process Get Records page: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            // Update global variables with any new variables from the query
            if (result.variables && window.FormVariables) {
                debugInfo('FormViewer', '📨 [GET RECORDS DEBUG] Received variables from server:', Object.keys(result.variables));
                
                // Enhanced variable logging
                Object.entries(result.variables).forEach(([key, value]) => {
                    debugInfo('FormViewer', `📨 [GET RECORDS DEBUG] Variable "${key}":`, {
                        type: typeof value,
                        isString: typeof value === 'string',
                        length: typeof value === 'string' ? value.length : 'N/A',
                        isJSON: typeof value === 'string' && (value.startsWith('[') || value.startsWith('{')),
                        preview: typeof value === 'string' && value.length > 100 ? 
                            `${value.substring(0, 100)}...` : value
                    });
                });
                
                // Log current variables before setting new ones
                const currentVariables = window.FormVariables.getAll();
                debugInfo('FormViewer', '📊 [GET RECORDS DEBUG] Variables before update:', Object.keys(currentVariables));
                
                // Set the new variables
                window.FormVariables.setMultiple(result.variables);
                
                // Log variables after setting
                const updatedVariables = window.FormVariables.getAll();
                debugInfo('FormViewer', '📊 [GET RECORDS DEBUG] Variables after update:', Object.keys(updatedVariables));
                debugInfo('FormViewer', '📊 [GET RECORDS DEBUG] New variables added:', 
                    Object.keys(result.variables).filter(key => !currentVariables.hasOwnProperty(key))
                );
                
                // Force refresh all DataTables to display the new data
                setTimeout(() => {
                    debugInfo('FormViewer', '🔄 [GET RECORDS DEBUG] Refreshing DataTables after receiving variables');
                    debugInfo('FormViewer', '🔄 [GET RECORDS DEBUG] Available fieldTypes module:', !!window.AppModules?.fieldTypes);
                    
                    if (window.AppModules?.fieldTypes) {
                        debugInfo('FormViewer', '🔄 [GET RECORDS DEBUG] Calling refreshAllDataTables...');
                        window.AppModules.fieldTypes.refreshAllDataTables();
                    } else {
                        debugError('FormViewer'('❌ [GET RECORDS DEBUG] fieldTypes module not available!');
                    }
                }, 100);
                
                // Additional debugging - trigger manual DataTable refresh after longer delay
                setTimeout(() => {
                    debugInfo('FormViewer', '🕐 [GET RECORDS DEBUG] Secondary DataTable refresh attempt...');
                    const dataTables = document.querySelectorAll('.datatable-field');
                    debugInfo('FormViewer', `🔍 [GET RECORDS DEBUG] Found ${dataTables.length} DataTable elements`);
                    
                    dataTables.forEach((table, index) => {
                        const fieldId = table.dataset.fieldId;
                        debugInfo('FormViewer', `🔄 [GET RECORDS DEBUG] DataTable ${index + 1}/${dataTables.length}:`, {
                            fieldId: fieldId,
                            hasFieldId: !!fieldId,
                            element: table
                        });
                        
                        if (fieldId && window.AppModules?.fieldTypes) {
                            const field = window.AppModules.fieldTypes.findFieldById(fieldId);
                            if (field) {
                                debugInfo('FormViewer', `🔄 [GET RECORDS DEBUG] Manually refreshing DataTable ${fieldId}`);
                                window.AppModules.fieldTypes.refreshDataTable(field);
                            }
                        }
                    });
                }, 500);
            } else {
                debugWarn('FormViewer'('⚠️ [GET RECORDS DEBUG] No variables received or FormVariables not available:', {
                    hasVariables: !!result.variables,
                    variableCount: result.variables ? Object.keys(result.variables).length : 0,
                    hasFormVariables: !!window.FormVariables
                });
            }
            
            debugInfo('FormViewer', `✅ Successfully processed Get Records page ${page.id}`);
            
        } catch (error) {
            debugError('FormViewer'(`❌ Error processing Get Records page ${page.id}:`, error);
            // Don't block navigation on error, but log it
        }
    }
}