// MultiPage Module - Handles multi-page form logic and navigation

const { debugError, debugWarn, debugInfo, debugDebug, debugVerbose } = window.SFBDebug;

export class MultiPage {
    constructor() {
        this.currentPageIndex = 0;
        this.pageVisibility = new Map();
        this.repeatInstances = new Map();
        this.variables = new Map();
        this.navigationHistory = [];
    }
    
    async initialize() {
        debugInfo('MultiPage', 'Initializing MultiPage module...');
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Listen for page changes
        document.addEventListener('pageChanged', (e) => {
            this.handlePageChange(e.detail);
        });
        
        // Listen for form submission
        document.addEventListener('beforeFormSubmit', (e) => {
            this.collectAllInstanceData(e.detail);
        });
        
        // Listen for repeat instance actions
        document.addEventListener('click', (e) => {
            if (e.target.matches('.add-instance-btn')) {
                this.addRepeatInstance(e.target.dataset.pageId);
            } else if (e.target.matches('.remove-instance-btn')) {
                this.removeRepeatInstance(e.target.dataset.pageId, e.target.dataset.instanceIndex);
            }
        });
        
        // Handle Enter key navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.target.matches('textarea')) {
                e.preventDefault();
                this.handleEnterKey();
            }
        });
    }
    
    addPage() {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) return;
        
        const pageId = `page_${Date.now()}`;
        const newPage = {
            id: pageId,
            name: `Page ${formBuilder.currentForm.pages.length + 1}`,
            fields: [],
            salesforceObject: null,
            actionType: 'create', // 'create' or 'update'
            hiddenFields: [],
            conditionalVisibility: {
                enabled: false,
                dependsOn: null,
                condition: 'equals',
                value: '',
                dependsOnPage: 0
            },
            repeatConfig: {
                enabled: false,
                minInstances: 1,
                maxInstances: 10,
                addButtonText: 'Add Another',
                removeButtonText: 'Remove',
                relationshipField: null,
                parentPage: null
            },
            variables: new Map(),
            styling: {
                backgroundColor: '',
                backgroundImage: '',
                padding: '20px',
                margin: '0px',
                borderRadius: '0px',
                boxShadow: '',
                customCSS: '',
                containerMaxWidth: '100%',
                textAlign: 'left',
                fontFamily: '',
                fontSize: '',
                lineHeight: '1.5'
            }
        };
        
        formBuilder.currentForm.pages.push(newPage);
        formBuilder.renderPageTabs();
        formBuilder.switchToPage(pageId);
        
        document.dispatchEvent(new Event('pageAdded'));
    }
    
    removePage(pageId) {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) return;
        
        formBuilder.removePage(pageId);
    }
    
    switchToPage(pageIndex) {
        if (typeof pageIndex === 'string') {
            // Convert page ID to index
            const formBuilder = window.AppModules.formBuilder;
            if (formBuilder) {
                pageIndex = formBuilder.currentForm.pages.findIndex(p => p.id === pageIndex);
            }
        }
        
        if (pageIndex < 0) pageIndex = 0;
        
        this.currentPageIndex = pageIndex;
        this.updatePageVisibility();
        this.updateNavigationButtons();
        
        document.dispatchEvent(new CustomEvent('pageChanged', {
            detail: { pageIndex: this.currentPageIndex }
        }));
    }
    
    nextPage() {
        if (!this.validateCurrentPage()) {
            return false;
        }

        // Store current page field values before navigating
        this.storeCurrentPageFieldValues();

        const formViewer = window.AppModules.formViewer;
        if (!formViewer) return false;

        const totalPages = formViewer.formData.pages.length;
        let nextIndex = this.currentPageIndex + 1;

        // Find the next visible page
        while (nextIndex < totalPages) {
            const nextPage = formViewer.formData.pages[nextIndex];
            if (this.isPageVisible(nextPage.id)) {
                this.navigationHistory.push(this.currentPageIndex);
                this.switchToPage(nextIndex);
                return true;
            }
            nextIndex++;
        }

        // If no more visible pages, show submit button
        this.showSubmitButton();
        return false;
    }

    previousPage() {
        // Store current page field values before navigating
        this.storeCurrentPageFieldValues();
        
        if (this.navigationHistory.length > 0) {
            const previousIndex = this.navigationHistory.pop();
            this.switchToPage(previousIndex);
            return true;
        }
        // Fallback for simple linear navigation
        else if (this.currentPageIndex > 0) {
            this.switchToPage(this.currentPageIndex - 1);
            return true;
        }
        return false;
    }
    
    storeCurrentPageFieldValues() {
        // Store all field values from the current page
        const currentPageElement = document.querySelector('.form-page.active');
        if (currentPageElement) {
            const fields = currentPageElement.querySelectorAll('input, select, textarea');
            fields.forEach(field => {
                const fieldId = field.name || field.id;
                if (fieldId) {
                    const value = this.getFieldValue(field);
                    
                    // Store in variables for cross-page access
                    this.variables.set(fieldId, value);
                    
                    // Also update conditionalLogic's field values
                    const conditionalLogic = window.AppModules?.conditionalLogic;
                    if (conditionalLogic) {
                        conditionalLogic.fieldValues.set(fieldId, value);
                    }
                    
                    debugInfo('MultiPage', `Stored field value: ${fieldId} = ${value}`);
                }
            });
        }
    }
    
    goToPage(pageIndex) {
        this.switchToPage(pageIndex);
    }
    
    switchToPage(pageIndex) {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) return;
        
        const totalPages = formBuilder.currentForm.pages.length;
        
        // Validate page index
        if (pageIndex < 0 || pageIndex >= totalPages) return;
        
        // Update current page index
        this.currentPageIndex = pageIndex;
        
        // Page visibility is now handled by conditionalLogic.js
        // Ensure all pages are evaluated for visibility after a page switch
        const conditionalLogic = window.AppModules.conditionalLogic;
        if (conditionalLogic) {
            conditionalLogic.evaluateAllConditions();
        }
        
        // Update navigation buttons
        if (pageIndex >= totalPages - 1) {
            // Last page - show submit button
            this.showSubmitButton();
        } else {
            // Not last page - show next button
            this.showNextButton();
        }
        
        // Update page indicator if exists
        this.updatePageIndicator();
        
        // Trigger page change event
        document.dispatchEvent(new CustomEvent('pageChanged', {
            detail: { 
                pageIndex: pageIndex,
                pageId: formBuilder.currentForm.pages[pageIndex].id
            }
        }));
    }
    
    getCurrentPageIndex() {
        return this.currentPageIndex;
    }
    
    validateCurrentPage() {
        const formFields = document.querySelectorAll(`[data-page-index="${this.currentPageIndex}"] input, [data-page-index="${this.currentPageIndex}"] select, [data-page-index="${this.currentPageIndex}"] textarea`);
        let isValid = true;
        
        formFields.forEach(field => {
            if (field.hasAttribute('required') && !field.disabled) {
                const fieldTypes = window.AppModules.fieldTypes;
                if (fieldTypes) {
                    const validation = fieldTypes.validateField(field.id || field.name);
                    if (!validation.valid) {
                        this.showFieldError(field, validation.message);
                        isValid = false;
                    } else {
                        this.hideFieldError(field);
                    }
                }
            }
        });
        
        // Validate signatures on current page
        const signatureFields = document.querySelectorAll(`[data-page-index="${this.currentPageIndex}"] [data-field-type="signature"]`);
        signatureFields.forEach(field => {
            const hiddenInput = field.querySelector('input[type="hidden"]');
            if (hiddenInput && hiddenInput.hasAttribute('required')) {
                const signature = window.AppModules.signature;
                if (signature && !signature.hasSignature(hiddenInput.id)) {
                    this.showFieldError(hiddenInput, 'Signature is required');
                    isValid = false;
                }
            }
        });
        
        return isValid;
    }
    
    showFieldError(field, message) {
        this.hideFieldError(field);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        
        const fieldContainer = field.closest('.form-field, .form-group');
        if (fieldContainer) {
            fieldContainer.appendChild(errorDiv);
            fieldContainer.classList.add('has-error');
        }
    }
    
    hideFieldError(field) {
        const fieldContainer = field.closest('.form-field, .form-group');
        if (fieldContainer) {
            const errorDiv = fieldContainer.querySelector('.field-error');
            if (errorDiv) {
                errorDiv.remove();
            }
            fieldContainer.classList.remove('has-error');
        }
    }
    
    updatePageVisibility() {
        // Page visibility is now handled by conditionalLogic.js
        // This method can be used to trigger a re-evaluation if needed
        const conditionalLogic = window.AppModules.conditionalLogic;
        if (conditionalLogic) {
            conditionalLogic.evaluateAllConditions();
        }
    }
    
    updateNavigationButtons() {
        debugInfo('MultiPage', '🔄 NAVIGATION: Updating navigation buttons...');
        
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        const submitBtn = document.getElementById('submitBtn');
        
        debugInfo('MultiPage', `🔄 NAVIGATION: Found buttons - Prev: ${!!prevBtn}, Next: ${!!nextBtn}, Submit: ${!!submitBtn}`);
        debugInfo('MultiPage', `🔄 NAVIGATION: Current page index: ${this.currentPageIndex}`);
        
        if (prevBtn) {
            prevBtn.style.display = this.currentPageIndex > 0 ? 'inline-block' : 'none';
        }
        
        // Check both formBuilder and formViewer contexts
        const formBuilder = window.AppModules.formBuilder;
        const formViewer = window.AppModules.formViewer;
        let totalPages = 1;
        
        if (formBuilder && formBuilder.currentForm) {
            totalPages = formBuilder.currentForm.pages.length;
            debugInfo('MultiPage', `🔄 NAVIGATION: Using formBuilder, total pages: ${totalPages}`);
        } else if (formViewer && formViewer.formData) {
            totalPages = formViewer.formData.pages.length;
            debugInfo('MultiPage', `🔄 NAVIGATION: Using formViewer, total pages: ${totalPages}`);
        }
        
        if (nextBtn && submitBtn) {
            // Always use shouldShowNavigationButton logic which considers conditional visibility
            const shouldShowNext = this.shouldShowNavigationButton('next');
            const shouldShowSubmit = this.shouldShowNavigationButton('submit');
            
            debugInfo('MultiPage', `🔄 NAVIGATION: Button evaluation - Next: ${shouldShowNext}, Submit: ${shouldShowSubmit}`);
            
            if (shouldShowNext) {
                nextBtn.style.display = 'inline-block';
                submitBtn.style.display = 'none';
                debugInfo('MultiPage', '🔄 NAVIGATION: Showing Next button');
            } else if (shouldShowSubmit) {
                nextBtn.style.display = 'none';
                submitBtn.style.display = 'inline-block';
                debugInfo('MultiPage', '🔄 NAVIGATION: Showing Submit button');
            } else {
                // Neither button should show (this shouldn't normally happen)
                nextBtn.style.display = 'none';
                submitBtn.style.display = 'none';
                debugInfo('MultiPage', '🔄 NAVIGATION: Hiding both buttons');
            }
        }
        
        debugInfo('MultiPage', '🔄 NAVIGATION: Navigation buttons updated successfully');
    }
    
    shouldShowNavigationButton(buttonType) {
        const formViewer = window.AppModules.formViewer;
        const formBuilder = window.AppModules.formBuilder;
        
        // Get form data from either context
        let formData = null;
        if (formViewer && formViewer.formData) {
            formData = formViewer.formData;
        } else if (formBuilder && formBuilder.currentForm) {
            formData = formBuilder.currentForm;
        }
        
        if (!formData) return true;

        const currentPage = formData.pages[this.currentPageIndex];
        if (!currentPage) return true;
        
        // For next button, check if there are more visible pages
        if (buttonType === 'next') {
            let hasMoreVisiblePages = false;
            for (let i = this.currentPageIndex + 1; i < formData.pages.length; i++) {
                const page = formData.pages[i];
                if (this.isPageVisible(page.id)) {
                    hasMoreVisiblePages = true;
                    break;
                }
            }
            if (!hasMoreVisiblePages) return false;
        }
        
        // For submit button, check if this is the last visible page
        if (buttonType === 'submit') {
            let hasMoreVisiblePages = false;
            for (let i = this.currentPageIndex + 1; i < formData.pages.length; i++) {
                const page = formData.pages[i];
                if (this.isPageVisible(page.id)) {
                    hasMoreVisiblePages = true;
                    break;
                }
            }
            if (hasMoreVisiblePages) return false;
        }
        
        // Now check conditional visibility
        return this.evaluateNavigationConditions(currentPage, buttonType);
    }
    
    showSubmitButton() {
        const nextBtn = document.getElementById('nextPageBtn');
        const submitBtn = document.getElementById('submitBtn');
        
        if (nextBtn) nextBtn.style.display = 'none';
        if (submitBtn) submitBtn.style.display = 'inline-block';
    }
    
    showNextButton() {
        const nextBtn = document.getElementById('nextPageBtn');
        const submitBtn = document.getElementById('submitBtn');
        
        if (nextBtn) nextBtn.style.display = 'inline-block';
        if (submitBtn) submitBtn.style.display = 'none';
    }
    
    handlePageChange(detail) {
        // Capture variables from current page
        this.capturePageVariables();
        
        // Evaluate conditional logic
        const conditionalLogic = window.AppModules.conditionalLogic;
        if (conditionalLogic) {
            conditionalLogic.evaluatePageConditions(detail.pageIndex);
        }
        
        // Auto-save progress
        const autoSave = window.AppModules.autoSave;
        if (autoSave) {
            autoSave.saveUserProgress();
        }
    }
    
    capturePageVariables() {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) return;
        
        const currentPage = formBuilder.getCurrentPage();
        const currentPageElement = document.querySelector(`[data-page-id="${currentPage.id}"]`);
        
        if (currentPageElement) {
            const fields = currentPageElement.querySelectorAll('input, select, textarea');
            
            fields.forEach(field => {
                const fieldId = field.name || field.id;
                const value = this.getFieldValue(field);
                
                if (fieldId && value !== null && value !== '') {
                    this.variables.set(fieldId, value);
                }
            });
        }
    }
    
    getFieldValue(field) {
        const fieldTypes = window.AppModules.fieldTypes;
        if (fieldTypes) {
            return fieldTypes.getFieldValue(field.id || field.name);
        }
        
        // Fallback
        switch (field.type) {
            case 'checkbox':
                return field.checked;
            case 'radio':
                return field.checked ? field.value : null;
            default:
                return field.value;
        }
    }
    
    setPageVisibility(pageId, visible) {
        this.pageVisibility.set(pageId, visible);
        
        // Update page visibility in both builder and viewer contexts
        const pageElements = document.querySelectorAll(`[data-page-id="${pageId}"]`);
        pageElements.forEach(element => {
            // Apply conditional visibility, but let navigation system control which single page is shown
            element.style.display = visible ? 'block' : 'none';
        });
        
        // After updating conditional visibility, let the navigation system update which page should be current
        // This ensures only one page is visible at a time during navigation
        // Use a small delay to avoid race conditions between conditional logic and navigation
        setTimeout(() => {
            const formViewer = window.AppModules.formViewer;
            if (formViewer && typeof formViewer.updatePageVisibility === 'function') {
                formViewer.updatePageVisibility();
            }
        }, 10);
        
        // After updating visibility, update navigation buttons
        this.updateNavigationButtons();
    }
    
    isPageVisible(pageId) {
        // If no explicit visibility state is set, we need to evaluate the page conditions
        if (!this.pageVisibility.has(pageId)) {
            // Check if the page has conditional visibility rules
            const formViewer = window.AppModules.formViewer;
            const formBuilder = window.AppModules.formBuilder;
            
            let formData = null;
            if (formViewer && formViewer.formData) {
                formData = formViewer.formData;
            } else if (formBuilder && formBuilder.currentForm) {
                formData = formBuilder.currentForm;
            }
            
            if (formData) {
                const page = formData.pages.find(p => p.id === pageId);
                if (page && page.conditionalVisibility && page.conditionalVisibility.enabled) {
                    // Page has conditional visibility - evaluate it
                    const conditionalLogic = window.AppModules.conditionalLogic;
                    if (conditionalLogic) {
                        const pageIndex = formData.pages.indexOf(page);
                        const pageConditionConfig = {
                            pageId: pageId,
                            pageIndex: pageIndex,
                            conditions: page.conditionalVisibility.conditions || [],
                            logic: page.conditionalVisibility.logic || 'AND'
                        };
                        
                        // Temporarily evaluate the condition
                        const shouldBeVisible = conditionalLogic.evaluateConditionSet(
                            pageConditionConfig.conditions, 
                            pageConditionConfig.logic
                        );
                        
                        debugInfo('MultiPage', `🔄 PAGE VISIBILITY: Evaluated ${pageId}: ${shouldBeVisible}`);
                        this.pageVisibility.set(pageId, shouldBeVisible);
                        return shouldBeVisible;
                    }
                    // If conditional logic module not available, default to hidden for conditional pages
                    return false;
                } else {
                    // Page has no conditional visibility - default to visible
                    return true;
                }
            }
        }
        
        return this.pageVisibility.get(pageId) !== false; // Default to visible if not explicitly set
    }
    
    // Repeat functionality
    enableRepeatForPage(pageId, config) {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) return;
        
        const page = formBuilder.currentForm.pages.find(p => p.id === pageId);
        if (page) {
            page.repeatConfig = {
                enabled: true,
                minInstances: config.minInstances || 1,
                maxInstances: config.maxInstances || 10,
                addButtonText: config.addButtonText || 'Add Another',
                removeButtonText: config.removeButtonText || 'Remove',
                relationshipField: config.relationshipField || null,
                parentPage: config.parentPage || null
            };
            
            this.initializeRepeatInstances(pageId);
        }
    }
    
    initializeRepeatInstances(pageId) {
        if (!this.repeatInstances.has(pageId)) {
            this.repeatInstances.set(pageId, [0]); // Start with one instance
        }
    }
    
    addRepeatInstance(pageId) {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) return;
        
        const page = formBuilder.currentForm.pages.find(p => p.id === pageId);
        if (!page || !page.repeatConfig?.enabled) return;
        
        const instances = this.repeatInstances.get(pageId) || [0];
        
        if (instances.length >= page.repeatConfig.maxInstances) {
            alert(`Maximum ${page.repeatConfig.maxInstances} instances allowed`);
            return;
        }
        
        const newInstanceIndex = Math.max(...instances) + 1;
        instances.push(newInstanceIndex);
        this.repeatInstances.set(pageId, instances);
        
        this.renderRepeatInstances(pageId);
        
        debugInfo('MultiPage', `Added repeat instance ${newInstanceIndex} for page ${pageId}`);
    }
    
    removeRepeatInstance(pageId, instanceIndex) {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) return;
        
        const page = formBuilder.currentForm.pages.find(p => p.id === pageId);
        if (!page || !page.repeatConfig?.enabled) return;
        
        const instances = this.repeatInstances.get(pageId) || [0];
        
        if (instances.length <= page.repeatConfig.minInstances) {
            alert(`Minimum ${page.repeatConfig.minInstances} instances required`);
            return;
        }
        
        const index = instances.indexOf(parseInt(instanceIndex));
        if (index > -1) {
            instances.splice(index, 1);
            this.repeatInstances.set(pageId, instances);
            
            this.renderRepeatInstances(pageId);
            
            debugInfo('MultiPage', `Removed repeat instance ${instanceIndex} for page ${pageId}`);
        }
    }
    
    renderRepeatInstances(pageId) {
        const pageElement = document.querySelector(`[data-page-id="${pageId}"]`);
        if (!pageElement) return;
        
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) return;
        
        const page = formBuilder.currentForm.pages.find(p => p.id === pageId);
        if (!page) return;
        
        const instances = this.repeatInstances.get(pageId) || [0];
        const container = pageElement.querySelector('.repeat-container') || pageElement;
        
        // Add data attributes for auto-save detection
        if (!container.hasAttribute('data-repeat-section')) {
            container.setAttribute('data-repeat-section', 'true');
            container.setAttribute('data-page-id', pageId);
        }
        
        // Clear existing instances
        container.innerHTML = '';
        
        instances.forEach((instanceIndex, arrayIndex) => {
            const instanceDiv = document.createElement('div');
            instanceDiv.className = 'repeat-instance';
            instanceDiv.dataset.instanceIndex = instanceIndex;
            instanceDiv.dataset.pageId = pageId;
            instanceDiv.setAttribute('data-repeat-instance', 'true');
            
            if (instances.length > 1) {
                instanceDiv.innerHTML = `<h4>Instance ${arrayIndex + 1}</h4>`;
            }
            
            // Render fields for this instance
            page.fields.forEach(field => {
                const fieldElement = this.renderFieldForInstance(field, instanceIndex);
                instanceDiv.appendChild(fieldElement);
            });
            
            // Add remove button for additional instances
            if (arrayIndex > 0 && instances.length > page.repeatConfig.minInstances) {
                const removeBtn = document.createElement('button');
                removeBtn.type = 'button';
                removeBtn.className = 'button button-secondary remove-instance-btn';
                removeBtn.textContent = page.repeatConfig.removeButtonText;
                removeBtn.dataset.pageId = pageId;
                removeBtn.dataset.instanceIndex = instanceIndex;
                instanceDiv.appendChild(removeBtn);
            }
            
            container.appendChild(instanceDiv);
        });
        
        // Add "Add Another" button
        if (instances.length < page.repeatConfig.maxInstances) {
            const addBtn = document.createElement('button');
            addBtn.type = 'button';
            addBtn.className = 'button button-secondary add-instance-btn';
            addBtn.textContent = page.repeatConfig.addButtonText;
            addBtn.dataset.pageId = pageId;
            container.appendChild(addBtn);
        }
    }
    
    renderFieldForInstance(field, instanceIndex) {
        const fieldTypes = window.AppModules.fieldTypes;
        if (!fieldTypes) return document.createElement('div');
        
        // Create modified field with instance suffix
        const instanceField = {
            ...field,
            id: instanceIndex === 0 ? field.id : `${field.id}_${instanceIndex}`
        };
        
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'form-field repeat-field';
        fieldDiv.dataset.fieldId = instanceField.id;
        fieldDiv.dataset.instanceIndex = instanceIndex;
        
        fieldDiv.innerHTML = `
            <label class="field-label">
                ${field.label}
                ${field.required ? '<span class="field-required">*</span>' : ''}
            </label>
            ${fieldTypes.renderField(instanceField)}
            ${field.helpText ? `<div class="field-help">${field.helpText}</div>` : ''}
        `;
        
        return fieldDiv;
    }
    
    collectAllInstanceData(formData) {
        // Collect data from all repeat instances
        for (const [pageId, instances] of this.repeatInstances) {
            if (instances.length > 1) {
                const instanceData = [];
                
                instances.forEach(instanceIndex => {
                    const data = {};
                    const instanceElements = document.querySelectorAll(`[data-instance-index="${instanceIndex}"]`);
                    
                    instanceElements.forEach(element => {
                        const input = element.querySelector('input, select, textarea');
                        if (input) {
                            const fieldId = input.name || input.id;
                            const baseFieldId = fieldId.replace(/_\d+$/, '');
                            data[baseFieldId] = this.getFieldValue(input);
                        }
                    });
                    
                    instanceData.push(data);
                });
                
                formData[`${pageId}_instances`] = instanceData;
            }
        }
    }
    
    // Variable management
    setVariable(name, value) {
        this.variables.set(name, value);
    }
    
    getVariable(name) {
        return this.variables.get(name);
    }
    
    getAllVariables() {
        return new Map(this.variables);
    }
    
    // Initialize for preview/published forms
    initializePreview() {
        this.setupPageNavigation();
        this.setupRepeatFunctionality();
        this.updateNavigationButtons();
    }
    
    setupPageNavigation() {
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => this.previousPage());
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextPage());
        }
    }
    
    setupRepeatFunctionality() {
        // Initialize repeat instances for all pages
        const repeatPages = document.querySelectorAll('[data-repeat-enabled="true"]');
        
        repeatPages.forEach(page => {
            const pageId = page.dataset.pageId;
            this.initializeRepeatInstances(pageId);
            this.renderRepeatInstances(pageId);
        });
    }
    
    handleEnterKey() {
        // Try to go to next page on Enter
        this.nextPage();
    }
    
    // Get current page data for submission
    getCurrentPageData() {
        const currentPageElement = document.querySelector(`[data-page-index="${this.currentPageIndex}"]`);
        if (!currentPageElement) return {};
        
        const data = {};
        const fields = currentPageElement.querySelectorAll('input, select, textarea');
        
        fields.forEach(field => {
            const fieldId = field.name || field.id;
            if (fieldId) {
                data[fieldId] = this.getFieldValue(field);
            }
        });
        
        return data;
    }
    
    // Get all form data across all pages
    getAllFormData() {
        const allData = {};
        const formElement = document.querySelector('#publicForm') || document.querySelector('form');

        if (!formElement) {
            debugError('MultiPage', "Could not find form element to collect data from.");
            return {};
        }

        const formData = new FormData(formElement);

        for (const [key, value] of formData.entries()) {
            // Skip files, they are handled separately
            if (value instanceof File) continue;

            // Handle repeating page data, which is stored in a hidden field
            if (key.startsWith('collected-data-')) {
                const pageId = key.replace('collected-data-', '');
                const instanceKey = `page_${pageId}_instances`;
                try {
                    const instances = JSON.parse(value);
                    if (instances && instances.length > 0) {
                        allData[instanceKey] = instances;
                    }
                } catch (e) {
                    debugError('MultiPage', `Error parsing repeating page data for ${pageId}:`, e);
                }
            } else {
                // Standard field
                allData[key] = value;
            }
        }

        // Add any captured variables
        allData._variables = Object.fromEntries(this.variables);

        return allData;
    }
    
    // Navigation button management (removed duplicate methods - consolidated into single updateNavigationButtons)
    
    evaluateNavigationConditions(page, buttonType) {
        debugInfo('MultiPage', `🔄 NAVIGATION: Evaluating conditions for ${buttonType} button on page ${page?.id}`);
        
        if (!page || !page.navigationConfig || !page.navigationConfig[buttonType]) {
            debugInfo('MultiPage', `🔄 NAVIGATION: No navigation config found for ${buttonType}, defaulting to visible`);
            return true; // Default to visible if no configuration
        }
        
        const config = page.navigationConfig[buttonType];
        debugInfo('MultiPage', `🔄 NAVIGATION: Navigation config for ${buttonType}:`, config);
        
        if (!config.conditionalVisibility || !config.conditionalVisibility.enabled) {
            debugInfo('MultiPage', `🔄 NAVIGATION: Conditional visibility not enabled for ${buttonType}, defaulting to visible`);
            return true; // Show if conditional visibility is not enabled
        }
        
        const conditionalLogic = window.AppModules.conditionalLogic;
        if (!conditionalLogic) {
            debugInfo('MultiPage', `🔄 NAVIGATION: ConditionalLogic module not found, defaulting to visible`);
            return true;
        }
        
        debugInfo('MultiPage', `🔄 NAVIGATION: Evaluating conditional visibility for ${buttonType}:`, config.conditionalVisibility);
        
        // Check if FormVariables are available for debugging
        if (window.FormVariables) {
            const allVars = window.FormVariables.getAll ? window.FormVariables.getAll() : {};
            debugInfo('MultiPage', `🔄 NAVIGATION: Current FormVariables:`, allVars);
        }
        
        // Use the existing conditional logic system to evaluate conditions
        const result = conditionalLogic.evaluateConditionGroup(config.conditionalVisibility);
        debugInfo('MultiPage', `🔄 NAVIGATION: Conditional evaluation result for ${buttonType}: ${result}`);
        
        return result;
    }
    
    showSubmitButton() {
        debugInfo('MultiPage', '🔄 NAVIGATION: Showing submit button (legacy method)');
        const submitBtn = document.querySelector('#submit-btn');
        if (submitBtn) {
            submitBtn.style.display = 'block';
        }
        
        const nextBtn = document.querySelector('#next-btn');
        if (nextBtn) {
            nextBtn.style.display = 'none';
        }
    }
    
    submitForm() {
        debugInfo('MultiPage', '🔄 NAVIGATION: Form submission triggered');
        
        // Validate current page before submission
        if (!this.validateCurrentPage()) {
            return false;
        }
        
        // Trigger form submission event
        const formData = this.collectAllFormData();
        document.dispatchEvent(new CustomEvent('formSubmit', {
            detail: { formData }
        }));
        
        return true;
    }
}