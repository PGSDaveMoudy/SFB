// FieldTypes Module - Defines and handles different field types

const { debugError, debugWarn, debugInfo, debugDebug, debugVerbose } = window.SFBDebug;

export class FieldTypes {
    constructor() {
        this.quillInstances = new Map();
        this.lookupCache = new Map();
        this.lookupDebounceTimers = new Map();
        this.pendingOTPs = new Map();
        this.contactLookupCache = new Map();
        this.displayFieldsCache = new Set(); // Track display fields for variable updates
    }
    
    async initialize() {
        debugInfo("FieldTypes", 'Initializing FieldTypes module...');
        this.setupEventListeners();
        this.setupDisplayFieldVariableWatching();
    }
    
    setupEventListeners() {
        // Listen for field updates to refresh field-specific functionality
        document.addEventListener('fieldUpdated', (e) => {
            this.handleFieldUpdate(e.detail);
        });
        
        // Listen for form rendering to initialize field-specific features
        document.addEventListener('formRendered', () => {
            this.initializeAllFields();
        });
    }
    
    renderField(field) {
        switch (field.type) {
            case 'text':
                return this.renderTextField(field);
            case 'email':
                return this.renderEmailField(field);
            case 'phone':
                return this.renderPhoneField(field);
            case 'number':
                return this.renderNumberField(field);
            case 'date':
                return this.renderDateField(field);
            case 'select':
                return this.renderSelectField(field);
            case 'textarea':
                return this.renderTextareaField(field);
            case 'checkbox':
                return this.renderCheckboxField(field);
            case 'radio':
                return this.renderRadioField(field);
            case 'lookup':
                return this.renderLookupField(field);
            case 'richtext':
                return this.renderRichTextField(field);
            case 'signature':
                return this.renderSignatureField(field);
            case 'file':
                return this.renderFileField(field);
            case 'display':
                return this.renderDisplayField(field);
            case 'login':
                return this.renderLoginField(field);
            case 'email-verify':
                return this.renderEmailVerifyField(field);
            case 'datatable':
                return this.renderDataTableField(field);
            case 'section':
                return this.renderSectionField(field);
            case 'columns':
                return this.renderColumnsField(field);
            default:
                return `<div class="field-placeholder">Unknown field type: ${field.type}</div>`;
        }
    }
    
    renderTextField(field) {
        return `
            <input 
                type="text" 
                id="${field.id}"
                name="${field.id}"
                placeholder="${field.placeholder || ''}" 
                ${field.required ? 'required' : ''}
                class="form-input"
                data-field-type="text"
            >
        `;
    }
    
    renderEmailField(field) {
        return `
            <input 
                type="email" 
                id="${field.id}"
                name="${field.id}"
                placeholder="${field.placeholder || 'email@example.com'}" 
                ${field.required ? 'required' : ''}
                class="form-input"
                data-field-type="email"
            >
        `;
    }
    
    renderPhoneField(field) {
        return `
            <input 
                type="tel" 
                id="${field.id}"
                name="${field.id}"
                placeholder="${field.placeholder || '(555) 123-4567'}" 
                ${field.required ? 'required' : ''}
                class="form-input"
                data-field-type="phone"
            >
        `;
    }
    
    renderNumberField(field) {
        return `
            <input 
                type="number" 
                id="${field.id}"
                name="${field.id}"
                placeholder="${field.placeholder || ''}" 
                ${field.required ? 'required' : ''}
                ${field.min !== undefined ? `min="${field.min}"` : ''}
                ${field.max !== undefined ? `max="${field.max}"` : ''}
                ${field.step !== undefined ? `step="${field.step}"` : ''}
                class="form-input"
                data-field-type="number"
            >
        `;
    }
    
    renderDateField(field) {
        return `
            <input 
                type="date" 
                id="${field.id}"
                name="${field.id}"
                ${field.required ? 'required' : ''}
                class="form-input"
                data-field-type="date"
            >
        `;
    }
    
    renderSelectField(field) {
        const options = field.options || [];
        
        return `
            <select 
                id="${field.id}"
                name="${field.id}"
                ${field.required ? 'required' : ''}
                class="form-select"
                data-field-type="select"
                ${field.usePicklist ? `data-picklist-object="${field.picklistObject || ''}" data-picklist-field="${field.picklistField || ''}"` : ''}
            >
                <option value="">Choose...</option>
                ${options.map(opt => 
                    `<option value="${this.escapeHtml(opt.value)}">${this.escapeHtml(opt.label)}</option>`
                ).join('')}
            </select>
        `;
    }
    
    renderTextareaField(field) {
        return `
            <textarea 
                id="${field.id}"
                name="${field.id}"
                placeholder="${field.placeholder || ''}" 
                ${field.required ? 'required' : ''}
                rows="${field.rows || 4}"
                class="form-textarea"
                data-field-type="textarea"
            ></textarea>
        `;
    }
    
    renderCheckboxField(field) {
        return `
            <label class="checkbox-label">
                <input 
                    type="checkbox" 
                    id="${field.id}"
                    name="${field.id}"
                    value="true"
                    ${field.required ? 'required' : ''}
                    class="form-checkbox"
                    data-field-type="checkbox"
                >
                <span class="checkbox-text">${this.escapeHtml(field.checkboxLabel || 'Check this box')}</span>
            </label>
        `;
    }
    
    renderRadioField(field) {
        const options = field.options || [];
        
        return `
            <div class="radio-group" data-field-type="radio">
                ${options.map((opt, idx) => `
                    <label class="radio-label">
                        <input 
                            type="radio" 
                            name="${field.id}" 
                            value="${this.escapeHtml(opt.value)}"
                            ${idx === 0 && field.required ? 'required' : ''}
                            class="form-radio"
                        >
                        <span class="radio-text">${this.escapeHtml(opt.label)}</span>
                    </label>
                `).join('')}
            </div>
        `;
    }
    
    renderLookupField(field) {
        return `
            <div class="lookup-field" data-field-type="lookup">
                <input 
                    type="text" 
                    id="${field.id}_search"
                    placeholder="Type to search ${field.lookupObject || 'records'}..."
                    class="form-input lookup-search"
                    autocomplete="off"
                    data-lookup-object="${field.lookupObject || ''}"
                    data-display-field="${field.displayField || 'Name'}"
                    data-search-field="${field.searchField || 'Name'}"
                    data-max-results="${field.maxResults || 10}"
                    data-lookup-filters="${this.encodeFilters(field.lookupFilters || [])}"
                    data-store-id-variable="${field.storeIdVariable || ''}"
                >
                <input 
                    type="hidden" 
                    id="${field.id}"
                    name="${field.id}"
                    ${field.required ? 'required' : ''}
                >
                <div class="lookup-results" id="${field.id}_results" style="display: none;"></div>
                <div class="lookup-selected" id="${field.id}_selected" style="display: none;">
                    <span class="selected-text"></span>
                    <button type="button" class="clear-selection" onclick="this.parentElement.parentElement.querySelector('.lookup-search').value = ''; this.parentElement.style.display = 'none'; this.parentElement.parentElement.querySelector('input[type=hidden]').value = '';">×</button>
                </div>
            </div>
        `;
    }
    
    encodeFilters(filters) {
        return encodeURIComponent(JSON.stringify(filters));
    }
    
    renderRichTextField(field) {
        const editorId = `${field.id}_editor`;
        
        // Schedule Quill initialization after DOM update
        setTimeout(() => {
            this.initializeRichTextEditor(field.id, editorId, field.content || '');
        }, 100);
        
        return `
            <div class="richtext-field" data-field-type="richtext">
                <div id="${editorId}" style="height: ${field.editorHeight || 200}px;"></div>
                <input type="hidden" id="${field.id}" name="${field.id}">
            </div>
        `;
    }
    
    renderSignatureField(field) {
        const config = field.signatureConfig || {};
        const canvasId = `${field.id}_canvas`;
        
        // Schedule signature pad initialization after DOM update
        setTimeout(() => {
            this.initializeSignaturePad(field.id, canvasId, config);
        }, 100);
        
        return `
            <div class="signature-field" data-field-type="signature">
                ${config.requireLegalText ? `
                    <div class="signature-legal-text">
                        <p>${this.escapeHtml(config.legalText || 'By signing below, I agree to the terms and conditions.')}</p>
                    </div>
                ` : ''}
                
                <canvas 
                    id="${canvasId}"
                    width="${config.width || 500}"
                    height="${config.height || 200}"
                    class="signature-pad"
                    style="border: 2px solid var(--border-color); border-radius: var(--radius-md); background-color: ${config.backgroundColor || '#ffffff'};"
                ></canvas>
                
                <div class="signature-controls">
                    <button type="button" onclick="window.AppModules.signature?.clearSignature('${field.id}')">
                        Clear
                    </button>
                    ${config.requireFullName ? `
                        <input type="text" placeholder="Full Name" class="signature-name" data-field="${field.id}">
                    ` : ''}
                    ${config.requireEmail ? `
                        <input type="email" placeholder="Email Address" class="signature-email" data-field="${field.id}">
                    ` : ''}
                </div>
                
                <input type="hidden" id="${field.id}" name="${field.id}" ${field.required ? 'required' : ''}>
            </div>
        `;
    }
    
    renderFileField(field) {
        const fileId = `${field.id}_file`;
        
        return `
            <div class="file-field" data-field-type="file">
                <div class="file-upload-area" 
                     onclick="document.getElementById('${fileId}').click()"
                     ondrop="window.AppModules.fieldTypes?.handleFileDrop(event, '${field.id}')"
                     ondragover="event.preventDefault(); this.classList.add('dragging')"
                     ondragleave="this.classList.remove('dragging')">
                    <div class="file-upload-icon">📎</div>
                    <div class="file-upload-text">
                        <p>Click to upload or drag and drop</p>
                        <small>Max size: ${this.formatFileSize(field.maxFileSize || 10485760)}</small>
                        ${field.allowedTypes ? `<small>Allowed: ${field.allowedTypes}</small>` : ''}
                    </div>
                </div>
                
                <input 
                    type="file" 
                    id="${fileId}"
                    name="${field.id}"
                    ${field.multiple ? 'multiple' : ''}
                    ${field.allowedTypes ? `accept="${field.allowedTypes}"` : ''}
                    ${field.required ? 'required' : ''}
                    style="display: none;"
                    onchange="window.AppModules.fieldTypes?.handleFileSelect(event, '${field.id}')"
                >
                
                <div class="file-list" id="${field.id}_files"></div>
            </div>
        `;
    }
    
    renderDisplayField(field) {
        // Process template variables in display content
        const processedContent = this.processTemplateVariables(field.displayContent || '<p>Enter your display text...</p>');
        
        return `
            <div class="display-field" data-field-type="display" id="${field.id}_display">
                <div class="display-content">
                    ${processedContent}
                </div>
            </div>
        `;
    }
    
    // Universal template variable processing method
    processTemplateVariables(content) {
        if (!content || typeof content !== 'string') return content;
        
        // Get all variables from the global FormVariables system
        const variables = window.FormVariables ? window.FormVariables.getAll() : new Map();
        
        // Process {{variableName}} patterns
        return content.replace(/\{\{([^}]+)\}\}/g, (match, variablePath) => {
            const path = variablePath.trim();
            
            // Handle nested paths like Contact.Name
            if (path.includes('.')) {
                const keys = path.split('.');
                let value = null;
                
                // Try to find the root object in variables
                const rootKey = keys[0];
                const rootValue = variables.get(rootKey);
                
                if (rootValue && typeof rootValue === 'object') {
                    value = rootValue;
                    // Navigate through the nested path
                    for (let i = 1; i < keys.length; i++) {
                        value = value ? value[keys[i]] : null;
                    }
                } else {
                    // Try the full path as a variable name first
                    value = variables.get(path) || rootValue;
                }
                
                return value !== null && value !== undefined ? String(value) : match;
            } else {
                // Simple variable lookup
                const value = variables.get(path);
                return value !== null && value !== undefined ? String(value) : match;
            }
        });
    }
    
    // Setup real-time variable watching for Display Text fields
    setupDisplayFieldVariableWatching() {
        // Listen for variable changes
        document.addEventListener('variablesChanged', () => {
            this.refreshDisplayFields();
        });
    }
    
    // Refresh all Display Text fields when variables change
    refreshDisplayFields() {
        const displayFields = document.querySelectorAll('.display-field[data-field-type="display"]');
        displayFields.forEach(fieldElement => {
            const fieldId = fieldElement.id.replace('_display', '');
            this.refreshDisplayField(fieldId);
        });
    }
    
    // Refresh a specific Display Text field
    refreshDisplayField(fieldId) {
        const fieldElement = document.getElementById(`${fieldId}_display`);
        if (!fieldElement) return;
        
        // Get the field data from the form builder
        const formBuilder = window.AppModules?.formBuilder;
        if (!formBuilder) return;
        
        const field = formBuilder.findFieldById(fieldId);
        if (!field || field.type !== 'display') return;
        
        // Re-process and update content
        const processedContent = this.processTemplateVariables(field.displayContent || '<p>Enter your display text...</p>');
        const contentDiv = fieldElement.querySelector('.display-content');
        if (contentDiv) {
            contentDiv.innerHTML = processedContent;
        }
    }
    
    renderLoginField(field) {
        const config = field.loginConfig || {};
        
        // Initialize login variables to false when field is first rendered
        if (window.FormVariables) {
            debugInfo("FieldTypes", `🔐 LOGIN: Initializing login variables for field ${field.id}`);
            
            const initialVariables = {
                'isLoggedIn': 'false',
                'loggedIn': 'false',
                'needsRegistration': 'false',
                'isNewUser': 'false',
                'contactExists': 'false',
                [`${field.id}_isLoggedIn`]: 'false',
                [`${field.id}_loggedIn`]: 'false',
                [`${field.id}_needsRegistration`]: 'false',
                [`${field.id}_isNewUser`]: 'false',
                [`${field.id}_contactExists`]: 'false'
            };
            
            if (window.FormVariables.setMultiple) {
                window.FormVariables.setMultiple(initialVariables);
            } else {
                // Fallback for older systems
                Object.entries(initialVariables).forEach(([name, value]) => {
                    window.FormVariables.set(name, value);
                });
            }
        }
        
        return `
            <div class="login-field" data-field-type="login" data-field-id="${field.id}">
                <div class="login-container">
                    <div class="login-header">
                        <h3 class="login-title">${config.title || 'Login Required'}</h3>
                        <p class="login-instructions">${config.instructions || 'Please enter your email address to continue.'}</p>
                    </div>
                    
                    <div class="login-form">
                        <div class="login-input-group">
                            <label for="${field.id}_email">Email Address</label>
                            <input 
                                type="email" 
                                id="${field.id}_email"
                                name="${field.id}_email"
                                class="form-input login-email-input"
                                placeholder="your.email@example.com"
                                required
                                data-field-id="${field.id}"
                                data-field-type="login"
                                data-enable-otp="${config.enableOTP || false}"
                                data-enable-lookup="${config.enableContactLookup || false}"
                                data-set-variables="${this.encodeFilters(config.setVariables || {})}"
                            >
                        </div>
                        
                        <div class="login-actions">
                            <button type="button" class="button button-primary login-submit-btn" data-field-id="${field.id}">
                                Continue
                            </button>
                        </div>
                    </div>
                    
                    <!-- This will be populated by flow logic -->
                    <div class="login-status" id="${field.id}_status" style="display: none;"></div>
                </div>
            </div>
        `;
    }
    
    renderEmailVerifyField(field) {
        const config = field.verifyConfig || {};
        return `
            <div class="email-verify-field" data-field-type="email-verify" data-field-id="${field.id}">
                <div class="verify-container">
                    <div class="verify-header">
                        <h3 class="verify-title">${config.title || 'Email Verification'}</h3>
                        <p class="verify-instructions">${config.instructions || 'Enter your email address and click verify to continue.'}</p>
                    </div>
                    
                    <div class="verify-form">
                        <div class="verify-input-group">
                            <label for="${field.id}_email">Email Address</label>
                            <input 
                                type="email" 
                                id="${field.id}_email"
                                name="${field.id}_email"
                                class="form-input verify-email-input"
                                placeholder="your.email@example.com"
                                required
                                data-field-id="${field.id}"
                                data-enable-contact-lookup="${config.enableContactLookup || false}"
                                data-require-existing-contact="${config.requireExistingContact || false}"
                                data-contact-not-found-message="${config.contactNotFoundMessage || 'No account found with this email address.'}"
                            >
                        </div>
                        
                        <div class="verify-actions">
                            <button type="button" class="button button-primary verify-btn" data-field-id="${field.id}">
                                ${config.buttonText || 'Verify Email'}
                            </button>
                        </div>
                    </div>
                    
                    <!-- This will be populated by verification logic -->
                    <div class="verify-status" id="${field.id}_status" style="display: none;"></div>
                    
                    <!-- Hidden input to store verification state -->
                    <input type="hidden" id="${field.id}" name="${field.id}" value="">
                </div>
            </div>
        `;
    }
    
    initializeAllFields() {
        // Initialize lookup fields
        this.initializeLookupFields();
        
        // Initialize rich text editors
        this.initializeRichTextFields();
        
        // Initialize signature pads
        this.initializeSignatureFields();
        
        // Initialize login fields
        this.initializeLoginFields();
        
        // Initialize email verification fields
        this.initializeEmailVerifyFields();
        
        // Initialize file upload fields
        this.initializeFileFields();
    }
    
    initializeLookupFields() {
        const lookupFields = document.querySelectorAll('.lookup-search');
        
        lookupFields.forEach(input => {
            this.setupLookupField(input);
        });
    }
    
    setupLookupField(input) {
        debugInfo("FieldTypes", 'Setting up lookup field:', input.id);
        const fieldContainer = input.closest('.lookup-field');
        
        if (!fieldContainer) {
            debugError("FieldTypes", 'Lookup field container not found for input:', input.id);
            return;
        }
        
        const hiddenInput = fieldContainer.querySelector('input[type="hidden"]');
        const resultsDiv = fieldContainer.querySelector('.lookup-results');
        const selectedDiv = fieldContainer.querySelector('.lookup-selected');
        
        if (!hiddenInput || !resultsDiv || !selectedDiv) {
            debugError("FieldTypes", 'Lookup field elements not found:', { hiddenInput: !!hiddenInput, resultsDiv: !!resultsDiv, selectedDiv: !!selectedDiv });
            return;
        }
        
        let debounceTimer;
        
        input.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            debugInfo("FieldTypes", 'Lookup input changed:', query);
            
            clearTimeout(debounceTimer);
            
            if (query.length < 2) {
                resultsDiv.style.display = 'none';
                return;
            }
            
            debounceTimer = setTimeout(async () => {
                debugInfo("FieldTypes", 'Performing lookup search for:', query);
                await this.performLookupSearch(input, query, resultsDiv, hiddenInput, selectedDiv);
            }, 300);
        });
        
        input.addEventListener('blur', () => {
            // Delay hiding results to allow clicking on them
            setTimeout(() => {
                resultsDiv.style.display = 'none';
            }, 200);
        });
        
        input.addEventListener('focus', () => {
            if (input.value.length >= 2) {
                resultsDiv.style.display = 'block';
            }
        });
    }
    
    async performLookupSearch(input, query, resultsDiv, hiddenInput, selectedDiv) {
        debugInfo("FieldTypes", 'performLookupSearch called with query:', query);
        const objectName = input.dataset.lookupObject;
        const displayField = input.dataset.displayField || 'Name';
        const searchField = input.dataset.searchField || 'Name';
        const maxResults = parseInt(input.dataset.maxResults) || 10;
        let filters = [];
        
        try {
            const filtersData = input.dataset.lookupFilters;
            if (filtersData) {
                filters = JSON.parse(decodeURIComponent(filtersData));
                debugInfo("FieldTypes", 'Parsed lookup filters:', filters);
            }
        } catch (e) {
            debugWarn("FieldTypes", 'Error parsing lookup filters:', e);
        }
        
        if (!objectName || !window.AppState.salesforceConnected) {
            debugInfo("FieldTypes", 'Lookup search aborted: objectName or Salesforce not connected');
            return;
        }
        
        try {
            const salesforce = window.AppModules.salesforce;
            debugInfo("FieldTypes", `Calling salesforce.searchRecords for ${objectName} with query ${query}`);
            const results = await salesforce.searchRecords(objectName, query, displayField, searchField, filters, maxResults);
            debugInfo("FieldTypes", 'Salesforce search results:', results);
            
            this.displayLookupResults(results, resultsDiv, hiddenInput, selectedDiv, input);
        } catch (error) {
            debugError("FieldTypes", 'Lookup search error:', error);
        }
    }
    
    displayLookupResults(results, resultsDiv, hiddenInput, selectedDiv, searchInput) {
        if (results.length === 0) {
            resultsDiv.innerHTML = '<div class="lookup-no-results">No results found</div>';
        } else {
            resultsDiv.innerHTML = results.map(record => `
                <div class="lookup-result-item" data-id="${record.id}" data-display="${this.escapeHtml(record.display)}">
                    ${this.escapeHtml(record.display)}
                </div>
            `).join('');
            
            // Add click handlers
            resultsDiv.querySelectorAll('.lookup-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = item.dataset.id;
                    const display = item.dataset.display;
                    
                    hiddenInput.value = id;
                    searchInput.value = '';
                    selectedDiv.querySelector('.selected-text').textContent = display;
                    selectedDiv.style.display = 'block';
                    resultsDiv.style.display = 'none';
                    
                    // Store record ID as variable if configured
                    this.storeLookupIdAsVariable(searchInput, id);
                });
            });
        }
        
        resultsDiv.style.display = 'block';
    }
    
    storeLookupIdAsVariable(searchInput, recordId) {
        // Find the variable name - either from field config or data attribute
        let variableName = '';
        
        // First try to get from data attribute (works in published forms)
        if (searchInput.dataset.storeIdVariable) {
            variableName = searchInput.dataset.storeIdVariable.trim();
        } else {
            // Fallback to form builder configuration (works in form builder)
            const fieldId = searchInput.id.replace('_search', '');
            const formBuilder = window.AppModules.formBuilder;
            
            if (!formBuilder) return;
            
            const currentPage = formBuilder.getCurrentPage();
            if (!currentPage) return;
            
            // Find the field in the current page
            const field = currentPage.fields.find(f => f.id === fieldId);
            if (!field || !field.storeIdVariable) return;
            
            variableName = field.storeIdVariable.trim();
        }
        
        if (!variableName) return;
        
        debugInfo("FieldTypes", `🔗 LOOKUP: Storing record ID "${recordId}" as variable "${variableName}"`);
        
        // Store in global variable system
        if (window.FormVariables) {
            window.FormVariables.set(variableName, recordId);
        }
        
        // Store in page variables if available
        if (currentPage.variables) {
            if (currentPage.variables instanceof Map) {
                currentPage.variables.set(variableName, recordId);
            } else {
                // Convert to Map if it's not already
                const map = new Map();
                if (typeof currentPage.variables === 'object') {
                    Object.entries(currentPage.variables).forEach(([key, value]) => {
                        map.set(key, value);
                    });
                }
                map.set(variableName, recordId);
                currentPage.variables = map;
            }
        } else {
            currentPage.variables = new Map([[variableName, recordId]]);
        }
        
        debugInfo("FieldTypes", `✅ LOOKUP: Variable "${variableName}" set successfully`);
        
        // Trigger conditional logic re-evaluation
        if (window.AppModules?.conditionalLogic) {
            setTimeout(() => {
                debugInfo("FieldTypes", '🔄 LOOKUP: Triggering conditional logic re-evaluation...');
                window.AppModules.conditionalLogic.evaluateAllConditions();
            }, 100);
        }
    }
    
    initializeRichTextFields() {
        const richTextFields = document.querySelectorAll('[data-field-type="richtext"]');
        
        richTextFields.forEach(field => {
            const editorDiv = field.querySelector('[id$="_editor"]');
            const hiddenInput = field.querySelector('input[type="hidden"]');
            
            if (editorDiv && !this.quillInstances.has(editorDiv.id)) {
                this.initializeRichTextEditor(hiddenInput.id, editorDiv.id, hiddenInput.value);
            }
        });
    }
    
    initializeRichTextEditor(fieldId, editorId, initialContent = '') {
        if (typeof Quill === 'undefined') {
            debugWarn("FieldTypes", 'Quill is not loaded, skipping rich text editor initialization');
            return;
        }
        
        const editorElement = document.getElementById(editorId);
        const hiddenInput = document.getElementById(fieldId);
        
        if (!editorElement || !hiddenInput) {
            return;
        }
        
        const quill = new Quill(`#${editorId}`, {
            theme: 'snow',
            modules: {
                toolbar: [
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'header': 1 }, { 'header': 2 }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'script': 'sub'}, { 'script': 'super' }],
                    ['link', 'image'],
                    ['clean']
                ]
            },
            placeholder: 'Enter text...'
        });
        
        // Set initial content
        if (initialContent) {
            quill.root.innerHTML = initialContent;
        }
        
        // Update hidden input on text change
        quill.on('text-change', () => {
            hiddenInput.value = quill.root.innerHTML;
        });
        
        this.quillInstances.set(editorId, quill);
    }
    
    initializeSignatureFields() {
        const signatureFields = document.querySelectorAll('[data-field-type="signature"]');
        
        signatureFields.forEach(field => {
            const canvas = field.querySelector('canvas');
            const hiddenInput = field.querySelector('input[type="hidden"]');
            
            if (canvas && hiddenInput) {
                this.initializeSignaturePad(hiddenInput.id, canvas.id, {});
            }
        });
    }
    
    initializeSignaturePad(fieldId, canvasId, config) {
        // This will be handled by the signature module
        const signatureModule = window.AppModules.signature;
        if (signatureModule) {
            signatureModule.initializeSignaturePad(fieldId, canvasId, config);
        }
    }
    
    initializeLoginFields() {
        const loginFields = document.querySelectorAll('[data-field-type="login"]');
        
        loginFields.forEach(field => {
            const emailInput = field.querySelector('.login-email-input');
            const submitBtn = field.querySelector('.login-submit-btn');
            
            if (emailInput && submitBtn) {
                this.setupLoginField(emailInput, submitBtn);
            }
        });
    }
    
    setupLoginField(emailInput, submitBtn) {
        const fieldId = emailInput.dataset.fieldId;
        const enableOTP = emailInput.dataset.enableOtp === 'true';
        const enableLookup = emailInput.dataset.enableLookup === 'true';
        let setVariables = {};
        
        try {
            const variablesData = emailInput.dataset.setVariables;
            if (variablesData) {
                setVariables = JSON.parse(decodeURIComponent(variablesData));
            }
        } catch (e) {
            debugWarn("FieldTypes", 'Error parsing login field variables:', e);
        }
        
        // Handle email input changes for real-time validation
        emailInput.addEventListener('input', (e) => {
            const email = e.target.value.trim();
            const isValid = this.isValidEmail(email);
            
            submitBtn.disabled = !isValid;
            
            // Clear any previous lookup timers but don't auto-lookup
            clearTimeout(this.loginLookupTimer);
        });
        
        // Handle submit button click
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const email = emailInput.value.trim();
            
            if (!this.isValidEmail(email)) {
                this.showLoginMessage(fieldId, 'Please enter a valid email address.', 'error');
                return;
            }
            
            if (enableLookup) {
                this.handleLoginEmailLookup(fieldId, email, setVariables);
            } else {
                // Just set basic variables and allow continuation
                this.handleBasicLogin(fieldId, email, setVariables);
            }
        });
        
        // Handle Enter key
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                submitBtn.click();
            }
        });
    }
    
    async handleLoginEmailLookup(fieldId, email, setVariables) {
        const statusDiv = document.getElementById(`${fieldId}_status`);
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = `
            <div class="login-loading">
                <div class="spinner"></div>
                <p>Looking up your account...</p>
            </div>
        `;
        
        try {
            debugInfo("FieldTypes", 'Starting login email lookup for:', email);
            const flowLogic = window.AppModules.flowLogic;
            if (!flowLogic) {
                debugError("FieldTypes", 'FlowLogic module not available');
                this.showLoginMessage(fieldId, 'System error. You can still continue.', 'warning');
                this.handleBasicLogin(fieldId, email, setVariables);
                return;
            }
            
            // Use the existing flow logic to handle email lookup
            const result = await flowLogic.performEmailLookup(email);
            debugInfo("FieldTypes", 'Lookup result:', result);
            
            if (result.found && result.contact) {
                debugInfo("FieldTypes", 'Contact found, showing OTP verification');
                
                // Clear the loading message first
                statusDiv.innerHTML = '';
                
                // Set variables to indicate contact exists (no registration needed)
                if (window.FormVariables) {
                    debugInfo("FieldTypes", '🔐 LOGIN: Contact found - Setting existing user variables');
                    window.FormVariables.set('needsRegistration', 'false');
                    window.FormVariables.set('isNewUser', 'false');
                    window.FormVariables.set('contactExists', 'true');
                    // Field-specific variables
                    window.FormVariables.set(`${fieldId}_needsRegistration`, 'false');
                    window.FormVariables.set(`${fieldId}_isNewUser`, 'false');
                    window.FormVariables.set(`${fieldId}_contactExists`, 'true');
                }
                
                // Trigger conditional logic evaluation after setting registration variables
                const conditionalLogic = window.AppModules.conditionalLogic;
                if (conditionalLogic) {
                    setTimeout(() => conditionalLogic.evaluateAllConditions(), 100);
                }
                
                // Show OTP verification UI directly in the status div
                // DO NOT set login variables here - they should only be set after OTP verification
                this.showLoginOTPVerification(fieldId, email, result.contact, statusDiv);
            } else {
                debugInfo("FieldTypes", 'No contact found, proceeding with new account flow');
                // No contact found - set basic variables and registration flag
                this.setLoginVariables(fieldId, setVariables, { Email: email });
                
                // Set variables to indicate user needs to register (new user)
                if (window.FormVariables) {
                    debugInfo("FieldTypes", '🔐 LOGIN: No contact found - Setting registration variables');
                    window.FormVariables.set('needsRegistration', 'true');
                    window.FormVariables.set('isNewUser', 'true');
                    window.FormVariables.set('contactExists', 'false');
                    // Field-specific variables
                    window.FormVariables.set(`${fieldId}_needsRegistration`, 'true');
                    window.FormVariables.set(`${fieldId}_isNewUser`, 'true');
                    window.FormVariables.set(`${fieldId}_contactExists`, 'false');
                }
                
                // Trigger conditional logic evaluation after setting registration variables
                const conditionalLogic = window.AppModules.conditionalLogic;
                if (conditionalLogic) {
                    setTimeout(() => conditionalLogic.evaluateAllConditions(), 100);
                }
                
                this.showLoginMessage(fieldId, 'Welcome! You can proceed to create your account.', 'success');
            }
        } catch (error) {
            debugError("FieldTypes", 'Login lookup error:', error);
            this.showLoginMessage(fieldId, 'Lookup failed. You can still continue.', 'warning');
            this.handleBasicLogin(fieldId, email, setVariables);
        }
    }
    
    handleBasicLogin(fieldId, email, setVariables) {
        // Set basic variables
        this.setLoginVariables(fieldId, setVariables, { Email: email });
        this.showLoginMessage(fieldId, 'You can now continue with the form.', 'success');
    }
    
    showLoginOTPVerification(fieldId, email, contact, statusDiv) {
        debugInfo("FieldTypes", '🔐 LOGIN: showLoginOTPVerification called with:', {
            fieldId,
            email,
            contactName: contact?.Name,
            statusDiv: !!statusDiv
        });
        
        const otpHTML = `
            <div class="otp-verification-container">
                <div class="otp-header">
                    <h4>📧 Email Verification Required</h4>
                    <p>We found an existing account for <strong>${email}</strong>.</p>
                    <p>Click below to send a verification code to your email.</p>
                </div>
                
                <div class="otp-actions">
                    <button type="button" class="button button-primary send-otp-btn" data-field-id="${fieldId}" data-email="${email}">
                        Send Verification Code
                    </button>
                </div>
                
                <div class="otp-input-section" style="display: none;">
                    <div class="otp-input-group">
                        <label for="${fieldId}_otp">Enter 6-digit code:</label>
                        <input type="text" 
                               id="${fieldId}_otp" 
                               class="form-input otp-input" 
                               placeholder="000000" 
                               maxlength="6"
                               pattern="[0-9]{6}"
                               autocomplete="one-time-code">
                        <button type="button" class="button button-primary verify-otp-btn" data-field-id="${fieldId}" data-email="${email}">
                            Verify Code
                        </button>
                    </div>
                    
                    <div class="otp-resend">
                        <button type="button" class="button button-secondary resend-otp-btn" data-field-id="${fieldId}" data-email="${email}">
                            Resend Code
                        </button>
                    </div>
                </div>
                
                <div class="otp-error" style="display: none;"></div>
            </div>
        `;
        
        debugInfo("FieldTypes", '🔐 LOGIN: Setting statusDiv.innerHTML with OTP HTML');
        statusDiv.innerHTML = otpHTML;
        
        debugInfo("FieldTypes", '🔐 LOGIN: After setting innerHTML, statusDiv content:', statusDiv.innerHTML.substring(0, 100) + '...');
        
        // Set up event listeners
        const sendOtpBtn = statusDiv.querySelector('.send-otp-btn');
        const verifyOtpBtn = statusDiv.querySelector('.verify-otp-btn');
        const resendOtpBtn = statusDiv.querySelector('.resend-otp-btn');
        const otpInput = statusDiv.querySelector('.otp-input');
        const otpInputSection = statusDiv.querySelector('.otp-input-section');
        
        debugInfo("FieldTypes", '🔐 LOGIN: Event listener setup - found elements:', {
            sendOtpBtn: !!sendOtpBtn,
            verifyOtpBtn: !!verifyOtpBtn,
            resendOtpBtn: !!resendOtpBtn,
            otpInput: !!otpInput,
            otpInputSection: !!otpInputSection
        });
        
        // Send OTP
        sendOtpBtn.addEventListener('click', async () => {
            if (sendOtpBtn.disabled) {
                debugInfo("FieldTypes", '🔐 LOGIN: Send OTP button already disabled, ignoring click');
                return;
            }
            debugInfo("FieldTypes", '🔐 LOGIN: Send OTP button clicked');
            await this.sendLoginOTP(fieldId, email, contact, statusDiv);
        });
        
        // Verify OTP
        verifyOtpBtn.addEventListener('click', async () => {
            debugInfo("FieldTypes", '🔐 LOGIN: Verify OTP button clicked');
            await this.verifyLoginOTP(fieldId, email, contact, statusDiv);
        });
        
        // Resend OTP
        resendOtpBtn.addEventListener('click', async () => {
            if (resendOtpBtn.disabled) {
                debugInfo("FieldTypes", '🔐 LOGIN: Resend OTP button already disabled, ignoring click');
                return;
            }
            debugInfo("FieldTypes", '🔐 LOGIN: Resend OTP button clicked');
            await this.sendLoginOTP(fieldId, email, contact, statusDiv);
        });
        
        // Auto-format OTP input
        otpInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, ''); // Only numbers
            verifyOtpBtn.disabled = e.target.value.length !== 6;
        });
        
        // Auto-submit on 6 digits
        otpInput.addEventListener('input', (e) => {
            if (e.target.value.length === 6) {
                setTimeout(() => verifyOtpBtn.click(), 500);
            }
        });
    }
    
    setLoginVariables(fieldId, variableConfig, contactData, isLoginComplete = false) {
        const flowLogic = window.AppModules.flowLogic;
        if (!flowLogic) return;
        
        // Process each variable in the configuration
        Object.entries(variableConfig).forEach(([varName, varValue]) => {
            let finalValue = varValue;
            
            // Handle template variables like {{Contact.Name}}
            if (typeof varValue === 'string' && varValue.includes('{{')) {
                finalValue = varValue.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
                    const keys = path.split('.');
                    let value = contactData;
                    
                    for (const key of keys) {
                        if (key === 'Contact') continue; // Skip Contact prefix
                        value = value ? value[key] : '';
                    }
                    
                    return value || '';
                });
            }
            
            // Set the variable in flow logic
            flowLogic.setFlowState(`${fieldId}_${varName}`, 'variable_set', {
                name: varName,
                value: finalValue,
                sourceField: fieldId
            });
        });
        
        // Set a general login success variable
        flowLogic.setFlowState(`${fieldId}_loginComplete`, 'login_complete', {
            email: contactData.Email,
            contactId: contactData.Id || null,
            timestamp: new Date().toISOString()
        });
        
        // Set variables in GLOBAL variable store (primary source for all modules)
        Object.entries(variableConfig).forEach(([varName, varValue]) => {
            let finalValue = varValue;
            
            // Handle template variables like {{Contact.Name}}
            if (typeof varValue === 'string' && varValue.includes('{{')) {
                finalValue = varValue.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
                    const keys = path.split('.');
                    let value = contactData;
                    
                    for (const key of keys) {
                        if (key === 'Contact') continue; // Skip Contact prefix
                        value = value ? value[key] : '';
                    }
                    
                    return value || '';
                });
            }
            
            // Set variable in GLOBAL store (this is the primary source now)
            if (window.FormVariables) {
                debugInfo("FieldTypes", `🔐 LOGIN: Setting global variable "${varName}" = "${finalValue}"`);
                window.FormVariables.set(varName, finalValue);
            }
            
            // Also set in multiPage for backward compatibility
            const multiPage = window.AppModules.multiPage;
            if (multiPage) {
                multiPage.setVariable(varName, finalValue);
            }
        });
        
        // Set common login variables for easy conditional logic
        if (window.FormVariables) {
            if (isLoginComplete) {
                debugInfo("FieldTypes", `🔐 LOGIN: Login complete - Setting global variable "isLoggedIn" = "true"`);
                window.FormVariables.set('isLoggedIn', 'true');
                debugInfo("FieldTypes", `🔐 LOGIN: Login complete - Setting global variable "loggedIn" = "true"`);
                window.FormVariables.set('loggedIn', 'true');
            } else {
                debugInfo("FieldTypes", `🔐 LOGIN: Contact found, but login not complete until OTP verified`);
                debugInfo("FieldTypes", `🔐 LOGIN: Setting global variable "isLoggedIn" = "false"`);
                window.FormVariables.set('isLoggedIn', 'false');
                debugInfo("FieldTypes", `🔐 LOGIN: Setting global variable "loggedIn" = "false"`);
                window.FormVariables.set('loggedIn', 'false');
            }
        }
        
        // Trigger conditional logic evaluation after setting variables
        const conditionalLogic = window.AppModules.conditionalLogic;
        if (conditionalLogic) {
            debugInfo("FieldTypes", '🔐 LOGIN: Triggering conditional logic re-evaluation');
            // Evaluate all conditions to handle any page visibility changes
            conditionalLogic.evaluateAllConditions();
        }
    }
    
    showLoginMessage(fieldId, message, type = 'info') {
        const statusDiv = document.getElementById(`${fieldId}_status`);
        if (!statusDiv) return;
        
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = `
            <div class="login-message ${type}">
                <span class="message-icon">${this.getMessageIcon(type)}</span>
                <span class="message-text">${message}</span>
            </div>
        `;
    }
    
    getMessageIcon(type) {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    initializeEmailVerifyFields() {
        const verifyFields = document.querySelectorAll('[data-field-type="email-verify"]');
        
        verifyFields.forEach(field => {
            const emailInput = field.querySelector('.verify-email-input');
            const verifyBtn = field.querySelector('.verify-btn');
            
            if (emailInput && verifyBtn) {
                this.setupEmailVerifyField(emailInput, verifyBtn);
            }
        });
    }
    
    setupEmailVerifyField(emailInput, verifyBtn) {
        const fieldId = emailInput.dataset.fieldId;
        
        // Handle email input changes for real-time validation
        emailInput.addEventListener('input', (e) => {
            const email = e.target.value.trim();
            const isValid = this.isValidEmail(email);
            
            verifyBtn.disabled = !isValid;
        });
        
        // Handle verify button click
        verifyBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Prevent multiple clicks by checking if already processing
            if (verifyBtn.disabled) {
                debugInfo("FieldTypes", '📧 EMAIL-VERIFY: Button already disabled, ignoring click');
                return;
            }
            
            const email = emailInput.value.trim();
            
            if (!this.isValidEmail(email)) {
                this.showVerifyMessage(fieldId, 'Please enter a valid email address.', 'error');
                return;
            }
            
            // Disable button and show processing state
            verifyBtn.disabled = true;
            const originalText = verifyBtn.textContent;
            verifyBtn.textContent = 'Sending...';
            
            try {
                await this.handleEmailVerification(fieldId, email);
            } catch (error) {
                debugError("FieldTypes", '📧 EMAIL-VERIFY: Error in handleEmailVerification:', error);
            } finally {
                // Re-enable button
                verifyBtn.disabled = false;
                verifyBtn.textContent = originalText;
            }
        });
        
        // Handle Enter key
        emailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                verifyBtn.click();
            }
        });
    }
    
    async handleEmailVerification(fieldId, email) {
        const statusDiv = document.getElementById(`${fieldId}_status`);
        const emailInput = document.getElementById(`${fieldId}_email`);
        
        // Get configuration from field
        const enableContactLookup = emailInput.dataset.enableContactLookup === 'true';
        const requireExistingContact = emailInput.dataset.requireExistingContact === 'true';
        const contactNotFoundMessage = emailInput.dataset.contactNotFoundMessage || 'No account found with this email address.';
        
        statusDiv.style.display = 'block';
        
        if (enableContactLookup) {
            // Show contact lookup loading
            statusDiv.innerHTML = `
                <div class="verify-loading">
                    <div class="spinner"></div>
                    <p>Looking up your account...</p>
                </div>
            `;
            
            try {
                // Perform contact lookup first
                const contactLookupResult = await this.performContactLookup(email);
                debugInfo("FieldTypes", '📧 EMAIL-VERIFY: Contact lookup result:', contactLookupResult);
                
                if (contactLookupResult.found && contactLookupResult.contact) {
                    // Contact found - proceed with OTP
                    debugInfo("FieldTypes", '📧 EMAIL-VERIFY: Contact found, proceeding with OTP verification');
                    await this.sendOTPToContact(fieldId, email, contactLookupResult.contact);
                } else {
                    // Contact not found
                    debugInfo("FieldTypes", '📧 EMAIL-VERIFY: Contact not found');
                    if (requireExistingContact) {
                        // Require existing contact - show error and don't send OTP
                        this.showVerifyMessage(fieldId, contactNotFoundMessage, 'error');
                        return;
                    } else {
                        // Allow new email - proceed with OTP but no contact data
                        debugInfo("FieldTypes", '📧 EMAIL-VERIFY: Contact not found but allowing new email verification');
                        await this.sendOTPToEmail(fieldId, email, null);
                    }
                }
            } catch (error) {
                debugError("FieldTypes", '📧 EMAIL-VERIFY: Contact lookup error:', error);
                if (requireExistingContact) {
                    this.showVerifyMessage(fieldId, 'Unable to verify account. Please try again.', 'error');
                    return;
                } else {
                    // Fallback to basic email verification
                    debugInfo("FieldTypes", '📧 EMAIL-VERIFY: Falling back to basic email verification');
                    await this.sendOTPToEmail(fieldId, email, null);
                }
            }
        } else {
            // Basic email verification without contact lookup
            debugInfo("FieldTypes", '📧 EMAIL-VERIFY: Basic email verification (no contact lookup)');
            await this.sendOTPToEmail(fieldId, email, null);
        }
    }
    
    async performContactLookup(email) {
        try {
            const flowLogic = window.AppModules.flowLogic;
            if (!flowLogic) {
                throw new Error('FlowLogic module not available');
            }
            
            // Use the existing flowLogic method for contact lookup
            const result = await flowLogic.performEmailLookup(email);
            return result;
        } catch (error) {
            debugError("FieldTypes", '📧 EMAIL-VERIFY: Contact lookup failed:', error);
            throw error;
        }
    }
    
    async sendOTPToContact(fieldId, email, contact) {
        debugInfo("FieldTypes", '📧 EMAIL-VERIFY: Sending OTP to existing contact:', contact.Name);
        
        const statusDiv = document.getElementById(`${fieldId}_status`);
        statusDiv.innerHTML = `
            <div class="verify-loading">
                <div class="spinner"></div>
                <p>Sending verification code to ${contact.Name || email}...</p>
            </div>
        `;
        
        try {
            const result = await this.sendOTP(email, contact.Id);
            
            // Store contact data for later use
            this.contactLookupCache = this.contactLookupCache || new Map();
            this.contactLookupCache.set(email, contact);
            
            // Show OTP interface with contact context and status message
            const statusMessage = result.emailSent ? 
                `Verification code sent to ${contact.Name || email}. Please check your email.` :
                result.demoOtp ? `Demo Mode - Code: ${result.demoOtp}` : 'Code sent';
            const statusType = result.emailSent ? 'success' : result.demoOtp ? 'info' : 'info';
            
            await this.showOTPVerificationInterface(fieldId, email, result.sessionId, contact, statusMessage, statusType);
        } catch (error) {
            debugError("FieldTypes", '📧 EMAIL-VERIFY: Failed to send OTP to contact:', error);
            this.showVerifyMessage(fieldId, 'Failed to send verification code. Please try again.', 'error');
        }
    }
    
    async sendOTPToEmail(fieldId, email, contact = null) {
        debugInfo("FieldTypes", '📧 EMAIL-VERIFY: Sending OTP to email:', email);
        
        const statusDiv = document.getElementById(`${fieldId}_status`);
        statusDiv.innerHTML = `
            <div class="verify-loading">
                <div class="spinner"></div>
                <p>Sending verification code...</p>
            </div>
        `;
        
        try {
            const result = await this.sendOTP(email, contact?.Id || null);
            
            // Store contact data if available
            if (contact) {
                this.contactLookupCache = this.contactLookupCache || new Map();
                this.contactLookupCache.set(email, contact);
            }
            
            // Show OTP interface with status message
            const statusMessage = result.emailSent ? 
                `Verification code sent to ${email}. Please check your email.` :
                result.demoOtp ? `Demo Mode - Code: ${result.demoOtp}` : 'Code sent';
            const statusType = result.emailSent ? 'success' : result.demoOtp ? 'info' : 'info';
            
            await this.showOTPVerificationInterface(fieldId, email, result.sessionId, contact, statusMessage, statusType);
        } catch (error) {
            debugError("FieldTypes", '📧 EMAIL-VERIFY: Failed to send OTP:', error);
            this.showVerifyMessage(fieldId, 'Failed to send verification code. Please try again.', 'error');
        }
    }
    
    async sendOTP(email, contactId = null) {
        const flowLogic = window.AppModules.flowLogic;
        const formId = flowLogic ? flowLogic.getCurrentFormId() : this.getCurrentFormId();
        
        const response = await fetch('/api/send-otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                email,
                contactId,
                isResend: false,
                formId 
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            if (response.status === 429) {
                // Rate limited - show specific message
                throw new Error(errorData.message || 'Please wait before requesting another verification code');
            }
            throw new Error(errorData.message || 'Failed to send verification code');
        }
        
        return await response.json();
    }
    
    async showOTPVerificationInterface(fieldId, email, sessionId, contact = null, statusMessage = null, statusType = 'info') {
        const statusDiv = document.getElementById(`${fieldId}_status`);
        
        const displayName = contact ? (contact.Name || email) : email;
        const welcomeText = contact ? 
            `We've sent a 6-digit code to ${displayName} (${email})` : 
            `We've sent a 6-digit code to ${email}`;
            
        // Include status message if provided
        const statusMessageHtml = statusMessage ? `
            <div class="verify-message ${statusType}">
                <span class="message-icon">${this.getMessageIcon(statusType)}</span>
                <span class="message-text">${statusMessage}</span>
            </div>
        ` : '';
        
        statusDiv.innerHTML = `
            <div class="otp-verification-container">
                <div class="otp-header">
                    <h4>📧 Enter Verification Code</h4>
                    <p>${welcomeText}</p>
                    ${contact ? `<div class="contact-found-indicator">✅ Account found: ${contact.Name}</div>` : ''}
                    ${statusMessageHtml}
                </div>
                
                <div class="otp-input-group">
                    <input type="text" 
                           id="${fieldId}_otp" 
                           class="otp-input" 
                           placeholder="000000" 
                           maxlength="6"
                           pattern="[0-9]{6}"
                           autocomplete="one-time-code">
                    <button type="button" class="button button-primary verify-otp-btn" 
                            data-field-id="${fieldId}" 
                            data-email="${email}" 
                            data-session-id="${sessionId}"
                            data-has-contact="${!!contact}">
                        Verify Code
                    </button>
                </div>
                
                <div class="otp-actions">
                    <button type="button" class="button button-secondary resend-verify-btn" data-field-id="${fieldId}" data-email="${email}">
                        Resend Code
                    </button>
                </div>
                
                <div class="otp-error" style="display: none;"></div>
            </div>
        `;
        
        // Set up OTP verification event listeners
        const otpInput = document.getElementById(`${fieldId}_otp`);
        const verifyOtpBtn = statusDiv.querySelector('.verify-otp-btn');
        const resendBtn = statusDiv.querySelector('.resend-verify-btn');
        
        // Auto-format OTP input
        otpInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, ''); // Only numbers
            verifyOtpBtn.disabled = e.target.value.length !== 6;
        });
        
        // Verify OTP
        verifyOtpBtn.addEventListener('click', () => {
            this.verifyOTPCode(fieldId, email, otpInput.value, sessionId);
        });
        
        // Resend verification
        resendBtn.addEventListener('click', () => {
            // Check if we have contact data cached
            const contact = this.contactLookupCache?.get(email) || null;
            if (contact) {
                // Resend to existing contact
                this.sendOTPToContact(fieldId, email, contact);
            } else {
                // Resend basic verification
                this.sendOTPToEmail(fieldId, email, null);
            }
        });
        
        // Auto-submit on 6 digits
        otpInput.addEventListener('input', (e) => {
            if (e.target.value.length === 6) {
                setTimeout(() => verifyOtpBtn.click(), 500);
            }
        });
    }
    
    async verifyOTPCode(fieldId, email, otp, sessionId) {
        if (!otp || otp.length !== 6) {
            this.showOTPError(fieldId, 'Please enter a valid 6-digit code.');
            return;
        }
        
        try {
            const response = await fetch('/api/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email,
                    otp,
                    sessionId 
                })
            });
            
            const result = await response.json();
            
            if (result.success || result.verified) {
                // Get contact data from cache if available
                const contact = this.contactLookupCache?.get(email) || null;
                debugInfo("FieldTypes", '📧 EMAIL-VERIFY: OTP verification successful, contact data:', contact);
                
                // Verification successful
                this.handleVerificationSuccess(fieldId, email, contact);
            } else {
                this.showOTPError(fieldId, result.message || 'Invalid verification code. Please try again.');
            }
        } catch (error) {
            debugError("FieldTypes", '📧 EMAIL-VERIFY: OTP verification error:', error);
            this.showOTPError(fieldId, 'Verification failed. Please try again.');
        }
    }
    
    handleVerificationSuccess(fieldId, email, contact = null) {
        const statusDiv = document.getElementById(`${fieldId}_status`);
        const hiddenInput = document.getElementById(fieldId);
        
        // Mark field as verified
        hiddenInput.value = email;
        
        // Set verification variables with contact data if available
        this.setVerificationVariables(fieldId, email, contact);
        
        // Show success message with contact context
        const displayName = contact ? contact.Name : email;
        const successMessage = contact ? 
            `Welcome back, ${displayName}! Email verified successfully.` : 
            'Email verified successfully!';
            
        statusDiv.innerHTML = `
            <div class="verify-success">
                <span class="success-icon">✅</span>
                <span class="success-text">${successMessage}</span>
                ${contact ? `<div class="contact-info">Account: ${contact.Name}</div>` : ''}
            </div>
        `;
        
        // Trigger conditional logic evaluation
        const conditionalLogic = window.AppModules.conditionalLogic;
        if (conditionalLogic) {
            conditionalLogic.evaluateAllConditions();
        }
    }
    
    setVerificationVariables(fieldId, email, contact = null) {
        const field = this.findFieldById(fieldId);
        if (!field || !field.verifyConfig?.setVariables) return;
        
        const flowLogic = window.AppModules.flowLogic;
        if (!flowLogic) return;
        
        debugInfo("FieldTypes", '📧 EMAIL-VERIFY: Setting verification variables for field:', fieldId, 'Contact data:', contact);
        
        // Create data object for template processing
        const templateData = {
            email: email,
            Contact: contact || {}
        };
        
        // Process each variable in the configuration
        Object.entries(field.verifyConfig.setVariables).forEach(([varName, varValue]) => {
            let finalValue = varValue;
            
            // Handle template variables like {{email}}, {{Contact.Name}}, {{Contact.Phone}}, etc.
            if (typeof varValue === 'string' && varValue.includes('{{')) {
                finalValue = varValue.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
                    const keys = path.split('.');
                    let value = templateData;
                    
                    for (const key of keys) {
                        value = value ? value[key] : '';
                    }
                    
                    return value || '';
                });
            }
            
            debugInfo("FieldTypes", `📧 EMAIL-VERIFY: Setting variable "${varName}" = "${finalValue}"`);
            
            // Set variable in GLOBAL store (primary source)
            if (window.FormVariables) {
                window.FormVariables.set(varName, finalValue);
            }
            
            // Set the variable in flow logic for backward compatibility
            flowLogic.setFlowState(`${fieldId}_${varName}`, 'variable_set', {
                name: varName,
                value: finalValue,
                sourceField: fieldId,
                contactData: contact
            });
        });
        
        // Set additional contact-specific variables if contact data is available
        if (contact) {
            debugInfo("FieldTypes", '📧 EMAIL-VERIFY: Setting contact-specific variables');
            
            // Set common contact variables
            const contactVariables = {
                'contactExists': 'true',
                'contactId': contact.Id || '',
                'contactName': contact.Name || '',
                'contactEmail': contact.Email || email,
                'contactPhone': contact.Phone || '',
                'contactFirstName': contact.FirstName || '',
                'contactLastName': contact.LastName || ''
            };
            
            Object.entries(contactVariables).forEach(([varName, varValue]) => {
                if (window.FormVariables) {
                    window.FormVariables.set(varName, varValue);
                }
                
                // Also set field-specific versions
                window.FormVariables.set(`${fieldId}_${varName}`, varValue);
            });
        } else {
            // No contact found - set appropriate variables
            if (window.FormVariables) {
                window.FormVariables.set('contactExists', 'false');
                window.FormVariables.set(`${fieldId}_contactExists`, 'false');
            }
        }
        
        // Set a general verification success variable
        flowLogic.setFlowState(`${fieldId}_verificationComplete`, 'verification_complete', {
            email: email,
            contactId: contact?.Id || null,
            contactName: contact?.Name || null,
            timestamp: new Date().toISOString()
        });
        
        debugInfo("FieldTypes", '📧 EMAIL-VERIFY: All verification variables set successfully');
    }
    
    findFieldById(fieldId) {
        debugInfo("FieldTypes", '🔍 [FIELD DEBUG] Looking for field:', fieldId);
        
        // Try form viewer first (for public forms)
        if (window.AppModules?.formViewer?.formData?.pages) {
            debugInfo("FieldTypes", '🔍 [FIELD DEBUG] Checking form viewer data...');
            const pages = window.AppModules.formViewer.formData.pages;
            for (const page of pages) {
                if (page.fields) {
                    const field = page.fields.find(f => f.id === fieldId);
                    if (field) {
                        debugInfo("FieldTypes", '✅ [FIELD DEBUG] Found field in form viewer:', field.type);
                        return field;
                    }
                }
            }
        }
        
        // Try form builder (for design time)
        if (window.AppModules?.formBuilder?.currentForm?.pages) {
            debugInfo("FieldTypes", '🔍 [FIELD DEBUG] Checking form builder data...');
            const pages = window.AppModules.formBuilder.currentForm.pages;
            for (const page of pages) {
                if (page.fields) {
                    const field = page.fields.find(f => f.id === fieldId);
                    if (field) {
                        debugInfo("FieldTypes", '✅ [FIELD DEBUG] Found field in form builder:', field.type);
                        return field;
                    }
                }
            }
        }
        
        debugWarn("FieldTypes", '⚠️ [FIELD DEBUG] Field not found anywhere:', fieldId);
        debugInfo("FieldTypes", '🔍 [FIELD DEBUG] Available modules:', {
            formViewer: !!window.AppModules?.formViewer,
            formBuilder: !!window.AppModules?.formBuilder,
            formViewerData: !!window.AppModules?.formViewer?.formData,
            formBuilderData: !!window.AppModules?.formBuilder?.currentForm
        });
        
        return null;
    }
    
    showVerifyMessage(fieldId, message, type = 'info') {
        const statusDiv = document.getElementById(`${fieldId}_status`);
        if (!statusDiv) return;
        
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = `
            <div class="verify-message ${type}">
                <span class="message-icon">${this.getMessageIcon(type)}</span>
                <span class="message-text">${message}</span>
            </div>
        `;
    }
    
    showOTPError(fieldId, message) {
        const errorDiv = document.querySelector(`#${fieldId}_status .otp-error`);
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }
    
    initializeFileFields() {
        const fileFields = document.querySelectorAll('[data-field-type="file"]');
        
        fileFields.forEach(field => {
            const fileInput = field.querySelector('input[type="file"]');
            const hiddenInput = field.querySelector('input[type="hidden"]');
            
            if (fileInput && hiddenInput) {
                this.setupFileField(fileInput, hiddenInput);
            }
        });
    }
    
    setupFileField(fileInput, hiddenInput) {
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelect(e, hiddenInput.id);
        });
    }
    
    handleFileSelect(event, fieldId) {
        const files = event.target.files;
        const fileListDiv = document.getElementById(`${fieldId}_files`);
        
        if (files.length === 0) return;
        
        // Clear previous file list
        fileListDiv.innerHTML = '';
        
        // Display selected files
        Array.from(files).forEach((file, index) => {
            const fileDiv = document.createElement('div');
            fileDiv.className = 'file-item';
            fileDiv.innerHTML = `
                <span class="file-name">${this.escapeHtml(file.name)}</span>
                <span class="file-size">${this.formatFileSize(file.size)}</span>
                <button type="button" onclick="window.AppModules.fieldTypes?.removeFile('${fieldId}', ${index})">Remove</button>
            `;
            fileListDiv.appendChild(fileDiv);
        });
        
        // Don't store file data in hidden input - let FormData handle the actual files
        debugInfo("FieldTypes", `Selected ${files.length} file(s) for field ${fieldId}`);
    }
    
    handleFileDrop(event, fieldId) {
        event.preventDefault();
        event.currentTarget.classList.remove('dragging');
        
        const files = event.dataTransfer.files;
        const fileInput = document.getElementById(`${fieldId}_file`);
        
        // Set files to the input element
        fileInput.files = files;
        
        // Trigger change event
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    removeFile(fieldId, index) {
        const fileInput = document.getElementById(`${fieldId}_file`);
        const fileListDiv = document.getElementById(`${fieldId}_files`);
        
        // Create a new FileList without the removed file
        const dt = new DataTransfer();
        const files = fileInput.files;
        
        for (let i = 0; i < files.length; i++) {
            if (i !== index) {
                dt.items.add(files[i]);
            }
        }
        
        fileInput.files = dt.files;
        
        // Trigger change event to update display
        this.handleFileSelect({ target: fileInput }, fieldId);
    }
    
    handleFieldUpdate(field) {
        // Re-initialize field-specific functionality when field is updated
        const fieldElement = document.querySelector(`[data-field-id="${field.id}"]`);
        
        if (fieldElement) {
            switch (field.type) {
                case 'lookup':
                    const lookupInput = fieldElement.querySelector('.lookup-search');
                    if (lookupInput) {
                        this.setupLookupField(lookupInput);
                    }
                    break;
                
                case 'richtext':
                    const editorDiv = fieldElement.querySelector('[id$="_editor"]');
                    if (editorDiv && !this.quillInstances.has(editorDiv.id)) {
                        this.initializeRichTextEditor(field.id, editorDiv.id, field.content);
                    }
                    break;
                
                case 'signature':
                    const canvas = fieldElement.querySelector('canvas');
                    if (canvas) {
                        this.initializeSignaturePad(field.id, canvas.id, field.signatureConfig || {});
                    }
                    break;
                    
                case 'login':
                    const emailInput = fieldElement.querySelector('.login-email-input');
                    const submitBtn = fieldElement.querySelector('.login-submit-btn');
                    if (emailInput && submitBtn) {
                        this.setupLoginField(emailInput, submitBtn);
                    }
                    break;
            }
        }
    }
    
    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Method to get field value
    getFieldValue(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return null;
        
        const fieldType = field.closest('[data-field-type]')?.dataset.fieldType;
        
        switch (fieldType) {
            case 'checkbox':
                return field.checked;
            case 'radio':
                const radioGroup = document.querySelectorAll(`input[name="${fieldId}"]:checked`);
                return radioGroup.length > 0 ? radioGroup[0].value : null;
            case 'richtext':
                const quill = this.quillInstances.get(`${fieldId}_editor`);
                return quill ? quill.root.innerHTML : field.value;
            case 'file':
                // For file fields, return the actual files from the input element
                if (field.files && field.files.length > 0) {
                    return Array.from(field.files).map(file => ({
                        name: file.name,
                        size: file.size,
                        type: file.type,
                        lastModified: file.lastModified
                    }));
                }
                return null;
            default:
                return field.value;
        }
    }
    
    // Method to set field value
    setFieldValue(fieldId, value) {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        const fieldType = field.closest('[data-field-type]')?.dataset.fieldType;
        
        switch (fieldType) {
            case 'checkbox':
                field.checked = !!value;
                break;
            case 'radio':
                const radioOption = document.querySelector(`input[name="${fieldId}"][value="${value}"]`);
                if (radioOption) radioOption.checked = true;
                break;
            case 'richtext':
                const quill = this.quillInstances.get(`${fieldId}_editor`);
                if (quill) quill.root.innerHTML = value || '';
                field.value = value || '';
                break;
            case 'file':
                // File fields cannot be programmatically set for security reasons
                // We only store metadata for auto-save purposes
                debugInfo("FieldTypes", 'File field value cannot be set programmatically:', fieldId);
                break;
            default:
                field.value = value || '';
        }
    }
    
    // Method to validate field
    validateField(fieldId) {
        const field = document.getElementById(fieldId);
        if (!field) return { valid: true };
        
        const fieldType = field.closest('[data-field-type]')?.dataset.fieldType;
        const required = field.hasAttribute('required');
        const value = this.getFieldValue(fieldId);
        
        if (required && (!value || value === '')) {
            return {
                valid: false,
                message: 'This field is required'
            };
        }
        
        // Type-specific validation
        switch (fieldType) {
            case 'email':
                if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                    return {
                        valid: false,
                        message: 'Please enter a valid email address'
                    };
                }
                break;
            
            case 'phone':
                if (value && !/^[\+]?[\d\s\-\(\)]+$/.test(value)) {
                    return {
                        valid: false,
                        message: 'Please enter a valid phone number'
                    };
                }
                break;
            
            case 'number':
                if (value && isNaN(value)) {
                    return {
                        valid: false,
                        message: 'Please enter a valid number'
                    };
                }
                break;
        }
        
        return { valid: true };
    }
    
    async sendLoginOTP(fieldId, email, contact, statusDiv) {
        try {
            debugInfo("FieldTypes", '🔐 LOGIN: Sending OTP to', email);
            
            // Show loading state
            const sendBtn = statusDiv.querySelector('.send-otp-btn');
            const resendBtn = statusDiv.querySelector('.resend-otp-btn');
            if (sendBtn) {
                sendBtn.disabled = true;
                sendBtn.textContent = 'Sending...';
            }
            if (resendBtn) {
                resendBtn.disabled = true;
                resendBtn.textContent = 'Sending...';
            }
            
            // Get current form ID
            const formId = this.getCurrentFormId();
            
            const response = await fetch('/api/send-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email, 
                    contactId: contact.Id,
                    isResend: !!resendBtn,
                    formId 
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                if (response.status === 429) {
                    // Rate limited - show specific message
                    throw new Error(errorData.message || 'Please wait before requesting another OTP');
                }
                throw new Error(errorData.message || 'Failed to send OTP');
            }
            
            const result = await response.json();
            debugInfo("FieldTypes", '🔐 LOGIN: OTP send result:', result);
            
            // Store OTP session info for verification
            if (result.sessionId) {
                debugInfo("FieldTypes", '🔐 LOGIN: Storing session ID for verification:', result.sessionId);
                this.pendingOTPs.set(email, {
                    sessionId: result.sessionId,
                    expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                    contact: contact
                });
            }
            
            // Show success message
            const messageDiv = statusDiv.querySelector('.otp-message p:last-child');
            if (messageDiv) {
                if (result.emailSent) {
                    messageDiv.textContent = `OTP sent to ${email}. Please check your email.`;
                    messageDiv.style.color = '#16a34a';
                } else if (result.demoOtp) {
                    messageDiv.textContent = `Demo Mode - OTP: ${result.demoOtp} (configure email service for production)`;
                    messageDiv.style.color = '#ea580c';
                }
            }
            
            // Show the OTP input section and enable inputs
            const otpInputSection = statusDiv.querySelector('.otp-input-section');
            const otpInput = statusDiv.querySelector(`#${fieldId}_otp`);
            const verifyBtn = statusDiv.querySelector('.verify-otp-btn');
            
            debugInfo("FieldTypes", '🔐 LOGIN: Looking for OTP elements:', {
                statusDiv: !!statusDiv,
                otpInputSection: !!otpInputSection,
                otpInput: !!otpInput,
                verifyBtn: !!verifyBtn,
                fieldId: fieldId
            });
            
            if (otpInputSection) {
                debugInfo("FieldTypes", '🔐 LOGIN: Showing OTP input section');
                otpInputSection.style.display = 'block';
                otpInputSection.classList.add('show');
            } else {
                debugError("FieldTypes", '🔐 LOGIN: OTP input section not found!');
                debugInfo("FieldTypes", '🔐 LOGIN: statusDiv innerHTML:', statusDiv.innerHTML);
            }
            
            if (otpInput) {
                otpInput.disabled = false;
                otpInput.focus(); // Focus on the input for better UX
                debugInfo("FieldTypes", '🔐 LOGIN: OTP input enabled and focused');
            } else {
                debugError("FieldTypes", '🔐 LOGIN: OTP input not found! Looking for:', `#${fieldId}_otp`);
            }
            
            if (verifyBtn) {
                verifyBtn.disabled = false;
                debugInfo("FieldTypes", '🔐 LOGIN: Verify button enabled');
            } else {
                debugError("FieldTypes", '🔐 LOGIN: Verify button not found!');
            }
            
        } catch (error) {
            debugError("FieldTypes", '🔐 LOGIN: Error sending OTP:', error);
            
            // Show error message
            const messageDiv = statusDiv.querySelector('.otp-message p:last-child');
            if (messageDiv) {
                messageDiv.textContent = 'Failed to send OTP. Please try again.';
                messageDiv.style.color = '#dc2626';
            }
        } finally {
            // Reset button states
            const sendBtn = statusDiv.querySelector('.send-otp-btn');
            const resendBtn = statusDiv.querySelector('.resend-otp-btn');
            if (sendBtn) {
                sendBtn.disabled = false;
                sendBtn.textContent = 'Send OTP';
            }
            if (resendBtn) {
                resendBtn.disabled = false;
                resendBtn.textContent = 'Resend OTP';
            }
        }
    }
    
    async verifyLoginOTP(fieldId, email, contact, statusDiv) {
        try {
            debugInfo("FieldTypes", '🔐 LOGIN: Verifying OTP for', email);
            
            const otpInput = statusDiv.querySelector(`#${fieldId}_otp`);
            const otp = otpInput?.value?.trim();
            
            if (!otp || otp.length !== 6) {
                this.showLoginOTPMessage(statusDiv, 'Please enter a valid 6-digit OTP code.', 'error');
                return;
            }
            
            // Show loading state
            const verifyBtn = statusDiv.querySelector('.verify-otp-btn');
            if (verifyBtn) {
                verifyBtn.disabled = true;
                verifyBtn.textContent = 'Verifying...';
            }
            
            const pendingOTP = this.pendingOTPs?.get(email);
            debugInfo("FieldTypes", '🔐 LOGIN: Pending OTP info:', {
                email,
                hasPendingOTP: !!pendingOTP,
                sessionId: pendingOTP?.sessionId,
                expiresAt: pendingOTP?.expiresAt
            });
            
            const requestData = {
                email,
                otp,
                sessionId: pendingOTP?.sessionId || 'login-session'
            };
            
            debugInfo("FieldTypes", '🔐 LOGIN: Sending OTP verification request:', requestData);
            
            const response = await fetch('/api/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                debugError("FieldTypes", '🔐 LOGIN: OTP verification failed with status:', response.status, 'Response:', errorText);
                throw new Error(`OTP verification failed: ${response.status} - ${errorText}`);
            }
            
            const result = await response.json();
            debugInfo("FieldTypes", '🔐 LOGIN: OTP verification result:', result);
            
            if (result.verified) {
                // OTP verified successfully
                this.handleSuccessfulLoginOTPVerification(fieldId, email, contact, statusDiv);
            } else {
                this.showLoginOTPMessage(statusDiv, 'Invalid OTP code. Please try again.', 'error');
            }
            
        } catch (error) {
            debugError("FieldTypes", '🔐 LOGIN: OTP verification error:', error);
            this.showLoginOTPMessage(statusDiv, 'Verification failed. Please try again.', 'error');
        } finally {
            // Reset button state
            const verifyBtn = statusDiv.querySelector('.verify-otp-btn');
            if (verifyBtn) {
                verifyBtn.disabled = false;
                verifyBtn.textContent = 'Verify OTP';
            }
        }
    }
    
    handleSuccessfulLoginOTPVerification(fieldId, email, contact, statusDiv) {
        debugInfo("FieldTypes", '🔐 LOGIN: OTP verification successful for', email);
        
        // Update UI to show success
        statusDiv.innerHTML = `
            <div class="login-success">
                <div class="success-icon">✅</div>
                <h4>Welcome back, ${contact.Name || email}!</h4>
                <p>You have been successfully authenticated.</p>
            </div>
        `;
        
        // Set global login variables for conditional logic using batching
        if (window.FormVariables) {
            const loginSuccessVariables = {
                'isLoggedIn': 'true',
                'loggedIn': 'true',
                'userEmail': email,
                'userName': contact.Name || email,
                [`${fieldId}_isLoggedIn`]: 'true',
                [`${fieldId}_loggedIn`]: 'true'
            };
            
            debugInfo("FieldTypes", '🔐 LOGIN: Setting login success variables via batching system:', loginSuccessVariables);
            
            if (window.FormVariables.setMultiple) {
                window.FormVariables.setMultiple(loginSuccessVariables);
            } else {
                // Fallback for older systems
                Object.entries(loginSuccessVariables).forEach(([name, value]) => {
                    window.FormVariables.set(name, value);
                });
            }
        }
        
        // Also set field-specific login variables if setVariables was provided
        const loginField = document.getElementById(fieldId);
        const setVariables = loginField?.dataset?.setVariables;
        if (setVariables) {
            this.setLoginVariables(fieldId, setVariables, contact, true); // true = login is complete
        }
        
        // Populate known contact data
        this.populateKnownContactData(contact);
        
        // Trigger conditional logic evaluation
        const conditionalLogic = window.AppModules.conditionalLogic;
        if (conditionalLogic) {
            debugInfo("FieldTypes", '🔐 LOGIN: Triggering conditional logic re-evaluation');
            conditionalLogic.evaluateAllConditions();
        }
        
        // Clean up pending OTP if exists
        if (this.pendingOTPs?.has(email)) {
            this.pendingOTPs.delete(email);
        }
    }
    
    showLoginOTPMessage(statusDiv, message, type = 'info') {
        const messageDiv = statusDiv.querySelector('.otp-message p:last-child');
        if (messageDiv) {
            messageDiv.textContent = message;
            messageDiv.style.color = type === 'error' ? '#dc2626' : 
                                    type === 'success' ? '#16a34a' : '#6b7280';
        }
    }
    
    populateKnownContactData(contact) {
        // Auto-populate form fields with known contact data
        const fieldMappings = {
            'FirstName': ['firstName', 'first_name', 'fname'],
            'LastName': ['lastName', 'last_name', 'lname'],
            'Phone': ['phone', 'phoneNumber', 'mobile'],
            'Title': ['title', 'jobTitle'],
            // Add more field mappings as needed
        };
        
        Object.entries(fieldMappings).forEach(([sfField, possibleFieldNames]) => {
            const value = contact[sfField];
            if (value) {
                possibleFieldNames.forEach(fieldName => {
                    const field = document.getElementById(fieldName) || document.querySelector(`[name="${fieldName}"]`);
                    if (field && !field.value) {
                        field.value = value;
                        field.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                });
            }
        });
    }
    
    getCurrentFormId() {
        // Try to get form ID from multiple sources
        
        // 1. From URL path if we're on form viewer (/form/:formId)
        const path = window.location.pathname;
        const formMatch = path.match(/\/form\/([^\/]+)/);
        if (formMatch) {
            return formMatch[1];
        }
        
        // 2. From global app state (form builder)
        if (window.AppModules?.formBuilder?.currentForm?.id) {
            return window.AppModules.formBuilder.currentForm.id;
        }
        
        // 3. From query parameters
        const urlParams = new URLSearchParams(window.location.search);
        const formIdFromQuery = urlParams.get('formId');
        if (formIdFromQuery) {
            return formIdFromQuery;
        }
        
        // 4. From form viewer state
        if (window.AppModules?.formViewer?.currentFormId) {
            return window.AppModules.formViewer.currentFormId;
        }
        
        debugWarn("FieldTypes", 'Could not determine current form ID for Login field');
        return null;
    }

    renderDataTableField(field) {
        const config = field.dataTableConfig || {};
        debugInfo("FieldTypes", `🚀 Rendering DataTable field ${field.id} with config:`, config);
        
        // Set up variable watching for dynamic data updates
        setTimeout(() => {
            this.setupDataTableVariableWatching(field);
            // Also do an initial refresh after a short delay to catch any variables that were set
            setTimeout(() => {
                debugInfo("FieldTypes", `🔄 Initial refresh for DataTable ${field.id}`);
                this.refreshDataTable(field);
            }, 200);
        }, 100);
        
        return `
            <div class="datatable-field" data-field-type="datatable" data-field-id="${field.id}">
                <div class="datatable-container">
                    <div class="datatable-header">
                        <div class="datatable-header-content">
                            <div class="datatable-header-text">
                                <h3 class="datatable-title">${config.title || 'Data Table'}</h3>
                                ${config.description ? `<p class="datatable-description">${config.description}</p>` : ''}
                            </div>
                            <div class="datatable-header-buttons">
                                <button type="button" class="button button-small datatable-fullscreen-btn" 
                                        onclick="window.AppModules.fieldTypes.toggleDataTableFullscreen('${field.id}')"
                                        title="Full Screen">
                                    🔍 Full Screen
                                </button>
                                ${config.allowAdd ? `
                                <button type="button" class="button button-small" onclick="window.AppModules.fieldTypes.addDataTableRow('${field.id}')">
                                    ➕ Add Row
                                </button>
                                ` : ''}
                            </div>
                        </div>
                        ${config.allowAdd && !config.allowAdd ? `
                        <div class="datatable-actions">
                            <button type="button" class="button button-small" onclick="window.AppModules.fieldTypes.addDataTableRow('${field.id}')">
                                ➕ Add Row
                            </button>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="datatable-wrapper">
                        <table id="${field.id}_table" class="datatable">
                            <thead id="${field.id}_thead">
                                ${this.renderDataTableHeader(field)}
                            </thead>
                            <tbody id="${field.id}_tbody">
                                ${this.renderDataTableBody(field)}
                            </tbody>
                        </table>
                    </div>
                    
                    ${config.showPagination ? `
                    <div class="datatable-pagination" id="${field.id}_pagination">
                        <div class="pagination-info">
                            <span id="${field.id}_info">Showing 0 to 0 of 0 entries</span>
                        </div>
                        <div class="pagination-controls">
                            <button type="button" class="button button-small" onclick="window.AppModules.fieldTypes.changeDataTablePage('${field.id}', 'prev')" disabled>
                                ← Previous
                            </button>
                            <button type="button" class="button button-small" onclick="window.AppModules.fieldTypes.changeDataTablePage('${field.id}', 'next')" disabled>
                                Next →
                            </button>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    renderDataTableHeader(field) {
        const config = field.dataTableConfig || {};
        const columns = config.columns || [];
        
        if (columns.length === 0) {
            return '<tr><th>Configure columns in field properties</th></tr>';
        }
        
        let headerHtml = '<tr>';
        columns.forEach(column => {
            headerHtml += `<th class="datatable-header-cell" data-field="${column.field}">
                ${column.label || column.field}
                ${column.sortable ? '<span class="sort-indicator">⇅</span>' : ''}
            </th>`;
        });
        
        // Add actions column if inline editing is enabled
        if (config.allowEdit || config.allowDelete) {
            headerHtml += '<th class="datatable-actions-header">Actions</th>';
        }
        
        headerHtml += '</tr>';
        return headerHtml;
    }

    renderDataTableBody(field) {
        const config = field.dataTableConfig || {};
        const data = this.getDataTableData(field);
        
        if (!data || data.length === 0) {
            const columnCount = (config.columns || []).length + (config.allowEdit || config.allowDelete ? 1 : 0);
            return `<tr class="datatable-empty"><td colspan="${columnCount || 1}">No data to display</td></tr>`;
        }
        
        let bodyHtml = '';
        data.forEach((row, rowIndex) => {
            bodyHtml += `<tr class="datatable-row" data-row-index="${rowIndex}">`;
            
            (config.columns || []).forEach(column => {
                const value = row[column.field] || '';
                const isEditable = config.allowEdit && column.editable !== false;
                
                bodyHtml += `<td class="datatable-cell ${isEditable ? 'editable' : ''}" data-field="${column.field}">`;
                
                if (isEditable) {
                    bodyHtml += this.renderEditableCell(field.id, rowIndex, column, value);
                } else {
                    bodyHtml += this.formatCellValue(value, column);
                }
                
                bodyHtml += '</td>';
            });
            
            // Add actions column if needed
            if (config.allowEdit || config.allowDelete) {
                bodyHtml += '<td class="datatable-actions">';
                if (config.allowEdit) {
                    bodyHtml += `<button type="button" class="button button-small" onclick="window.AppModules.fieldTypes.editDataTableRow('${field.id}', ${rowIndex})" title="Edit Row">✏️</button>`;
                }
                if (config.allowDelete) {
                    bodyHtml += `<button type="button" class="button button-small button-danger" onclick="window.AppModules.fieldTypes.deleteDataTableRow('${field.id}', ${rowIndex})" title="Delete Row">🗑️</button>`;
                }
                bodyHtml += '</td>';
            }
            
            bodyHtml += '</tr>';
        });
        
        return bodyHtml;
    }

    renderEditableCell(tableId, rowIndex, column, value) {
        const cellId = `${tableId}_row${rowIndex}_${column.field}`;
        
        switch (column.type || 'text') {
            case 'select':
                const options = column.options || [];
                let selectHtml = `<select class="datatable-input" id="${cellId}" onchange="window.AppModules.fieldTypes.updateDataTableCell('${tableId}', ${rowIndex}, '${column.field}', this.value)">`;
                selectHtml += '<option value="">-- Select --</option>';
                options.forEach(option => {
                    const optionValue = typeof option === 'string' ? option : option.value;
                    const optionLabel = typeof option === 'string' ? option : option.label;
                    selectHtml += `<option value="${optionValue}" ${value === optionValue ? 'selected' : ''}>${optionLabel}</option>`;
                });
                selectHtml += '</select>';
                return selectHtml;
                
            case 'checkbox':
                return `<input type="checkbox" class="datatable-input" id="${cellId}" ${value ? 'checked' : ''} onchange="window.AppModules.fieldTypes.updateDataTableCell('${tableId}', ${rowIndex}, '${column.field}', this.checked)">`;
                
            case 'number':
                return `<input type="number" class="datatable-input" id="${cellId}" value="${value}" onchange="window.AppModules.fieldTypes.updateDataTableCell('${tableId}', ${rowIndex}, '${column.field}', this.value)">`;
                
            case 'date':
                return `<input type="date" class="datatable-input" id="${cellId}" value="${value}" onchange="window.AppModules.fieldTypes.updateDataTableCell('${tableId}', ${rowIndex}, '${column.field}', this.value)">`;
                
            default: // text
                return `<input type="text" class="datatable-input" id="${cellId}" value="${value}" onchange="window.AppModules.fieldTypes.updateDataTableCell('${tableId}', ${rowIndex}, '${column.field}', this.value)">`;
        }
    }

    formatCellValue(value, column) {
        if (value === null || value === undefined || value === '') {
            return '<span class="datatable-empty-value">-</span>';
        }
        
        switch (column.type || 'text') {
            case 'checkbox':
                return value ? '✓' : '✗';
            case 'date':
                try {
                    return new Date(value).toLocaleDateString();
                } catch {
                    return value;
                }
            case 'number':
                return typeof value === 'number' ? value.toLocaleString() : value;
            default:
                return String(value);
        }
    }

    getDataTableData(field) {
        const config = field.dataTableConfig || {};
        debugInfo("FieldTypes", '🔍 [DATATABLE DEBUG] getDataTableData called for field:', field.id);
        debugInfo("FieldTypes", '🔍 [DATATABLE DEBUG] Timestamp:', new Date().toISOString());
        debugInfo("FieldTypes", '🔍 [DATATABLE DEBUG] Config:', {
            dataSource: config.dataSource,
            sourceVariable: config.sourceVariable,
            sourcePageId: config.sourcePageId,
            hasStaticData: !!(config.staticData && Array.isArray(config.staticData)),
            staticDataLength: config.staticData ? config.staticData.length : 0
        });
        
        // Check if FormVariables system is available
        if (!window.FormVariables) {
            debugError("FieldTypes", '❌ [DATATABLE DEBUG] FormVariables system not available!');
            debugError("FieldTypes", '❌ [DATATABLE DEBUG] window.FormVariables is:', window.FormVariables);
            return [];
        }
        
        const allVariables = window.FormVariables.getAll();
        debugInfo("FieldTypes", '🌐 [DATATABLE DEBUG] Total variables available:', Object.keys(allVariables).length);
        debugInfo("FieldTypes", '🌐 [DATATABLE DEBUG] Variable keys:', Object.keys(allVariables));
        
        // Enhanced variable preview with more details
        const variablePreview = {};
        Object.entries(allVariables).forEach(([key, value]) => {
            if (typeof value === 'string') {
                variablePreview[key] = {
                    type: 'string',
                    length: value.length,
                    preview: value.length > 100 ? `${value.substring(0, 100)}...` : value,
                    isJSON: value.startsWith('[') || value.startsWith('{')
                };
            } else {
                variablePreview[key] = {
                    type: typeof value,
                    value: value
                };
            }
        });
        debugInfo("FieldTypes", '🌐 [DATATABLE DEBUG] Variable details:', variablePreview);
        
        // Try to get data from various sources
        
        // 1. From static configuration
        if (config.staticData && Array.isArray(config.staticData) && config.staticData.length > 0) {
            debugInfo("FieldTypes", '📊 [DATATABLE DEBUG] Using static data:', config.staticData.length, 'records');
            debugInfo("FieldTypes", '📊 [DATATABLE DEBUG] Static data sample:', config.staticData.slice(0, 2));
            return config.staticData;
        }
        
        // 2. From variable (typically populated by Get Records)
        if (config.dataSource === 'variable' && config.sourceVariable) {
            const variableData = allVariables[config.sourceVariable];
            debugInfo("FieldTypes", `🔍 [DATATABLE DEBUG] Looking for variable "${config.sourceVariable}":`, {
                found: !!variableData,
                type: typeof variableData,
                isString: typeof variableData === 'string',
                length: variableData?.length || 0,
                preview: typeof variableData === 'string' && variableData.length > 100 ? 
                    `${variableData.substring(0, 100)}...` : variableData
            });
            
            if (variableData) {
                try {
                    const parsedData = typeof variableData === 'string' ? JSON.parse(variableData) : variableData;
                    debugInfo("FieldTypes", '📊 [DATATABLE DEBUG] Successfully parsed variable data:', {
                        isArray: Array.isArray(parsedData),
                        length: parsedData?.length || 0,
                        sample: Array.isArray(parsedData) ? parsedData.slice(0, 2) : parsedData
                    });
                    return Array.isArray(parsedData) ? parsedData : [];
                } catch (e) {
                    debugError("FieldTypes", '❌ [DATATABLE DEBUG] Failed to parse DataTable variable data:', e);
                    debugError("FieldTypes", '❌ [DATATABLE DEBUG] Raw variable data:', variableData);
                    return [];
                }
            } else {
                debugWarn("FieldTypes", '⚠️ [DATATABLE DEBUG] Variable not found, checking for similar variables...');
                const similarVariables = Object.keys(allVariables).filter(key => 
                    key.includes(config.sourceVariable) || 
                    config.sourceVariable.includes(key) ||
                    key.includes('QueryResults')
                );
                debugInfo("FieldTypes", '🔍 [DATATABLE DEBUG] Similar variables found:', similarVariables);
            }
        }
        
        // 3. From Get Records page results
        if (config.dataSource === 'query' && config.sourcePageId) {
            const queryResultsVar = `${config.sourcePageId}_QueryResults`;
            const queryData = allVariables[queryResultsVar];
            debugInfo("FieldTypes", `🔍 [DATATABLE DEBUG] Looking for query variable "${queryResultsVar}":`, {
                found: !!queryData,
                type: typeof queryData,
                isString: typeof queryData === 'string',
                length: queryData?.length || 0,
                preview: typeof queryData === 'string' && queryData.length > 100 ? 
                    `${queryData.substring(0, 100)}...` : queryData
            });
            
            if (queryData) {
                try {
                    const parsedData = typeof queryData === 'string' ? JSON.parse(queryData) : queryData;
                    debugInfo("FieldTypes", '📊 [DATATABLE DEBUG] Successfully parsed query data:', {
                        isArray: Array.isArray(parsedData),
                        length: parsedData?.length || 0,
                        sample: Array.isArray(parsedData) ? parsedData.slice(0, 2) : parsedData
                    });
                    return Array.isArray(parsedData) ? parsedData : [];
                } catch (e) {
                    debugError("FieldTypes", '❌ [DATATABLE DEBUG] Failed to parse DataTable query data:', e);
                    debugError("FieldTypes", '❌ Raw query data:', queryData);
                    return [];
                }
            } else {
                debugWarn("FieldTypes", '⚠️ [DATATABLE DEBUG] Query variable not found, checking for similar variables...');
                const queryRelatedVariables = Object.keys(allVariables).filter(key => 
                    key.includes(config.sourcePageId) || 
                    key.includes('QueryResults') ||
                    key.includes('QueryCount')
                );
                debugInfo("FieldTypes", '🔍 [DATATABLE DEBUG] Query-related variables found:', queryRelatedVariables);
                
                // Try common variations
                const possibleVariations = [
                    `${config.sourcePageId}_QueryResults`,
                    `QueryResults_${config.sourcePageId}`,
                    `${config.sourcePageId}QueryResults`,
                    `page_${config.sourcePageId}_QueryResults`
                ];
                
                for (const variation of possibleVariations) {
                    const variationData = allVariables[variation];
                    if (variationData) {
                        debugInfo("FieldTypes", `🎯 [DATATABLE DEBUG] Found data in variation "${variation}"`);
                        try {
                            const parsedData = typeof variationData === 'string' ? JSON.parse(variationData) : variationData;
                            debugInfo("FieldTypes", '📊 [DATATABLE DEBUG] Successfully parsed variation data:', {
                                isArray: Array.isArray(parsedData),
                                length: parsedData?.length || 0,
                                sample: Array.isArray(parsedData) ? parsedData.slice(0, 2) : parsedData
                            });
                            return Array.isArray(parsedData) ? parsedData : [];
                        } catch (e) {
                            debugError("FieldTypes", '❌ [DATATABLE DEBUG] Failed to parse variation data:', e);
                        }
                    }
                }
            }
        }
        
        // 4. During design time, show sample data if configured with Get Records
        if (config.dataSource === 'query' && config.sourcePageId && config.columns && config.columns.length > 0) {
            debugInfo("FieldTypes", '🎨 [DATATABLE DEBUG] Design time: generating sample data for preview');
            return this.generateSampleDataForPreview(config.columns);
        }
        
        // Final fallback - provide diagnostic info
        debugError("FieldTypes", '📭 [DATATABLE DEBUG] NO DATA FOUND for DataTable!');
        debugError("FieldTypes", '📭 [DATATABLE DEBUG] Expected data sources:');
        debugError("FieldTypes", '   - Static data:', !!(config.staticData && Array.isArray(config.staticData)));
        debugError("FieldTypes", '   - Variable source:', config.dataSource === 'variable', config.sourceVariable);
        debugError("FieldTypes", '   - Query source:', config.dataSource === 'query', config.sourcePageId);
        debugError("FieldTypes", '📭 [DATATABLE DEBUG] Available variables:', Object.keys(allVariables));
        debugError("FieldTypes", '📭 [DATATABLE DEBUG] DataTable config:', config);
        
        // Return empty array
        return [];
    }

    // Global method to refresh all DataTables on the current page
    refreshAllDataTables() {
        debugInfo("FieldTypes", '🔄 Refreshing all DataTables...');
        const dataTables = document.querySelectorAll('.datatable-field');
        let refreshCount = 0;
        
        dataTables.forEach(element => {
            const fieldId = element.dataset.fieldId;
            if (fieldId) {
                const field = this.findFieldById(fieldId);
                if (field && field.type === 'datatable') {
                    debugInfo("FieldTypes", `🔄 Refreshing DataTable ${fieldId}...`);
                    this.refreshDataTable(field);
                    refreshCount++;
                }
            }
        });
        
        debugInfo("FieldTypes", `✅ Refreshed ${refreshCount} DataTables`);
        return refreshCount;
    }

    // Helper method to find field by ID (for cases where we need the full field object)
    // Removed duplicate findFieldById method - using the enhanced version above

    generateSampleDataForPreview(columns) {
        // Generate 2-3 sample rows for design time preview
        const sampleData = [];
        
        for (let i = 0; i < 3; i++) {
            const row = {};
            columns.forEach(column => {
                switch (column.type) {
                    case 'date':
                        row[column.field] = new Date().toISOString().split('T')[0];
                        break;
                    case 'number':
                        row[column.field] = Math.floor(Math.random() * 1000);
                        break;
                    case 'checkbox':
                        row[column.field] = Math.random() > 0.5;
                        break;
                    default:
                        if (column.field.toLowerCase().includes('name')) {
                            row[column.field] = `Sample ${column.field} ${i + 1}`;
                        } else if (column.field.toLowerCase().includes('email')) {
                            row[column.field] = `sample${i + 1}@example.com`;
                        } else {
                            row[column.field] = `Sample ${i + 1}`;
                        }
                        break;
                }
            });
            sampleData.push(row);
        }
        
        return sampleData;
    }

    setupDataTableVariableWatching(field) {
        const config = field.dataTableConfig || {};
        
        // Only watch for variables if using variable or query data source
        if (config.dataSource !== 'variable' && config.dataSource !== 'query') {
            return;
        }
        
        // Determine which variables to watch
        const variablesToWatch = [];
        
        if (config.dataSource === 'variable' && config.sourceVariable) {
            variablesToWatch.push(config.sourceVariable);
        }
        
        if (config.dataSource === 'query' && config.sourcePageId) {
            variablesToWatch.push(`${config.sourcePageId}_QueryResults`);
            variablesToWatch.push(`${config.sourcePageId}_QueryCount`);
        }
        
        if (variablesToWatch.length === 0) {
            return;
        }
        
        debugInfo("FieldTypes", `🔍 Setting up DataTable variable watching for field ${field.id}, watching:`, variablesToWatch);
        
        // Listen for variable changes
        const handleVariableChange = (event) => {
            const { name, newValue } = event.detail;
            
            if (variablesToWatch.includes(name)) {
                debugInfo("FieldTypes", `🔄 DataTable ${field.id} detected variable change: ${name} =`, newValue);
                this.refreshDataTable(field);
            }
        };
        
        // Add event listener
        document.addEventListener('variableChanged', handleVariableChange);
        
        // Store cleanup function on the field for removal later
        field._variableCleanup = () => {
            document.removeEventListener('variableChanged', handleVariableChange);
        };
    }

    refreshDataTable(field) {
        debugInfo("FieldTypes", `🔄 Refreshing DataTable ${field.id}...`);
        
        const tbody = document.getElementById(`${field.id}_tbody`);
        if (!tbody) {
            debugWarn("FieldTypes", `❌ DataTable tbody not found for field ${field.id}`);
            return;
        }
        
        // Get fresh data
        const data = this.getDataTableData(field);
        debugInfo("FieldTypes", `📊 DataTable ${field.id} refresh data:`, data?.length || 0, 'records');
        
        // Re-render table body with new data
        tbody.innerHTML = this.renderDataTableBody(field);
        debugInfo("FieldTypes", `✅ Refreshed DataTable ${field.id} with new data`);
        
        // If still no data, set up a delayed retry (for cases where variables are set asynchronously)
        if (!data || data.length === 0) {
            debugInfo("FieldTypes", `⏰ DataTable ${field.id} has no data, setting up delayed retry...`);
            setTimeout(() => {
                const retryData = this.getDataTableData(field);
                if (retryData && retryData.length > 0) {
                    debugInfo("FieldTypes", `🔄 DataTable ${field.id} delayed retry found data:`, retryData.length, 'records');
                    tbody.innerHTML = this.renderDataTableBody(field);
                }
            }, 500);
        }
    }

    // DataTable interaction methods
    addDataTableRow(fieldId) {
        const field = this.findFieldById(fieldId);
        if (!field || !field.dataTableConfig) return;
        
        const config = field.dataTableConfig;
        const tbody = document.getElementById(`${fieldId}_tbody`);
        if (!tbody) return;
        
        // Create empty row data
        const newRow = {};
        (config.columns || []).forEach(column => {
            newRow[column.field] = column.defaultValue || '';
        });
        
        // Add to data source
        if (!config.staticData) config.staticData = [];
        config.staticData.push(newRow);
        
        // Re-render table body
        tbody.innerHTML = this.renderDataTableBody(field);
        
        debugInfo("FieldTypes", 'Added new row to DataTable:', fieldId);
    }

    editDataTableRow(fieldId, rowIndex) {
        debugInfo("FieldTypes", `Edit row ${rowIndex} in table ${fieldId}`);
        // Future: Could open a modal or enable inline editing
    }

    deleteDataTableRow(fieldId, rowIndex) {
        if (!confirm('Are you sure you want to delete this row?')) return;
        
        const field = this.findFieldById(fieldId);
        if (!field || !field.dataTableConfig) return;
        
        const config = field.dataTableConfig;
        const tbody = document.getElementById(`${fieldId}_tbody`);
        if (!tbody) return;
        
        // Remove from data source
        if (config.staticData && Array.isArray(config.staticData)) {
            config.staticData.splice(rowIndex, 1);
        }
        
        // Re-render table body
        tbody.innerHTML = this.renderDataTableBody(field);
        
        debugInfo("FieldTypes", `Deleted row ${rowIndex} from DataTable:`, fieldId);
    }

    updateDataTableCell(fieldId, rowIndex, fieldName, value) {
        const field = this.findFieldById(fieldId);
        if (!field || !field.dataTableConfig) return;
        
        const config = field.dataTableConfig;
        
        // Update data source
        if (!config.staticData) config.staticData = [];
        if (!config.staticData[rowIndex]) config.staticData[rowIndex] = {};
        
        config.staticData[rowIndex][fieldName] = value;
        
        debugInfo("FieldTypes", `Updated cell [${rowIndex}][${fieldName}] = ${value} in table ${fieldId}`);
    }

    changeDataTablePage(fieldId, direction) {
        debugInfo("FieldTypes", `Change page ${direction} for table ${fieldId}`);
        // Future: Implement pagination
    }

    // DataTable Full Screen functionality
    toggleDataTableFullscreen(fieldId) {
        const dataTableElement = document.querySelector(`.datatable-field[data-field-id="${fieldId}"]`);
        const fullscreenBtn = dataTableElement.querySelector('.datatable-fullscreen-btn');
        
        if (!dataTableElement) {
            debugError("FieldTypes", 'DataTable element not found for field:', fieldId);
            return;
        }
        
        if (dataTableElement.classList.contains('datatable-fullscreen')) {
            // Exit full screen
            this.exitDataTableFullscreen(fieldId);
        } else {
            // Enter full screen
            this.enterDataTableFullscreen(fieldId);
        }
    }
    
    enterDataTableFullscreen(fieldId) {
        const dataTableElement = document.querySelector(`.datatable-field[data-field-id="${fieldId}"]`);
        const fullscreenBtn = dataTableElement.querySelector('.datatable-fullscreen-btn');
        
        // Add full screen class
        dataTableElement.classList.add('datatable-fullscreen');
        
        // Update button text and icon
        fullscreenBtn.innerHTML = '🔙 Exit Full Screen';
        fullscreenBtn.title = 'Exit Full Screen';
        
        // Add overlay to body to prevent scrolling
        document.body.classList.add('datatable-fullscreen-active');
        
        // Add ESC key listener
        this.addFullscreenKeyListener(fieldId);
        
        debugInfo("FieldTypes", '📊 DataTable entered full screen mode:', fieldId);
    }
    
    exitDataTableFullscreen(fieldId) {
        const dataTableElement = document.querySelector(`.datatable-field[data-field-id="${fieldId}"]`);
        const fullscreenBtn = dataTableElement.querySelector('.datatable-fullscreen-btn');
        
        // Remove full screen class
        dataTableElement.classList.remove('datatable-fullscreen');
        
        // Update button text and icon
        fullscreenBtn.innerHTML = '🔍 Full Screen';
        fullscreenBtn.title = 'Full Screen';
        
        // Remove overlay from body
        document.body.classList.remove('datatable-fullscreen-active');
        
        // Remove ESC key listener
        this.removeFullscreenKeyListener();
        
        debugInfo("FieldTypes", '📊 DataTable exited full screen mode:', fieldId);
    }
    
    addFullscreenKeyListener(fieldId) {
        // Remove any existing listener first
        this.removeFullscreenKeyListener();
        
        // Add new listener
        this.fullscreenKeyListener = (e) => {
            if (e.key === 'Escape') {
                this.exitDataTableFullscreen(fieldId);
            }
        };
        
        document.addEventListener('keydown', this.fullscreenKeyListener);
    }
    
    removeFullscreenKeyListener() {
        if (this.fullscreenKeyListener) {
            document.removeEventListener('keydown', this.fullscreenKeyListener);
            this.fullscreenKeyListener = null;
        }
    }
    
    renderSectionField(field) {
        const config = field.sectionConfig || {};
        const isCollapsed = config.collapsed && config.collapsible;
        
        return `
            <div class="section-container" data-section-id="${field.id}">
                <div class="section-header ${config.collapsible ? 'collapsible' : ''}" 
                     ${config.collapsible ? `onclick="window.AppModules.fieldTypes.toggleSection('${field.id}')"` : ''}>
                    ${config.collapsible ? `<span class="section-toggle">${isCollapsed ? '▶' : '▼'}</span>` : ''}
                    <h3 class="section-title">${config.title || 'Section'}</h3>
                    ${config.description ? `<p class="section-description">${config.description}</p>` : ''}
                </div>
                <div class="section-content ${isCollapsed ? 'collapsed' : ''}" 
                     style="display: ${isCollapsed ? 'none' : 'block'}; 
                            background-color: ${config.backgroundColor || 'transparent'}; 
                            padding: ${this.getPaddingValue(config.padding)};
                            ${config.showBorder ? 'border: 1px solid var(--notion-gray-200);' : ''}">
                    <div class="section-fields-dropzone" data-section-id="${field.id}">
                        ${config.fields && config.fields.length > 0 ? 
                            config.fields.map(nestedField => this.renderNestedField(nestedField)).join('') :
                            '<div class="empty-section">Drag fields here</div>'
                        }
                    </div>
                </div>
            </div>
        `;
    }
    
    renderColumnsField(field) {
        const config = field.columnsConfig || {};
        debugInfo("FieldTypes", '📋 renderColumnsField called for:', field.id);
        debugInfo("FieldTypes", '📋 Columns config:', config);
        
        // Ensure columns array exists
        if (!config.columns || !Array.isArray(config.columns)) {
            debugWarn("FieldTypes", '⚠️ No columns array found, creating default columns');
            config.columns = [
                { width: '50%', fields: [] },
                { width: '50%', fields: [] }
            ];
            field.columnsConfig = config;
        }
        
        const html = `
            <div class="columns-container ${config.mobileStack ? 'mobile-stack' : ''}" 
                 data-columns-id="${field.id}">
                <div class="columns-layout" style="display: grid; 
                     grid-template-columns: ${config.columns.map(col => col.width || '1fr').join(' ')}; 
                     gap: ${this.getGapValue(config.columnGap)};">
                    ${config.columns.map((column, index) => {
                        const fields = column.fields || [];
                        debugInfo("FieldTypes", `📋 Rendering column ${index}:`, {
                            fieldsCount: fields.length,
                            fields: fields
                        });
                        
                        return `
                        <div class="column-dropzone" 
                             data-column-index="${index}" 
                             data-columns-id="${field.id}"
                             style="min-height: 100px; padding: 15px; border: 2px dashed #e0e6ed; border-radius: 8px; background: #f8f9fa; position: relative;">
                            ${fields.length > 0 ? 
                                fields.map(nestedField => {
                                    debugInfo("FieldTypes", '📝 Rendering nested field:', nestedField.id, nestedField.type);
                                    return `<div style="margin-bottom: 15px;">${this.renderNestedField(nestedField)}</div>`;
                                }).join('') :
                                `<div class="empty-column" style="text-align: center; color: #6c757d; padding: 20px; font-style: italic;">
                                    <div style="font-size: 24px; margin-bottom: 10px;">📋</div>
                                    <div>Drop fields here</div>
                                    <div style="font-size: 0.9em; margin-top: 5px;">Column ${index + 1}</div>
                                </div>`
                            }
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        
        debugInfo("FieldTypes", '📋 Generated HTML length:', html.length);
        debugInfo("FieldTypes", '📋 HTML preview:', html.substring(0, 200) + '...');
        return html;
    }
    
    toggleSection(sectionId) {
        const section = document.querySelector(`[data-section-id="${sectionId}"]`);
        if (!section) return;
        
        const content = section.querySelector('.section-content');
        const toggle = section.querySelector('.section-toggle');
        
        if (content.classList.contains('collapsed')) {
            content.classList.remove('collapsed');
            content.style.display = 'block';
            if (toggle) toggle.textContent = '▼';
        } else {
            content.classList.add('collapsed');
            content.style.display = 'none';
            if (toggle) toggle.textContent = '▶';
        }
    }
    
    getPaddingValue(padding) {
        const paddingMap = {
            small: 'var(--space-2)',
            medium: 'var(--space-4)',
            large: 'var(--space-6)'
        };
        return paddingMap[padding] || paddingMap.medium;
    }
    
    getGapValue(gap) {
        const gapMap = {
            small: 'var(--space-2)',
            medium: 'var(--space-4)',
            large: 'var(--space-6)'
        };
        return gapMap[gap] || gapMap.medium;
    }

    // Render nested fields with proper field structure
    renderNestedField(field) {
        return `
            <div class="form-field" 
                 data-field-id="${field.id}" 
                 data-field-type="${field.type}"
                 draggable="true">
                <div class="field-header">
                    <label class="field-label">
                        ${field.label}
                        ${field.required ? '<span class="field-required">*</span>' : ''}
                    </label>
                    <div class="field-controls">
                        ${field.conditionalVisibility?.enabled ? 
                            '<span class="visibility-icon" title="Conditional visibility enabled">👁️</span>' : ''}
                        <button class="field-delete-btn" data-field-id="${field.id}" title="Delete field">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="m18 6-12 12M6 6l12 12"/>
                            </svg>
                        </button>
                    </div>
                </div>
                ${this.renderField(field)}
                ${field.helpText ? `<div class="field-help">${field.helpText}</div>` : ''}
            </div>
        `;
    }

    // findFieldById method moved above to avoid duplication
}