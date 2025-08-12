// FormBuilder Module - Core form building functionality

const { debugError, debugWarn, debugInfo, debugDebug, debugVerbose } = window.SFBDebug;

export class FormBuilder {
    constructor() {
        this.currentForm = {
            id: null,
            name: 'Untitled Form',
            description: '',
            pages: [{
                id: 'page_1',
                name: 'Page 1',
                fields: [],
                salesforceObject: null,
                actionType: 'create', // 'create' or 'update'
                hiddenFields: [],
                conditionalVisibility: {
                    enabled: false,
                    conditions: [], // Array of conditions
                    logic: 'AND' // AND or OR
                },
                repeatConfig: null,
                variables: new Map(),
                navigationConfig: { // Page-level navigation button visibility
                    next: {
                        conditionalVisibility: {
                            enabled: false,
                            conditions: [],
                            logic: 'AND'
                        }
                    },
                    submit: {
                        conditionalVisibility: {
                            enabled: false,
                            conditions: [],
                            logic: 'AND'
                        }
                    }
                }
            }],
            settings: {
                submitButtonText: 'Submit',
                successMessage: 'Thank you for your submission!',
                redirectUrl: '',
                requireAuth: false,
                customCSS: '',
                theme: 'light'
            }
        };
        
        this.currentPageIndex = 0;
        this.selectedField = null;
        this.fieldIdCounter = 1;
        
        // Initialize caches for lookup field functionality
        this.lookupObjectFieldsCache = {};
    }
    
    async initialize() {
        debugInfo('FormBuilder', 'Initializing FormBuilder module...');
        this.setupEventListeners();
        this.renderFormCanvas();
        
        // Show properties panel and form properties by default
        this.switchPropertyTab('form');
        
    }
    
    setupEventListeners() {
        // Field selection and deletion
        document.addEventListener('click', (e) => {
            if (e.target.closest('.field-delete-btn')) {
                e.stopPropagation();
                const fieldId = e.target.closest('.field-delete-btn').dataset.fieldId;
                this.deleteField(fieldId);
            } else if (e.target.closest('.form-field')) {
                this.selectField(e.target.closest('.form-field'));
            } else if (!e.target.closest('.properties-panel')) {
                this.deselectField();
            }
        });
        
        // Page tab clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.page-tab')) {
                const pageId = e.target.closest('.page-tab').dataset.pageId;
                this.switchToPage(pageId);
            }
        });

        // Property tab clicks
        document.addEventListener('click', (e) => {
            if (e.target.closest('.property-tab')) {
                e.preventDefault();
                e.stopPropagation();
                const tabType = e.target.closest('.property-tab').dataset.tab;
                debugInfo('FormBuilder', 'Switching to property tab:', tabType);
                this.switchPropertyTab(tabType);
            }
        });
        
        // Form state changes
        document.addEventListener('fieldAdded', () => this.markFormDirty());
        document.addEventListener('fieldUpdated', () => this.markFormDirty());
        document.addEventListener('fieldRemoved', () => this.markFormDirty());
        document.addEventListener('pageAdded', () => this.markFormDirty());
        document.addEventListener('pageRemoved', () => this.markFormDirty());
    }
    
    renderFormCanvas() {
        debugInfo('FormBuilder', '🔄 renderFormCanvas called');
        const canvas = document.getElementById('formCanvas');
        const currentPage = this.getCurrentPage();
        
        // Debug: Log current DOM state before render
        const existingColumns = document.querySelectorAll('.column-dropzone');
        debugInfo('FormBuilder', '📊 Before render - existing columns in DOM:', existingColumns.length);
        existingColumns.forEach((col, i) => {
            debugInfo("FormBuilder", `  Column ${i}:`, col.dataset.columnsId, col.dataset.columnIndex);
        });
        
        if (!currentPage.fields || currentPage.fields.length === 0) {
            canvas.innerHTML = `
                <div class="empty-state">
                    <div class="pilotforms-logo">
                        <div class="logo-icon">🚀</div>
                        <h1 class="logo-text">PilotForms</h1>
                        <div class="logo-tagline">Enterprise Form Builder</div>
                    </div>
                    <h2>✨ Start Building Your Form</h2>
                    <p>🔗 Connect to Salesforce and 🎯 drag fields from the sidebar to begin creating your professional form!</p>
                    <div class="canvas-features">
                        <span class="feature-badge">📋 Multi-Page</span>
                        <span class="feature-badge">✍️ E-Signatures</span>
                        <span class="feature-badge">🔄 Conditional Logic</span>
                        <span class="feature-badge">📱 Mobile Ready</span>
                    </div>
                </div>
            `;
        } else {
            debugInfo('FormBuilder', '🔄 Rendering fields', { fieldsCount: currentPage.fields.length });
            canvas.innerHTML = '';
            currentPage.fields.forEach((field, index) => {
                debugInfo('FormBuilder', `📝 Rendering field ${index}:`, { fieldId: field.id, fieldType: field.type });
                canvas.appendChild(this.createFieldElement(field));
            });
        }
        
        // Debug: Log DOM state after render
        const newColumns = document.querySelectorAll('.column-dropzone');
        debugInfo('FormBuilder', '📊 After render - columns in DOM:', newColumns.length);
        newColumns.forEach((col, i) => {
            debugInfo("FormBuilder", `  Column ${i}:`, col.dataset.columnsId, col.dataset.columnIndex);
            const fieldsInColumn = col.querySelectorAll('.form-field');
            debugInfo("FormBuilder", `    Fields in column: ${fieldsInColumn.length}`);
        });
        
        this.renderPageTabs();
        
        // Ensure container drag and drop listeners are set up
        setTimeout(() => {
            if (window.AppModules.dragDrop) {
                debugInfo("FormBuilder", '🔧 FormBuilder: Setting up container listeners after render');
                window.AppModules.dragDrop.setupContainerListeners();
            }
            
            // Apply field styling after DOM is ready
            this.applyAllFieldStyling();
        }, 200);
    }
    
    renderPageTabs() {
        const tabsContainer = document.getElementById('pageTabs');
        tabsContainer.innerHTML = '';
        
        this.currentForm.pages.forEach((page, index) => {
            const tab = document.createElement('div');
            tab.className = 'page-tab';
            if (index === this.currentPageIndex) {
                tab.classList.add('active');
            }
            tab.dataset.pageId = page.id;
            tab.dataset.pageIndex = index;
            tab.draggable = true;
            
            tab.innerHTML = `
                <span contenteditable="true" class="page-name" 
                      onblur="window.AppModules.formBuilder.updatePageName('${page.id}', this.textContent)">
                    ${page.name}
                </span>
                ${this.currentForm.pages.length > 1 ? 
                    `<span class="close-tab" onclick="window.AppModules.formBuilder.removePage('${page.id}')">×</span>` : 
                    ''}
            `;
            
            tabsContainer.appendChild(tab);
        });
        
        // Add the "Add Page" button
        const addPageBtn = document.createElement('button');
        addPageBtn.className = 'add-page-btn';
        addPageBtn.innerHTML = `
            <span class="add-icon">+</span>
            <span class="add-text">Add Page</span>
        `;
        addPageBtn.onclick = () => {
            if (window.AppModules.multiPage) {
                window.AppModules.multiPage.addPage();
            }
        };
        
        tabsContainer.appendChild(addPageBtn);
        
        // Always show tabs container when connected to Salesforce
        tabsContainer.style.display = window.AppState?.salesforceConnected ? 'flex' : 'none';
        
        // Setup drag and drop functionality for page tabs
        this.setupPageTabDragAndDrop();
    }
    
    createFieldElement(field) {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = 'form-field';
        fieldDiv.dataset.fieldId = field.id;
        fieldDiv.draggable = true;
        
        // Add visual indicator for conditional fields
        if (field.conditionalVisibility?.enabled) {
            fieldDiv.classList.add('conditional');
        }
        
        fieldDiv.innerHTML = `
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
            ${this.renderFieldByType(field)}
            ${field.helpText ? `<div class="field-help">${field.helpText}</div>` : ''}
        `;
        
        // Add field-specific event listeners
        this.attachFieldEventListeners(fieldDiv, field);
        
        return fieldDiv;
    }
    
    renderFieldByType(field) {
        const fieldTypes = window.AppModules.fieldTypes;
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
                return `<input type="${field.type}" placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}>`;
            
            case 'textarea':
                return `<textarea placeholder="${field.placeholder || ''}" ${field.required ? 'required' : ''}></textarea>`;
            
            case 'select':
                return `
                    <select ${field.required ? 'required' : ''}>
                        <option value="">Choose...</option>
                        ${(field.options || []).map(opt => 
                            `<option value="${opt.value}">${opt.label}</option>`
                        ).join('')}
                    </select>
                `;
            
            case 'checkbox':
                return `
                    <label>
                        <input type="checkbox" ${field.required ? 'required' : ''}>
                        ${field.checkboxLabel || 'Check this box'}
                    </label>
                `;
            
            case 'radio':
                return `
                    <div class="radio-group">
                        ${(field.options || []).map((opt, idx) => `
                            <label>
                                <input type="radio" name="${field.id}" value="${opt.value}" 
                                       ${idx === 0 && field.required ? 'required' : ''}>
                                ${opt.label}
                            </label>
                        `).join('')}
                    </div>
                `;
            
            default:
                return `<div class="field-placeholder">${field.type} field</div>`;
        }
    }
    
    attachFieldEventListeners(fieldElement, field) {
        // Drag start
        fieldElement.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('fieldId', field.id);
            fieldElement.classList.add('dragging');
        });
        
        // Drag end
        fieldElement.addEventListener('dragend', () => {
            fieldElement.classList.remove('dragging');
        });
    }
    
    addField(fieldType, targetIndex = null) {
        const field = {
            id: `field_${this.fieldIdCounter++}`,
            type: fieldType,
            label: this.getDefaultLabel(fieldType),
            placeholder: '',
            required: false,
            helpText: '',
            salesforceField: null,
            conditionalVisibility: {
                enabled: false,
                dependsOn: null,
                condition: 'equals',
                value: ''
            }
        };
        
        // Add type-specific properties
        switch (fieldType) {
            case 'select':
            case 'radio':
                field.options = [
                    { label: 'Option 1', value: 'option1' },
                    { label: 'Option 2', value: 'option2' }
                ];
                field.usePicklist = false;
                field.picklistObject = null;
                field.picklistField = null;
                break;
            
            case 'checkbox':
                field.checkboxLabel = 'Check this box';
                break;
            
            case 'lookup':
                field.lookupObject = null;
                field.displayField = 'Name';
                field.searchField = 'Name';
                field.lookupFilters = []; // Array of filter objects {field, operator, value}
                field.maxResults = 10;
                break;
            
            case 'richtext':
                field.content = '';
                field.editorHeight = 200;
                break;
            
            case 'signature':
                field.signatureConfig = {
                    width: 500,
                    height: 200,
                    penColor: '#000000',
                    backgroundColor: '#ffffff',
                    requireLegalText: true,
                    legalText: 'By signing below, I agree to the terms and conditions.',
                    requireFullName: true,
                    requireEmail: true,
                    requireDate: true
                };
                break;
            
            case 'file':
                field.maxFileSize = 10485760; // 10MB
                field.allowedTypes = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
                field.multiple = false;
                field.salesforceField = null; // Files are attached as ContentDocuments
                break;
            
            case 'signature':
                field.salesforceField = null; // Signatures are attached as ContentDocuments
                break;
            
            case 'display':
                field.displayContent = '<p>Enter your text here...</p>';
                field.salesforceField = null; // Display fields don't map to Salesforce
                break;
                
            case 'login':
                field.loginConfig = {
                    title: 'Login Required',
                    instructions: 'Please enter your email address to continue.',
                    successMessage: 'Login successful! You can now continue.',
                    newUserMessage: 'Welcome! You can proceed to create your account.',
                    enableOTP: true,
                    enableContactLookup: true,
                    setVariables: {
                        'isLoggedIn': 'true',
                        'contactId': '{{Contact.Id}}',
                        'contactName': '{{Contact.Name}}',
                        'contactEmail': '{{Contact.Email}}'
                    }
                };
                field.salesforceField = null; // Login fields don't map to Salesforce directly
                break;
                
            case 'email-verify':
                field.verifyConfig = {
                    title: 'Email Verification',
                    instructions: 'Enter your email address and click verify to continue.',
                    buttonText: 'Verify Email',
                    successMessage: 'Email verified successfully!',
                    resendText: 'Resend Code',
                    requiredToSubmit: true,
                    enableContactLookup: false,
                    requireExistingContact: false,
                    contactNotFoundMessage: 'No account found with this email address.',
                    setVariables: {
                        'emailVerified': 'true',
                        'verifiedEmail': '{{email}}'
                    }
                };
                field.salesforceField = null; // Verify fields don't map to Salesforce directly
                break;
                
            case 'datatable':
                field.dataTableConfig = {
                    title: 'Data Table',
                    description: '',
                    dataSource: 'static', // 'static', 'variable', 'query'
                    sourceVariable: '', // For variable data source
                    sourcePageId: '', // For query data source
                    columns: [
                        {
                            field: 'name',
                            label: 'Name',
                            type: 'text',
                            editable: true,
                            sortable: true,
                            defaultValue: ''
                        },
                        {
                            field: 'value',
                            label: 'Value',
                            type: 'text',
                            editable: true,
                            sortable: false,
                            defaultValue: ''
                        }
                    ],
                    staticData: [],
                    allowAdd: true,
                    allowEdit: true,
                    allowDelete: true,
                    showPagination: false,
                    pageSize: 10
                };
                field.salesforceField = null; // DataTable fields don't map to Salesforce directly
                break;
                
            case 'section':
                field.sectionConfig = {
                    title: 'Section',
                    description: '',
                    collapsible: false,
                    collapsed: false,
                    showBorder: true,
                    backgroundColor: '',
                    padding: 'medium', // small, medium, large
                    fields: [] // Nested fields within the section
                };
                break;
                
            case 'columns':
                field.columnsConfig = {
                    columnCount: 2,
                    columnGap: 'medium', // small, medium, large
                    mobileStack: true, // Stack columns on mobile
                    columns: [
                        { width: '50%', fields: [] },
                        { width: '50%', fields: [] }
                    ]
                };
                break;
        }
        
        const currentPage = this.getCurrentPage();
        if (targetIndex !== null) {
            currentPage.fields.splice(targetIndex, 0, field);
        } else {
            currentPage.fields.push(field);
        }
        
        document.dispatchEvent(new CustomEvent('fieldAdded', { detail: field }));
        
        // Refresh conditional logic dropdowns if a field with conditional logic is selected
        if (this.selectedField && this.selectedField.conditionalVisibility?.enabled) {
            setTimeout(() => this.showFieldProperties(), 100);
        }
        
        return field;
    }
    
    updateField(fieldId, updates) {
        // Find the field using the enhanced search that looks in nested structures
        const field = this.findFieldById(fieldId);
        
        if (field) {
            Object.assign(field, updates);
            document.dispatchEvent(new CustomEvent('fieldUpdated', { detail: field }));
            
            this.markFormDirty();
        } else {
            debugWarn('FormBuilder', `Field with ID ${fieldId} not found for update`);
        }
    }
    
    deleteField(fieldId) {
        // Find the field anywhere in the form structure
        const field = this.findFieldById(fieldId);
        
        if (field && confirm(`Are you sure you want to delete the "${field.label}" field?`)) {
            this.removeField(fieldId);
            
            // Clear selection if this field was selected
            if (this.selectedField && this.selectedField.id === fieldId) {
                this.deselectField();
            } else if (this.selectedField && this.selectedField.conditionalVisibility?.enabled) {
                // Refresh conditional logic dropdowns if a field with conditional logic is selected
                setTimeout(() => this.showFieldProperties(), 100);
            }
        }
    }
    
    removeField(fieldId) {
        // Use the enhanced removal method that handles nested fields
        const removedField = this.removeFieldFromAnyLocation(fieldId);
        
        if (removedField) {
            this.renderFormCanvas(); // Re-render the form to update UI
            this.markFormDirty();
            document.dispatchEvent(new CustomEvent('fieldRemoved', { detail: removedField }));
        }
    }
    
    moveField(fieldId, newIndex) {
        const currentPage = this.getCurrentPage();
        const oldIndex = currentPage.fields.findIndex(f => f.id === fieldId);
        
        if (oldIndex !== -1 && oldIndex !== newIndex) {
            const [field] = currentPage.fields.splice(oldIndex, 1);
            currentPage.fields.splice(newIndex, 0, field);
            document.dispatchEvent(new CustomEvent('fieldMoved', { detail: { field, oldIndex, newIndex } }));
        }
    }
    
    // Methods for handling fields within containers (sections and columns)
    addFieldToContainer(fieldType, containerId, containerType, targetIndex = null) {
        debugInfo("FormBuilder", '🚀 addFieldToContainer called:', { fieldType, containerId, containerType, targetIndex });
        
        // First create the field
        const field = this.createField(fieldType);
        debugInfo("FormBuilder", '📝 Created field:', field);
        
        // Find the container and add the field to it
        if (containerType === 'section') {
            const sectionField = this.findFieldById(containerId);
            if (sectionField && sectionField.type === 'section') {
                if (!sectionField.sectionConfig.fields) {
                    sectionField.sectionConfig.fields = [];
                }
                if (targetIndex !== null && targetIndex >= 0) {
                    sectionField.sectionConfig.fields.splice(targetIndex, 0, field);
                } else {
                    sectionField.sectionConfig.fields.push(field);
                }
                debugInfo("FormBuilder", '✅ Added field to section:', sectionField.sectionConfig.fields);
            }
        } else if (containerType === 'column') {
            // containerId format is "field_X_Y" where X is part of columnsId and Y is columnIndex
            const parts = containerId.split('_');
            const columnIndex = parts.pop(); // Get the last part (column index)
            const columnsId = parts.join('_'); // Join the rest back together
            debugInfo("FormBuilder", '🔍 Column container info:', { columnsId, columnIndex, originalContainerId: containerId });
            
            const columnsField = this.findFieldById(columnsId);
            debugInfo("FormBuilder", '📋 Found columns field:', columnsField);
            
            if (columnsField && columnsField.type === 'columns') {
                const colIndex = parseInt(columnIndex);
                debugInfo("FormBuilder", '📍 Column index:', colIndex);
                debugInfo("FormBuilder", '📋 Columns config:', columnsField.columnsConfig);
                
                if (columnsField.columnsConfig.columns[colIndex]) {
                    if (!columnsField.columnsConfig.columns[colIndex].fields) {
                        columnsField.columnsConfig.columns[colIndex].fields = [];
                    }
                    if (targetIndex !== null && targetIndex >= 0) {
                        columnsField.columnsConfig.columns[colIndex].fields.splice(targetIndex, 0, field);
                    } else {
                        columnsField.columnsConfig.columns[colIndex].fields.push(field);
                    }
                    debugInfo("FormBuilder", '✅ Added field to column:', columnsField.columnsConfig.columns[colIndex].fields);
                    debugInfo("FormBuilder", '🔍 Full columns field after addition:', JSON.stringify(columnsField, null, 2));
                } else {
                    debugError("FormBuilder", '❌ Column not found:', colIndex);
                }
            } else {
                debugError("FormBuilder", '❌ Columns field not found or wrong type:', columnsField);
            }
        }
        
        debugInfo("FormBuilder", '🔄 Re-rendering form canvas...');
        this.markFormDirty();
        document.dispatchEvent(new CustomEvent('fieldAdded', { detail: field }));
        
        return field;
    }
    
    moveFieldToContainer(fieldId, containerId, containerType, targetIndex = null) {
        debugInfo("FormBuilder", '🔄 moveFieldToContainer called:', { fieldId, containerId, containerType, targetIndex });
        
        // Safety check: Don't allow moving a columns field into its own columns
        if (containerType === 'column') {
            const parts = containerId.split('_');
            const columnIndex = parseInt(parts.pop());
            const columnsId = parts.join('_');
            if (fieldId === columnsId) {
                debugWarn("FormBuilder", '⚠️ Cannot move columns field into its own columns');
                return;
            }
        }
        
        const fieldLocation = this.findFieldLocation(fieldId);
        if (!fieldLocation) {
            debugError("FormBuilder", `❌ Field ${fieldId} not found - cannot move to container`);
            return;
        }
        const { field, parentArray, index: oldIndex } = fieldLocation;

        // Determine target array
        let targetArray = null;
        if (containerType === 'section') {
            const sectionField = this.findFieldById(containerId);
            if (sectionField && sectionField.type === 'section') {
                targetArray = sectionField.sectionConfig.fields;
            }
        } else if (containerType === 'column') {
            const parts = containerId.split('_');
            const columnIndex = parseInt(parts.pop());
            const columnsId = parts.join('_');
            const columnsField = this.findFieldById(columnsId);
            if (columnsField && columnsField.type === 'columns' && columnsField.columnsConfig.columns[columnIndex]) {
                targetArray = columnsField.columnsConfig.columns[columnIndex].fields;
            }
        }

        if (!targetArray) {
            debugError("FormBuilder", `❌ Target container ${containerId} not found or invalid type`);
            return;
        }

        // Ensure targetArray.fields exists
        if (!targetArray) {
            targetArray = [];
        }

        // Check if moving within the same array
        if (parentArray === targetArray) {
            debugInfo("FormBuilder", `🔄 Reordering field ${fieldId} within the same array (index ${oldIndex} to ${targetIndex})`);
            // Adjust targetIndex if moving from a lower index to a higher index
            const adjustedTargetIndex = (oldIndex < targetIndex) ? targetIndex - 1 : targetIndex;
            parentArray.splice(oldIndex, 1);
            parentArray.splice(adjustedTargetIndex, 0, field);
        } else {
            debugInfo("FormBuilder", `🔄 Moving field ${fieldId} from one container to another`);
            // Remove from old location
            this.removeFieldFromAnyLocation(fieldId);
            // Add to new location
            if (targetIndex !== null && targetIndex >= 0) {
                targetArray.splice(targetIndex, 0, field);
            } else {
                targetArray.push(field);
            }
        }
        
        this.markFormDirty();
        document.dispatchEvent(new CustomEvent('fieldMoved', { detail: { field, newLocation: { containerId, containerType } } }));
    }
    
    // Helper method to create a field without adding it to the page
    createField(fieldType) {
        // Ensure we don't create duplicate IDs by double-checking
        let newFieldId;
        let attempts = 0;
        do {
            newFieldId = `field_${this.fieldIdCounter++}`;
            attempts++;
            if (attempts > 10) {
                debugError("FormBuilder", '❌ Too many attempts to create unique field ID');
                break;
            }
        } while (this.findFieldById(newFieldId) !== null);
        
        debugInfo("FormBuilder", '🆔 Creating field with ID:', newFieldId, 'Counter now:', this.fieldIdCounter, 'Attempts:', attempts);
        
        const field = {
            id: newFieldId,
            type: fieldType,
            label: this.getDefaultLabel(fieldType),
            placeholder: '',
            required: false,
            helpText: '',
            salesforceField: null,
            conditionalVisibility: {
                enabled: false,
                conditions: [],
                logic: 'AND'
            }
        };
        
        // Add type-specific configurations (same as in addField method)
        switch (fieldType) {
            case 'select':
            case 'radio':
            case 'checkbox':
                field.options = ['Option 1', 'Option 2', 'Option 3'];
                break;
                
            case 'number':
                field.min = '';
                field.max = '';
                field.step = '';
                break;
                
            case 'lookup':
                field.lookupConfig = {
                    sobject: '',
                    displayField: 'Name',
                    valueField: 'Id',
                    searchFields: ['Name'],
                    allowCreate: false,
                    whereClause: '',
                    limit: 10
                };
                break;
                
            case 'rich-text':
                field.richTextConfig = {
                    toolbar: ['bold', 'italic', 'underline', 'link'],
                    height: 200
                };
                break;
                
            case 'signature':
                field.signatureConfig = {
                    width: 500,
                    height: 200,
                    penColor: '#000000',
                    backgroundColor: '#ffffff',
                    requireLegalText: true,
                    legalText: 'By signing below, I agree to the terms and conditions.',
                    requireFullName: true,
                    requireEmail: true,
                    requireDate: true
                };
                break;
                
            case 'file':
                field.maxFileSize = 10485760; // 10MB
                field.allowedTypes = '.pdf,.doc,.docx,.jpg,.jpeg,.png';
                field.multiple = false;
                field.salesforceField = null;
                break;
                
            case 'display':
                field.displayContent = '<p>Enter your text here...</p>';
                field.salesforceField = null;
                break;
                
            case 'login':
                field.loginConfig = {
                    title: 'Login Required',
                    instructions: 'Please enter your email address to continue.',
                    successMessage: 'Login successful! You can now continue.',
                    newUserMessage: 'Welcome! You can proceed to create your account.',
                    enableOTP: true,
                    enableContactLookup: true,
                    setVariables: {
                        'isLoggedIn': 'true',
                        'contactId': '{{Contact.Id}}',
                        'contactName': '{{Contact.Name}}',
                        'contactEmail': '{{Contact.Email}}'
                    }
                };
                field.salesforceField = null;
                break;
                
            case 'email-verify':
                field.emailVerifyConfig = {
                    title: 'Email Verification',
                    instructions: 'Please enter your email address to verify.',
                    successMessage: 'Email verified successfully!',
                    codeLength: 6,
                    codeType: 'numeric', // 'numeric' or 'alphanumeric'
                    enableResend: true,
                    resendDelay: 60
                };
                field.salesforceField = null;
                break;
                
            case 'datatable':
                field.dataTableConfig = {
                    columns: [],
                    data: [],
                    allowAdd: true,
                    allowEdit: true,
                    allowDelete: true,
                    showPagination: false,
                    pageSize: 10
                };
                field.salesforceField = null;
                break;
                
            case 'section':
                field.sectionConfig = {
                    title: 'Section',
                    description: '',
                    collapsible: false,
                    collapsed: false,
                    showBorder: true,
                    backgroundColor: '',
                    padding: 'medium',
                    fields: []
                };
                break;
                
            case 'columns':
                field.columnsConfig = {
                    columnCount: 2,
                    columnGap: 'medium',
                    mobileStack: true,
                    columns: [
                        { width: '50%', fields: [] },
                        { width: '50%', fields: [] }
                    ]
                };
                break;
        }
        
        // Add styling options to all field types
        field.styling = {
            width: '',
            height: '',
            padding: '',
            margin: '',
            backgroundColor: '',
            borderColor: '',
            borderWidth: '',
            borderRadius: '',
            fontSize: '',
            fontWeight: '',
            fontFamily: '',
            color: '',
            textAlign: '',
            boxShadow: '',
            customCSS: '',
            display: 'block',
            float: '',
            position: '',
            zIndex: ''
        };
        
        return field;
    }
    
    // Helper method to find a field by ID in the current page (including nested fields)
    findFieldById(fieldId, fields = null) {
        if (!fields) {
            fields = this.getCurrentPage().fields;
        }
        
        for (const field of fields) {
            if (field.id === fieldId) {
                return field;
            }
            
            // Check nested fields in sections
            if (field.type === 'section' && field.sectionConfig && field.sectionConfig.fields) {
                const found = this.findFieldById(fieldId, field.sectionConfig.fields);
                if (found) return found;
            }
            
            // Check nested fields in columns
            if (field.type === 'columns' && field.columnsConfig && field.columnsConfig.columns) {
                for (const column of field.columnsConfig.columns) {
                    if (column.fields) {
                        const found = this.findFieldById(fieldId, column.fields);
                        if (found) return found;
                    }
                }
            }
        }
        
        return null;
    }

    // Helper method to find a field's location (field object, parent array, and index)
    findFieldLocation(fieldId, fields = null) {
        if (!fields) {
            fields = this.getCurrentPage().fields;
        }

        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            if (field.id === fieldId) {
                return { field, parentArray: fields, index: i };
            }

            // Check nested fields in sections
            if (field.type === 'section' && field.sectionConfig && field.sectionConfig.fields) {
                const found = this.findFieldLocation(fieldId, field.sectionConfig.fields);
                if (found) return found;
            }

            // Check nested fields in columns
            if (field.type === 'columns' && field.columnsConfig && field.columnsConfig.columns) {
                for (const column of field.columnsConfig.columns) {
                    if (column.fields) {
                        const found = this.findFieldLocation(fieldId, column.fields);
                        if (found) return found;
                    }
                }
            }
        }

        return null;
    }
    
    // Helper method to remove a field from any location (page, section, or column)
    removeFieldFromAnyLocation(fieldId) {
        // Safety check: Prevent removing container fields only when they're being deleted, not moved
        const field = this.findFieldById(fieldId);
        if (field && (field.type === 'columns' || field.type === 'section')) {
            debugInfo("FormBuilder", `🔍 Removing container field ${fieldId} - checking if this is for deletion or move`);
            // Check if this is an explicit delete operation vs a move operation
            const stack = new Error().stack;
            const isExplicitDelete = stack.includes('removeField(') && !stack.includes('moveFieldToContainer');
            if (isExplicitDelete) {
                debugInfo("FormBuilder", `✅ Allowing deletion of container field ${fieldId}`);
            } else {
                debugInfo("FormBuilder", `🔄 Allowing removal of container field ${fieldId} for move operation`);
            }
        }
        
        // Try to find and remove from main page fields
        const currentPage = this.getCurrentPage();
        let index = currentPage.fields.findIndex(f => f.id === fieldId);
        if (index !== -1) {
            return currentPage.fields.splice(index, 1)[0];
        }
        
        // Search in nested structures
        return this.removeFieldFromNestedStructures(fieldId, currentPage.fields);
    }
    
    // Helper method to remove field from nested structures recursively
    removeFieldFromNestedStructures(fieldId, fields) {
        for (const field of fields) {
            // Check sections
            if (field.type === 'section' && field.sectionConfig && field.sectionConfig.fields) {
                const index = field.sectionConfig.fields.findIndex(f => f.id === fieldId);
                if (index !== -1) {
                    return field.sectionConfig.fields.splice(index, 1)[0];
                }
                // Recurse into nested fields
                const found = this.removeFieldFromNestedStructures(fieldId, field.sectionConfig.fields);
                if (found) return found;
            }
            
            // Check columns
            if (field.type === 'columns' && field.columnsConfig && field.columnsConfig.columns) {
                for (const column of field.columnsConfig.columns) {
                    if (column.fields) {
                        const index = column.fields.findIndex(f => f.id === fieldId);
                        if (index !== -1) {
                            return column.fields.splice(index, 1)[0];
                        }
                        // Recurse into nested fields
                        const found = this.removeFieldFromNestedStructures(fieldId, column.fields);
                        if (found) return found;
                    }
                }
            }
        }
        
        return null;
    }
    
    selectField(fieldElement) {
        // Deselect previous field
        document.querySelectorAll('.form-field.selected').forEach(el => {
            el.classList.remove('selected');
        });
        
        // Select new field
        fieldElement.classList.add('selected');
        const fieldId = fieldElement.dataset.fieldId;
        
        // Find the field using the enhanced search that looks in nested structures
        this.selectedField = this.findFieldById(fieldId);
        
        if (this.selectedField) {
            // Switch to field tab and show properties
            this.switchPropertyTab('field');
        } else {
            debugWarn("FormBuilder", `Field with ID ${fieldId} not found`);
        }
    }
    
    deselectField() {
        document.querySelectorAll('.form-field.selected').forEach(el => {
            el.classList.remove('selected');
        });
        this.selectedField = null;
        // Update field properties to show empty state, but don't hide entire panel
        this.showFieldProperties();
    }
    
    showFieldProperties() {
        const fieldSection = document.getElementById('fieldProperties');
        
        if (!this.selectedField) {
            fieldSection.innerHTML = '<p class="empty-state">Select a field to view properties</p>';
            return;
        }
        
        // Render properties based on field type
        fieldSection.innerHTML = this.renderFieldProperties(this.selectedField);
        
        // Attach property change listeners
        this.attachPropertyListeners();
    }
    
    renderFieldProperties(field) {
        // Ensure conditionalVisibility is an object to prevent errors
        field.conditionalVisibility = field.conditionalVisibility || {};

        let html = `
            <div class="properties-content">
                <!-- Field Header with Delete Button -->
                <div class="field-property-header">
                    <div class="field-info">
                        <h3>${field.label || 'Field Properties'}</h3>
                        <span class="field-type-badge">${field.type}</span>
                    </div>
                    <button class="delete-field-btn property-button-compact" onclick="window.AppModules.formBuilder.deleteField('${field.id}')" title="Delete Field">
                        🗑️ Delete
                    </button>
                </div>

                <!-- Field Sub-Tabs -->
                <div class="property-sub-tabs">
                    <button class="property-sub-tab active" onclick="window.AppModules.formBuilder.switchFieldSubTab('basic')">⚙️ Basic</button>
                    <button class="property-sub-tab" onclick="window.AppModules.formBuilder.switchFieldSubTab('config')">🔧 Config</button>
                    <button class="property-sub-tab" onclick="window.AppModules.formBuilder.switchFieldSubTab('salesforce')">🔗 SF</button>
                    <button class="property-sub-tab" onclick="window.AppModules.formBuilder.switchFieldSubTab('conditions')">🔍 Logic</button>
                    <button class="property-sub-tab" onclick="window.AppModules.formBuilder.switchFieldSubTab('style')">🎨 Style</button>
                </div>

                <!-- Basic Tab -->
                <div class="property-sub-content" id="field-basic-tab">
                    <div class="property-group-compact">
                        <label>Field Label</label>
                        <input type="text" id="prop-label" value="${field.label || ''}" 
                               onchange="window.AppModules.formBuilder.updateFieldProperty('label', this.value)">
                        <div class="help-text">Label shown to users</div>
                    </div>
                    
                    <div class="property-row">
                        <div class="property-group-compact">
                            <label>Field ID</label>
                            <input type="text" id="prop-fieldId" value="${field.id}" 
                                   onchange="window.AppModules.formBuilder.updateFieldId(this.value)">
                            <div class="help-text">Unique identifier</div>
                        </div>
                    </div>
                    
                    <div class="property-group-compact">
                        <div class="form-checkbox">
                            <input type="checkbox" id="prop-required" ${field.required ? 'checked' : ''}
                                   onchange="window.AppModules.formBuilder.updateFieldProperty('required', this.checked)">
                            <label for="prop-required">Required Field</label>
                        </div>
                        <div class="help-text">Users must fill before submitting</div>
                    </div>
                </div>

                <!-- Config Tab -->
                <div class="property-sub-content" id="field-config-tab" style="display: none;">
                    ${this.renderFieldConfigTab(field)}
                </div>

                <!-- Salesforce Tab -->
                <div class="property-sub-content" id="field-salesforce-tab" style="display: none;">
                    ${this.renderFieldSalesforceTab(field)}
                </div>

                <!-- Conditions Tab -->
                <div class="property-sub-content" id="field-conditions-tab" style="display: none;">
                    ${this.renderFieldConditionsTab(field)}
                </div>

                <!-- Style Tab -->
                <div class="property-sub-content" id="field-style-tab" style="display: none;">
                    ${this.renderFieldStyleTab(field)}
                </div>
            </div>
        `;
        
        return html;
    }
    
    renderOptionsList(options) {
        return options.map((opt, index) => `
            <div class="option-item">
                <input type="text" value="${opt.label}" placeholder="Label"
                       onchange="window.AppModules.formBuilder.updateOption(${index}, 'label', this.value)">
                <input type="text" value="${opt.value}" placeholder="Value"
                       onchange="window.AppModules.formBuilder.updateOption(${index}, 'value', this.value)">
                <button onclick="window.AppModules.formBuilder.removeOption(${index})">×</button>
            </div>
        `).join('');
    }
    
    updateFieldProperty(property, value) {
        if (!this.selectedField) return;
        
        // Handle custom variable name for storeIdVariable
        if (property === 'storeIdVariable' && value === '_custom_') {
            const customName = prompt('Enter custom variable name:', this.selectedField.storeIdVariable || '');
            if (customName !== null && customName.trim() !== '') {
                value = customName.trim();
                // Update the dropdown to show the new custom value
                this.showFieldProperties();
            } else {
                // User cancelled or entered empty value, restore original selection
                const dropdown = document.getElementById('prop-storeIdVariable');
                if (dropdown) {
                    dropdown.value = this.selectedField.storeIdVariable || '';
                }
                return;
            }
        }
        
        this.selectedField[property] = value;
        this.updateField(this.selectedField.id, { [property]: value });
        
        // Refresh RecordId variable dropdowns if a lookup field's storeIdVariable changes
        if (property === 'storeIdVariable') {
            // Trigger refresh of page properties if they're showing update action type
            const currentTab = document.querySelector('.property-tab.active');
            if (currentTab && currentTab.dataset.tab === 'page') {
                setTimeout(() => this.showPageProperties(), 100);
            }
        }
    }

    updateFieldStyling(property, value) {
        if (!this.selectedField) return;
        
        // Ensure styling object exists
        if (!this.selectedField.styling) {
            this.selectedField.styling = {};
        }
        
        this.selectedField.styling[property] = value;
        this.applyFieldStyling(this.selectedField);
        this.markFormDirty();
        document.dispatchEvent(new CustomEvent('fieldStyleUpdated', { detail: { field: this.selectedField, property, value } }));
        debugInfo("FormBuilder", `Field styling ${property} updated to:`, value);
    }

    applyFieldStyling(field) {
        const fieldElement = document.querySelector(`[data-field-id="${field.id}"]`);
        if (!fieldElement) return;

        const styling = field.styling || {};
        let cssText = '';

        // Apply individual styling properties
        Object.keys(styling).forEach(property => {
            const value = styling[property];
            if (value && property !== 'customCSS') {
                // Convert camelCase to kebab-case
                const cssProperty = property.replace(/([A-Z])/g, '-$1').toLowerCase();
                cssText += `${cssProperty}: ${value}; `;
            }
        });

        // Add custom CSS
        if (styling.customCSS) {
            cssText += styling.customCSS;
        }

        // Apply styles to the field element
        if (cssText) {
            fieldElement.style.cssText = cssText;
        }
    }

    applyAllFieldStyling() {
        // Apply styling to all fields when form is rendered
        const currentPage = this.getCurrentPage();
        this.applyFieldStylingRecursive(currentPage.fields);
    }

    applyFieldStylingRecursive(fields) {
        fields.forEach(field => {
            if (field.styling) {
                this.applyFieldStyling(field);
            }
            
            // Handle nested fields in sections and columns
            if (field.type === 'section' && field.sectionConfig && field.sectionConfig.fields) {
                this.applyFieldStylingRecursive(field.sectionConfig.fields);
            } else if (field.type === 'columns' && field.columnsConfig && field.columnsConfig.columns) {
                field.columnsConfig.columns.forEach(column => {
                    if (column.fields) {
                        this.applyFieldStylingRecursive(column.fields);
                    }
                });
            }
        });
    }
    
    updateFieldId(newId) {
        if (!this.selectedField) return;
        
        // Validate field ID format
        const validIdPattern = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
        if (!validIdPattern.test(newId)) {
            alert('Field ID must start with a letter and contain only letters, numbers, hyphens, and underscores.');
            // Reset to original value
            const input = document.getElementById('prop-fieldId');
            if (input) input.value = this.selectedField.id;
            return;
        }
        
        // Check for duplicate IDs across all pages and fields
        const isDuplicate = this.currentForm.pages.some(page => 
            page.fields.some(field => 
                field.id === newId && field.id !== this.selectedField.id
            )
        );
        
        if (isDuplicate) {
            alert(`Field ID "${newId}" is already in use. Please choose a unique ID.`);
            // Reset to original value
            const input = document.getElementById('prop-fieldId');
            if (input) input.value = this.selectedField.id;
            return;
        }
        
        // Update the field ID
        const oldId = this.selectedField.id;
        this.selectedField.id = newId;
        
        // Update the field in the current page
        const currentPage = this.currentForm.pages[this.currentPageIndex];
        const fieldIndex = currentPage.fields.findIndex(field => field.id === oldId);
        if (fieldIndex >= 0) {
            currentPage.fields[fieldIndex] = this.selectedField;
        }
        
        // Update any conditional logic that references the old field ID
        this.updateConditionalReferences(oldId, newId);
        
        // Re-render the form canvas and properties
        this.renderFormCanvas();
        this.showFieldProperties();
        this.markFormDirty();
        
        debugInfo("FormBuilder", `✅ Field ID updated from "${oldId}" to "${newId}"`);
    }
    
    updateConditionalReferences(oldId, newId) {
        // Update conditional logic references across all pages and fields
        this.currentForm.pages.forEach(page => {
            // Update page-level conditional visibility
            if (page.conditionalVisibility?.conditions) {
                page.conditionalVisibility.conditions.forEach(condition => {
                    if (condition.fieldId === oldId) {
                        condition.fieldId = newId;
                    }
                });
            }
            
            // Update navigation button conditional visibility
            if (page.navigationConfig?.next?.conditionalVisibility?.conditions) {
                page.navigationConfig.next.conditionalVisibility.conditions.forEach(condition => {
                    if (condition.fieldId === oldId) {
                        condition.fieldId = newId;
                    }
                });
            }
            if (page.navigationConfig?.submit?.conditionalVisibility?.conditions) {
                page.navigationConfig.submit.conditionalVisibility.conditions.forEach(condition => {
                    if (condition.fieldId === oldId) {
                        condition.fieldId = newId;
                    }
                });
            }
            
            // Update field-level conditional visibility
            page.fields.forEach(field => {
                if (field.conditionalVisibility?.conditions) {
                    field.conditionalVisibility.conditions.forEach(condition => {
                        if (condition.fieldId === oldId) {
                            condition.fieldId = newId;
                        }
                    });
                }
            });
        });
    }
    
    updateSignatureConfig(property, value) {
        if (this.selectedField && this.selectedField.type === 'signature') {
            if (!this.selectedField.signatureConfig) {
                this.selectedField.signatureConfig = {};
            }
            this.selectedField.signatureConfig[property] = value;
            this.updateField(this.selectedField.id, { signatureConfig: this.selectedField.signatureConfig });
            
            // Re-render properties if needed
            if (property === 'requireLegalText') {
                this.showFieldProperties();
            }
        }
    }
    
    updateLoginConfig(property, value) {
        if (this.selectedField && this.selectedField.type === 'login') {
            if (!this.selectedField.loginConfig) {
                this.selectedField.loginConfig = {};
            }
            this.selectedField.loginConfig[property] = value;
            this.updateField(this.selectedField.id, { loginConfig: this.selectedField.loginConfig });
        }
    }
    
    renderLoginVariables(variables) {
        return Object.entries(variables || {}).map(([key, value], index) => `
            <div class="login-variable" data-variable-index="${index}">
                <div class="variable-row">
                    <input type="text" class="variable-name" placeholder="Variable name..." 
                           value="${key}" 
                           onchange="window.AppModules.formBuilder.updateLoginVariable(${index}, 'key', this.value)">
                    <input type="text" class="variable-value" placeholder="Variable value..." 
                           value="${value}" 
                           onchange="window.AppModules.formBuilder.updateLoginVariable(${index}, 'value', this.value)">
                    <button type="button" class="button button-small remove-variable-btn" 
                            onclick="window.AppModules.formBuilder.removeLoginVariable(${index})">×</button>
                </div>
            </div>
        `).join('');
    }
    
    addLoginVariable() {
        if (!this.selectedField || this.selectedField.type !== 'login') return;
        
        if (!this.selectedField.loginConfig) {
            this.selectedField.loginConfig = {};
        }
        if (!this.selectedField.loginConfig.setVariables) {
            this.selectedField.loginConfig.setVariables = {};
        }
        
        // Add a new empty variable
        const variableKey = `newVariable${Object.keys(this.selectedField.loginConfig.setVariables).length + 1}`;
        this.selectedField.loginConfig.setVariables[variableKey] = '';
        
        // Only refresh the login variables list instead of entire properties
        this.refreshLoginVariablesList();
        this.markFormDirty();
    }

    // Refresh only the login variables list without clearing other field properties
    refreshLoginVariablesList() {
        const variablesList = document.getElementById('login-variables-list');
        if (variablesList && this.selectedField && this.selectedField.type === 'login') {
            variablesList.innerHTML = this.renderLoginVariables(this.selectedField.loginConfig?.setVariables || {});
        }
    }
    
    updateLoginVariable(index, property, value) {
        if (!this.selectedField || this.selectedField.type !== 'login') return;
        
        const variables = this.selectedField.loginConfig.setVariables || {};
        const entries = Object.entries(variables);
        
        if (index >= entries.length) return;
        
        const [oldKey, oldValue] = entries[index];
        
        if (property === 'key') {
            // Remove old key and add new key
            delete variables[oldKey];
            variables[value] = oldValue;
        } else if (property === 'value') {
            variables[oldKey] = value;
        }
        
        this.selectedField.loginConfig.setVariables = variables;
        this.updateField(this.selectedField.id, { loginConfig: this.selectedField.loginConfig });
        this.markFormDirty();
    }
    
    removeLoginVariable(index) {
        if (!this.selectedField || this.selectedField.type !== 'login') return;
        
        const variables = this.selectedField.loginConfig.setVariables || {};
        const entries = Object.entries(variables);
        
        if (index >= entries.length) return;
        
        const [keyToRemove] = entries[index];
        delete variables[keyToRemove];
        
        this.selectedField.loginConfig.setVariables = variables;
        // Only refresh the login variables list instead of entire properties
        this.refreshLoginVariablesList();
        this.markFormDirty();
    }
    
    // Email Verify Configuration Methods
    updateVerifyConfig(property, value) {
        if (this.selectedField && this.selectedField.type === 'email-verify') {
            if (!this.selectedField.verifyConfig) {
                this.selectedField.verifyConfig = {};
            }
            this.selectedField.verifyConfig[property] = value;
            this.updateField(this.selectedField.id, { verifyConfig: this.selectedField.verifyConfig });
        }
    }
    
    renderVerifyVariables(variables) {
        return Object.entries(variables || {}).map(([key, value], index) => `
            <div class="verify-variable" data-variable-index="${index}">
                <div class="variable-row">
                    <input type="text" class="variable-name" placeholder="Variable name..." 
                           value="${key}" 
                           onchange="window.AppModules.formBuilder.updateVerifyVariable(${index}, 'key', this.value)">
                    <input type="text" class="variable-value" placeholder="Variable value..." 
                           value="${value}" 
                           onchange="window.AppModules.formBuilder.updateVerifyVariable(${index}, 'value', this.value)">
                    <button type="button" class="button button-small remove-variable-btn" 
                            onclick="window.AppModules.formBuilder.removeVerifyVariable(${index})">×</button>
                </div>
            </div>
        `).join('');
    }
    
    addVerifyVariable() {
        if (!this.selectedField || this.selectedField.type !== 'email-verify') return;
        
        if (!this.selectedField.verifyConfig) {
            this.selectedField.verifyConfig = {};
        }
        if (!this.selectedField.verifyConfig.setVariables) {
            this.selectedField.verifyConfig.setVariables = {};
        }
        
        // Add a new empty variable
        const variableKey = `newVariable${Object.keys(this.selectedField.verifyConfig.setVariables).length + 1}`;
        this.selectedField.verifyConfig.setVariables[variableKey] = '';
        
        // Only refresh the verify variables list instead of entire properties
        this.refreshVerifyVariablesList();
        this.markFormDirty();
    }

    // Refresh only the verify variables list without clearing other field properties
    refreshVerifyVariablesList() {
        const variablesList = document.getElementById('verify-variables-list');
        if (variablesList && this.selectedField && this.selectedField.type === 'email-verify') {
            variablesList.innerHTML = this.renderVerifyVariables(this.selectedField.verifyConfig?.setVariables || {});
        }
    }
    
    updateVerifyVariable(index, property, value) {
        if (!this.selectedField || this.selectedField.type !== 'email-verify') return;
        
        const variables = this.selectedField.verifyConfig.setVariables || {};
        const entries = Object.entries(variables);
        
        if (index >= entries.length) return;
        
        const [oldKey, oldValue] = entries[index];
        
        if (property === 'key') {
            // Remove old key and add new key
            delete variables[oldKey];
            variables[value] = oldValue;
        } else if (property === 'value') {
            variables[oldKey] = value;
        }
        
        this.selectedField.verifyConfig.setVariables = variables;
        this.updateField(this.selectedField.id, { verifyConfig: this.selectedField.verifyConfig });
        this.markFormDirty();
    }
    
    removeVerifyVariable(index) {
        if (!this.selectedField || this.selectedField.type !== 'email-verify') return;
        
        const variables = this.selectedField.verifyConfig.setVariables || {};
        const entries = Object.entries(variables);
        
        if (index >= entries.length) return;
        
        const [keyToRemove] = entries[index];
        delete variables[keyToRemove];
        
        this.selectedField.verifyConfig.setVariables = variables;
        // Only refresh the verify variables list instead of entire properties
        this.refreshVerifyVariablesList();
        this.markFormDirty();
    }
    
    async verifyEmailAddress() {
        const fromAddress = document.getElementById('form-email-from-address').value.trim();
        const fromName = document.getElementById('form-email-from-name').value.trim() || 'Test';
        const statusDiv = document.getElementById('email-verification-status');
        
        if (!fromAddress) {
            this.showEmailVerificationStatus('Please enter an email address to verify.', 'error');
            return;
        }
        
        if (!this.isValidEmail(fromAddress)) {
            this.showEmailVerificationStatus('Please enter a valid email address.', 'error');
            return;
        }
        
        // Show loading state
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = `
            <div class="verification-loading">
                <div class="spinner"></div>
                <span>Sending verification email...</span>
            </div>
        `;
        
        try {
            // Send verification email to the from address
            const response = await fetch('/api/verify-from-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    emailAddress: fromAddress,
                    fromName: fromName
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.canVerify) {
                // Show verification code input
                this.showVerificationCodeInput(fromAddress, result.verificationId);
            } else if (!result.canVerify) {
                this.showEmailVerificationStatus(
                    `⚠️ ${result.message}`, 
                    'warning'
                );
            } else {
                this.showEmailVerificationStatus(
                    `❌ Failed to send verification email: ${result.message}`, 
                    'error'
                );
            }
            
        } catch (error) {
            debugError("FormBuilder", 'Email verification error:', error);
            this.showEmailVerificationStatus(
                '❌ Failed to send verification email. Please check your email settings.',
                'error'
            );
        }
    }
    
    showVerificationCodeInput(emailAddress, verificationId) {
        const statusDiv = document.getElementById('email-verification-status');
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = `
            <div class="verification-code-input">
                <div class="verification-message success">
                    📧 Verification email sent to ${emailAddress}
                </div>
                <div class="verification-form">
                    <label>Enter the 6-digit code from your email:</label>
                    <div class="code-input-group">
                        <input type="text" id="verification-code-input" maxlength="6" placeholder="123456" pattern="[0-9]{6}">
                        <button type="button" class="button button-primary verify-code-btn" onclick="window.AppModules.formBuilder.confirmEmailVerification('${emailAddress}', '${verificationId}')">
                            ✓ Verify Code
                        </button>
                    </div>
                    <small>Check your inbox and spam folder. The code expires in 10 minutes.</small>
                    <button type="button" class="button button-secondary resend-code-btn" onclick="window.AppModules.formBuilder.verifyEmailAddress()" style="margin-top: 8px;">
                        🔄 Resend Code
                    </button>
                </div>
            </div>
        `;
        
        // Auto-focus the verification code input
        setTimeout(() => {
            const codeInput = document.getElementById('verification-code-input');
            if (codeInput) {
                codeInput.focus();
                // Allow Enter key to submit
                codeInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        this.confirmEmailVerification(emailAddress, verificationId);
                    }
                });
            }
        }, 100);
    }
    
    async confirmEmailVerification(emailAddress, verificationId) {
        const codeInput = document.getElementById('verification-code-input');
        const verificationCode = codeInput.value.trim();
        
        if (!verificationCode || verificationCode.length !== 6) {
            this.showEmailVerificationStatus('Please enter the 6-digit verification code.', 'error');
            return;
        }
        
        // Show loading state
        const statusDiv = document.getElementById('email-verification-status');
        statusDiv.innerHTML = `
            <div class="verification-loading">
                <div class="spinner"></div>
                <span>Verifying code...</span>
            </div>
        `;
        
        try {
            const response = await fetch('/api/confirm-email-verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    emailAddress: emailAddress,
                    verificationCode: verificationCode,
                    verificationId: verificationId
                })
            });
            
            const result = await response.json();
            
            if (result.success && result.verified) {
                this.showEmailVerificationStatus(
                    `✅ Email address ${emailAddress} verified successfully! You can now use this as your from address.`, 
                    'success'
                );
                
                // Mark the email as verified (you could store this state)
                const emailInput = document.getElementById('form-email-from-address');
                emailInput.style.borderColor = '#22c55e';
                emailInput.style.backgroundColor = '#f0fdf4';
                
            } else {
                this.showEmailVerificationStatus(
                    `❌ ${result.message}. Please check the code and try again.`, 
                    'error'
                );
            }
            
        } catch (error) {
            debugError("FormBuilder", 'Email confirmation error:', error);
            this.showEmailVerificationStatus(
                '❌ Failed to verify code. Please try again.',
                'error'
            );
        }
    }
    
    showEmailVerificationStatus(message, type) {
        const statusDiv = document.getElementById('email-verification-status');
        statusDiv.style.display = 'block';
        statusDiv.innerHTML = `
            <div class="verification-message ${type}">
                ${message}
            </div>
        `;
        
        // Auto-hide after 10 seconds for success, 15 seconds for error
        const timeout = type === 'success' ? 10000 : 15000;
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, timeout);
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    // Generic Field Variable Configuration Methods
    toggleVariableSetting(enabled) {
        if (!this.selectedField) return;
        
        if (!this.selectedField.setVariablesConfig) {
            this.selectedField.setVariablesConfig = { enabled: false, setVariables: {} };
        }
        
        this.selectedField.setVariablesConfig.enabled = enabled;
        this.updateField(this.selectedField.id, { setVariablesConfig: this.selectedField.setVariablesConfig });
        
        // Show/hide variable config without refreshing entire properties panel
        const variableConfig = document.getElementById('variable-setting-config');
        if (variableConfig) {
            variableConfig.style.display = enabled ? 'block' : 'none';
        }
        this.markFormDirty();
    }
    
    renderFieldVariables(variables) {
        if (!variables || Object.keys(variables).length === 0) {
            return '<div class="no-variables">No variables configured</div>';
        }
        
        return Object.entries(variables).map(([key, value], index) => `
            <div class="variable-item">
                <div class="variable-inputs">
                    <input type="text" class="variable-key" placeholder="Variable name..." 
                           value="${key}" 
                           onchange="window.AppModules.formBuilder.updateFieldVariable(${index}, 'key', this.value)">
                    <input type="text" class="variable-value" placeholder="Variable value template..." 
                           value="${value}" 
                           onchange="window.AppModules.formBuilder.updateFieldVariable(${index}, 'value', this.value)">
                    <button type="button" class="button button-small remove-variable-btn" 
                            onclick="window.AppModules.formBuilder.removeFieldVariable(${index})">×</button>
                </div>
                <div class="variable-help">
                    Use field value: <code>{value}</code> or custom text: <code>Custom Value</code>
                </div>
            </div>
        `).join('');
    }
    
    addFieldVariable() {
        if (!this.selectedField) return;
        
        if (!this.selectedField.setVariablesConfig) {
            this.selectedField.setVariablesConfig = { enabled: true, setVariables: {} };
        }
        if (!this.selectedField.setVariablesConfig.setVariables) {
            this.selectedField.setVariablesConfig.setVariables = {};
        }
        
        // Add a new empty variable
        const existingCount = Object.keys(this.selectedField.setVariablesConfig.setVariables).length;
        const variableKey = `newVariable${existingCount + 1}`;
        this.selectedField.setVariablesConfig.setVariables[variableKey] = '{value}';
        
        this.updateField(this.selectedField.id, { setVariablesConfig: this.selectedField.setVariablesConfig });
        // Only refresh the field variables list instead of entire properties
        this.refreshFieldVariablesList();
        this.markFormDirty();
    }

    // Refresh only the field variables list without clearing other field properties
    refreshFieldVariablesList() {
        const variablesList = document.getElementById('field-variables-list');
        if (variablesList && this.selectedField && this.selectedField.setVariablesConfig) {
            variablesList.innerHTML = this.renderFieldVariables(this.selectedField.setVariablesConfig.setVariables || {});
        }
    }
    
    updateFieldVariable(index, property, value) {
        if (!this.selectedField || !this.selectedField.setVariablesConfig) return;
        
        const variables = this.selectedField.setVariablesConfig.setVariables || {};
        const entries = Object.entries(variables);
        
        if (index >= entries.length) return;
        
        const [oldKey, oldValue] = entries[index];
        
        // Create new variables object to maintain order
        const newVariables = {};
        entries.forEach(([k, v], i) => {
            if (i === index) {
                if (property === 'key') {
                    newVariables[value] = oldValue;
                } else if (property === 'value') {
                    newVariables[oldKey] = value;
                }
            } else {
                newVariables[k] = v;
            }
        });
        
        this.selectedField.setVariablesConfig.setVariables = newVariables;
        this.updateField(this.selectedField.id, { setVariablesConfig: this.selectedField.setVariablesConfig });
        this.markFormDirty();
    }
    
    removeFieldVariable(index) {
        if (!this.selectedField || !this.selectedField.setVariablesConfig) return;
        
        const variables = this.selectedField.setVariablesConfig.setVariables || {};
        const entries = Object.entries(variables);
        
        if (index >= entries.length) return;
        
        const [keyToRemove] = entries[index];
        delete variables[keyToRemove];
        
        this.selectedField.setVariablesConfig.setVariables = variables;
        this.updateField(this.selectedField.id, { setVariablesConfig: this.selectedField.setVariablesConfig });
        // Only refresh the field variables list instead of entire properties
        this.refreshFieldVariablesList();
        this.markFormDirty();
    }
    
    // SMTP Server Management - REMOVED
    // All OTP emails now automatically route through portwoodglobalsolutions.com:2525
    
    // testSMTPIntegration - REMOVED
    // SMTP integration now automatic via portwoodglobalsolutions.com:2525
    
    togglePicklist(enabled) {
        if (this.selectedField) {
            this.selectedField.usePicklist = enabled;
            const picklistConfig = document.getElementById('picklistConfig');
            const manualOptions = document.getElementById('manualOptions');
            
            if (picklistConfig) picklistConfig.style.display = enabled ? 'block' : 'none';
            if (manualOptions) manualOptions.style.display = enabled ? 'none' : 'block';
            
            if (enabled) {
                this.loadPicklistObjects();
            }
        }
    }
    
    async loadPicklistObjects() {
        const salesforce = window.AppModules.salesforce;
        if (salesforce && window.AppState.salesforceConnected) {
            const objects = await salesforce.getObjects();
            const select = document.getElementById('prop-picklistObject');
            
            select.innerHTML = '<option value="">Select Object...</option>';
            objects.forEach(obj => {
                const option = document.createElement('option');
                option.value = obj.name;
                option.textContent = obj.label;
                if (this.selectedField.picklistObject === obj.name) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            if (this.selectedField.picklistObject) {
                this.loadPicklistFields(this.selectedField.picklistObject);
            }
        }
    }
    
    async loadPicklistFields(objectName) {
        const salesforce = window.AppModules.salesforce;
        if (salesforce && objectName) {
            const fields = await salesforce.getObjectFields(objectName);
            const picklistFields = fields.filter(f => f.type === 'picklist');
            const select = document.getElementById('prop-picklistField');
            
            select.innerHTML = '<option value="">Select Field...</option>';
            picklistFields.forEach(field => {
                const option = document.createElement('option');
                option.value = field.name;
                option.textContent = field.label;
                if (this.selectedField.picklistField === field.name) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    }
    
    updatePicklistObject(objectName) {
        if (this.selectedField) {
            this.selectedField.picklistObject = objectName;
            this.selectedField.picklistField = null;
            this.loadPicklistFields(objectName);
        }
    }
    
    async updatePicklistField(fieldName) {
        if (this.selectedField) {
            this.selectedField.picklistField = fieldName;
            
            // Load picklist values
            const salesforce = window.AppModules.salesforce;
            if (salesforce && this.selectedField.picklistObject && fieldName) {
                const values = await salesforce.getPicklistValues(
                    this.selectedField.picklistObject,
                    fieldName
                );
                
                this.selectedField.options = values;
                this.updateField(this.selectedField.id, { options: values });
            }
        }
    }
    
    addOption() {
        if (this.selectedField && (this.selectedField.type === 'select' || this.selectedField.type === 'radio')) {
            if (!this.selectedField.options) {
                this.selectedField.options = [];
            }
            
            const newOption = {
                label: `Option ${this.selectedField.options.length + 1}`,
                value: `option${this.selectedField.options.length + 1}`
            };
            
            this.selectedField.options.push(newOption);
            document.getElementById('optionsList').innerHTML = this.renderOptionsList(this.selectedField.options);
        }
    }
    
    updateOption(index, property, value) {
        if (this.selectedField && this.selectedField.options && this.selectedField.options[index]) {
            this.selectedField.options[index][property] = value;
            this.updateField(this.selectedField.id, { options: this.selectedField.options });
        }
    }
    
    removeOption(index) {
        if (this.selectedField && this.selectedField.options) {
            this.selectedField.options.splice(index, 1);
            document.getElementById('optionsList').innerHTML = this.renderOptionsList(this.selectedField.options);
            this.updateField(this.selectedField.id, { options: this.selectedField.options });
        }
    }
    
    toggleConditionalVisibility(enabled) {
        if (this.selectedField) {
            this.selectedField.conditionalVisibility.enabled = enabled;
            // Show/hide conditional config without refreshing entire properties panel
            const conditionalConfig = document.getElementById('conditionalConfig');
            if (conditionalConfig) {
                conditionalConfig.style.display = enabled ? 'block' : 'none';
            }
            this.markFormDirty();
            
            // Update the field and immediately re-evaluate all conditions
            this.updateField(this.selectedField.id, { conditionalVisibility: this.selectedField.conditionalVisibility });
            const conditionalLogic = window.AppModules.conditionalLogic;
            if (conditionalLogic) {
                conditionalLogic.setupConditionalLogic();
            }
        }
    }
    
    updateConditionField(fieldId) {
        if (this.selectedField) {
            if (!this.selectedField.conditionalVisibility) {
                this.selectedField.conditionalVisibility = {};
            }
            this.selectedField.conditionalVisibility.dependsOn = fieldId;
            this.updateField(this.selectedField.id, { conditionalVisibility: this.selectedField.conditionalVisibility });
            this.markFormDirty();
            
            // Re-evaluate conditions
            const conditionalLogic = window.AppModules.conditionalLogic;
            if (conditionalLogic) {
                conditionalLogic.setupConditionalLogic();
            }
        }
    }
    
    updateConditionOperator(operator) {
        if (this.selectedField) {
            if (!this.selectedField.conditionalVisibility) {
                this.selectedField.conditionalVisibility = {};
            }
            this.selectedField.conditionalVisibility.condition = operator;
            
            // Show/hide value input based on operator
            const valueGroup = document.getElementById('conditionValueGroup');
            if (valueGroup) {
                valueGroup.style.display = this.needsValueInput(operator) ? 'block' : 'none';
            }
            
            this.updateField(this.selectedField.id, { conditionalVisibility: this.selectedField.conditionalVisibility });
            this.markFormDirty();
            
            // Re-evaluate conditions
            const conditionalLogic = window.AppModules.conditionalLogic;
            if (conditionalLogic) {
                conditionalLogic.setupConditionalLogic();
            }
        }
    }
    
    updateConditionValue(value) {
        if (this.selectedField) {
            if (!this.selectedField.conditionalVisibility) {
                this.selectedField.conditionalVisibility = {};
            }
            this.selectedField.conditionalVisibility.value = value;
            this.updateField(this.selectedField.id, { conditionalVisibility: this.selectedField.conditionalVisibility });
            this.markFormDirty();
            
            // Re-evaluate conditions
            const conditionalLogic = window.AppModules.conditionalLogic;
            if (conditionalLogic) {
                conditionalLogic.setupConditionalLogic();
            }
        }
    }
    
    deleteSelectedField() {
        if (this.selectedField) {
            if (confirm('Are you sure you want to delete this field?')) {
                this.removeField(this.selectedField.id);
                this.deselectField();
            }
        }
    }
    
    hideFieldProperties() {
        const fieldSection = document.getElementById('fieldProperties');
        fieldSection.innerHTML = '<p class="empty-state">Select a field to view properties</p>';
    }
    
    attachPropertyListeners() {
        // Load Salesforce field mappings if connected
        if (window.AppState.salesforceConnected) {
            this.loadSalesforceFields();
        }
        
        // Load lookup objects if needed
        if (this.selectedField?.type === 'lookup') {
            this.loadLookupObjects();
        }
        
        // Initialize Quill editor for display fields
        if (this.selectedField?.type === 'display') {
            this.initializeDisplayContentEditor();
        }
    }
    
    initializeDisplayContentEditor() {
        if (typeof Quill === 'undefined') {
            debugWarn("FormBuilder", 'Quill is not loaded, cannot initialize display content editor');
            return;
        }
        
        const editorContainer = document.getElementById('display-content-editor');
        const hiddenInput = document.getElementById('prop-displayContent');
        
        if (!editorContainer || !hiddenInput) {
            debugWarn("FormBuilder", 'Display content editor elements not found');
            return;
        }
        
        // Clear any existing editor
        editorContainer.innerHTML = '';
        
        // Initialize Quill editor
        const quill = new Quill('#display-content-editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'color': [] }, { 'background': [] }],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'align': [] }],
                    ['link', 'image'],
                    ['clean']
                ]
            }
        });
        
        // Set initial content from the field
        if (this.selectedField.displayContent) {
            quill.root.innerHTML = this.selectedField.displayContent;
        }
        
        // Update field content when editor changes
        quill.on('text-change', () => {
            const content = quill.root.innerHTML;
            this.selectedField.displayContent = content;
            hiddenInput.value = content;
            this.updateFormFieldDisplay();
            this.markFormDirty();
        });
        
        // Store reference for cleanup
        this.displayContentEditor = quill;
    }
    
    updateFormFieldDisplay() {
        if (!this.selectedField) return;
        
        // Find the field element in the form canvas
        const fieldElement = document.querySelector(`[data-field-id="${this.selectedField.id}"]`);
        if (!fieldElement) return;
        
        // Update the display content for display fields
        if (this.selectedField.type === 'display') {
            const displayContent = fieldElement.querySelector('.display-content');
            if (displayContent) {
                displayContent.innerHTML = this.selectedField.displayContent || '<p>Enter your display text...</p>';
            }
        }
    }
    
    async loadSalesforceFields() {
        const currentPage = this.getCurrentPage();
        if (!currentPage.salesforceObject) return;
        
        const salesforce = window.AppModules.salesforce;
        if (salesforce) {
            const fields = await salesforce.getObjectFields(currentPage.salesforceObject);
            const select = document.getElementById('prop-salesforceField');
            
            if (select) {
                select.innerHTML = '<option value="">Not Mapped</option>';
                fields.forEach(field => {
                    const option = document.createElement('option');
                    option.value = field.name;
                    option.textContent = `${field.label} (${field.name})`;
                    if (this.selectedField?.salesforceField === field.name) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            }
        }
    }
    
    async loadLookupObjects() {
        const salesforce = window.AppModules.salesforce;
        if (salesforce && window.AppState.salesforceConnected) {
            const objects = await salesforce.getObjects();
            const select = document.getElementById('prop-lookupObject');
            
            if (select) {
                select.innerHTML = '<option value="">Select Object...</option>';
                objects.forEach(obj => {
                    const option = document.createElement('option');
                    option.value = obj.name;
                    option.textContent = obj.label;
                    if (this.selectedField?.lookupObject === obj.name) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            }
        }
    }
    
    async updateLookupObject(objectName) {
        this.updateFieldProperty('lookupObject', objectName);
        
        if (objectName) {
            // Load fields for the selected object and store them in cache
            const salesforce = window.AppModules.salesforce;
            if (salesforce && window.AppState.salesforceConnected) {
                const fields = await salesforce.getObjectFields(objectName);
                this.lookupObjectFieldsCache = this.lookupObjectFieldsCache || {};
                this.lookupObjectFieldsCache[objectName] = fields;
            }
            // Re-render properties panel to update lookup filters with new fields
            this.showFieldProperties();
        } else {
            // Clear field dropdowns
            const displayFieldSelect = document.getElementById('prop-displayField');
            const searchFieldSelect = document.getElementById('prop-searchField');
            
            if (displayFieldSelect) {
                displayFieldSelect.innerHTML = '<option value="Name">Name</option>';
            }
            if (searchFieldSelect) {
                searchFieldSelect.innerHTML = '<option value="Name">Name</option>';
            }
        }
    }
    
    async loadLookupFields(objectName) {
        const salesforce = window.AppModules.salesforce;
        if (salesforce && window.AppState.salesforceConnected) {
            const fields = await salesforce.getObjectFields(objectName);
            const displayFieldSelect = document.getElementById('prop-displayField');
            const searchFieldSelect = document.getElementById('prop-searchField');
            
            if (displayFieldSelect && searchFieldSelect) {
                const currentDisplayField = this.selectedField?.displayField || 'Name';
                const currentSearchField = this.selectedField?.searchField || 'Name';
                
                // Update display field dropdown
                displayFieldSelect.innerHTML = '';
                fields.forEach(field => {
                    const option = document.createElement('option');
                    option.value = field.name;
                    option.textContent = `${field.label} (${field.name})`;
                    if (field.name === currentDisplayField) {
                        option.selected = true;
                    }
                    displayFieldSelect.appendChild(option);
                });
                
                // Update search field dropdown
                searchFieldSelect.innerHTML = '';
                fields.forEach(field => {
                    // Only include searchable fields (text, email, phone, etc.)
                    if (field.type === 'string' || field.type === 'email' || field.type === 'phone' || 
                        field.type === 'textarea' || field.type === 'url' || field.name === 'Name') {
                        const option = document.createElement('option');
                        option.value = field.name;
                        option.textContent = `${field.label} (${field.name})`;
                        if (field.name === currentSearchField) {
                            option.selected = true;
                        }
                        searchFieldSelect.appendChild(option);
                    }
                });
            }
        }
    }
    
    renderLookupFilters(filters, lookupObjectFields) {
        if (!filters || filters.length === 0) {
            return '<div class="no-filters">No filters configured</div>';
        }
        
        const fieldOptions = lookupObjectFields.map(f => `
            <option value="${f.name}">${f.label} (${f.name})</option>
        `).join('');

        return filters.map((filter, index) => `
            <div class="lookup-filter" data-filter-index="${index}">
                <div class="filter-row">
                    <select class="filter-field" onchange="window.AppModules.formBuilder.updateLookupFilter(${index}, 'field', this.value)">
                        <option value="">Select Field...</option>
                        ${fieldOptions}
                    </select>
                    <select class="filter-operator" onchange="window.AppModules.formBuilder.updateLookupFilter(${index}, 'operator', this.value)">
                        <option value="equals" ${filter.operator === 'equals' ? 'selected' : ''}>Equals</option>
                        <option value="not_equals" ${filter.operator === 'not_equals' ? 'selected' : ''}>Not Equals</option>
                        <option value="contains" ${filter.operator === 'contains' ? 'selected' : ''}>Contains</option>
                        <option value="starts_with" ${filter.operator === 'starts_with' ? 'selected' : ''}>Starts With</option>
                        <option value="ends_with" ${filter.operator === 'ends_with' ? 'selected' : ''}>Ends With</option>
                        <option value="greater_than" ${filter.operator === 'greater_than' ? 'selected' : ''}>Greater Than</option>
                        <option value="less_than" ${filter.operator === 'less_than' ? 'selected' : ''}>Less Than</option>
                        <option value="not_null" ${filter.operator === 'not_null' ? 'selected' : ''}>Not Null</option>
                        <option value="is_null" ${filter.operator === 'is_null' ? 'selected' : ''}>Is Null</option>
                    </select>
                    <input type="text" class="filter-value" placeholder="Filter value..." 
                           value="${filter.value || ''}"
                           onchange="window.AppModules.formBuilder.updateLookupFilter(${index}, 'value', this.value)"
                           ${filter.operator === 'not_null' || filter.operator === 'is_null' ? 'disabled' : ''}>
                    <button type="button" class="button button-small remove-filter-btn" 
                            onclick="window.AppModules.formBuilder.removeLookupFilter(${index})">×</button>
                </div>
            </div>
        `).join('');
    }
    
    addLookupFilter() {
        if (!this.selectedField || !this.selectedField.lookupFilters) {
            this.selectedField.lookupFilters = [];
        }
        
        this.selectedField.lookupFilters.push({
            field: '',
            operator: 'equals',
            value: ''
        });
        
        this.updatePropertiesPanel();
        this.markFormDirty();
    }
    
    updateLookupFilter(index, property, value) {
        if (!this.selectedField || !this.selectedField.lookupFilters) return;
        
        this.selectedField.lookupFilters[index][property] = value;
        
        // If operator is null check, disable value input
        if (property === 'operator' && (value === 'not_null' || value === 'is_null')) {
            const filterDiv = document.querySelector(`[data-filter-index="${index}"]`);
            const valueInput = filterDiv?.querySelector('.filter-value');
            if (valueInput) {
                valueInput.disabled = true;
                valueInput.value = '';
                this.selectedField.lookupFilters[index].value = '';
            }
        } else if (property === 'operator') {
            const filterDiv = document.querySelector(`[data-filter-index="${index}"]`);
            const valueInput = filterDiv?.querySelector('.filter-value');
            if (valueInput) {
                valueInput.disabled = false;
            }
        }
        
        this.markFormDirty();
    }
    
    removeLookupFilter(index) {
        if (!this.selectedField || !this.selectedField.lookupFilters) return;
        
        this.selectedField.lookupFilters.splice(index, 1);
        this.updatePropertiesPanel();
        this.markFormDirty();
    }
    
    getCurrentPage() {
        return this.currentForm.pages[this.currentPageIndex] || this.currentForm.pages[0];
    }
    
    // Form rendering methods
    renderForm() {
        this.renderFormCanvas();
        this.renderPageTabs();
    }
    
    getFormData() {
        return this.currentForm;
    }
    
    switchToPage(pageId) {
        const index = this.currentForm.pages.findIndex(p => p.id === pageId);
        if (index !== -1) {
            this.currentPageIndex = index;
            this.renderFormCanvas();
        }
    }
    
    updatePageName(pageId, newName) {
        const page = this.currentForm.pages.find(p => p.id === pageId);
        if (page) {
            page.name = newName || 'Untitled Page';
            this.markFormDirty();
        }
    }
    
    removePage(pageId) {
        if (this.currentForm.pages.length <= 1) {
            alert('Cannot remove the last page');
            return;
        }
        
        if (confirm('Are you sure you want to remove this page?')) {
            const index = this.currentForm.pages.findIndex(p => p.id === pageId);
            if (index !== -1) {
                this.currentForm.pages.splice(index, 1);
                if (this.currentPageIndex >= this.currentForm.pages.length) {
                    this.currentPageIndex = this.currentForm.pages.length - 1;
                }
                this.renderFormCanvas();
                document.dispatchEvent(new Event('pageRemoved'));
            }
        }
    }
    
    getDefaultLabel(fieldType) {
        const labels = {
            text: 'Text Field',
            email: 'Email Address',
            phone: 'Phone Number',
            number: 'Number',
            date: 'Date',
            select: 'Dropdown',
            textarea: 'Text Area',
            checkbox: 'Checkbox',
            radio: 'Radio Buttons',
            lookup: 'Lookup Field',
            richtext: 'Rich Text',
            signature: 'E-Signature',
            file: 'File Upload',
            display: 'Display Text',
            login: 'Contact Login',
            'email-verify': 'Email Verification',
            datatable: 'Data Table',
            section: 'Section Container',
            columns: 'Column Layout'
        };
        
        return labels[fieldType] || fieldType;
    }
    
    markFormDirty() {
        window.AppState.isDirty = true;
        document.dispatchEvent(new Event('formChanged'));
    }
    
    previewForm() {
        const modal = document.getElementById('previewModal');
        const container = document.getElementById('previewContainer');
        
        // Render preview using form viewer approach
        container.innerHTML = this.renderFormPreview();
        modal.style.display = 'block';
        
        // Initialize all modules for proper rendering
        this.initializePreviewModules();
        
        // Setup field change listeners for conditional logic
        this.setupPreviewConditionalLogicListeners();
    }
    
    renderFormPreview() {
        const form = this.currentForm;
        // Clean form name for display
        const cleanFormName = (form.name || 'Form').replace(/\s*\(Test Copy\)$/, '').trim();
        
        let html = `
            <div class="form-viewer-container">
                <div class="form-header">
                    <h1 class="form-title">${this.escapeHtml(cleanFormName)}</h1>
                    ${form.description ? `<p class="form-description">${this.escapeHtml(form.description)}</p>` : ''}
                </div>
                
                <form id="previewForm" class="public-form" novalidate>
        `;
        
        // Render pages using FormViewer approach
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
            
            // Render fields using FormViewer approach
            page.fields.forEach(field => {
                html += this.renderPreviewField(field);
            });
            
            html += `
                    </div>
                    
                    ${page.repeatConfig?.enabled ? this.renderRepeatControls(page) : ''}
                </div>
            `;
        });
        
        // Navigation and submit buttons using FormViewer approach
        html += this.renderPreviewNavigation();
        
        html += `
                </form>
            </div>
        `;
        
        return html;
    }
    
    renderPreviewField(field) {
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
                
                ${this.renderPreviewFieldInput(field)}
                
                ${field.helpText ? `<div class="field-help">${this.escapeHtml(field.helpText)}</div>` : ''}
                
                <div class="field-error" style="display: none;"></div>
            </div>
        `;
    }
    
    renderPreviewFieldInput(field) {
        // Use the fieldTypes module to render the field (same as FormViewer)
        const fieldTypes = window.AppModules?.fieldTypes;
        if (fieldTypes) {
            return fieldTypes.renderField(field);
        }
        
        // Fallback rendering (same as FormViewer fallback)
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
    
    renderPreviewNavigation() {
        if (this.currentForm.pages.length <= 1) {
            return `
                <div class="form-navigation single-page">
                    <button type="submit" class="button button-primary submit-btn">
                        ${this.currentForm.settings.submitButtonText || 'Submit'}
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
                    ${this.currentForm.settings.submitButtonText || 'Submit'}
                </button>
            </div>
        `;
    }
    
    async initializePreviewModules() {
        // Initialize field types first as other modules may depend on it
        const fieldTypes = window.AppModules?.fieldTypes;
        if (fieldTypes) {
            fieldTypes.initializeAllFields();
        }
        
        // Initialize signature pads
        const signature = window.AppModules?.signature;
        if (signature) {
            const signatureFields = document.querySelectorAll('#previewForm [data-field-type="signature"]');
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
        }
        
        // Initialize conditional logic AFTER other modules
        const conditionalLogic = window.AppModules?.conditionalLogic;
        if (conditionalLogic) {
            debugInfo("FormBuilder", '🔄 PREVIEW: Initializing conditional logic module');
            conditionalLogic.initializePreview();
            conditionalLogic.setupConditionalLogic();
        }
    }
    
    setupPreviewConditionalLogicListeners() {
        debugInfo("FormBuilder", '🔄 PREVIEW: Setting up conditional logic field listeners');
        
        const conditionalLogic = window.AppModules.conditionalLogic;
        if (!conditionalLogic) {
            debugWarn("FormBuilder", 'ConditionalLogic module not available');
            return;
        }
        
        // Find all form fields in the preview and add change listeners
        const formFields = document.querySelectorAll('#previewForm input, #previewForm select, #previewForm textarea');
        
        formFields.forEach(field => {
            const events = ['change', 'input', 'keyup'];
            
            events.forEach(eventType => {
                field.addEventListener(eventType, () => {
                    debugInfo("FormBuilder", '🔄 PREVIEW FIELD CHANGE: Field changed:', field.name || field.id, 'Value:', field.value);
                    conditionalLogic.handleFieldChange(field);
                });
            });
        });
        
        // Initial evaluation of all conditions
        debugInfo("FormBuilder", '🔄 PREVIEW: Performing initial conditional logic evaluation');
        conditionalLogic.evaluateAllConditions();
        
        debugInfo("FormBuilder", '🔄 PREVIEW: Conditional logic listeners setup complete');
    }
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    loadForm(formData) {
        this.currentForm = formData;
        this.currentPageIndex = 0;
        this.fieldIdCounter = this.calculateNextFieldId();
        debugInfo("FormBuilder", '📋 Form loaded, fieldIdCounter set to:', this.fieldIdCounter);
        
        // Show form builder UI
        const buildingBlocks = document.getElementById('buildingBlocks');
        const bottomFooter = document.getElementById('bottomFooter');
        
        if (buildingBlocks) buildingBlocks.style.display = 'block';
        if (bottomFooter) bottomFooter.style.display = 'block';
        
        this.renderFormCanvas();
        this.markFormDirty();
    }
    
    calculateNextFieldId() {
        let maxId = 0;
        
        // Recursive function to find max field ID in any nested structure
        const findMaxIdInFields = (fields) => {
            fields.forEach(field => {
                // Check current field ID
                const match = field.id.match(/field_(\d+)/);
                if (match) {
                    maxId = Math.max(maxId, parseInt(match[1]));
                }
                
                // Check nested fields in sections
                if (field.type === 'section' && field.sectionConfig && field.sectionConfig.fields) {
                    findMaxIdInFields(field.sectionConfig.fields);
                }
                
                // Check nested fields in columns
                if (field.type === 'columns' && field.columnsConfig && field.columnsConfig.columns) {
                    field.columnsConfig.columns.forEach(column => {
                        if (column.fields) {
                            findMaxIdInFields(column.fields);
                        }
                    });
                }
            });
        };
        
        // Search through all pages
        this.currentForm.pages.forEach(page => {
            findMaxIdInFields(page.fields);
        });
        
        debugInfo("FormBuilder", '🔢 Calculated next field ID:', maxId + 1);
        return maxId + 1;
    }
    
    getFormData() {
        return this.currentForm;
    }

    loadSalesforceObjectsForPage() {
        const salesforce = window.AppModules.salesforce;
        if (salesforce && window.AppState.salesforceConnected) {
            salesforce.getObjects().then(objects => {
                const select = document.getElementById('page-salesforce-object');
                if (select) {
                    select.innerHTML = '<option value="">Not Mapped</option>';
                    objects.forEach(obj => {
                        const option = document.createElement('option');
                        option.value = obj.name;
                        option.textContent = obj.label;
                        if (this.getCurrentPage().salesforceObject === obj.name) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                }
            }).catch(error => {
                debugError("FormBuilder", 'Error loading Salesforce objects for page:', error);
            });
        }
    }

    loadSalesforceObjectsForPage() {
        const salesforce = window.AppModules.salesforce;
        if (salesforce && window.AppState.salesforceConnected) {
            salesforce.getObjects().then(objects => {
                const select = document.getElementById('page-salesforce-object');
                if (select) {
                    select.innerHTML = '<option value="">Not Mapped</option>';
                    objects.forEach(obj => {
                        const option = document.createElement('option');
                        option.value = obj.name;
                        option.textContent = obj.label;
                        if (this.getCurrentPage().salesforceObject === obj.name) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                }
            }).catch(error => {
                debugError("FormBuilder", 'Error loading Salesforce objects for page:', error);
            });
        }
    }

    loadSalesforceObjectsForPage() {
        const salesforce = window.AppModules.salesforce;
        if (salesforce && window.AppState.salesforceConnected) {
            salesforce.getObjects().then(objects => {
                const select = document.getElementById('page-salesforce-object');
                if (select) {
                    select.innerHTML = '<option value="">Select Object...</option>';
                    objects.forEach(obj => {
                        const option = document.createElement('option');
                        option.value = obj.name;
                        option.textContent = obj.label;
                        if (this.getCurrentPage().salesforceObject === obj.name) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                }
            }).catch(error => {
                debugError("FormBuilder", 'Error loading Salesforce objects for page:', error);
            });
        }
    }

    // Property Tab Management
    switchPropertyTab(tabType) {
        debugInfo("FormBuilder", 'switchPropertyTab called with:', tabType);
        
        // Update tab visual state
        document.querySelectorAll('.property-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const targetTab = document.querySelector(`[data-tab="${tabType}"]`);
        if (targetTab) {
            targetTab.classList.add('active');
            debugInfo("FormBuilder", '✅ Tab visual state updated for:', tabType);
        } else {
            debugError("FormBuilder", '❌ Tab not found:', tabType);
            return;
        }

        // Hide all property sections
        document.querySelectorAll('.property-section').forEach(section => {
            section.style.display = 'none';
        });
        debugInfo("FormBuilder", '🔧 All property sections hidden');

        // Show selected section and render content
        const section = document.getElementById(`${tabType}Properties`);
        if (section) {
            section.style.display = 'block';
            debugInfo("FormBuilder", '✅ Property section shown:', `${tabType}Properties`);
        } else {
            debugError("FormBuilder", '❌ Property section not found:', `${tabType}Properties`);
            return;
        }

        switch (tabType) {
            case 'form':
                debugInfo("FormBuilder", '📋 Showing form properties');
                this.showFormProperties();
                break;
            case 'page':
                debugInfo("FormBuilder", '📄 Showing page properties');
                this.showPageProperties();
                break;
            case 'field':
                debugInfo("FormBuilder", '🔧 Showing field properties');
                this.showFieldProperties();
                break;
            default:
                debugError("FormBuilder", '❌ Unknown tab type:', tabType);
        }
        
        debugInfo("FormBuilder", '🎉 switchPropertyTab completed for:', tabType);
    }

    // Form Properties
    showFormProperties() {
        const section = document.getElementById('formProperties');
        section.innerHTML = this.renderFormProperties();
        this.attachFormPropertyListeners();
    }

    renderFormProperties() {
        const form = this.currentForm;
        const settings = form.settings || {};

        return `
            <div class="properties-content">
                <!-- Form Sub-Tabs -->
                <div class="property-sub-tabs">
                    <button class="property-sub-tab active" onclick="window.AppModules.formBuilder.switchFormSubTab('basic')">📋 Basic</button>
                    <button class="property-sub-tab" onclick="window.AppModules.formBuilder.switchFormSubTab('appearance')">🎨 Style</button>
                    <button class="property-sub-tab" onclick="window.AppModules.formBuilder.switchFormSubTab('advanced')">⚙️ Advanced</button>
                </div>

                <!-- Basic Settings Tab -->
                <div class="property-sub-content" id="form-basic-tab">
                    <div class="property-row">
                        <div class="property-group-compact">
                            <label>Form Name</label>
                            <input type="text" id="form-name" value="${form.name || ''}" placeholder="Contact Registration">
                            <div class="help-text">Internal reference name</div>
                        </div>
                        <div class="property-group-compact">
                            <label>Submit Button Text</label>
                            <input type="text" id="form-submit-text" value="${settings.submitButtonText || 'Submit'}" placeholder="Submit">
                            <div class="help-text">Button text</div>
                        </div>
                    </div>
                    
                    <div class="property-group-compact">
                        <label>Form Description</label>
                        <textarea id="form-description" rows="2" placeholder="Brief description...">${form.description || ''}</textarea>
                        <div class="help-text">Optional description for documentation</div>
                    </div>
                    
                    <div class="property-group-compact">
                        <label>Success Message</label>
                        <textarea id="form-success-message" rows="2" placeholder="Thank you for your submission!">${settings.successMessage || ''}</textarea>
                        <div class="help-text">Message shown after successful submission</div>
                    </div>
                    
                    <div class="property-group-compact">
                        <label>Redirect URL (Optional)</label>
                        <input type="url" id="form-redirect-url" value="${settings.redirectUrl || ''}" placeholder="https://example.com/thank-you">
                        <div class="help-text">Redirect users after submission</div>
                    </div>
                </div>

                <!-- Appearance Tab -->
                <div class="property-sub-content" id="form-appearance-tab" style="display: none;">
                    <!-- Style Presets -->
                    <div class="property-group-compact">
                        <label>🎨 Quick Style Presets</label>
                        <div class="style-presets">
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyFormThemePreset('modern')">
                                ✨ Modern
                            </button>
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyFormThemePreset('corporate')">
                                🏢 Corporate
                            </button>
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyFormThemePreset('playful')">
                                🎈 Playful
                            </button>
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyFormThemePreset('minimal')">
                                📝 Minimal
                            </button>
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyFormThemePreset('dark')">
                                🌙 Dark
                            </button>
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.resetFormStyles()">
                                🔄 Reset
                            </button>
                        </div>
                        <div class="help-text">Click to apply predefined styles instantly</div>
                    </div>

                    <!-- Color Palette -->
                    <div class="property-group-compact">
                        <label>🎨 Color Palette</label>
                        <div class="color-picker-group">
                            <div class="color-picker-item">
                                <label>Primary</label>
                                <input type="color" class="color-picker" id="form-primary-color-picker" value="${settings.primaryColor || '#8b5cf6'}">
                            </div>
                            <div class="color-picker-item">
                                <label>Secondary</label>
                                <input type="color" class="color-picker" id="form-secondary-color-picker" value="${settings.secondaryColor || '#64748b'}">
                            </div>
                            <div class="color-picker-item">
                                <label>Background</label>
                                <input type="color" class="color-picker" id="form-bg-color-picker" value="${settings.backgroundColor || '#ffffff'}">
                            </div>
                            <div class="color-picker-item">
                                <label>Text</label>
                                <input type="color" class="color-picker" id="form-text-color-picker" value="${settings.textColor || '#111827'}">
                            </div>
                            <div class="color-picker-item">
                                <label>Border</label>
                                <input type="color" class="color-picker" id="form-border-color-picker" value="${settings.borderColor || '#e5e7eb'}">
                            </div>
                            <div class="color-picker-item">
                                <label>Accent</label>
                                <input type="color" class="color-picker" id="form-accent-color-picker" value="${settings.accentColor || '#f59e0b'}">
                            </div>
                        </div>
                        <div class="help-text">Customize form color scheme</div>
                    </div>

                    <!-- Live Style Preview -->
                    <div class="style-preview">
                        <div class="style-preview-title">📱 Live Preview</div>
                        <div class="style-preview-content" id="form-style-preview">
                            <div style="margin-bottom: 12px;">
                                <label style="display: block; margin-bottom: 4px; font-weight: 600;">Sample Field</label>
                                <input type="text" placeholder="Type here..." style="width: 100%; padding: 8px 12px; border: 1px solid; border-radius: 6px;">
                            </div>
                            <button style="padding: 8px 16px; border-radius: 6px; border: none; font-weight: 600; cursor: pointer;">
                                Submit Button
                            </button>
                        </div>
                    </div>

                    <div class="property-group-compact">
                        <label>Typography</label>
                        <div class="property-row">
                            <div class="property-group-compact">
                                <label>Font Family</label>
                                <select id="form-font-family">
                                    <option value="Inter" ${settings.fontFamily === 'Inter' ? 'selected' : ''}>Inter</option>
                                    <option value="Arial" ${settings.fontFamily === 'Arial' ? 'selected' : ''}>Arial</option>
                                    <option value="Helvetica" ${settings.fontFamily === 'Helvetica' ? 'selected' : ''}>Helvetica</option>
                                    <option value="Georgia" ${settings.fontFamily === 'Georgia' ? 'selected' : ''}>Georgia</option>
                                    <option value="Times New Roman" ${settings.fontFamily === 'Times New Roman' ? 'selected' : ''}>Times New Roman</option>
                                    <option value="custom" ${settings.fontFamily === 'custom' ? 'selected' : ''}>Custom</option>
                                </select>
                            </div>
                            <div class="property-group-compact">
                                <label>Base Font Size</label>
                                <select id="form-font-size">
                                    <option value="14px" ${settings.fontSize === '14px' ? 'selected' : ''}>Small (14px)</option>
                                    <option value="16px" ${settings.fontSize === '16px' || !settings.fontSize ? 'selected' : ''}>Normal (16px)</option>
                                    <option value="18px" ${settings.fontSize === '18px' ? 'selected' : ''}>Large (18px)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="property-group-compact">
                        <label>Layout</label>
                        <div class="property-row">
                            <div class="property-group-compact">
                                <label>Max Width</label>
                                <input type="text" id="form-max-width" value="${settings.maxWidth || '800px'}" placeholder="e.g., 800px, 100%">
                                <div class="help-text">Form container width</div>
                            </div>
                            <div class="property-group-compact">
                                <label>Padding</label>
                                <input type="text" id="form-padding" value="${settings.padding || '2rem'}" placeholder="e.g., 2rem, 24px">
                                <div class="help-text">Internal spacing</div>
                            </div>
                        </div>
                    </div>

                    <div class="property-group-compact">
                        <label>Style Options</label>
                        <div class="checkbox-list">
                            <div class="form-checkbox">
                                <input type="checkbox" id="form-show-progress" ${settings.showProgress ? 'checked' : ''}>
                                <label for="form-show-progress">Show Progress Bar</label>
                            </div>
                            <div class="form-checkbox">
                                <input type="checkbox" id="form-rounded-corners" ${settings.roundedCorners !== false ? 'checked' : ''}>
                                <label for="form-rounded-corners">Rounded Corners</label>
                            </div>
                            <div class="form-checkbox">
                                <input type="checkbox" id="form-show-shadows" ${settings.showShadows !== false ? 'checked' : ''}>
                                <label for="form-show-shadows">Show Shadows</label>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Advanced Tab -->
                <div class="property-sub-content" id="form-advanced-tab" style="display: none;">
                    <div class="property-group-compact">
                        <label>Email Configuration (OTP)</label>
                        <div class="checkbox-list">
                            <div class="form-checkbox">
                                <input type="checkbox" id="form-use-custom-email" ${settings.useCustomEmail ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.toggleCustomEmail(this.checked)">
                                <label for="form-use-custom-email">Use Custom SMTP Server</label>
                            </div>
                        </div>
                        <div class="help-text">Configure custom email settings for OTP delivery (defaults to pilotforms.com)</div>
                    </div>

                    <div id="custom-email-config" style="display: ${settings.useCustomEmail ? 'block' : 'none'}">
                        <div class="property-group-compact">
                            <label>Email Provider</label>
                            <select id="form-email-provider" onchange="window.AppModules.formBuilder.updateEmailProvider(this.value)">
                                <option value="smtp" ${settings.emailProvider === 'smtp' || !settings.emailProvider ? 'selected' : ''}>Custom SMTP</option>
                                <option value="gmail" ${settings.emailProvider === 'gmail' ? 'selected' : ''}>Gmail</option>
                                <option value="sendgrid" ${settings.emailProvider === 'sendgrid' ? 'selected' : ''}>SendGrid</option>
                            </select>
                        </div>

                        <div id="smtp-config" style="display: ${settings.emailProvider !== 'gmail' && settings.emailProvider !== 'sendgrid' ? 'block' : 'none'}">
                            <div class="property-row">
                                <div class="property-group-compact">
                                    <label>SMTP Host</label>
                                    <input type="text" id="form-email-host" value="${settings.emailHost || ''}" placeholder="smtp.yourdomain.com">
                                </div>
                                <div class="property-group-compact">
                                    <label>Port</label>
                                    <input type="number" id="form-email-port" value="${settings.emailPort || '587'}" placeholder="587">
                                </div>
                            </div>
                            <div class="property-row">
                                <div class="property-group-compact">
                                    <label>Username</label>
                                    <input type="text" id="form-email-user" value="${settings.emailUser || ''}" placeholder="user@yourdomain.com">
                                </div>
                                <div class="property-group-compact">
                                    <label>Password</label>
                                    <input type="password" id="form-email-pass" value="${settings.emailPass || ''}" placeholder="Your password">
                                </div>
                            </div>
                            <div class="form-checkbox">
                                <input type="checkbox" id="form-email-secure" ${settings.emailSecure ? 'checked' : ''}>
                                <label for="form-email-secure">Use SSL/TLS</label>
                            </div>
                        </div>

                        <div id="gmail-config" style="display: ${settings.emailProvider === 'gmail' ? 'block' : 'none'}">
                            <div class="property-group-compact">
                                <label>Gmail Address</label>
                                <input type="email" id="form-gmail-user" value="${settings.gmailUser || ''}" placeholder="your-gmail@gmail.com">
                                <div class="help-text">Your Gmail address</div>
                            </div>
                            <div class="property-group-compact">
                                <label>App Password</label>
                                <input type="password" id="form-gmail-pass" value="${settings.gmailPass || ''}" placeholder="16-character app password">
                                <div class="help-text">Generate at <a href="https://myaccount.google.com/apppasswords" target="_blank">Google App Passwords</a></div>
                            </div>
                        </div>

                        <div id="sendgrid-config" style="display: ${settings.emailProvider === 'sendgrid' ? 'block' : 'none'}">
                            <div class="property-group-compact">
                                <label>SendGrid API Key</label>
                                <input type="password" id="form-sendgrid-key" value="${settings.sendgridKey || ''}" placeholder="SG.xxxxxxxxxxxxxxxx">
                                <div class="help-text">Your SendGrid API key</div>
                            </div>
                        </div>

                        <div class="property-group-compact">
                            <label>From Email Address</label>
                            <input type="email" id="form-email-from" value="${settings.emailFrom || 'noreply@yourdomain.com'}" placeholder="noreply@yourdomain.com">
                            <div class="help-text">Email address for OTP messages</div>
                        </div>

                        <div class="property-group-compact">
                            <label>From Name</label>
                            <input type="text" id="form-email-from-name" value="${settings.emailFromName || 'Form Builder'}" placeholder="Your Company">
                            <div class="help-text">Display name for OTP emails</div>
                        </div>

                        <div class="property-group-compact">
                            <button type="button" class="property-button-compact" onclick="window.AppModules.formBuilder.testEmailConfiguration()">
                                📧 Test Email Configuration
                            </button>
                            <div class="help-text">Send a test email to verify settings</div>
                        </div>
                    </div>

                    <!-- Custom CSS Editor -->
                    <div class="property-group-compact">
                        <label>🎨 Custom CSS Editor</label>
                        <div class="css-editor-container">
                            <textarea id="form-custom-css" class="css-editor" rows="8" 
                                placeholder="/* Custom CSS styles for this form */
.form-container {
    /* Form-level styles */
}

.form-field {
    /* Field-level styles */
}

.submit-button {
    /* Button styles */
}">${settings.customCSS || ''}</textarea>
                            <div class="help-text">
                                Advanced CSS styling. Use classes: .form-container, .form-field, .field-label, .submit-button
                                <br><strong>Tips:</strong> Changes apply in real-time • Use CSS variables for consistent theming
                            </div>
                            <div class="property-row" style="margin-top: var(--space-2);">
                                <button type="button" class="property-button-compact" onclick="window.AppModules.formBuilder.formatCustomCSS()">
                                    ✨ Format CSS
                                </button>
                                <button type="button" class="property-button-compact" onclick="window.AppModules.formBuilder.insertCSSTemplate()">
                                    📝 Insert Template
                                </button>
                                <button type="button" class="property-button-compact" onclick="window.AppModules.formBuilder.validateCSS()">
                                    ✅ Validate
                                </button>
                                <button type="button" class="property-button-compact" onclick="window.AppModules.formBuilder.clearCustomCSS()">
                                    🗑️ Clear
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- CSS Snippets -->
                    <div class="property-group-compact">
                        <label>📚 CSS Snippets</label>
                        <div class="style-presets">
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.insertCSSSnippet('gradient-bg')">
                                🌈 Gradient Background
                            </button>
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.insertCSSSnippet('glass-effect')">
                                💎 Glass Effect
                            </button>
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.insertCSSSnippet('hover-animations')">
                                ✨ Hover Effects
                            </button>
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.insertCSSSnippet('custom-fonts')">
                                📝 Custom Fonts
                            </button>
                        </div>
                        <div class="help-text">Click to insert common CSS patterns</div>
                    </div>
                </div>
            </div>
        `;
    }

    attachFormPropertyListeners() {
        const elements = [
            { id: 'form-name', event: 'input', handler: (e) => { this.currentForm.name = e.target.value; this.markFormDirty(); } },
            { id: 'form-description', event: 'input', handler: (e) => { this.currentForm.description = e.target.value; this.markFormDirty(); } },
            { id: 'form-submit-text', event: 'input', handler: (e) => { this.updateFormSetting('submitButtonText', e.target.value); } },
            { id: 'form-success-message', event: 'input', handler: (e) => { this.updateFormSetting('successMessage', e.target.value); } },
            { id: 'form-redirect-url', event: 'input', handler: (e) => { this.updateFormSetting('redirectUrl', e.target.value); } },
            { id: 'form-primary-color-picker', event: 'input', handler: (e) => { this.updateFormSetting('primaryColor', e.target.value); this.updateStylePreview(); } },
            { id: 'form-secondary-color-picker', event: 'input', handler: (e) => { this.updateFormSetting('secondaryColor', e.target.value); this.updateStylePreview(); } },
            { id: 'form-bg-color-picker', event: 'input', handler: (e) => { this.updateFormSetting('backgroundColor', e.target.value); this.updateStylePreview(); } },
            { id: 'form-text-color-picker', event: 'input', handler: (e) => { this.updateFormSetting('textColor', e.target.value); this.updateStylePreview(); } },
            { id: 'form-border-color-picker', event: 'input', handler: (e) => { this.updateFormSetting('borderColor', e.target.value); this.updateStylePreview(); } },
            { id: 'form-accent-color-picker', event: 'input', handler: (e) => { this.updateFormSetting('accentColor', e.target.value); this.updateStylePreview(); } },
            { id: 'form-font-family', event: 'change', handler: (e) => { this.updateFormSetting('fontFamily', e.target.value); } },
            { id: 'form-font-size', event: 'change', handler: (e) => { this.updateFormSetting('fontSize', e.target.value); } },
            { id: 'form-max-width', event: 'input', handler: (e) => { this.updateFormSetting('maxWidth', e.target.value); } },
            { id: 'form-padding', event: 'input', handler: (e) => { this.updateFormSetting('padding', e.target.value); } },
            { id: 'form-show-progress', event: 'change', handler: (e) => { this.updateFormSetting('showProgress', e.target.checked); } },
            { id: 'form-rounded-corners', event: 'change', handler: (e) => { this.updateFormSetting('roundedCorners', e.target.checked); } },
            { id: 'form-show-shadows', event: 'change', handler: (e) => { this.updateFormSetting('showShadows', e.target.checked); } },
            { id: 'form-email-host', event: 'input', handler: (e) => { this.updateFormSetting('emailHost', e.target.value); } },
            { id: 'form-email-port', event: 'input', handler: (e) => { this.updateFormSetting('emailPort', e.target.value); } },
            { id: 'form-email-user', event: 'input', handler: (e) => { this.updateFormSetting('emailUser', e.target.value); } },
            { id: 'form-email-pass', event: 'input', handler: (e) => { this.updateFormSetting('emailPass', e.target.value); } },
            { id: 'form-email-secure', event: 'change', handler: (e) => { this.updateFormSetting('emailSecure', e.target.checked); } },
            { id: 'form-gmail-user', event: 'input', handler: (e) => { this.updateFormSetting('gmailUser', e.target.value); } },
            { id: 'form-gmail-pass', event: 'input', handler: (e) => { this.updateFormSetting('gmailPass', e.target.value); } },
            { id: 'form-sendgrid-key', event: 'input', handler: (e) => { this.updateFormSetting('sendgridKey', e.target.value); } },
            { id: 'form-email-from', event: 'input', handler: (e) => { this.updateFormSetting('emailFrom', e.target.value); } },
            { id: 'form-email-from-name', event: 'input', handler: (e) => { this.updateFormSetting('emailFromName', e.target.value); } },
            { id: 'form-custom-css', event: 'input', handler: (e) => { this.updateFormSetting('customCSS', e.target.value); this.updateStylePreview(); } }
        ];

        elements.forEach(elConfig => {
            const element = document.getElementById(elConfig.id);
            if (element) {
                element.addEventListener(elConfig.event, elConfig.handler);
            }
        });
    }

    switchFormSubTab(tabName) {
        // Hide all form sub-tab contents
        const tabs = ['basic', 'appearance', 'advanced'];
        tabs.forEach(tab => {
            const content = document.getElementById(`form-${tab}-tab`);
            const button = document.querySelector(`[onclick="window.AppModules.formBuilder.switchFormSubTab('${tab}')"]`);
            if (content) content.style.display = 'none';
            if (button) button.classList.remove('active');
        });

        // Show selected tab
        const selectedContent = document.getElementById(`form-${tabName}-tab`);
        const selectedButton = document.querySelector(`[onclick="window.AppModules.formBuilder.switchFormSubTab('${tabName}')"]`);
        if (selectedContent) selectedContent.style.display = 'block';
        if (selectedButton) selectedButton.classList.add('active');
    }

    switchPageSubTab(tabName) {
        // Hide all page sub-tab contents
        const tabs = ['basic', 'styles', 'salesforce', 'conditions', 'navigation', 'advanced'];
        tabs.forEach(tab => {
            const content = document.getElementById(`page-${tab}-tab`);
            const button = document.querySelector(`[onclick="window.AppModules.formBuilder.switchPageSubTab('${tab}')"]`);
            if (content) content.style.display = 'none';
            if (button) button.classList.remove('active');
        });

        // Show selected tab
        const selectedContent = document.getElementById(`page-${tabName}-tab`);
        const selectedButton = document.querySelector(`[onclick="window.AppModules.formBuilder.switchPageSubTab('${tabName}')"]`);
        if (selectedContent) selectedContent.style.display = 'block';
        if (selectedButton) selectedButton.classList.add('active');
    }

    switchFieldSubTab(tabName) {
        // Hide all field sub-tab contents
        const tabs = ['basic', 'config', 'salesforce', 'conditions', 'style'];
        tabs.forEach(tab => {
            const content = document.getElementById(`field-${tab}-tab`);
            const button = document.querySelector(`[onclick="window.AppModules.formBuilder.switchFieldSubTab('${tab}')"]`);
            if (content) content.style.display = 'none';
            if (button) button.classList.remove('active');
        });

        // Show selected tab
        const selectedContent = document.getElementById(`field-${tabName}-tab`);
        const selectedButton = document.querySelector(`[onclick="window.AppModules.formBuilder.switchFieldSubTab('${tabName}')"]`);
        if (selectedContent) selectedContent.style.display = 'block';
        if (selectedButton) selectedButton.classList.add('active');
        
        // Load Salesforce fields when switching to Salesforce tab
        if (tabName === 'salesforce') {
            this.loadSalesforceFieldsForMapping();
        }
    }
    
    async loadSalesforceFieldsForMapping() {
        const currentPage = this.getCurrentPage();
        const salesforceObject = currentPage?.salesforceObject;
        
        if (!window.AppState.salesforceConnected || !salesforceObject) {
            return;
        }
        
        try {
            // Get the field dropdown
            const fieldSelect = document.getElementById('prop-salesforceField');
            if (!fieldSelect) return;
            
            // Show loading state
            fieldSelect.innerHTML = '<option value="_loading_">Loading fields...</option>';
            
            // Ensure salesforce connector is available
            let salesforceConnector = window.AppModules?.salesforce;
            
            // If not available in AppModules, try to get it directly
            if (!salesforceConnector) {
                console.warn('SalesforceConnector not found in AppModules, attempting direct access...');
                // Try to initialize or get the connector
                if (window.SalesforceConnector) {
                    salesforceConnector = new window.SalesforceConnector();
                    await salesforceConnector.initialize();
                } else {
                    throw new Error('SalesforceConnector class not available');
                }
            }
            
            // Verify the method exists
            if (!salesforceConnector.getObjectFields) {
                throw new Error('getObjectFields method not available on salesforce connector');
            }
            
            // Load fields from Salesforce
            const fields = await salesforceConnector.getObjectFields(salesforceObject);
            
            // Clear and populate dropdown
            fieldSelect.innerHTML = '<option value="">Not Mapped</option>';
            
            // Group fields by type for better organization
            const standardFields = [];
            const customFields = [];
            
            fields.forEach(field => {
                if (field.name.endsWith('__c')) {
                    customFields.push(field);
                } else {
                    standardFields.push(field);
                }
            });
            
            // Add standard fields
            if (standardFields.length > 0) {
                const standardGroup = document.createElement('optgroup');
                standardGroup.label = 'Standard Fields';
                
                standardFields.forEach(field => {
                    const option = document.createElement('option');
                    option.value = field.name;
                    option.textContent = `${field.label} (${field.name}) - ${field.type}`;
                    
                    // Select current value if it matches
                    if (this.selectedField?.salesforceField === field.name) {
                        option.selected = true;
                    }
                    
                    standardGroup.appendChild(option);
                });
                
                fieldSelect.appendChild(standardGroup);
            }
            
            // Add custom fields
            if (customFields.length > 0) {
                const customGroup = document.createElement('optgroup');
                customGroup.label = 'Custom Fields';
                
                customFields.forEach(field => {
                    const option = document.createElement('option');
                    option.value = field.name;
                    option.textContent = `${field.label} (${field.name}) - ${field.type}`;
                    
                    // Select current value if it matches
                    if (this.selectedField?.salesforceField === field.name) {
                        option.selected = true;
                    }
                    
                    customGroup.appendChild(option);
                });
                
                fieldSelect.appendChild(customGroup);
            }
            
            
        } catch (error) {
            console.error('❌ Error loading Salesforce fields:', error);
            console.error('Debug info:', {
                salesforceConnected: window.AppState.salesforceConnected,
                salesforceObject: salesforceObject,
                appModules: Object.keys(window.AppModules || {}),
                salesforceModule: !!window.AppModules?.salesforce
            });
            
            const fieldSelect = document.getElementById('prop-salesforceField');
            if (fieldSelect) {
                fieldSelect.innerHTML = `
                    <option value="">Not Mapped</option>
                    <option value="_error_">Error loading fields - ${error.message}</option>
                    <option value="_manual_">Enter field API name manually</option>
                `;
            }
        }
    }

    renderFieldConfigTab(field) {
        let content = '';
        
        // Type-specific configuration
        switch (field.type) {
            case 'text':
            case 'email':
            case 'phone':
            case 'textarea':
                content = `
                    <div class="property-group-compact">
                        <label>Placeholder</label>
                        <input type="text" id="prop-placeholder" value="${field.placeholder || ''}"
                               onchange="window.AppModules.formBuilder.updateFieldProperty('placeholder', this.value)">
                        <div class="help-text">Hint text for user input</div>
                    </div>
                `;
                break;
            
            case 'checkbox':
                content = `
                    <div class="property-group-compact">
                        <label>Checkbox Text</label>
                        <input type="text" id="prop-checkboxLabel" value="${field.checkboxLabel || 'Check this box'}"
                               onchange="window.AppModules.formBuilder.updateFieldProperty('checkboxLabel', this.value)">
                        <div class="help-text">Text next to checkbox</div>
                    </div>
                `;
                break;
            
            case 'select':
            case 'radio':
                content = `
                    <div class="property-group-compact">
                        <div class="form-checkbox">
                            <input type="checkbox" id="prop-usePicklist" ${field.usePicklist ? 'checked' : ''}
                                   onchange="window.AppModules.formBuilder.togglePicklist(this.checked)">
                            <label for="prop-usePicklist">Use Salesforce Picklist</label>
                        </div>
                        <div class="help-text">Load options from Salesforce</div>
                    </div>
                    
                    <div id="picklistConfig" style="display: ${field.usePicklist ? 'block' : 'none'}">
                        <div class="property-group-compact">
                            <label>Salesforce Object</label>
                            <select id="prop-picklistObject" onchange="window.AppModules.formBuilder.updatePicklistObject(this.value)">
                                <option value="">Select Object...</option>
                            </select>
                            <div class="help-text">Source object</div>
                        </div>
                        
                        <div class="property-group-compact">
                            <label>Picklist Field</label>
                            <select id="prop-picklistField" onchange="window.AppModules.formBuilder.updatePicklistField(this.value)">
                                <option value="">Select Field...</option>
                            </select>
                            <div class="help-text">Picklist field name</div>
                        </div>
                    </div>
                    
                    <div id="manualOptions" style="display: ${field.usePicklist ? 'none' : 'block'}">
                        <div class="property-group-compact">
                            <label>Options</label>
                            <div id="optionsList">
                                ${this.renderOptionsList(field.options || [])}
                            </div>
                            <button class="property-button-compact" onclick="window.AppModules.formBuilder.addOption()">
                                ➕ Add Option
                            </button>
                            <div class="help-text">Manual option list</div>
                        </div>
                    </div>
                `;
                break;

            case 'datatable':
                const dataTableConfig = field.dataTableConfig || {};
                content = `
                    <div class="property-group-compact">
                        <label>Table Title</label>
                        <input type="text" id="prop-dataTableTitle" value="${dataTableConfig.title || ''}"
                               onchange="window.AppModules.formBuilder.updateDataTableConfig('title', this.value)">
                        <div class="help-text">Display title for the table</div>
                    </div>
                    
                    <div class="property-group-compact">
                        <label>Description</label>
                        <textarea id="prop-dataTableDescription" 
                                  onchange="window.AppModules.formBuilder.updateDataTableConfig('description', this.value)">${dataTableConfig.description || ''}</textarea>
                        <div class="help-text">Optional description text</div>
                    </div>
                    
                    <div class="property-group-compact">
                        <label>Data Source</label>
                        <select id="prop-dataSource" onchange="window.AppModules.formBuilder.updateDataTableConfig('dataSource', this.value)">
                            <option value="static" ${dataTableConfig.dataSource === 'static' ? 'selected' : ''}>Static Data (Manual Entry)</option>
                            <option value="variable" ${dataTableConfig.dataSource === 'variable' ? 'selected' : ''}>From Variable</option>
                            <option value="query" ${dataTableConfig.dataSource === 'query' ? 'selected' : ''}>Salesforce Query</option>
                        </select>
                        <div class="help-text">Choose how to populate table data</div>
                    </div>
                    
                    <div id="variable-source-config" style="display: ${dataTableConfig.dataSource === 'variable' ? 'block' : 'none'}">
                        <div class="property-group-compact">
                            <label>Source Variable</label>
                            <select id="prop-sourceVariable" onchange="window.AppModules.formBuilder.updateDataTableConfig('sourceVariable', this.value)">
                                <option value="">Select Variable...</option>
                                ${this.renderVariableOptions(dataTableConfig.sourceVariable)}
                            </select>
                            <div class="help-text">Variable containing array data</div>
                        </div>
                    </div>
                    
                    <div id="query-source-config" style="display: ${dataTableConfig.dataSource === 'query' ? 'block' : 'none'}">
                        <div class="property-group-compact">
                            <label>Query Page</label>
                            <select id="prop-sourcePageId" onchange="window.AppModules.formBuilder.updateDataTableConfig('sourcePageId', this.value)">
                                <option value="">Select Page...</option>
                                ${this.renderPageOptions(dataTableConfig.sourcePageId)}
                            </select>
                            <div class="help-text">Page with Salesforce query action</div>
                        </div>
                        
                        <div class="property-group-compact">
                            <label>Auto-Generate Columns</label>
                            <div class="field-selection-container">
                                <div id="available-fields-list" class="field-list">
                                    <div class="field-selection-info">Select fields to create table columns automatically</div>
                                </div>
                                <button class="property-button-compact" onclick="window.AppModules.formBuilder.createColumnsFromSelectedFields()">
                                    🔧 Generate Columns
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="property-group-compact">
                        <label>Table Columns</label>
                        <div id="datatable-columns-container">
                            ${this.renderDataTableColumns(dataTableConfig.columns || [])}
                        </div>
                        <button class="property-button-compact" onclick="window.AppModules.formBuilder.addDataTableColumn()">
                            ➕ Add Column
                        </button>
                        <div class="help-text">Define table structure</div>
                    </div>
                    
                    <div class="property-group-compact">
                        <label>Table Options</label>
                        <div class="checkbox-list">
                            <div class="form-checkbox">
                                <input type="checkbox" id="prop-allowAdd" ${dataTableConfig.allowAdd ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateDataTableConfig('allowAdd', this.checked)">
                                <label for="prop-allowAdd">Allow Add Rows</label>
                            </div>
                            <div class="form-checkbox">
                                <input type="checkbox" id="prop-allowEdit" ${dataTableConfig.allowEdit ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateDataTableConfig('allowEdit', this.checked)">
                                <label for="prop-allowEdit">Allow Edit Rows</label>
                            </div>
                            <div class="form-checkbox">
                                <input type="checkbox" id="prop-allowDelete" ${dataTableConfig.allowDelete ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateDataTableConfig('allowDelete', this.checked)">
                                <label for="prop-allowDelete">Allow Delete Rows</label>
                            </div>
                            <div class="form-checkbox">
                                <input type="checkbox" id="prop-showPagination" ${dataTableConfig.showPagination ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateDataTableConfig('showPagination', this.checked)">
                                <label for="prop-showPagination">Show Pagination</label>
                            </div>
                        </div>
                    </div>
                    
                    <div id="pagination-config" style="display: ${dataTableConfig.showPagination ? 'block' : 'none'}">
                        <div class="property-group-compact">
                            <label>Page Size</label>
                            <select id="prop-pageSize" onchange="window.AppModules.formBuilder.updateDataTableConfig('pageSize', parseInt(this.value))">
                                <option value="5" ${dataTableConfig.pageSize === 5 ? 'selected' : ''}>5 rows</option>
                                <option value="10" ${dataTableConfig.pageSize === 10 ? 'selected' : ''}>10 rows</option>
                                <option value="25" ${dataTableConfig.pageSize === 25 ? 'selected' : ''}>25 rows</option>
                                <option value="50" ${dataTableConfig.pageSize === 50 ? 'selected' : ''}>50 rows</option>
                            </select>
                            <div class="help-text">Rows per page</div>
                        </div>
                    </div>
                `;
                break;
        }
        
        return content || '<div class="property-group-compact"><p>No additional configuration needed for this field type.</p></div>';
    }

    renderFieldSalesforceTab(field) {
        // Enhanced Salesforce field mapping for all field types
        if (field.type === 'lookup') {
            return `
                <div class="salesforce-mapping">
                    <h4>🔍 Lookup Configuration</h4>
                    <div class="property-group-compact">
                        <label>Salesforce Object</label>
                        <select id="prop-lookupObject" class="salesforce-field-select" onchange="window.AppModules.formBuilder.updateLookupObject(this.value)">
                            <option value="">Select Object...</option>
                        </select>
                        <div class="mapping-help-text">Object to search for records</div>
                    </div>
                    
                    <div class="property-row">
                        <div class="property-group-compact">
                            <label>Display Field</label>
                            <select id="prop-displayField" class="salesforce-field-select" onchange="window.AppModules.formBuilder.updateFieldProperty('displayField', this.value)">
                                <option value="Name">Name</option>
                            </select>
                            <div class="mapping-help-text">Field to show in dropdown</div>
                        </div>
                        
                        <div class="property-group-compact">
                            <label>Search Field</label>
                            <select id="prop-searchField" class="salesforce-field-select" onchange="window.AppModules.formBuilder.updateFieldProperty('searchField', this.value)">
                                <option value="Name">Name</option>
                            </select>
                            <div class="mapping-help-text">Field to search in</div>
                        </div>
                    </div>
                    
                    <div class="property-group-compact">
                        <label>Store Record ID Variable</label>
                        <input type="text" id="prop-storeIdVariable" value="${field.storeIdVariable || ''}" class="salesforce-field-select"
                               onchange="window.AppModules.formBuilder.updateFieldProperty('storeIdVariable', this.value)">
                        <div class="mapping-help-text">Variable name to store selected record ID</div>
                    </div>
                </div>
            `;
        }
        
        // Get current page's Salesforce object for field mapping
        const currentPage = this.getCurrentPage();
        const salesforceObject = currentPage?.salesforceObject;
        
        return `
            <div class="salesforce-mapping">
                <h4>🔗 Field Mapping</h4>
                ${!window.AppState.salesforceConnected ? `
                    <div class="mapping-required">
                        ⚠️ Please connect to Salesforce first to enable field mapping
                    </div>
                ` : ''}
                
                ${!salesforceObject ? `
                    <div class="property-group-compact">
                        <div class="mapping-required">
                            ⚠️ No Salesforce object selected for this page
                        </div>
                        <div class="mapping-help-text">Go to Page properties and select a Salesforce object first</div>
                    </div>
                ` : `
                    <div class="property-group-compact">
                        <label>Map to Salesforce Field</label>
                        <select id="prop-salesforceField" class="salesforce-field-select" 
                                onchange="window.AppModules.formBuilder.updateFieldProperty('salesforceField', this.value)">
                            <option value="">Not Mapped</option>
                            <option value="_loading_">Loading fields...</option>
                        </select>
                        <div class="mapping-help-text">
                            Current object: <strong>${salesforceObject}</strong>
                        </div>
                    </div>
                    
                    <div class="property-group-compact">
                        <label>Manual Field API Name</label>
                        <input type="text" id="prop-salesforceFieldManual" value="${field.salesforceField || ''}" 
                               class="salesforce-field-select" placeholder="e.g., Custom_Field__c"
                               onchange="window.AppModules.formBuilder.updateFieldProperty('salesforceField', this.value)">
                        <div class="mapping-help-text">Override with custom field API name</div>
                    </div>
                    
                    ${field.type === 'checkbox' ? `
                        <div class="property-group-compact">
                            <div class="form-checkbox">
                                <input type="checkbox" id="prop-booleanMapping" ${field.booleanMapping ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateFieldProperty('booleanMapping', this.checked)">
                                <label for="prop-booleanMapping">Map as Boolean</label>
                            </div>
                            <div class="mapping-help-text">Convert checkbox to true/false for Salesforce</div>
                        </div>
                    ` : ''}
                    
                    ${field.type === 'select' || field.type === 'radio' ? `
                        <div class="property-group-compact">
                            <div class="form-checkbox">
                                <input type="checkbox" id="prop-usePicklistValues" ${field.usePicklistValues ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateFieldProperty('usePicklistValues', this.checked)">
                                <label for="prop-usePicklistValues">Load Picklist Values</label>
                            </div>
                            <div class="mapping-help-text">Automatically load options from Salesforce picklist</div>
                        </div>
                    ` : ''}
                `}
            </div>
        `;
    }

    renderFieldConditionsTab(field) {
        return `
            <div class="property-group-compact">
                <div class="form-checkbox">
                    <input type="checkbox" id="prop-conditionalVisibility" ${field.conditionalVisibility?.enabled ? 'checked' : ''}
                           onchange="window.AppModules.formBuilder.toggleConditionalVisibility(this.checked)">
                    <label for="prop-conditionalVisibility">Conditional Visibility</label>
                </div>
                <div class="help-text">Show/hide based on other field values</div>
            </div>
            
            <div id="conditionalConfig" style="display: ${field.conditionalVisibility?.enabled ? 'block' : 'none'}">
                <div class="property-group-compact">
                    <label>Show When</label>
                    <select id="prop-conditionField" onchange="window.AppModules.formBuilder.updateConditionField(this.value)">
                        <option value="">Select Field...</option>
                        ${(() => {
                            const availableFields = this.getAvailableFields(this.currentForm, this.getCurrentPage(), field);
                            return availableFields.map(f => `
                                <option value="${f.id}" ${field.conditionalVisibility?.dependsOn === f.id ? 'selected' : ''}>
                                    ${f.label}
                                </option>
                            `).join('');
                        })()}
                    </select>
                    <div class="help-text">Field to check</div>
                </div>
                
                <div class="property-row">
                    <div class="property-group-compact">
                        <label>Condition</label>
                        <select id="prop-conditionOperator" onchange="window.AppModules.formBuilder.updateConditionOperator(this.value)">
                            <option value="equals" ${field.conditionalVisibility?.condition === 'equals' ? 'selected' : ''}>Equals</option>
                            <option value="not_equals" ${field.conditionalVisibility?.condition === 'not_equals' ? 'selected' : ''}>Not Equals</option>
                            <option value="contains" ${field.conditionalVisibility?.condition === 'contains' ? 'selected' : ''}>Contains</option>
                            <option value="not_contains" ${field.conditionalVisibility?.condition === 'not_contains' ? 'selected' : ''}>Does not contain</option>
                            <option value="starts_with" ${field.conditionalVisibility?.condition === 'starts_with' ? 'selected' : ''}>Starts with</option>
                            <option value="ends_with" ${field.conditionalVisibility?.condition === 'ends_with' ? 'selected' : ''}>Ends with</option>
                            <option value="is_empty" ${field.conditionalVisibility?.condition === 'is_empty' ? 'selected' : ''}>Is empty</option>
                            <option value="is_not_empty" ${field.conditionalVisibility?.condition === 'is_not_empty' ? 'selected' : ''}>Is not empty</option>
                            <option value="greater_than" ${field.conditionalVisibility?.condition === 'greater_than' ? 'selected' : ''}>Greater than</option>
                            <option value="less_than" ${field.conditionalVisibility?.condition === 'less_than' ? 'selected' : ''}>Less than</option>
                            <option value="greater_equal" ${field.conditionalVisibility?.condition === 'greater_equal' ? 'selected' : ''}>Greater or equal</option>
                            <option value="less_equal" ${field.conditionalVisibility?.condition === 'less_equal' ? 'selected' : ''}>Less or equal</option>
                        </select>
                        <div class="help-text">Comparison type</div>
                    </div>
                    
                    <div class="property-group-compact" id="conditionValueGroup" style="display: ${this.needsValueInput(field.conditionalVisibility?.condition) ? 'block' : 'none'}">
                        <label>Value</label>
                        <input type="text" id="prop-conditionValue" value="${field.conditionalVisibility?.value || ''}"
                               onchange="window.AppModules.formBuilder.updateConditionValue(this.value)">
                        <div class="help-text">Value to compare</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderFieldStyleTab(field) {
        if (!field.styling) field.styling = {};
        const styling = field.styling;
        
        return `
            <!-- Field Style Presets -->
            <div class="property-group-compact">
                <label>🎨 Field Style Presets</label>
                <div class="style-presets">
                    <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyFieldStylePreset('modern')">
                        ✨ Modern
                    </button>
                    <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyFieldStylePreset('minimal')">
                        📝 Minimal
                    </button>
                    <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyFieldStylePreset('rounded')">
                        🔘 Rounded
                    </button>
                    <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyFieldStylePreset('material')">
                        📱 Material
                    </button>
                    <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyFieldStylePreset('bold')">
                        💪 Bold
                    </button>
                    <button class="style-preset-btn" onclick="window.AppModules.formBuilder.resetFieldStyles()">
                        🔄 Reset
                    </button>
                </div>
                <div class="help-text">Quick field styling presets</div>
            </div>

            <!-- Layout Options -->
            <div class="property-group-compact">
                <label>Layout</label>
                <div class="property-row">
                    <div class="property-group-compact">
                        <label>Width</label>
                        <select id="prop-width" onchange="window.AppModules.formBuilder.updateFieldStyling('width', this.value)">
                            <option value="full" ${styling.width === 'full' || !styling.width ? 'selected' : ''}>Full Width</option>
                            <option value="half" ${styling.width === 'half' ? 'selected' : ''}>Half Width</option>
                            <option value="third" ${styling.width === 'third' ? 'selected' : ''}>One Third</option>
                            <option value="quarter" ${styling.width === 'quarter' ? 'selected' : ''}>Quarter</option>
                            <option value="custom" ${styling.width === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    ${styling.width === 'custom' ? `
                        <div class="property-group-compact">
                            <label>Custom Width</label>
                            <input type="text" value="${styling.customWidth || '100%'}" 
                                   placeholder="e.g., 300px, 50%"
                                   onchange="window.AppModules.formBuilder.updateFieldStyling('customWidth', this.value)">
                        </div>
                    ` : ''}
                </div>
            </div>

            <!-- Spacing -->
            <div class="property-group-compact">
                <label>Spacing</label>
                <div class="property-row">
                    <div class="property-group-compact">
                        <label>Margin</label>
                        <input type="text" placeholder="e.g., 10px, 1rem"
                               value="${styling.margin || ''}"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('margin', this.value)">
                    </div>
                    <div class="property-group-compact">
                        <label>Padding</label>
                        <input type="text" placeholder="e.g., 10px, 1rem"
                               value="${styling.padding || ''}"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('padding', this.value)">
                    </div>
                </div>
            </div>

            <!-- Field Colors -->
            <div class="property-group-compact">
                <label>🎨 Field Colors</label>
                <div class="color-picker-group">
                    <div class="color-picker-item">
                        <label>Background</label>
                        <input type="color" class="color-picker" value="${styling.backgroundColor || '#ffffff'}"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('backgroundColor', this.value)">
                    </div>
                    <div class="color-picker-item">
                        <label>Text</label>
                        <input type="color" class="color-picker" value="${styling.color || '#000000'}"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('color', this.value)">
                    </div>
                    <div class="color-picker-item">
                        <label>Border</label>
                        <input type="color" class="color-picker" value="${styling.borderColor || '#e5e7eb'}"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('borderColor', this.value)">
                    </div>
                    <div class="color-picker-item">
                        <label>Focus</label>
                        <input type="color" class="color-picker" value="${styling.focusColor || '#8b5cf6'}"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('focusColor', this.value)">
                    </div>
                </div>
                <div class="help-text">Customize field appearance</div>
            </div>

            <!-- Typography -->
            <div class="property-group-compact">
                <label>Typography</label>
                <div class="property-row">
                    <div class="property-group-compact">
                        <label>Font Size</label>
                        <select onchange="window.AppModules.formBuilder.updateFieldStyling('fontSize', this.value)">
                            <option value="" ${!styling.fontSize ? 'selected' : ''}>Default</option>
                            <option value="12px" ${styling.fontSize === '12px' ? 'selected' : ''}>Small</option>
                            <option value="14px" ${styling.fontSize === '14px' ? 'selected' : ''}>Normal</option>
                            <option value="16px" ${styling.fontSize === '16px' ? 'selected' : ''}>Medium</option>
                            <option value="18px" ${styling.fontSize === '18px' ? 'selected' : ''}>Large</option>
                            <option value="custom" ${styling.fontSize === 'custom' ? 'selected' : ''}>Custom</option>
                        </select>
                    </div>
                    <div class="property-group-compact">
                        <label>Font Weight</label>
                        <select onchange="window.AppModules.formBuilder.updateFieldStyling('fontWeight', this.value)">
                            <option value="" ${!styling.fontWeight ? 'selected' : ''}>Default</option>
                            <option value="300" ${styling.fontWeight === '300' ? 'selected' : ''}>Light</option>
                            <option value="400" ${styling.fontWeight === '400' ? 'selected' : ''}>Normal</option>
                            <option value="500" ${styling.fontWeight === '500' ? 'selected' : ''}>Medium</option>
                            <option value="600" ${styling.fontWeight === '600' ? 'selected' : ''}>Semi-Bold</option>
                            <option value="700" ${styling.fontWeight === '700' ? 'selected' : ''}>Bold</option>
                        </select>
                    </div>
                </div>
            </div>

            <!-- Border & Effects -->
            <div class="property-group-compact">
                <label>Border & Effects</label>
                <div class="property-row">
                    <div class="property-group-compact">
                        <label>Border Width</label>
                        <input type="text" placeholder="e.g., 1px, 2px"
                               value="${styling.borderWidth || ''}"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('borderWidth', this.value)">
                    </div>
                    <div class="property-group-compact">
                        <label>Border Radius</label>
                        <input type="text" placeholder="e.g., 4px, 8px"
                               value="${styling.borderRadius || ''}"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('borderRadius', this.value)">
                    </div>
                </div>
                <div class="property-group-compact">
                    <label>Box Shadow</label>
                    <input type="text" placeholder="e.g., 0 2px 4px rgba(0,0,0,0.1)"
                           value="${styling.boxShadow || ''}"
                           onchange="window.AppModules.formBuilder.updateFieldStyling('boxShadow', this.value)">
                </div>
            </div>

            <!-- Field Custom CSS -->
            <div class="property-group-compact">
                <label>🎨 Field Custom CSS</label>
                <div class="css-editor-container">
                    <textarea id="prop-customCSS" class="css-editor" rows="5"
                              placeholder="/* Custom CSS for this field */
.field-wrapper {
    /* Field container styles */
}

.field-input {
    /* Input element styles */
}

.field-label {
    /* Label styles */
}"
                              onchange="window.AppModules.formBuilder.updateFieldStyling('customCSS', this.value)">${styling.customCSS || ''}</textarea>
                    <div class="help-text">CSS styles applied only to this field</div>
                    <div class="property-row" style="margin-top: var(--space-2);">
                        <button type="button" class="property-button-compact" onclick="window.AppModules.formBuilder.formatFieldCSS()">
                            ✨ Format
                        </button>
                        <button type="button" class="property-button-compact" onclick="window.AppModules.formBuilder.insertFieldCSSTemplate()">
                            📝 Template
                        </button>
                        <button type="button" class="property-button-compact" onclick="window.AppModules.formBuilder.clearFieldCSS()">
                            🗑️ Clear
                        </button>
                    </div>
                </div>
            </div>

            <!-- CSS Classes -->
            <div class="property-group-compact">
                <label>🏷️ CSS Classes</label>
                <input type="text" id="prop-cssClasses" value="${field.cssClasses || ''}"
                       placeholder="class1 class2 custom-field"
                       onchange="window.AppModules.formBuilder.updateFieldProperty('cssClasses', this.value)">
                <div class="help-text">Space-separated CSS class names to add to this field</div>
            </div>
        `;
    }

    updateFormSetting(key, value) {
        try {
            if (!this.currentForm.settings) {
                this.currentForm.settings = {};
            }
            this.currentForm.settings[key] = value;
            debugInfo("FormBuilder", `📝 Updated form setting: ${key} =`, value);
            this.markFormDirty();
        } catch (error) {
            debugError("FormBuilder", '❌ Error updating form setting:', error, { key, value });
        }
    }

    // ==========================================================================
    // CUSTOM STYLES FUNCTIONALITY
    // ==========================================================================

    updateStylePreview() {
        const preview = document.getElementById('form-style-preview');
        if (!preview) return;

        const settings = this.currentForm.settings || {};
        const primaryColor = settings.primaryColor || '#8b5cf6';
        const backgroundColor = settings.backgroundColor || '#ffffff';
        const textColor = settings.textColor || '#111827';
        const borderColor = settings.borderColor || '#e5e7eb';

        const sampleInput = preview.querySelector('input');
        const sampleButton = preview.querySelector('button');

        if (sampleInput) {
            sampleInput.style.color = textColor;
            sampleInput.style.backgroundColor = backgroundColor;
            sampleInput.style.borderColor = borderColor;
        }

        if (sampleButton) {
            sampleButton.style.backgroundColor = primaryColor;
            sampleButton.style.color = '#ffffff';
        }

        // Update preview container background
        preview.style.backgroundColor = backgroundColor;
        preview.style.color = textColor;
    }

    applyFormThemePreset(theme) {
        debugInfo("FormBuilder", `🎨 Applying theme preset: ${theme}`);
        
        const presets = {
            modern: {
                primaryColor: '#8b5cf6',
                secondaryColor: '#64748b',
                backgroundColor: '#ffffff',
                textColor: '#111827',
                borderColor: '#e5e7eb',
                accentColor: '#f59e0b',
                fontFamily: 'Inter',
                fontSize: '16px',
                customCSS: `/* Modern Theme */
.form-container {
    background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
    border-radius: 12px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
.form-field {
    transition: all 0.2s ease;
}
.form-field:focus {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
}`
            },
            corporate: {
                primaryColor: '#1f2937',
                secondaryColor: '#6b7280',
                backgroundColor: '#f9fafb',
                textColor: '#111827',
                borderColor: '#d1d5db',
                accentColor: '#3b82f6',
                fontFamily: 'Arial',
                fontSize: '16px',
                customCSS: `/* Corporate Theme */
.form-container {
    background: #ffffff;
    border: 2px solid #e5e7eb;
    border-radius: 8px;
}
.submit-button {
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-weight: 600;
}`
            },
            playful: {
                primaryColor: '#ec4899',
                secondaryColor: '#a855f7',
                backgroundColor: '#fef7ff',
                textColor: '#581c87',
                borderColor: '#f3e8ff',
                accentColor: '#f59e0b',
                fontFamily: 'Inter',
                fontSize: '16px',
                customCSS: `/* Playful Theme */
.form-container {
    background: linear-gradient(135deg, #fef7ff 0%, #fff7ed 100%);
    border-radius: 20px;
    border: 3px solid #f3e8ff;
}
.form-field {
    border-radius: 12px;
    border: 2px solid #f3e8ff;
}
.submit-button {
    border-radius: 25px;
    background: linear-gradient(135deg, #ec4899 0%, #a855f7 100%);
}`
            },
            minimal: {
                primaryColor: '#000000',
                secondaryColor: '#6b7280',
                backgroundColor: '#ffffff',
                textColor: '#000000',
                borderColor: '#000000',
                accentColor: '#6b7280',
                fontFamily: 'Arial',
                fontSize: '14px',
                customCSS: `/* Minimal Theme */
.form-container {
    background: #ffffff;
    border: 1px solid #000000;
    border-radius: 0;
}
.form-field {
    border: 1px solid #000000;
    border-radius: 0;
    background: transparent;
}
.submit-button {
    border: 2px solid #000000;
    background: #000000;
    color: #ffffff;
    border-radius: 0;
}`
            },
            dark: {
                primaryColor: '#8b5cf6',
                secondaryColor: '#a855f7',
                backgroundColor: '#111827',
                textColor: '#f9fafb',
                borderColor: '#374151',
                accentColor: '#fbbf24',
                fontFamily: 'Inter',
                fontSize: '16px',
                customCSS: `/* Dark Theme */
.form-container {
    background: #111827;
    border: 1px solid #374151;
    color: #f9fafb;
}
.form-field {
    background: #1f2937;
    color: #f9fafb;
    border: 1px solid #374151;
}
.form-field:focus {
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}`
            }
        };

        const preset = presets[theme];
        if (preset) {
            // Apply all preset values
            Object.entries(preset).forEach(([key, value]) => {
                this.updateFormSetting(key, value);
            });

            // Refresh the form properties to show new values
            this.showFormProperties();
            
            // Update style preview
            setTimeout(() => this.updateStylePreview(), 100);
        }
    }

    resetFormStyles() {
        debugInfo("FormBuilder", '🔄 Resetting form styles to default');
        
        const defaultSettings = {
            primaryColor: '#8b5cf6',
            secondaryColor: '#64748b',
            backgroundColor: '#ffffff',
            textColor: '#111827',
            borderColor: '#e5e7eb',
            accentColor: '#f59e0b',
            fontFamily: 'Inter',
            fontSize: '16px',
            customCSS: ''
        };

        Object.entries(defaultSettings).forEach(([key, value]) => {
            this.updateFormSetting(key, value);
        });

        this.showFormProperties();
        setTimeout(() => this.updateStylePreview(), 100);
    }

    formatCustomCSS() {
        const cssEditor = document.getElementById('form-custom-css');
        if (!cssEditor) return;

        try {
            // Basic CSS formatting
            let css = cssEditor.value;
            css = css.replace(/;\s*}/g, ';\n}');
            css = css.replace(/{/g, ' {\n    ');
            css = css.replace(/;(?!\s*})/g, ';\n    ');
            css = css.replace(/}\s*/g, '}\n\n');
            css = css.replace(/,\s*/g, ',\n');
            css = css.trim();

            cssEditor.value = css;
            this.updateFormSetting('customCSS', css);
            debugInfo("FormBuilder", '✨ CSS formatted successfully');
        } catch (error) {
            debugError("FormBuilder", '❌ Error formatting CSS:', error);
        }
    }

    insertCSSTemplate() {
        const template = `/* Form Container Styling */
.form-container {
    background: #ffffff;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    max-width: 600px;
    margin: 0 auto;
}

/* Field Styling */
.form-field {
    margin-bottom: 1rem;
    padding: 0.75rem;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    font-size: 16px;
    transition: border-color 0.2s ease;
}

.form-field:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

/* Button Styling */
.submit-button {
    background: #8b5cf6;
    color: white;
    padding: 0.75rem 2rem;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: background-color 0.2s ease;
}

.submit-button:hover {
    background: #7c3aed;
}`;

        const cssEditor = document.getElementById('form-custom-css');
        if (cssEditor) {
            cssEditor.value = template;
            this.updateFormSetting('customCSS', template);
            this.updateStylePreview();
            debugInfo("FormBuilder", '📝 CSS template inserted');
        }
    }

    validateCSS() {
        const cssEditor = document.getElementById('form-custom-css');
        if (!cssEditor) return;

        const css = cssEditor.value;
        
        // Basic CSS validation
        const openBraces = (css.match(/{/g) || []).length;
        const closeBraces = (css.match(/}/g) || []).length;
        
        if (openBraces !== closeBraces) {
            alert('⚠️ CSS Validation: Mismatched braces detected');
            return;
        }

        // Check for common CSS errors
        const lines = css.split('\n');
        const errors = [];

        lines.forEach((line, index) => {
            if (line.includes(':') && !line.includes(';') && !line.includes('{') && line.trim() && !line.includes('/*')) {
                errors.push(`Line ${index + 1}: Missing semicolon`);
            }
        });

        if (errors.length > 0) {
            alert('⚠️ CSS Validation Issues:\n' + errors.join('\n'));
        } else {
            alert('✅ CSS appears to be valid!');
        }

        debugInfo("FormBuilder", '✅ CSS validation completed');
    }

    clearCustomCSS() {
        if (confirm('🗑️ Clear all custom CSS? This cannot be undone.')) {
            const cssEditor = document.getElementById('form-custom-css');
            if (cssEditor) {
                cssEditor.value = '';
                this.updateFormSetting('customCSS', '');
                this.updateStylePreview();
                debugInfo("FormBuilder", '🗑️ Custom CSS cleared');
            }
        }
    }

    insertCSSSnippet(snippetType) {
        const snippets = {
            'gradient-bg': `/* Gradient Background */
.form-container {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}`,
            'glass-effect': `/* Glass Effect */
.form-container {
    background: rgba(255, 255, 255, 0.25);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.37);
}`,
            'hover-animations': `/* Hover Animations */
.form-field:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
}

.submit-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(139, 92, 246, 0.4);
}`,
            'custom-fonts': `/* Custom Fonts */
@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;600&display=swap');

.form-container {
    font-family: 'Poppins', sans-serif;
}

.field-label {
    font-weight: 600;
    letter-spacing: 0.5px;
}`
        };

        const snippet = snippets[snippetType];
        if (snippet) {
            const cssEditor = document.getElementById('form-custom-css');
            if (cssEditor) {
                const currentCSS = cssEditor.value;
                const newCSS = currentCSS ? currentCSS + '\n\n' + snippet : snippet;
                cssEditor.value = newCSS;
                this.updateFormSetting('customCSS', newCSS);
                this.updateStylePreview();
                debugInfo("FormBuilder", `📝 CSS snippet "${snippetType}" inserted`);
            }
        }
    }

    // ==========================================================================
    // PAGE-LEVEL CUSTOM STYLES FUNCTIONALITY
    // ==========================================================================

    updatePageStyleProperty(key, value) {
        const currentPage = this.getCurrentPage();
        if (!currentPage) return;

        if (!currentPage.styleSettings) {
            currentPage.styleSettings = {};
        }

        currentPage.styleSettings[key] = value;
        debugInfo("FormBuilder", `🎨 Updated page style setting: ${key} =`, value);
        this.markFormDirty();
    }

    applyPageThemePreset(theme) {
        debugInfo("FormBuilder", `🎨 Applying page theme preset: ${theme}`);
        const currentPage = this.getCurrentPage();
        if (!currentPage) return;

        const presets = {
            clean: {
                width: 'normal',
                columns: '1',
                backgroundColor: '#ffffff',
                headerColor: '#1f2937',
                borderColor: '#e5e7eb',
                customCSS: `/* Clean Page Theme */
.page-container {
    background: #ffffff;
    padding: 2rem;
    border-radius: 8px;
    max-width: 800px;
    margin: 0 auto;
}
.page-header {
    border-bottom: 1px solid #e5e7eb;
    padding-bottom: 1rem;
    margin-bottom: 2rem;
}`
            },
            card: {
                width: 'narrow',
                columns: '1',
                backgroundColor: '#ffffff',
                headerColor: '#8b5cf6',
                borderColor: '#d1d5db',
                customCSS: `/* Card Page Theme */
.page-container {
    background: #ffffff;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    border: 1px solid #e5e7eb;
    max-width: 600px;
    margin: 2rem auto;
}
.page-header {
    text-align: center;
    margin-bottom: 2rem;
}`
            },
            centered: {
                width: 'narrow',
                columns: '1',
                backgroundColor: '#f9fafb',
                headerColor: '#374151',
                borderColor: '#d1d5db',
                customCSS: `/* Centered Page Theme */
.page-container {
    background: #f9fafb;
    text-align: center;
    padding: 3rem 2rem;
    min-height: 60vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
}
.page-content {
    max-width: 500px;
    margin: 0 auto;
}`
            },
            wide: {
                width: 'wide',
                columns: '2',
                backgroundColor: '#ffffff',
                headerColor: '#059669',
                borderColor: '#d1fae5',
                customCSS: `/* Wide Page Theme */
.page-container {
    background: #ffffff;
    padding: 2rem;
    max-width: 1200px;
    margin: 0 auto;
}
.page-content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    align-items: start;
}`
            }
        };

        const preset = presets[theme];
        if (preset) {
            // Apply all preset values
            Object.entries(preset).forEach(([key, value]) => {
                this.updatePageStyleProperty(key, value);
            });

            // Refresh the page properties to show new values
            this.showPageProperties();
            debugInfo("FormBuilder", `✅ Applied page theme: ${theme}`);
        }
    }

    resetPageStyles() {
        debugInfo("FormBuilder", '🔄 Resetting page styles to default');
        const currentPage = this.getCurrentPage();
        if (!currentPage) return;

        const defaultSettings = {
            width: 'normal',
            columns: '1',
            backgroundColor: '#ffffff',
            headerColor: '#8b5cf6',
            borderColor: '#e5e7eb',
            customCSS: ''
        };

        Object.entries(defaultSettings).forEach(([key, value]) => {
            this.updatePageStyleProperty(key, value);
        });

        this.showPageProperties();
        debugInfo("FormBuilder", '✅ Page styles reset to default');
    }

    formatPageCSS() {
        const cssEditor = document.getElementById('page-custom-css');
        if (!cssEditor) return;

        try {
            // Basic CSS formatting
            let css = cssEditor.value;
            css = css.replace(/;\s*}/g, ';\n}');
            css = css.replace(/{/g, ' {\n    ');
            css = css.replace(/;(?!\s*})/g, ';\n    ');
            css = css.replace(/}\s*/g, '}\n\n');
            css = css.replace(/,\s*/g, ',\n');
            css = css.trim();

            cssEditor.value = css;
            this.updatePageStyleProperty('customCSS', css);
            debugInfo("FormBuilder", '✨ Page CSS formatted successfully');
        } catch (error) {
            debugError("FormBuilder", '❌ Error formatting page CSS:', error);
        }
    }

    insertPageCSSTemplate() {
        const template = `/* Page Container Styling */
.page-container {
    background: #ffffff;
    padding: 2rem;
    border-radius: 8px;
    max-width: 800px;
    margin: 2rem auto;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Page Header */
.page-header {
    text-align: center;
    margin-bottom: 2rem;
    padding-bottom: 1rem;
    border-bottom: 2px solid #8b5cf6;
}

/* Page Content Area */
.page-content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
}

/* Responsive Design */
@media (max-width: 768px) {
    .page-container {
        padding: 1rem;
        margin: 1rem;
    }
}`;

        const cssEditor = document.getElementById('page-custom-css');
        if (cssEditor) {
            cssEditor.value = template;
            this.updatePageStyleProperty('customCSS', template);
            debugInfo("FormBuilder", '📝 Page CSS template inserted');
        }
    }

    clearPageCSS() {
        if (confirm('🗑️ Clear all page CSS? This cannot be undone.')) {
            const cssEditor = document.getElementById('page-custom-css');
            if (cssEditor) {
                cssEditor.value = '';
                this.updatePageStyleProperty('customCSS', '');
                debugInfo("FormBuilder", '🗑️ Page CSS cleared');
            }
        }
    }

    updateNavigationConfig(buttonType, property, value) {
        if (!this.currentForm.navigationConfig) {
            this.currentForm.navigationConfig = {};
        }
        if (!this.currentForm.navigationConfig[buttonType]) {
            this.currentForm.navigationConfig[buttonType] = {
                conditionalVisibility: {}
            };
        }
        if (!this.currentForm.navigationConfig[buttonType].conditionalVisibility) {
            this.currentForm.navigationConfig[buttonType].conditionalVisibility = {};
        }
        
        if (property === 'enabled') {
            this.currentForm.navigationConfig[buttonType].conditionalVisibility.enabled = value;
        } else {
            this.currentForm.navigationConfig[buttonType].conditionalVisibility[property] = value;
        }
        
        this.markFormDirty();
        debugInfo("FormBuilder", `Navigation config updated for ${buttonType}: ${property} = ${value}`);
    }

    updateEmailSetting(key, value) {
        if (!this.currentForm.settings) {
            this.currentForm.settings = {};
        }
        if (!this.currentForm.settings.emailSettings) {
            this.currentForm.settings.emailSettings = {};
        }
        this.currentForm.settings.emailSettings[key] = value;
        this.markFormDirty();
    }

    // Page Properties
    showPageProperties() {
        debugInfo("FormBuilder", '📄 showPageProperties called');
        const pageSection = document.getElementById('pageProperties');
        debugInfo("FormBuilder", '📄 pageSection element:', pageSection);
        
        const currentPage = this.getCurrentPage();
        debugInfo("FormBuilder", '📄 currentPage:', currentPage);

        if (!currentPage) {
            debugInfo("FormBuilder", '❌ No current page found');
            pageSection.innerHTML = '<p class="empty-state">Select a page to view properties</p>';
            return;
        }

        debugInfo("FormBuilder", '📄 Rendering page properties...');
        const renderedHTML = this.renderPageProperties(currentPage);
        debugInfo("FormBuilder", '📄 Rendered HTML length:', renderedHTML.length);
        pageSection.innerHTML = renderedHTML;

        debugInfo("FormBuilder", '📄 Attaching page property listeners...');
        // Attach listeners for page properties
        this.attachPagePropertyListeners(currentPage);

        debugInfo("FormBuilder", '📄 Loading Salesforce objects...');
        // Load Salesforce objects for mapping
        this.loadSalesforceObjectsForPage();
        
        debugInfo("FormBuilder", '✅ showPageProperties completed');
    }

    renderPageProperties(page) {
        const conditionalLogic = window.AppModules.conditionalLogic;
        const availableFields = this.getAvailableFieldsForPageConditions(page);
        const availableObjects = this.getAvailableSalesforceObjects();

        return `
            <div class="properties-content">
                <!-- Page Sub-Tabs -->
                <div class="property-sub-tabs">
                    <button class="property-sub-tab active" onclick="window.AppModules.formBuilder.switchPageSubTab('basic')">📄 Basic</button>
                    <button class="property-sub-tab" onclick="window.AppModules.formBuilder.switchPageSubTab('styles')">🎨 Styles</button>
                    <button class="property-sub-tab" onclick="window.AppModules.formBuilder.switchPageSubTab('salesforce')">🔗 SF</button>
                    <button class="property-sub-tab" onclick="window.AppModules.formBuilder.switchPageSubTab('conditions')">🔍 Logic</button>
                    <button class="property-sub-tab" onclick="window.AppModules.formBuilder.switchPageSubTab('navigation')">⬅️➡️ Nav</button>
                    <button class="property-sub-tab" onclick="window.AppModules.formBuilder.switchPageSubTab('advanced')">⚙️ More</button>
                </div>

                <!-- Basic Settings Tab -->
                <div class="property-sub-content" id="page-basic-tab">
                    <div class="property-group-compact">
                        <label>Page Name</label>
                        <input type="text" id="page-name" value="${page.name || ''}" 
                               placeholder="Contact Information"
                               onchange="window.AppModules.formBuilder.updatePageProperty('name', this.value)">
                        <div class="help-text">Name for this page</div>
                    </div>

                    <div class="property-group-compact">
                        <label>Page Description</label>
                        <textarea id="page-description" rows="2" 
                                  placeholder="Optional description..."
                                  onchange="window.AppModules.formBuilder.updatePageProperty('description', this.value)">${page.description || ''}</textarea>
                        <div class="help-text">Description shown to users</div>
                    </div>
                </div>

                <!-- Page Styles Tab -->
                <div class="property-sub-content" id="page-styles-tab" style="display: none;">
                    <!-- Page Style Presets -->
                    <div class="property-group-compact">
                        <label>🎨 Page Style Presets</label>
                        <div class="style-presets">
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyPageThemePreset('clean')">
                                ✨ Clean
                            </button>
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyPageThemePreset('card')">
                                🃏 Card
                            </button>
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyPageThemePreset('centered')">
                                📍 Centered
                            </button>
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.applyPageThemePreset('wide')">
                                📏 Wide
                            </button>
                            <button class="style-preset-btn" onclick="window.AppModules.formBuilder.resetPageStyles()">
                                🔄 Reset
                            </button>
                        </div>
                        <div class="help-text">Apply page layout presets</div>
                    </div>

                    <!-- Page Layout Settings -->
                    <div class="property-group-compact">
                        <label>📐 Layout Settings</label>
                        <div class="property-row">
                            <div class="property-group-compact">
                                <label>Page Width</label>
                                <select id="page-width" onchange="window.AppModules.formBuilder.updatePageStyleProperty('width', this.value)">
                                    <option value="narrow" ${(page.styleSettings?.width || 'normal') === 'narrow' ? 'selected' : ''}>Narrow (600px)</option>
                                    <option value="normal" ${(page.styleSettings?.width || 'normal') === 'normal' ? 'selected' : ''}>Normal (800px)</option>
                                    <option value="wide" ${(page.styleSettings?.width || 'normal') === 'wide' ? 'selected' : ''}>Wide (1200px)</option>
                                    <option value="full" ${(page.styleSettings?.width || 'normal') === 'full' ? 'selected' : ''}>Full Width</option>
                                </select>
                            </div>
                            <div class="property-group-compact">
                                <label>Column Layout</label>
                                <select id="page-columns" onchange="window.AppModules.formBuilder.updatePageStyleProperty('columns', this.value)">
                                    <option value="1" ${(page.styleSettings?.columns || '1') === '1' ? 'selected' : ''}>Single Column</option>
                                    <option value="2" ${(page.styleSettings?.columns || '1') === '2' ? 'selected' : ''}>Two Columns</option>
                                    <option value="3" ${(page.styleSettings?.columns || '1') === '3' ? 'selected' : ''}>Three Columns</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <!-- Page Color Customization -->
                    <div class="property-group-compact">
                        <label>🎨 Page Colors</label>
                        <div class="color-picker-group">
                            <div class="color-picker-item">
                                <label>Background</label>
                                <input type="color" class="color-picker" id="page-bg-color" value="${page.styleSettings?.backgroundColor || '#ffffff'}"
                                       onchange="window.AppModules.formBuilder.updatePageStyleProperty('backgroundColor', this.value)">
                            </div>
                            <div class="color-picker-item">
                                <label>Header</label>
                                <input type="color" class="color-picker" id="page-header-color" value="${page.styleSettings?.headerColor || '#8b5cf6'}"
                                       onchange="window.AppModules.formBuilder.updatePageStyleProperty('headerColor', this.value)">
                            </div>
                            <div class="color-picker-item">
                                <label>Border</label>
                                <input type="color" class="color-picker" id="page-border-color" value="${page.styleSettings?.borderColor || '#e5e7eb'}"
                                       onchange="window.AppModules.formBuilder.updatePageStyleProperty('borderColor', this.value)">
                            </div>
                        </div>
                        <div class="help-text">Customize page-specific colors</div>
                    </div>

                    <!-- Page Custom CSS -->
                    <div class="property-group-compact">
                        <label>🎨 Page Custom CSS</label>
                        <div class="css-editor-container">
                            <textarea id="page-custom-css" class="css-editor" rows="6" 
                                placeholder="/* Page-specific CSS */
.page-container {
    /* Page wrapper styles */
}

.page-header {
    /* Page title area */
}

.page-content {
    /* Page content area */
}"
                                onchange="window.AppModules.formBuilder.updatePageStyleProperty('customCSS', this.value)">${page.styleSettings?.customCSS || ''}</textarea>
                            <div class="help-text">CSS styles applied only to this page</div>
                            <div class="property-row" style="margin-top: var(--space-2);">
                                <button type="button" class="property-button-compact" onclick="window.AppModules.formBuilder.formatPageCSS()">
                                    ✨ Format
                                </button>
                                <button type="button" class="property-button-compact" onclick="window.AppModules.formBuilder.insertPageCSSTemplate()">
                                    📝 Template
                                </button>
                                <button type="button" class="property-button-compact" onclick="window.AppModules.formBuilder.clearPageCSS()">
                                    🗑️ Clear
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Salesforce Integration Tab -->
                <div class="property-sub-content" id="page-salesforce-tab" style="display: none;">
                    <div class="property-group-compact">
                        <label>Salesforce Object</label>
                        <select id="page-salesforce-object" onchange="window.AppModules.formBuilder.updatePageProperty('salesforceObject', this.value)">
                            <option value="">Not Mapped</option>
                            ${availableObjects.map(obj => `
                                <option value="${obj.name}" ${page.salesforceObject === obj.name ? 'selected' : ''}>
                                    ${obj.label}
                                </option>
                            `).join('')}
                        </select>
                        <div class="help-text">Object to create/update</div>
                    </div>

                    <div class="property-row">
                        <div class="property-group-compact">
                            <label>Action Type</label>
                            <select id="page-action-type" onchange="window.AppModules.formBuilder.updatePageProperty('actionType', this.value)">
                                <option value="create" ${page.actionType === 'create' ? 'selected' : ''}>Create New</option>
                                <option value="update" ${page.actionType === 'update' ? 'selected' : ''}>Update Existing</option>
                                <option value="get" ${page.actionType === 'get' ? 'selected' : ''}>Query Records</option>
                            </select>
                            <div class="help-text">Create or update records</div>
                        </div>
                    </div>
                    
                    <div class="property-group-compact" id="record-id-group" style="display: ${page.actionType === 'update' ? 'block' : 'none'};">
                        <label>Record ID Variable</label>
                        <select id="page-record-id-variable" 
                                onchange="window.AppModules.formBuilder.updatePageProperty('recordIdVariable', this.value)">
                            ${this.renderRecordIdVariableOptions(page.recordIdVariable)}
                        </select>
                        <div class="help-text">Variable with record ID to update</div>
                    </div>

                    <!-- Record Linking Section -->
                    <div class="property-group-compact">
                        <div class="property-section-header">
                            <h4>🔗 Record Linking</h4>
                            <div class="help-text">Link this record to parent records created on previous pages</div>
                        </div>
                        
                        <div class="form-checkbox">
                            <input type="checkbox" id="page-enable-record-linking" 
                                   ${page.recordLinking?.enabled ? 'checked' : ''}
                                   onchange="window.AppModules.formBuilder.toggleRecordLinking(this.checked)">
                            <label for="page-enable-record-linking">Enable Record Linking</label>
                        </div>
                        
                        <div id="record-linking-config" style="display: ${page.recordLinking?.enabled ? 'block' : 'none'};">
                            <div class="property-group-compact">
                                <label>Parent Record Source</label>
                                <select id="page-parent-record-source" 
                                        onchange="window.AppModules.formBuilder.updateRecordLinkingProperty('parentSource', this.value)">
                                    <option value="">Select parent record...</option>
                                    ${this.renderParentRecordOptions(page.recordLinking?.parentSource)}
                                </select>
                                <div class="help-text">Choose which page's record to link to</div>
                            </div>
                            
                            <div class="property-group-compact" id="relationship-field-group" 
                                 style="display: ${page.recordLinking?.parentSource ? 'block' : 'none'};">
                                <label>Relationship Field</label>
                                <select id="page-relationship-field" 
                                        onchange="window.AppModules.formBuilder.updateRecordLinkingProperty('relationshipField', this.value)">
                                    <option value="">Select relationship field...</option>
                                    ${this.renderRelationshipFieldOptions(page.salesforceObject, page.recordLinking?.relationshipField)}
                                </select>
                                <div class="help-text">Field that links to the parent record</div>
                            </div>
                        </div>
                    </div>

                    <!-- Repeating Pages Section -->
                    <div class="property-group-compact">
                        <div class="property-section-header">
                            <h4>🔄 Repeating Pages</h4>
                            <div class="help-text">Allow users to create multiple records of this type</div>
                        </div>
                        
                        <div class="form-checkbox">
                            <input type="checkbox" id="page-enable-repeat" 
                                   ${page.repeatConfig?.enabled ? 'checked' : ''}
                                   onchange="window.AppModules.formBuilder.togglePageRepeat(this.checked)">
                            <label for="page-enable-repeat">Enable Repeating Page</label>
                        </div>
                        
                        <div id="repeat-config" style="display: ${page.repeatConfig?.enabled ? 'block' : 'none'};">
                            <div class="property-row">
                                <div class="property-group-compact">
                                    <label>Repeat Button Text</label>
                                    <input type="text" id="page-repeat-button-text" 
                                           value="${page.repeatConfig?.buttonText || 'Add Another'}"
                                           placeholder="Add Another Contact"
                                           onchange="window.AppModules.formBuilder.updateRepeatProperty('buttonText', this.value)">
                                </div>
                                <div class="property-group-compact">
                                    <label>Max Instances</label>
                                    <input type="number" id="page-repeat-max" 
                                           value="${page.repeatConfig?.maxInstances || 10}"
                                           min="1" max="50"
                                           onchange="window.AppModules.formBuilder.updateRepeatProperty('maxInstances', parseInt(this.value))">
                                </div>
                            </div>
                            
                            <div class="property-group-compact">
                                <label>Instance Label Template</label>
                                <input type="text" id="page-repeat-label-template" 
                                       value="${page.repeatConfig?.labelTemplate || 'Instance {number}'}"
                                       placeholder="Contact {number}"
                                       onchange="window.AppModules.formBuilder.updateRepeatProperty('labelTemplate', this.value)">
                                <div class="help-text">Use {number} for instance number, {field_name} for field values</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Conditions Tab -->
                <div class="property-sub-content" id="page-conditions-tab" style="display: none;">
                    <div class="property-group-compact">
                        <div class="form-checkbox">
                            <input type="checkbox" id="page-conditional-enabled" ${page.conditionalVisibility?.enabled ? 'checked' : ''}
                                   onchange="window.AppModules.formBuilder.togglePageConditionalVisibilityInline(this.checked)">
                            <label for="page-conditional-enabled">Conditional Visibility</label>
                        </div>
                        <div class="help-text">Show/hide this page based on field values</div>
                    </div>
                    
                    <div id="page-conditional-config" style="display: ${page.conditionalVisibility?.enabled ? 'block' : 'none'}">
                        <div class="property-group-compact">
                            <label>Logic Expression</label>
                            <input type="text" id="page-logic-expression" 
                                   value="${page.conditionalVisibility?.logicExpression || ''}"
                                   placeholder="(1 AND 2) OR 3"
                                   onchange="window.AppModules.formBuilder.updatePageConditionalProperty('logicExpression', this.value)">
                            <div class="help-text">Use numbers for conditions: (1 AND 2) OR 3, or leave blank for simple AND logic</div>
                        </div>
                        
                        <div class="property-group-compact">
                            <label>Conditions</label>
                            <div id="page-conditions-list" class="conditions-list-compact">
                                ${this.renderPageConditionsAdvanced(page.conditionalVisibility?.conditions || [], availableFields)}
                            </div>
                            <button type="button" class="property-button-compact" onclick="window.AppModules.formBuilder.addPageConditionCompact()">
                                ➕ Add Condition
                            </button>
                            <div class="help-text">Each condition gets a number (1, 2, 3...) for use in logic expression</div>
                        </div>
                    </div>
                </div>

                <!-- Navigation Tab -->
                <div class="property-sub-content" id="page-navigation-tab" style="display: none;">
                    <div class="property-group-compact">
                        <label>Next Button</label>
                        <div class="form-checkbox">
                            <input type="checkbox" id="next-conditional-enabled" ${page.navigationConfig?.nextButton?.conditionalVisibility?.enabled ? 'checked' : ''}
                                   onchange="window.AppModules.formBuilder.toggleNavigationConditionalVisibilityInline('nextButton', this.checked)">
                            <label for="next-conditional-enabled">Conditional Visibility</label>
                        </div>
                        <div class="help-text">Control when Next button appears</div>
                    </div>
                    
                    <div id="next-conditional-config" style="display: ${page.navigationConfig?.nextButton?.conditionalVisibility?.enabled ? 'block' : 'none'}">
                        <div class="property-row">
                            <div class="property-group-compact">
                                <label>Show When</label>
                                <select id="next-condition-field" onchange="window.AppModules.formBuilder.updateNavigationCondition('nextButton', 'field', this.value)">
                                    <option value="">Select Field...</option>
                                    ${this.renderFieldOptionsCompact(availableFields, page.navigationConfig?.nextButton?.conditionalVisibility?.field)}
                                </select>
                            </div>
                            <div class="property-group-compact">
                                <label>Condition</label>
                                <select id="next-condition-operator" onchange="window.AppModules.formBuilder.updateNavigationCondition('nextButton', 'operator', this.value)">
                                    <option value="equals" ${page.navigationConfig?.nextButton?.conditionalVisibility?.operator === 'equals' || !page.navigationConfig?.nextButton?.conditionalVisibility?.operator ? 'selected' : ''}>Equals</option>
                                    <option value="not_equals" ${page.navigationConfig?.nextButton?.conditionalVisibility?.operator === 'not_equals' ? 'selected' : ''}>Not Equals</option>
                                    <option value="contains" ${page.navigationConfig?.nextButton?.conditionalVisibility?.operator === 'contains' ? 'selected' : ''}>Contains</option>
                                    <option value="is_empty" ${page.navigationConfig?.nextButton?.conditionalVisibility?.operator === 'is_empty' ? 'selected' : ''}>Is Empty</option>
                                    <option value="is_not_empty" ${page.navigationConfig?.nextButton?.conditionalVisibility?.operator === 'is_not_empty' ? 'selected' : ''}>Is Not Empty</option>
                                </select>
                            </div>
                            <div class="property-group-compact" id="next-condition-value-group" style="display: ${this.needsValueInput(page.navigationConfig?.nextButton?.conditionalVisibility?.operator || 'equals') ? 'block' : 'none'}">
                                <label>Value</label>
                                <input type="text" id="next-condition-value" value="${page.navigationConfig?.nextButton?.conditionalVisibility?.value || ''}"
                                       onchange="window.AppModules.formBuilder.updateNavigationCondition('nextButton', 'value', this.value)">
                            </div>
                        </div>
                    </div>
                    
                    <div class="property-group-compact">
                        <label>Submit Button</label>
                        <div class="form-checkbox">
                            <input type="checkbox" id="submit-conditional-enabled" ${page.navigationConfig?.submitButton?.conditionalVisibility?.enabled ? 'checked' : ''}
                                   onchange="window.AppModules.formBuilder.toggleNavigationConditionalVisibilityInline('submitButton', this.checked)">
                            <label for="submit-conditional-enabled">Conditional Visibility</label>
                        </div>
                        <div class="help-text">Control when Submit button appears</div>
                    </div>
                    
                    <div id="submit-conditional-config" style="display: ${page.navigationConfig?.submitButton?.conditionalVisibility?.enabled ? 'block' : 'none'}">
                        <div class="property-row">
                            <div class="property-group-compact">
                                <label>Show When</label>
                                <select id="submit-condition-field" onchange="window.AppModules.formBuilder.updateNavigationCondition('submitButton', 'field', this.value)">
                                    <option value="">Select Field...</option>
                                    ${this.renderFieldOptionsCompact(availableFields, page.navigationConfig?.submitButton?.conditionalVisibility?.field)}
                                </select>
                            </div>
                            <div class="property-group-compact">
                                <label>Condition</label>
                                <select id="submit-condition-operator" onchange="window.AppModules.formBuilder.updateNavigationCondition('submitButton', 'operator', this.value)">
                                    <option value="equals" ${page.navigationConfig?.submitButton?.conditionalVisibility?.operator === 'equals' || !page.navigationConfig?.submitButton?.conditionalVisibility?.operator ? 'selected' : ''}>Equals</option>
                                    <option value="not_equals" ${page.navigationConfig?.submitButton?.conditionalVisibility?.operator === 'not_equals' ? 'selected' : ''}>Not Equals</option>
                                    <option value="contains" ${page.navigationConfig?.submitButton?.conditionalVisibility?.operator === 'contains' ? 'selected' : ''}>Contains</option>
                                    <option value="is_empty" ${page.navigationConfig?.submitButton?.conditionalVisibility?.operator === 'is_empty' ? 'selected' : ''}>Is Empty</option>
                                    <option value="is_not_empty" ${page.navigationConfig?.submitButton?.conditionalVisibility?.operator === 'is_not_empty' ? 'selected' : ''}>Is Not Empty</option>
                                </select>
                            </div>
                            <div class="property-group-compact" id="submit-condition-value-group" style="display: ${this.needsValueInput(page.navigationConfig?.submitButton?.conditionalVisibility?.operator || 'equals') ? 'block' : 'none'}">
                                <label>Value</label>
                                <input type="text" id="submit-condition-value" value="${page.navigationConfig?.submitButton?.conditionalVisibility?.value || ''}"
                                       onchange="window.AppModules.formBuilder.updateNavigationCondition('submitButton', 'value', this.value)">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Advanced Tab -->
                <div class="property-sub-content" id="page-advanced-tab" style="display: none;">
                    ${this.renderRepeatConfigurationSection(page)}
                    ${this.renderHiddenFieldsSection(page)}
                </div>
            </div>
        `;
    }

    // Helper method for Page Conditional Visibility Section (Legacy - uses unique IDs)
    renderPageConditionalVisibilitySection(page, availableFields) {
        return `
            <div class="property-section">
                <div class="section-header">
                    <h3 class="section-title">🔍 Page Conditional Visibility</h3>
                    <p class="section-description">Show or hide this entire page based on field values from previous pages</p>
                </div>
                
                <div class="property-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="page-conditional-enabled-legacy" ${page.conditionalVisibility?.enabled ? 'checked' : ''}
                               onchange="window.AppModules.formBuilder.togglePageConditionalVisibility(this.checked)">
                        Enable page conditional visibility
                    </label>
                </div>
                
                <div id="page-conditional-config" style="display: ${page.conditionalVisibility?.enabled ? 'block' : 'none'}">
                    <div class="property-group">
                        <label>Show this page when:</label>
                        <select id="page-condition-logic" onchange="window.AppModules.formBuilder.updatePageConditionalProperty('logic', this.value)">
                            <option value="AND" ${page.conditionalVisibility?.logic === 'AND' ? 'selected' : ''}>All conditions are met (AND)</option>
                            <option value="OR" ${page.conditionalVisibility?.logic === 'OR' ? 'selected' : ''}>Any condition is met (OR)</option>
                        </select>
                    </div>
                    
                    <div id="page-conditions-list" class="conditions-list">
                        ${this.renderPageConditions(page.conditionalVisibility?.conditions || [], availableFields)}
                    </div>
                    
                    <button type="button" class="button button-secondary add-condition-btn" 
                            onclick="window.AppModules.formBuilder.addPageCondition()">
                        <span class="button-icon">+</span> Add Condition
                    </button>
                </div>
            </div>
        `;
    }

    // Helper method for Navigation Button Section
    renderNavigationButtonSection(page, availableFields) {
        return `
            <div class="property-section">
                <div class="section-header">
                    <h3 class="section-title">🔘 Navigation Button Controls</h3>
                    <p class="section-description">Configure when Next and Submit buttons are visible on this page</p>
                </div>
                
                <!-- Next Button Configuration -->
                <div class="property-subsection">
                    <h4 class="subsection-title">Next Button Visibility</h4>
                    <div class="property-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="page-next-btn-conditional" 
                                   ${page.navigationConfig?.next?.conditionalVisibility?.enabled ? 'checked' : ''}
                                   onchange="window.AppModules.formBuilder.togglePageNavigationButtonConditionalVisibility('next', this.checked)">
                            Enable conditional Next button visibility
                        </label>
                    </div>
                    
                    <div id="page-next-btn-conditions" style="display: ${page.navigationConfig?.next?.conditionalVisibility?.enabled ? 'block' : 'none'}">
                        <div class="property-group">
                            <label>Show Next button when:</label>
                            <select id="page-next-condition-logic" 
                                    onchange="window.AppModules.formBuilder.updatePageNavigationButtonConditionalProperty('next', 'logic', this.value)">
                                <option value="AND" ${page.navigationConfig?.next?.conditionalVisibility?.logic === 'AND' ? 'selected' : ''}>All conditions are met (AND)</option>
                                <option value="OR" ${page.navigationConfig?.next?.conditionalVisibility?.logic === 'OR' ? 'selected' : ''}>Any condition is met (OR)</option>
                            </select>
                        </div>
                        
                        <div id="page-next-conditions-list" class="conditions-list">
                            ${this.renderPageConditions(page.navigationConfig?.next?.conditionalVisibility?.conditions || [], availableFields, 'next')}
                        </div>
                        
                        <button type="button" class="button button-secondary add-condition-btn" 
                                onclick="window.AppModules.formBuilder.addPageNavigationButtonCondition('next')">
                            <span class="button-icon">+</span> Add Next Button Condition
                        </button>
                        
                        <button type="button" class="button button-primary" style="margin-top: var(--space-2);"
                                onclick="setupRequireLoginForNext()">
                            🔐 Require Login for Next Button
                        </button>
                    </div>
                </div>
                
                <!-- Submit Button Configuration -->
                <div class="property-subsection">
                    <h4 class="subsection-title">Submit Button Visibility</h4>
                    <div class="property-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="page-submit-btn-conditional" 
                                   ${page.navigationConfig?.submit?.conditionalVisibility?.enabled ? 'checked' : ''}
                                   onchange="window.AppModules.formBuilder.togglePageNavigationButtonConditionalVisibility('submit', this.checked)">
                            Enable conditional Submit button visibility
                        </label>
                    </div>
                    
                    <div id="page-submit-btn-conditions" style="display: ${page.navigationConfig?.submit?.conditionalVisibility?.enabled ? 'block' : 'none'}">
                        <div class="property-group">
                            <label>Show Submit button when:</label>
                            <select id="page-submit-condition-logic" 
                                    onchange="window.AppModules.formBuilder.updatePageNavigationButtonConditionalProperty('submit', 'logic', this.value)">
                                <option value="AND" ${page.navigationConfig?.submit?.conditionalVisibility?.logic === 'AND' ? 'selected' : ''}>All conditions are met (AND)</option>
                                <option value="OR" ${page.navigationConfig?.submit?.conditionalVisibility?.logic === 'OR' ? 'selected' : ''}>Any condition is met (OR)</option>
                            </select>
                        </div>
                        
                        <div id="page-submit-conditions-list" class="conditions-list">
                            ${this.renderPageConditions(page.navigationConfig?.submit?.conditionalVisibility?.conditions || [], availableFields, 'submit')}
                        </div>
                        
                        <button type="button" class="button button-secondary add-condition-btn" 
                                onclick="window.AppModules.formBuilder.addPageNavigationButtonCondition('submit')">
                            <span class="button-icon">+</span> Add Submit Button Condition
                        </button>
                        
                        <button type="button" class="button button-primary" style="margin-top: var(--space-2);"
                                onclick="setupRequireLoginForSubmit()">
                            🔐 Require Login for Submit Button
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // Helper method for Repeat Configuration Section
    renderRepeatConfigurationSection(page) {
        return `
            <div class="property-section">
                <div class="section-header">
                    <h3 class="section-title">🔄 Repeat Configuration</h3>
                    <p class="section-description">Allow users to create multiple instances of this page (e.g., multiple contacts)</p>
                </div>
                
                <div class="property-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="page-repeat-enabled" ${page.repeatConfig?.enabled ? 'checked' : ''}
                               onchange="window.AppModules.formBuilder.togglePageRepeat(this.checked)">
                        Enable repeat functionality for this page
                    </label>
                </div>
                
                <div id="page-repeat-config" style="display: ${page.repeatConfig?.enabled ? 'block' : 'none'}">
                    <div class="property-row">
                        <div class="property-group">
                            <label>Minimum Instances</label>
                            <input type="number" id="page-repeat-min" min="1" max="50" 
                                   value="${page.repeatConfig?.minInstances || 1}"
                                   onchange="window.AppModules.formBuilder.updatePageRepeatProperty('minInstances', parseInt(this.value))">
                        </div>
                        
                        <div class="property-group">
                            <label>Maximum Instances</label>
                            <input type="number" id="page-repeat-max" min="1" max="50" 
                                   value="${page.repeatConfig?.maxInstances || 10}"
                                   onchange="window.AppModules.formBuilder.updatePageRepeatProperty('maxInstances', parseInt(this.value))">
                        </div>
                    </div>
                    
                    <div class="property-row">
                        <div class="property-group">
                            <label>Add Button Text</label>
                            <input type="text" id="page-repeat-add-text" 
                                   value="${page.repeatConfig?.addButtonText || 'Add Another'}"
                                   placeholder="Add Another"
                                   onchange="window.AppModules.formBuilder.updatePageRepeatProperty('addButtonText', this.value)">
                        </div>
                        
                        <div class="property-group">
                            <label>Remove Button Text</label>
                            <input type="text" id="page-repeat-remove-text" 
                                   value="${page.repeatConfig?.removeButtonText || 'Remove'}"
                                   placeholder="Remove"
                                   onchange="window.AppModules.formBuilder.updatePageRepeatProperty('removeButtonText', this.value)">
                        </div>
                    </div>
                    
                    <div class="property-group">
                        <label>Relationship Field (Optional)</label>
                        <select id="page-repeat-relationship" 
                                onchange="window.AppModules.formBuilder.updatePageRepeatProperty('relationshipField', this.value)">
                            ${this.renderRepeatRelationshipFieldOptions(page.repeatConfig?.relationshipField)}
                        </select>
                        <div class="help-text">Field to link repeat instances to a parent record (loads from Salesforce object)</div>
                    </div>
                </div>
            </div>
        `;
    }

    // Helper method for Hidden Fields Section
    renderHiddenFieldsSection(page) {
        const hiddenFields = page.hiddenFields || [];
        return `
            <div class="property-section">
                <div class="section-header">
                    <h3 class="section-title">🔒 Hidden Fields</h3>
                    <p class="section-description">Set hidden field values automatically (e.g., RecordTypeId, OwnerId)</p>
                </div>
                
                <div id="hidden-fields-list" class="hidden-fields-list">
                    ${hiddenFields.map((field, index) => `
                        <div class="hidden-field-item" data-field-index="${index}">
                            <div class="property-row">
                                <div class="property-group">
                                    <label>Salesforce Field</label>
                                    <input type="text" value="${field.salesforceField || ''}"
                                           placeholder="e.g., RecordTypeId, OwnerId"
                                           onchange="window.AppModules.formBuilder.updateHiddenField(${index}, 'salesforceField', this.value)">
                                </div>
                                
                                <div class="property-group">
                                    <label>Value Type</label>
                                    <select onchange="window.AppModules.formBuilder.updateHiddenField(${index}, 'valueType', this.value)">
                                        <option value="static" ${field.valueType === 'static' ? 'selected' : ''}>Static Value</option>
                                        <option value="variable" ${field.valueType === 'variable' ? 'selected' : ''}>Variable</option>
                                        <option value="userInfo" ${field.valueType === 'userInfo' ? 'selected' : ''}>Current User</option>
                                    </select>
                                </div>
                                
                                <div class="property-group">
                                    <label>Value</label>
                                    <input type="text" value="${field.value || ''}"
                                           placeholder="${field.valueType === 'variable' ? 'Variable name' : field.valueType === 'userInfo' ? 'Id' : 'Static value'}"
                                           onchange="window.AppModules.formBuilder.updateHiddenField(${index}, 'value', this.value)">
                                </div>
                                
                                <button type="button" class="button button-danger remove-hidden-field-btn"
                                        onclick="window.AppModules.formBuilder.removeHiddenField(${index})">
                                    <span class="button-icon">×</span>
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <button type="button" class="button button-secondary add-hidden-field-btn" 
                        onclick="window.AppModules.formBuilder.addHiddenField()">
                    <span class="button-icon">+</span> Add Hidden Field
                </button>
            </div>
        `;
    }

    // Helper method for Advanced Settings Section
    renderAdvancedSettingsSection(page) {
        return `
            <div class="property-section">
                <div class="section-header">
                    <h3 class="section-title">⚙️ Advanced Settings</h3>
                    <p class="section-description">Advanced page configuration options</p>
                </div>
                
                <div class="property-group">
                    <label>Page CSS Classes</label>
                    <input type="text" id="page-css-classes" 
                           value="${page.cssClasses || ''}"
                           placeholder="custom-page special-styling"
                           onchange="window.AppModules.formBuilder.updatePageProperty('cssClasses', this.value)">
                    <div class="help-text">Custom CSS classes to apply to this page (space-separated)</div>
                </div>
                
                <div class="property-group">
                    <label>Page Custom CSS</label>
                    <textarea id="page-custom-css" rows="4"
                              placeholder="/* Custom CSS for this page only */"
                              onchange="window.AppModules.formBuilder.updatePageProperty('customCSS', this.value)">${page.customCSS || ''}</textarea>
                    <div class="help-text">CSS styles that will only apply to this specific page</div>
                </div>
                
                <div class="property-group">
                    <label>Skip Validation</label>
                    <label class="checkbox-label">
                        <input type="checkbox" id="page-skip-validation" ${page.skipValidation ? 'checked' : ''}
                               onchange="window.AppModules.formBuilder.updatePageProperty('skipValidation', this.checked)">
                        Skip field validation when navigating away from this page
                    </label>
                    <div class="help-text">Useful for optional information pages</div>
                </div>
                
                <div class="property-group">
                    <label>Page Order/Index</label>
                    <input type="number" id="page-order" min="0" 
                           value="${this.currentForm.pages.indexOf(page)}"
                           readonly
                           title="Use drag-and-drop on page tabs to reorder pages">
                    <div class="help-text">Current page position (use drag-and-drop on tabs to reorder)</div>
                </div>
            </div>
        `;
    }

    // Helper method to get available Salesforce objects
    getAvailableSalesforceObjects() {
        // Return cached objects if available
        if (window.AppState.salesforceObjects && window.AppState.salesforceObjects.length > 0) {
            return window.AppState.salesforceObjects;
        }
        
        // Return empty array if not connected or no objects loaded
        return [];
    }

    // Helper method to get available fields for page conditions
    getAvailableFieldsForPageConditions(page) {
        const variableMap = new Map();
        const currentPageIndex = this.currentForm.pages.indexOf(page);
        
        // Helper function to add variable to map with source tracking
        const addVariable = (id, label, page, source) => {
            if (!variableMap.has(id)) {
                variableMap.set(id, { id, label, page, source });
                debugInfo("FormBuilder", `  ✅ PAGE CONDITIONS: Added variable "${id}" (${source})`);
            } else {
                const existing = variableMap.get(id);
                // Update label to show multiple sources if different
                if (existing.source !== source) {
                    existing.label = `${id} (${existing.source} + ${source})`;
                    debugInfo("FormBuilder", `  🔄 PAGE CONDITIONS: Updated variable "${id}" to show multiple sources`);
                }
            }
        };
        
        // Get fields from ALL pages in the form
        this.currentForm.pages.forEach((p, pageIdx) => {
            p.fields.forEach(field => {
                if (field.type !== 'display') {
                    // Add page context if it's not the current page
                    const label = pageIdx === currentPageIndex 
                        ? field.label 
                        : `${field.label} (${p.name || `Page ${pageIdx + 1}`})`;
                    
                    addVariable(
                        field.id,
                        label,
                        p.name || `Page ${pageIdx + 1}`,
                        'Field'
                    );
                }
            });
        })
        
        // Add global variables
        debugInfo("FormBuilder", '🔍 PAGE CONDITIONS: Checking FormVariables availability...');
        if (window.FormVariables) {
            try {
                // Check if getAll method exists
                if (typeof window.FormVariables.getAll === 'function') {
                    const globalVars = window.FormVariables.getAll();
                    const varCount = Object.keys(globalVars).length;
                    debugInfo("FormBuilder", `📊 PAGE CONDITIONS: Found ${varCount} global variables:`, globalVars);
                    
                    Object.entries(globalVars).forEach(([varName, value]) => {
                        addVariable(
                            varName,
                            `${varName} (Variable)`,
                            'Global Variables',
                            'Global'
                        );
                    });
                } else {
                    debugWarn("FormBuilder", '⚠️ PAGE CONDITIONS: FormVariables.getAll method not available');
                    // Fallback: try to access the variables Map directly
                    if (window.FormVariables.variables && window.FormVariables.variables instanceof Map) {
                        debugInfo("FormBuilder", '🔄 PAGE CONDITIONS: Using direct Map access as fallback...');
                        window.FormVariables.variables.forEach((value, varName) => {
                            addVariable(
                                varName,
                                `${varName} (Variable)`,
                                'Global Variables',
                                'Global'
                            );
                        });
                    }
                }
            } catch (error) {
                debugWarn("FormBuilder", 'Error accessing FormVariables in getAvailableFieldsForPageConditions:', error);
            }
        } else {
            debugWarn("FormBuilder", '⚠️ PAGE CONDITIONS: FormVariables not available');
        }
        
        // Add Login field variables from ALL pages
        debugInfo("FormBuilder", '🔍 PAGE CONDITIONS: Checking Login field variables...');
        this.currentForm.pages.forEach((formPage, pageIdx) => {
            formPage.fields.forEach(field => {
                if (field.type === 'login' && field.loginConfig && field.loginConfig.setVariables) {
                    debugInfo("FormBuilder", `📝 PAGE CONDITIONS: Found login field "${field.label}" (${field.id}) with variables:`, Object.keys(field.loginConfig.setVariables));
                    Object.keys(field.loginConfig.setVariables).forEach(varName => {
                        // Only add the simple variable name (no field-specific duplicates)
                        addVariable(
                            varName,
                            `${varName} (Login)`,
                            formPage.name,
                            'Login'
                        );
                    });
                    
                    // Add login completion variable (field-specific)
                    const loginCompleteId = `${field.id}_loginComplete`;
                    addVariable(
                        loginCompleteId,
                        `${loginCompleteId} (Login Status)`,
                        formPage.name,
                        'Login Status'
                    );
                }
            });
        });
        
        // Add variables from field setVariablesConfig for ALL field types
        debugInfo("FormBuilder", '🔍 PAGE CONDITIONS: Checking field setVariablesConfig variables...');
        this.currentForm.pages.forEach((formPage, pageIdx) => {
            formPage.fields.forEach(field => {
                if (field.setVariablesConfig && field.setVariablesConfig.enabled && field.setVariablesConfig.setVariables) {
                    debugInfo("FormBuilder", `📝 PAGE CONDITIONS: Found field "${field.label}" (${field.id}) with setVariablesConfig:`, Object.keys(field.setVariablesConfig.setVariables));
                    Object.keys(field.setVariablesConfig.setVariables).forEach(varName => {
                        addVariable(
                            varName,
                            `${varName} (Field: ${field.label})`,
                            formPage.name,
                            'Field'
                        );
                    });
                }
            });
        });

        // Add Email Verify field variables from ALL pages
        debugInfo("FormBuilder", '🔍 PAGE CONDITIONS: Checking Email Verify field variables...');
        this.currentForm.pages.forEach((formPage, pageIdx) => {
            formPage.fields.forEach(field => {
                if (field.type === 'email-verify' && field.verifyConfig && field.verifyConfig.setVariables) {
                    debugInfo("FormBuilder", `📝 PAGE CONDITIONS: Found email verify field "${field.label}" (${field.id}) with variables:`, Object.keys(field.verifyConfig.setVariables));
                    Object.keys(field.verifyConfig.setVariables).forEach(varName => {
                        addVariable(
                            varName,
                            `${varName} (Email Verify)`,
                            formPage.name,
                            'Email Verify'
                        );
                    });
                }
            });
        });
        
        // Convert variableMap back to fields array
        const fields = [];
        debugInfo("FormBuilder", `🔍 PAGE CONDITIONS: Found ${variableMap.size} unique variables total`);
        variableMap.forEach(variable => {
            fields.push(variable);
        });
        
        return fields;
    }

    // Helper method to update page properties
    updatePageProperty(property, value) {
        const currentPage = this.getCurrentPage();
        if (!currentPage) return;

        // Special handling for record ID variable creation
        if (property === 'recordIdVariable' && value === '_create_new_') {
            const newVarName = prompt('Enter new variable name (e.g., recordId, contactId):');
            if (newVarName && newVarName.trim()) {
                const varName = newVarName.trim();
                currentPage[property] = varName;
                
                // Create the variable in the global system if it doesn't exist
                if (window.FormVariables && !window.FormVariables.has(varName)) {
                    window.FormVariables.set(varName, '');
                    debugInfo("FormBuilder", `Created new RecordId variable: ${varName}`);
                }
                
                // Refresh the page properties to show the new variable in dropdown
                this.showPageProperties();
                this.markFormDirty();
                return;
            } else {
                // Reset the dropdown if no name provided
                const dropdown = document.getElementById('page-record-id-variable');
                if (dropdown) {
                    dropdown.value = currentPage.recordIdVariable || '';
                }
                return;
            }
        }

        // Standard property update
        currentPage[property] = value;
        this.markFormDirty();
        
        // Special handling for action type to show/hide record ID field
        if (property === 'actionType') {
            const recordIdGroup = document.getElementById('record-id-group');
            if (recordIdGroup) {
                recordIdGroup.style.display = value === 'update' ? 'block' : 'none';
            }
        }
        
        // Update page tabs if name changed
        if (property === 'name') {
            this.updatePageTabs();
        }
    }

    // Toggle record linking functionality
    toggleRecordLinking(enabled) {
        const currentPage = this.getCurrentPage();
        if (!currentPage) return;
        
        if (!currentPage.recordLinking) {
            currentPage.recordLinking = {
                enabled: false,
                parentSource: '',
                relationshipField: ''
            };
        }
        
        currentPage.recordLinking.enabled = enabled;
        this.markFormDirty();
        
        // Show/hide record linking configuration
        const configDiv = document.getElementById('record-linking-config');
        if (configDiv) {
            configDiv.style.display = enabled ? 'block' : 'none';
        }
    }

    // Update record linking properties
    updateRecordLinkingProperty(property, value) {
        const currentPage = this.getCurrentPage();
        if (!currentPage) return;
        
        if (!currentPage.recordLinking) {
            currentPage.recordLinking = {};
        }
        
        currentPage.recordLinking[property] = value;
        this.markFormDirty();
        
        // Show relationship field dropdown when parent source is selected
        if (property === 'parentSource') {
            const relationshipGroup = document.getElementById('relationship-field-group');
            if (relationshipGroup) {
                relationshipGroup.style.display = value ? 'block' : 'none';
            }
            
            // Refresh relationship field options
            this.refreshRelationshipFieldOptions();
        }
    }

    // Render parent record options (pages that create records)
    renderParentRecordOptions(selectedValue) {
        const pages = this.currentForm.pages || [];
        const currentPageIndex = this.currentPageIndex;
        
        return pages
            .filter((page, index) => {
                // Only show pages that come before this page and create records
                return index < currentPageIndex && 
                       page.salesforceObject && 
                       page.actionType === 'create';
            })
            .map(page => {
                const pageName = page.name || `Page ${pages.indexOf(page) + 1}`;
                const objectLabel = page.salesforceObject;
                return `<option value="page_${pages.indexOf(page)}" ${selectedValue === `page_${pages.indexOf(page)}` ? 'selected' : ''}>
                    ${pageName} (${objectLabel})
                </option>`;
            })
            .join('');
    }

    // Render relationship field options based on current object
    renderRelationshipFieldOptions(currentObject, selectedValue) {
        if (!currentObject) {
            return '<option value="">Select Salesforce object first</option>';
        }
        
        // This would be populated with actual relationship fields from Salesforce
        // For now, return common relationship field patterns
        const commonRelationshipFields = [
            { name: 'AccountId', label: 'Account' },
            { name: 'ContactId', label: 'Contact' },
            { name: 'OpportunityId', label: 'Opportunity' },
            { name: 'LeadId', label: 'Lead' },
            { name: 'CaseId', label: 'Case' },
            { name: 'ParentId', label: 'Parent Record' }
        ];
        
        return commonRelationshipFields
            .map(field => `<option value="${field.name}" ${selectedValue === field.name ? 'selected' : ''}>
                ${field.label} (${field.name})
            </option>`)
            .join('');
    }

    // Refresh relationship field options when parent source changes
    refreshRelationshipFieldOptions() {
        const currentPage = this.getCurrentPage();
        if (!currentPage || !currentPage.salesforceObject) return;
        
        const dropdown = document.getElementById('page-relationship-field');
        if (dropdown) {
            dropdown.innerHTML = `
                <option value="">Select relationship field...</option>
                ${this.renderRelationshipFieldOptions(currentPage.salesforceObject, currentPage.recordLinking?.relationshipField)}
            `;
        }
    }

    // Helper method to toggle page repeat functionality
    togglePageRepeat(enabled) {
        const currentPage = this.getCurrentPage();
        if (!currentPage) return;
        
        if (!currentPage.repeatConfig) {
            currentPage.repeatConfig = {
                enabled: false,
                minInstances: 1,
                maxInstances: 10,
                addButtonText: 'Add Another',
                removeButtonText: 'Remove',
                relationshipField: null
            };
        }
        
        currentPage.repeatConfig.enabled = enabled;
        this.markFormDirty();
        
        // Show/hide repeat configuration
        const repeatConfig = document.getElementById('page-repeat-config');
        if (repeatConfig) {
            repeatConfig.style.display = enabled ? 'block' : 'none';
        }
    }

    // Helper method to update page repeat properties
    updatePageRepeatProperty(property, value) {
        const currentPage = this.getCurrentPage();
        if (!currentPage || !currentPage.repeatConfig) return;

        // Special handling for custom relationship field creation
        if (property === 'relationshipField' && value === '_create_custom_') {
            const customFieldName = prompt('Enter custom relationship field name (e.g., AccountId, CustomParent__c):');
            if (customFieldName && customFieldName.trim()) {
                const fieldName = customFieldName.trim();
                currentPage.repeatConfig[property] = fieldName;
                this.markFormDirty();
                
                // Refresh the page properties to show the new field
                this.renderPageProperties();
                return;
            } else {
                // Reset the dropdown if no name provided
                this.renderPageProperties();
                return;
            }
        }
        
        currentPage.repeatConfig[property] = value;
        this.markFormDirty();
    }

    // Helper method to add hidden field
    addHiddenField() {
        const currentPage = this.getCurrentPage();
        if (!currentPage) return;
        
        if (!currentPage.hiddenFields) {
            currentPage.hiddenFields = [];
        }
        
        currentPage.hiddenFields.push({
            salesforceField: '',
            valueType: 'static',
            value: ''
        });
        
        this.showPageProperties(); // Refresh to show new field
        this.markFormDirty();
    }

    // Helper method to update hidden field
    updateHiddenField(index, property, value) {
        const currentPage = this.getCurrentPage();
        if (!currentPage || !currentPage.hiddenFields || !currentPage.hiddenFields[index]) return;
        
        currentPage.hiddenFields[index][property] = value;
        this.markFormDirty();
    }

    // Helper method to remove hidden field
    removeHiddenField(index) {
        const currentPage = this.getCurrentPage();
        if (!currentPage || !currentPage.hiddenFields) return;
        
        if (confirm('Remove this hidden field?')) {
            currentPage.hiddenFields.splice(index, 1);
            this.showPageProperties(); // Refresh to remove field from UI
            this.markFormDirty();
        }
    }

    attachPagePropertyListeners(page) {
        // Helper function to safely add event listeners
        const addSafeListener = (id, event, handler) => {
            const element = document.getElementById(id);
            if (element) {
                element.addEventListener(event, handler);
            } else {
                debugWarn("FormBuilder", `Element with ID '${id}' not found when attaching listeners`);
            }
        };

        // Page Name
        addSafeListener('page-name', 'input', (e) => {
            this.updatePageProperty('name', e.target.value);
        });

        // Salesforce Object
        addSafeListener('page-salesforce-object', 'change', (e) => {
            this.updatePageProperty('salesforceObject', e.target.value);
        });

        // Action Type
        addSafeListener('page-action-type', 'change', (e) => {
            this.updatePageProperty('actionType', e.target.value);
            // Show/hide appropriate configuration groups based on action type
            const recordIdGroup = document.getElementById('record-id-group');
            const queryConfigGroup = document.getElementById('query-config-group');
            
            if (recordIdGroup) {
                recordIdGroup.style.display = e.target.value === 'update' ? 'block' : 'none';
            }
            
            if (queryConfigGroup) {
                queryConfigGroup.style.display = e.target.value === 'get' ? 'block' : 'none';
            }
        });

        // Page Conditional Visibility Toggle - Note: using the legacy ID since main one might be hidden
        addSafeListener('page-conditional-enabled-legacy', 'change', (e) => {
            this.togglePageConditionalVisibility(e.target.checked);
        });

        // Page Conditional Logic (AND/OR)
        addSafeListener('page-condition-logic', 'change', (e) => {
            this.updatePageConditionalProperty('logic', e.target.value);
        });

        // Page Navigation Button Conditional Visibility Toggles
        addSafeListener('page-next-btn-conditional', 'change', (e) => {
            this.togglePageNavigationButtonConditionalVisibility('next', e.target.checked);
        });
        addSafeListener('page-submit-btn-conditional', 'change', (e) => {
            this.togglePageNavigationButtonConditionalVisibility('submit', e.target.checked);
        });

        // Page Navigation Button Conditional Logic (AND/OR)
        addSafeListener('page-next-condition-logic', 'change', (e) => {
            this.updatePageNavigationButtonConditionalProperty('next', 'logic', e.target.value);
        });
        addSafeListener('page-submit-condition-logic', 'change', (e) => {
            this.updatePageNavigationButtonConditionalProperty('submit', 'logic', e.target.value);
        });
    }

    renderPageConditions(conditions, availableFields, buttonType = null) {
        if (!conditions || conditions.length === 0) {
            return '<div class="no-conditions">No conditions configured</div>';
        }

        return conditions.map((condition, index) => {
            const dependsOnId = buttonType ? `page-${buttonType}-dependsOn-${index}` : `page-dependsOn-${index}`;
            const conditionId = buttonType ? `page-${buttonType}-condition-${index}` : `page-condition-${index}`;
            const valueId = buttonType ? `page-${buttonType}-value-${index}` : `page-value-${index}`;

            return `
                <div class="condition-item" data-condition-index="${index}">
                    <select id="${dependsOnId}" onchange="window.AppModules.formBuilder.updatePageCondition(${index}, 'dependsOn', this.value, '${buttonType || 'page'}')">
                        <option value="">Select field/variable...</option>
                        ${availableFields.map(f => `
                            <option value="${f.id}" ${condition.dependsOn === f.id ? 'selected' : ''}>
                                ${f.label}
                            </option>
                        `).join('')}
                    </select>
                    <select id="${conditionId}" onchange="window.AppModules.formBuilder.updatePageCondition(${index}, 'condition', this.value, '${buttonType || 'page'}')">
                        <option value="equals" ${condition.condition === 'equals' ? 'selected' : ''}>Equals</option>
                        <option value="not_equals" ${condition.condition === 'not_equals' ? 'selected' : ''}>Not equals</option>
                        <option value="contains" ${condition.condition === 'contains' ? 'selected' : ''}>Contains</option>
                        <option value="not_contains" ${condition.condition === 'not_contains' ? 'selected' : ''}>Does not contain</option>
                        <option value="starts_with" ${condition.condition === 'starts_with' ? 'selected' : ''}>Starts with</option>
                        <option value="ends_with" ${condition.condition === 'ends_with' ? 'selected' : ''}>Ends with</option>
                        <option value="is_empty" ${condition.condition === 'is_empty' ? 'selected' : ''}>Is empty</option>
                        <option value="is_not_empty" ${condition.condition === 'is_not_empty' ? 'selected' : ''}>Is not empty</option>
                        <option value="greater_than" ${condition.condition === 'greater_than' ? 'selected' : ''}>Greater than</option>
                        <option value="less_than" ${condition.condition === 'less_than' ? 'selected' : ''}>Less than</option>
                        <option value="greater_equal" ${condition.condition === 'greater_equal' ? 'selected' : ''}>Greater or equal</option>
                        <option value="less_equal" ${condition.condition === 'less_equal' ? 'selected' : ''}>Less or equal</option>
                    </select>
                    <input type="text" id="${valueId}" value="${condition.value || ''}"
                           onchange="window.AppModules.formBuilder.updatePageCondition(${index}, 'value', this.value, '${buttonType || 'page'}')"
                           ${this.needsValueInput(condition.condition) ? '' : 'disabled'}>
                    <button type="button" class="button button-small remove-condition-btn" 
                            onclick="window.AppModules.formBuilder.removePageCondition(${index}, '${buttonType || 'page'}')">×</button>
                </div>
            `;
        }).join('');
    }

    // Helper method to determine if a condition needs a value input
    needsValueInput(condition) {
        return !['is_empty', 'is_not_empty'].includes(condition);
    }


    addPageCondition() {
        const currentPage = this.getCurrentPage();
        if (!currentPage) {
            debugError("FormBuilder", 'No current page found for adding condition');
            return;
        }
        if (!currentPage.conditionalVisibility) {
            currentPage.conditionalVisibility = { enabled: true, conditions: [], logic: 'AND' };
        }
        if (!Array.isArray(currentPage.conditionalVisibility.conditions)) {
            currentPage.conditionalVisibility.conditions = [];
        }
        currentPage.conditionalVisibility.conditions.push({
            dependsOn: '',
            condition: 'equals',
            value: ''
        });
        this.showPageProperties();
        this.markFormDirty();
    }

    removePageCondition(index, type) {
        const currentPage = this.getCurrentPage();
        if (!currentPage) {
            debugError("FormBuilder", 'No current page found for removing condition');
            return;
        }
        
        if (type === 'page') {
            if (currentPage.conditionalVisibility && Array.isArray(currentPage.conditionalVisibility.conditions)) {
                currentPage.conditionalVisibility.conditions.splice(index, 1);
            }
        } else if (type === 'next') {
            if (currentPage.navigationConfig?.next?.conditionalVisibility?.conditions) {
                currentPage.navigationConfig.next.conditionalVisibility.conditions.splice(index, 1);
            }
        } else if (type === 'submit') {
            if (currentPage.navigationConfig?.submit?.conditionalVisibility?.conditions) {
                currentPage.navigationConfig.submit.conditionalVisibility.conditions.splice(index, 1);
            }
        }
        this.showPageProperties();
        this.markFormDirty();
    }

    updatePageCondition(index, property, value, type) {
        const currentPage = this.getCurrentPage();
        if (!currentPage) {
            debugError("FormBuilder", 'No current page found for updating condition');
            return;
        }
        
        let targetConditions;

        if (type === 'page') {
            targetConditions = currentPage.conditionalVisibility?.conditions;
        } else if (type === 'next') {
            targetConditions = currentPage.navigationConfig?.next?.conditionalVisibility?.conditions;
        } else if (type === 'submit') {
            targetConditions = currentPage.navigationConfig?.submit?.conditionalVisibility?.conditions;
        }

        if (targetConditions && Array.isArray(targetConditions) && targetConditions[index]) {
            targetConditions[index][property] = value;
            this.markFormDirty();
            // Re-render properties to update disabled state of value input
            this.showPageProperties();
        }
    }

    togglePageConditionalVisibility(enabled) {
        const currentPage = this.getCurrentPage();
        if (!currentPage.conditionalVisibility) {
            currentPage.conditionalVisibility = { enabled: false, conditions: [], logic: 'AND' };
        }
        currentPage.conditionalVisibility.enabled = enabled;
        this.showPageProperties();
        this.markFormDirty();
    }

    // New inline version that doesn't refresh the properties panel
    togglePageConditionalVisibilityInline(enabled) {
        const currentPage = this.getCurrentPage();
        if (!currentPage.conditionalVisibility) {
            currentPage.conditionalVisibility = { enabled: false, conditions: [], logic: 'AND' };
        }
        currentPage.conditionalVisibility.enabled = enabled;
        
        // Show/hide conditional config without refreshing entire properties panel
        const conditionalConfig = document.getElementById('page-conditional-config');
        if (conditionalConfig) {
            conditionalConfig.style.display = enabled ? 'block' : 'none';
        }
        this.markFormDirty();
    }

    // New inline version for navigation conditional visibility
    toggleNavigationConditionalVisibilityInline(buttonType, enabled) {
        const currentPage = this.getCurrentPage();
        if (!currentPage.navigationConfig) {
            currentPage.navigationConfig = {};
        }
        if (!currentPage.navigationConfig[buttonType]) {
            currentPage.navigationConfig[buttonType] = {
                conditionalVisibility: {}
            };
        }
        
        currentPage.navigationConfig[buttonType].conditionalVisibility.enabled = enabled;
        
        // Show/hide conditional config without refreshing entire properties panel
        const conditionalConfig = document.getElementById(`${buttonType.replace('Button', '')}-conditional-config`);
        if (conditionalConfig) {
            conditionalConfig.style.display = enabled ? 'block' : 'none';
        }
        this.markFormDirty();
    }

    // Advanced rendering with numbered conditions and clear labels
    renderPageConditionsAdvanced(conditions, availableFields) {
        if (!conditions || conditions.length === 0) {
            return '<div class="no-conditions">No conditions set</div>';
        }
        
        return conditions.map((condition, index) => `
            <div class="condition-item-compact">
                <div class="condition-header">
                    <span class="condition-number">${index + 1}</span>
                    <label class="condition-label">Condition ${index + 1}</label>
                    <button type="button" class="property-button-compact remove-condition" onclick="window.AppModules.formBuilder.removePageConditionCompact(${index})">×</button>
                </div>
                <div class="condition-controls">
                    <div class="property-group-compact">
                        <label class="control-label">Field</label>
                        <select onchange="window.AppModules.formBuilder.updatePageCondition(${index}, 'field', this.value)">
                            <option value="">Choose field to check...</option>
                            ${this.renderFieldOptionsCompact(availableFields, condition.field)}
                        </select>
                    </div>
                    <div class="property-group-compact">
                        <label class="control-label">Operator</label>
                        <select onchange="window.AppModules.formBuilder.updatePageCondition(${index}, 'operator', this.value)">
                            <option value="equals" ${condition.operator === 'equals' ? 'selected' : ''}>Equals</option>
                            <option value="not_equals" ${condition.operator === 'not_equals' ? 'selected' : ''}>Not Equals</option>
                            <option value="contains" ${condition.operator === 'contains' ? 'selected' : ''}>Contains</option>
                            <option value="starts_with" ${condition.operator === 'starts_with' ? 'selected' : ''}>Starts With</option>
                            <option value="ends_with" ${condition.operator === 'ends_with' ? 'selected' : ''}>Ends With</option>
                            <option value="is_empty" ${condition.operator === 'is_empty' ? 'selected' : ''}>Is Empty</option>
                            <option value="is_not_empty" ${condition.operator === 'is_not_empty' ? 'selected' : ''}>Is Not Empty</option>
                        </select>
                    </div>
                    <div class="property-group-compact">
                        <label class="control-label">Value</label>
                        <input type="text" value="${condition.value || ''}" 
                               placeholder="Value to compare against..."
                               onchange="window.AppModules.formBuilder.updatePageCondition(${index}, 'value', this.value)">
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderPageConditionsCompact(conditions, availableFields) {
        // Fallback to advanced version for backwards compatibility
        return this.renderPageConditionsAdvanced(conditions, availableFields);
    }

    renderFieldOptionsCompact(fields, selectedValue) {
        return fields.map(field => `
            <option value="${field.id}" ${field.id === selectedValue ? 'selected' : ''}>${field.label}</option>
        `).join('');
    }

    addPageConditionCompact() {
        const currentPage = this.getCurrentPage();
        if (!currentPage.conditionalVisibility) {
            currentPage.conditionalVisibility = { enabled: true, conditions: [], logicExpression: '' };
        }
        if (!currentPage.conditionalVisibility.conditions) {
            currentPage.conditionalVisibility.conditions = [];
        }
        
        currentPage.conditionalVisibility.conditions.push({
            field: '',
            operator: 'equals',
            value: ''
        });
        
        // Re-render just the conditions list
        const conditionsList = document.getElementById('page-conditions-list');
        if (conditionsList) {
            const availableFields = this.getAvailableFieldsForPageConditions(currentPage);
            conditionsList.innerHTML = this.renderPageConditionsAdvanced(currentPage.conditionalVisibility.conditions, availableFields);
        }
        this.markFormDirty();
    }

    removePageConditionCompact(index) {
        const currentPage = this.getCurrentPage();
        if (!currentPage.conditionalVisibility || !currentPage.conditionalVisibility.conditions) return;
        
        currentPage.conditionalVisibility.conditions.splice(index, 1);
        
        // Re-render just the conditions list
        const conditionsList = document.getElementById('page-conditions-list');
        if (conditionsList) {
            const availableFields = this.getAvailableFieldsForPageConditions(currentPage);
            conditionsList.innerHTML = this.renderPageConditionsAdvanced(currentPage.conditionalVisibility.conditions, availableFields);
        }
        this.markFormDirty();
    }

    updatePageCondition(index, property, value) {
        const currentPage = this.getCurrentPage();
        if (!currentPage.conditionalVisibility || !currentPage.conditionalVisibility.conditions || !currentPage.conditionalVisibility.conditions[index]) return;
        
        currentPage.conditionalVisibility.conditions[index][property] = value;
        this.markFormDirty();
        
        // Re-evaluate page conditions immediately
        const conditionalLogic = window.AppModules?.conditionalLogic;
        if (conditionalLogic) {
            conditionalLogic.setupConditionalLogic();
        }
    }

    updateNavigationCondition(buttonType, property, value) {
        const currentPage = this.getCurrentPage();
        if (!currentPage.navigationConfig || !currentPage.navigationConfig[buttonType]) return;
        
        // Ensure conditionalVisibility exists
        if (!currentPage.navigationConfig[buttonType].conditionalVisibility) {
            currentPage.navigationConfig[buttonType].conditionalVisibility = {};
        }
        
        currentPage.navigationConfig[buttonType].conditionalVisibility[property] = value;
        
        // Handle operator change - show/hide value field
        if (property === 'operator') {
            const valueGroupId = buttonType === 'nextButton' ? 'next-condition-value-group' : 'submit-condition-value-group';
            const valueGroup = document.getElementById(valueGroupId);
            if (valueGroup) {
                valueGroup.style.display = this.needsValueInput(value) ? 'block' : 'none';
            }
        }
        
        this.markFormDirty();
        
        // Re-evaluate conditions immediately
        const multiPage = window.AppModules?.multiPage;
        if (multiPage) {
            multiPage.updateNavigationButtons();
        }
    }

    updatePageConditionalProperty(property, value) {
        const currentPage = this.getCurrentPage();
        if (currentPage.conditionalVisibility) {
            currentPage.conditionalVisibility[property] = value;
            this.markFormDirty();
        }
    }

    togglePageNavigationButtonConditionalVisibility(buttonType, enabled) {
        const currentPage = this.getCurrentPage();
        if (!currentPage) {
            debugError("FormBuilder", 'No current page found for navigation button conditional visibility');
            return;
        }
        
        // Initialize navigationConfig if it doesn't exist
        if (!currentPage.navigationConfig) {
            currentPage.navigationConfig = {
                next: { conditionalVisibility: { enabled: false, conditions: [], logic: 'AND' } },
                submit: { conditionalVisibility: { enabled: false, conditions: [], logic: 'AND' } }
            };
        }
        
        // Initialize specific button config if it doesn't exist
        if (!currentPage.navigationConfig[buttonType]) {
            currentPage.navigationConfig[buttonType] = { conditionalVisibility: { enabled: false, conditions: [], logic: 'AND' } };
        }
        
        if (!currentPage.navigationConfig[buttonType].conditionalVisibility) {
            currentPage.navigationConfig[buttonType].conditionalVisibility = { enabled: false, conditions: [], logic: 'AND' };
        }
        
        currentPage.navigationConfig[buttonType].conditionalVisibility.enabled = enabled;
        this.showPageProperties();
        this.markFormDirty();
    }

    updatePageNavigationButtonConditionalProperty(buttonType, property, value) {
        const currentPage = this.getCurrentPage();
        if (!currentPage) {
            debugError("FormBuilder", 'No current page found for navigation button property update');
            return;
        }
        
        // Initialize navigationConfig if needed
        if (!currentPage.navigationConfig) {
            currentPage.navigationConfig = {
                next: { conditionalVisibility: { enabled: false, conditions: [], logic: 'AND' } },
                submit: { conditionalVisibility: { enabled: false, conditions: [], logic: 'AND' } }
            };
        }
        
        if (!currentPage.navigationConfig[buttonType]) {
            currentPage.navigationConfig[buttonType] = { conditionalVisibility: { enabled: false, conditions: [], logic: 'AND' } };
        }
        
        if (!currentPage.navigationConfig[buttonType].conditionalVisibility) {
            currentPage.navigationConfig[buttonType].conditionalVisibility = { enabled: false, conditions: [], logic: 'AND' };
        }
        
        currentPage.navigationConfig[buttonType].conditionalVisibility[property] = value;
        this.markFormDirty();
    }

    addPageNavigationButtonCondition(buttonType) {
        const currentPage = this.getCurrentPage();
        if (!currentPage) {
            debugError("FormBuilder", 'No current page found for adding navigation button condition');
            return;
        }
        
        // Initialize navigationConfig if needed
        if (!currentPage.navigationConfig) {
            currentPage.navigationConfig = {
                next: { conditionalVisibility: { enabled: false, conditions: [], logic: 'AND' } },
                submit: { conditionalVisibility: { enabled: false, conditions: [], logic: 'AND' } }
            };
        }
        
        if (!currentPage.navigationConfig[buttonType]) {
            currentPage.navigationConfig[buttonType] = { conditionalVisibility: { enabled: false, conditions: [], logic: 'AND' } };
        }
        
        if (!currentPage.navigationConfig[buttonType].conditionalVisibility) {
            currentPage.navigationConfig[buttonType].conditionalVisibility = { enabled: true, conditions: [], logic: 'AND' };
        }
        
        if (!Array.isArray(currentPage.navigationConfig[buttonType].conditionalVisibility.conditions)) {
            currentPage.navigationConfig[buttonType].conditionalVisibility.conditions = [];
        }
        
        currentPage.navigationConfig[buttonType].conditionalVisibility.conditions.push({
            dependsOn: '',
            condition: 'equals',
            value: ''
        });
        this.showPageProperties();
        this.markFormDirty();
    }

    // ... (rest of the class) ...

    updatePageConditionalProperty(property, value) {
        const currentPage = this.getCurrentPage();
        if (currentPage.conditionalVisibility) {
            currentPage.conditionalVisibility[property] = value;
            this.markFormDirty();
        }
    }

    // Helper for rendering conditional config for fields (existing method)
    renderConditionalConfig(field) {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) return '';

        const currentForm = formBuilder.getFormData();
        const currentPage = formBuilder.getCurrentPage();

        // Get available fields for dependencies
        const availableFields = this.getAvailableFields(currentForm, currentPage, field);

        // For field conditions, we still use a single condition for simplicity in UI
        const currentCondition = field.conditionalVisibility || {};

        return `
            <div id="conditionalConfig" class="conditional-config">
                <div class="property-group">
                    <label>Show this field when:</label>
                    <select id="prop-dependsOn" onchange="window.AppModules.conditionalLogic?.updateConditionalProperty('dependsOn', this.value)">
                        <option value="">Select field...</option>
                        ${availableFields.map(f => `
                            <option value="${f.id}" ${currentCondition.dependsOn === f.id ? 'selected' : ''}>
                                ${f.label}
                            </option>
                        `).join('')}
                    </select>
                </div>

                <div class="property-group">
                    <label>Condition:</label>
                    <select id="prop-condition" onchange="window.AppModules.conditionalLogic?.updateConditionalProperty('condition', this.value)">
                        <option value="equals" ${currentCondition.condition === 'equals' ? 'selected' : ''}>Equals</option>
                        <option value="not_equals" ${currentCondition.condition === 'not_equals' ? 'selected' : ''}>Not equals</option>
                        <option value="contains" ${currentCondition.condition === 'contains' ? 'selected' : ''}>Contains</option>
                        <option value="not_contains" ${currentCondition.condition === 'not_contains' ? 'selected' : ''}>Does not contain</option>
                        <option value="starts_with" ${currentCondition.condition === 'starts_with' ? 'selected' : ''}>Starts with</option>
                        <option value="ends_with" ${currentCondition.condition === 'ends_with' ? 'selected' : ''}>Ends with</option>
                        <option value="is_empty" ${currentCondition.condition === 'is_empty' ? 'selected' : ''}>Is empty</option>
                        <option value="is_not_empty" ${currentCondition.condition === 'is_not_empty' ? 'selected' : ''}>Is not empty</option>
                        <option value="greater_than" ${currentCondition.condition === 'greater_than' ? 'selected' : ''}>Greater than</option>
                        <option value="less_than" ${currentCondition.condition === 'less_than' ? 'selected' : ''}>Less than</option>
                        <option value="greater_equal" ${currentCondition.condition === 'greater_equal' ? 'selected' : ''}>Greater or equal</option>
                        <option value="less_equal" ${currentCondition.condition === 'less_equal' ? 'selected' : ''}>Less or equal</option>
                    </select>
                </div>

                <div class="property-group" id="valueGroup" style="display: ${this.needsValueInput(currentCondition.condition) ? 'block' : 'none'}">
                    <label>Value:</label>
                    <input type="text" id="prop-conditionValue" value="${currentCondition.value || ''}"
                           onchange="window.AppModules.conditionalLogic?.updateConditionalProperty('value', this.value)">
                </div>
            </div>
        `;
    }

    needsValueInput(condition) {
        return !['is_empty', 'is_not_empty'].includes(condition);
    }

    getAvailableFields(form, currentPage, excludeField) {
        const fields = [];
        const currentPageIndex = form.pages.indexOf(currentPage);

        // Get fields from ALL pages in the form
        form.pages.forEach((page, pageIndex) => {
            page.fields.forEach(field => {
                // Exclude the current field being edited and display-only fields
                if (field.id !== excludeField?.id && field.type !== 'display') {
                    // Add page context if it's not the current page
                    const label = pageIndex === currentPageIndex 
                        ? field.label 
                        : `${field.label} (${page.name || `Page ${pageIndex + 1}`})`;
                    
                    fields.push({
                        id: field.id,
                        label: label,
                        page: page.name,
                        pageIndex: pageIndex,
                        type: field.type
                    });
                }
            });
        });

        // Also include global variables if available
        try {
            if (window.FormVariables && typeof window.FormVariables.getAll === 'function') {
                const variables = window.FormVariables.getAll();
                for (const [key, value] of variables) {
                    // Only add variables that aren't already field IDs
                    if (!fields.some(f => f.id === key)) {
                        fields.push({
                            id: key,
                            label: `${key} (Variable)`,
                            page: 'Global',
                            pageIndex: -1,
                            type: 'variable'
                        });
                    }
                }
            }
        } catch (error) {
            debugWarn("FormBuilder", 'Error accessing FormVariables in getAvailableFields:', error);
        }

        // Sort fields: current page first, then by page order, then variables
        fields.sort((a, b) => {
            if (a.pageIndex === currentPageIndex && b.pageIndex !== currentPageIndex) return -1;
            if (b.pageIndex === currentPageIndex && a.pageIndex !== currentPageIndex) return 1;
            if (a.pageIndex === -1 && b.pageIndex !== -1) return 1;
            if (b.pageIndex === -1 && a.pageIndex !== -1) return -1;
            return a.pageIndex - b.pageIndex;
        });

        return fields;
    }

    updateConditionalProperty(property, value) {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder || !formBuilder.selectedField) return;

        // Ensure conditionalVisibility object exists
        if (!formBuilder.selectedField.conditionalVisibility) {
            formBuilder.selectedField.conditionalVisibility = {};
        }

        formBuilder.selectedField.conditionalVisibility[property] = value;

        // Show/hide value input based on condition
        if (property === 'condition') {
            const valueGroup = document.getElementById('valueGroup');
            if (valueGroup) {
                valueGroup.style.display = this.needsValueInput(value) ? 'block' : 'none';
            }
        }

        // Update the field
        formBuilder.updateField(formBuilder.selectedField.id, {
            conditionalVisibility: formBuilder.selectedField.conditionalVisibility
        });

        // Re-evaluate conditions
        this.setupConditionalLogic();
    }

    // Method to initialize conditional logic for preview/published forms
    initializePreview() {
        // Get all form fields and setup value tracking
        const formFields = document.querySelectorAll('input, select, textarea');

        formFields.forEach(field => {
            const fieldId = field.name || field.id;
            const initialValue = this.getFieldValue(field);
            this.fieldValues.set(fieldId, initialValue);

            // Add event listeners
            field.addEventListener('input', (e) => this.handleFieldChange(e.target));
            field.addEventListener('change', (e) => this.handleFieldChange(e.target));
        });

        // Setup conditions from form configuration
        this.setupConditionalLogic();
    }

    // Method to evaluate page conditions for multi-page forms
    evaluatePageConditions(currentPageIndex) {
        for (const [pageId, pageConditionConfig] of this.pageConditions) {
            // Only evaluate pages that are after the current page or the current page itself
            // This prevents issues with conditions depending on future pages
            if (pageConditionConfig.pageIndex >= currentPageIndex) {
                this.evaluatePageCondition(pageId, pageConditionConfig);
            }
        }
    }

    // Method to get all field values (useful for form submission)
    getAllFieldValues() {
        return new Map(this.fieldValues);
    }

    // Method to set field value programmatically
    setFieldValue(fieldId, value) {
        this.fieldValues.set(fieldId, value);
        this.evaluateConditionsForField(fieldId);
    }

    // Method to check if a field is currently visible
    isFieldVisible(fieldId) {
        const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
        return fieldElement ? fieldElement.style.display !== 'none' : true;
    }

    // Method to get visible fields
    getVisibleFields() {
        const visibleFields = [];

        for (const [fieldId] of this.conditions) {
            if (this.isFieldVisible(fieldId)) {
                visibleFields.push(fieldId);
            }
        }

        return visibleFields;
    }

    // Method to validate conditional logic
    validateConditionalLogic() {
        const errors = [];

        for (const [fieldId, condition] of this.conditions) {
            // Check if dependent field exists
            if (!this.fieldValues.has(condition.dependsOn)) {
                errors.push(`Field ${fieldId} depends on non-existent field ${condition.dependsOn}`);
            }

            // Check for circular dependencies
            if (this.hasCircularDependency(fieldId, condition.dependsOn)) {
                errors.push(`Circular dependency detected for field ${fieldId}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    hasCircularDependency(fieldId, dependsOn, visited = new Set()) {
        if (visited.has(fieldId)) {
            return true;
        }

        visited.add(fieldId);

        const condition = this.conditions.get(dependsOn);
        if (condition) {
            return this.hasCircularDependency(dependsOn, condition.dependsOn, visited);
        }

        return false;
    }

    // Method to export conditional logic configuration
    exportConditions() {
        return {
            fieldConditions: Object.fromEntries(this.conditions),
            pageConditions: Object.fromEntries(this.pageConditions)
        };
    }

    // Method to import conditional logic configuration
    importConditions(config) {
        this.conditions = new Map(Object.entries(config.fieldConditions || {}));
        this.pageConditions = new Map(Object.entries(config.pageConditions || {}));
        this.evaluateAllConditions();
    }

    async loadSalesforceObjects() {
        // Page name
        document.getElementById('page-name').addEventListener('input', (e) => {
            const currentPage = this.getCurrentPage();
            if (currentPage) {
                currentPage.name = e.target.value;
                this.updatePageTabs();
                this.markFormDirty();
            }
        });

        // Page description
        document.getElementById('page-description').addEventListener('input', (e) => {
            const currentPage = this.getCurrentPage();
            if (currentPage) {
                currentPage.description = e.target.value;
                this.markFormDirty();
            }
        });

        // Load Salesforce objects
        await this.loadSalesforceObjects();

        // Salesforce object selection
        document.getElementById('page-salesforce-object').addEventListener('change', (e) => {
            const currentPage = this.getCurrentPage();
            if (currentPage) {
                currentPage.salesforceObject = e.target.value;
                this.markFormDirty();
                if (e.target.value) {
                    this.showFieldMapping();
                } else {
                    const fieldMappingSection = document.getElementById('field-mapping-section');
                    if (fieldMappingSection) fieldMappingSection.style.display = 'none';
                }
            }
        });

        // Action type selection
        document.getElementById('page-action-type').addEventListener('change', (e) => {
            const currentPage = this.getCurrentPage();
            if (currentPage) {
                currentPage.actionType = e.target.value;
                this.markFormDirty();
                debugInfo("FormBuilder", `Page action type changed to: ${e.target.value}`);
            }
        });

        // Load parent pages
        this.loadParentPages();

        // Parent page selection
        document.getElementById('page-parent-page').addEventListener('change', (e) => {
            const currentPage = this.getCurrentPage();
            if (currentPage) {
                currentPage.parentPageId = e.target.value;
                this.markFormDirty();
                if (e.target.value) {
                    this.loadParentFields(e.target.value);
                    const parentFieldSection = document.getElementById('parent-field-section');
                    if (parentFieldSection) parentFieldSection.style.display = 'block';
                } else {
                    const parentFieldSection = document.getElementById('parent-field-section');
                    if (parentFieldSection) parentFieldSection.style.display = 'none';
                }
            }
        });

        // Parent relationship field selection
        document.getElementById('page-parent-field').addEventListener('change', (e) => {
            const currentPage = this.getCurrentPage();
            if (currentPage) {
                currentPage.parentField = e.target.value;
                this.markFormDirty();
            }
        });

        // Page conditional visibility
        document.getElementById('page-conditional-enabled').addEventListener('change', (e) => {
            const currentPage = this.getCurrentPage();
            if (currentPage) {
                if (!currentPage.conditionalVisibility) currentPage.conditionalVisibility = {};
                currentPage.conditionalVisibility.enabled = e.target.checked;
                const pageConditionalOptions = document.getElementById('page-conditional-options');
                if (pageConditionalOptions) pageConditionalOptions.style.display = e.target.checked ? 'block' : 'none';
                this.markFormDirty();
            }
        });

        // Load previous pages for conditional visibility
        this.loadConditionalPages();

        // Page conditional depends on page
        document.getElementById('page-conditional-depends-page').addEventListener('change', (e) => {
            const currentPage = this.getCurrentPage();
            if (currentPage) {
                if (!currentPage.conditionalVisibility) currentPage.conditionalVisibility = {};
                currentPage.conditionalVisibility.dependsOnPage = e.target.value;
                this.loadConditionalFields(e.target.value);
                this.markFormDirty();
            }
        });

        // Page conditional depends on field
        document.getElementById('page-conditional-depends-field').addEventListener('change', (e) => {
            const currentPage = this.getCurrentPage();
            if (currentPage) {
                if (!currentPage.conditionalVisibility) currentPage.conditionalVisibility = {};
                currentPage.conditionalVisibility.dependsOn = e.target.value;
                this.markFormDirty();
            }
        });

        // Page conditional condition
        document.getElementById('page-conditional-condition').addEventListener('change', (e) => {
            const currentPage = this.getCurrentPage();
            if (currentPage) {
                if (!currentPage.conditionalVisibility) currentPage.conditionalVisibility = {};
                currentPage.conditionalVisibility.condition = e.target.value;
                const pageConditionalValueGroup = document.getElementById('page-conditional-value-group');
                if (pageConditionalValueGroup) pageConditionalValueGroup.style.display = this.needsValueInput(e.target.value) ? 'block' : 'none';
                this.markFormDirty();
            }
        });

        // Page conditional value
        document.getElementById('page-conditional-value').addEventListener('input', (e) => {
            const currentPage = this.getCurrentPage();
            if (currentPage) {
                if (!currentPage.conditionalVisibility) currentPage.conditionalVisibility = {};
                currentPage.conditionalVisibility.value = e.target.value;
                this.markFormDirty();
            }
        });

        // Repeat functionality
        document.getElementById('page-repeat-enabled').addEventListener('change', (e) => {
            const currentPage = this.getCurrentPage();
            if (currentPage) {
                if (!currentPage.repeatConfig) currentPage.repeatConfig = {};
                currentPage.repeatConfig.enabled = e.target.checked;
                const repeatOptions = document.getElementById('repeat-options');
                if (repeatOptions) repeatOptions.style.display = e.target.checked ? 'block' : 'none';
                this.markFormDirty();
            }
        });

        // Repeat configuration
        ['min', 'max', 'addButtonText', 'removeButtonText'].forEach(prop => {
            const element = document.getElementById(`page-repeat-${prop.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
            if (element) {
                element.addEventListener('input', (e) => {
                    const currentPage = this.getCurrentPage();
                    if (currentPage) {
                        if (!currentPage.repeatConfig) currentPage.repeatConfig = {};
                        currentPage.repeatConfig[prop] = e.target.type === 'number' ? parseInt(e.target.value) : e.target.value;
                        this.markFormDirty();
                    }
                });
            }
        });
    }

    async loadSalesforceObjects() {
        const salesforce = window.AppModules.salesforce;
        if (salesforce && window.AppState.salesforceConnected) {
            const objects = await salesforce.getObjects();
            const select = document.getElementById('page-salesforce-object');
            const currentPage = this.getCurrentPage();
            
            select.innerHTML = '<option value="">Select Salesforce Object...</option>';
            objects.forEach(obj => {
                const option = document.createElement('option');
                option.value = obj.name;
                option.textContent = `${obj.label} (${obj.name})`;
                if (currentPage && currentPage.salesforceObject === obj.name) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            if (currentPage && currentPage.salesforceObject) {
                this.showFieldMapping();
            }
        }
    }

    showFieldMapping() {
        const section = document.getElementById('field-mapping-section');
        section.style.display = 'block';
        // TODO: Implement field mapping UI
        document.getElementById('field-mapping-list').innerHTML = '<p>Field mapping will be implemented here</p>';
    }

    loadParentPages() {
        const select = document.getElementById('page-parent-page');
        if (!select) {
            debugWarn("FormBuilder", 'page-parent-page element not found, skipping loadParentPages');
            return;
        }
        
        const currentPage = this.getCurrentPage();
        
        select.innerHTML = '<option value="">No parent (independent page)</option>';
        
        this.currentForm.pages.forEach((page, index) => {
            if (index < this.currentPageIndex) { // Only show previous pages
                const option = document.createElement('option');
                option.value = page.id;
                option.textContent = page.name || `Page ${index + 1}`;
                if (currentPage && currentPage.parentPageId === page.id) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        });
        
        // If a parent page is selected, load the relationship fields and show the field section
        const parentFieldSection = document.getElementById('parent-field-section');
        if (currentPage && currentPage.parentPageId) {
            this.loadParentFields(currentPage.parentPageId);
            if (parentFieldSection) parentFieldSection.style.display = 'block';
        } else {
            if (parentFieldSection) parentFieldSection.style.display = 'none';
        }
    }

    async loadParentFields(parentPageId) {
        const parentPage = this.currentForm.pages.find(p => p.id === parentPageId);
        const currentPage = this.getCurrentPage();
        
        if (parentPage && parentPage.salesforceObject && currentPage && currentPage.salesforceObject) {
            const salesforce = window.AppModules.salesforce;
            if (salesforce && window.AppState.salesforceConnected) {
                // Get fields from the CURRENT page's object (e.g., Contact)
                // Look for relationship fields that can link to the parent object (e.g., Account)
                const fields = await salesforce.getObjectFields(currentPage.salesforceObject);
                
                // Filter for reference fields that could link to the parent object
                const relationshipFields = fields.filter(f => {
                    // Include reference fields and the parent object type
                    return f.type === 'reference' && (
                        // Check if this reference field can link to the parent object type
                        f.referenceTo && f.referenceTo.includes(parentPage.salesforceObject)
                    );
                });
                
                const select = document.getElementById('page-parent-field');
                
                select.innerHTML = '<option value="">Select relationship field...</option>';
                
                if (relationshipFields.length === 0) {
                    const noFieldsOption = document.createElement('option');
                    noFieldsOption.value = '';
                    noFieldsOption.textContent = `No relationship fields found linking ${currentPage.salesforceObject} to ${parentPage.salesforceObject}`;
                    noFieldsOption.disabled = true;
                    select.appendChild(noFieldsOption);
                } else {
                    // Auto-select the most appropriate field if none is currently selected
                    let autoSelectedField = null;
                    
                    // If current page doesn't have a parentField set, try to auto-select
                    if (!currentPage.parentField) {
                        // Look for common relationship field names based on parent object
                        const parentObjectName = parentPage.salesforceObject;
                        const commonFieldNames = [
                            `${parentObjectName}Id`,  // e.g., AccountId
                            `${parentObjectName}__c`, // e.g., Account__c (custom)
                            parentObjectName         // e.g., Account
                        ];
                        
                        // Find the best matching field
                        autoSelectedField = relationshipFields.find(field => 
                            commonFieldNames.includes(field.name)
                        ) || relationshipFields[0]; // fallback to first field
                        
                        if (autoSelectedField) {
                            currentPage.parentField = autoSelectedField.name;
                            this.markFormDirty();
                            debugInfo("FormBuilder", `Auto-selected relationship field: ${autoSelectedField.name} for ${currentPage.salesforceObject} → ${parentObjectName}`);
                        }
                    }
                    
                    relationshipFields.forEach(field => {
                        const option = document.createElement('option');
                        option.value = field.name;
                        option.textContent = `${field.label} (${field.name})`;
                        if (currentPage && currentPage.parentField === field.name) {
                            option.selected = true;
                        }
                        select.appendChild(option);
                    });
                }
            }
        }
    }

    loadConditionalPages() {
        const select = document.getElementById('page-conditional-depends-page');
        if (!select) {
            debugWarn("FormBuilder", 'page-conditional-depends-page element not found, skipping loadConditionalPages');
            return;
        }
        
        const currentPage = this.getCurrentPage();
        
        select.innerHTML = '<option value="">Select previous page...</option>';
        
        this.currentForm.pages.forEach((page, index) => {
            if (index < this.currentPageIndex) { // Only show previous pages
                const option = document.createElement('option');
                option.value = page.id;
                option.textContent = page.name || `Page ${index + 1}`;
                if (currentPage && currentPage.conditionalVisibility?.dependsOnPage === page.id) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        });
        
        // If a depends on page is selected, load the fields and variables
        if (currentPage && currentPage.conditionalVisibility?.dependsOnPage) {
            this.loadConditionalFields(currentPage.conditionalVisibility.dependsOnPage);
        }
    }

    loadConditionalFields(pageId) {
        const select = document.getElementById('page-conditional-depends-field');
        const currentPage = this.getCurrentPage();
        
        select.innerHTML = '<option value="">Select field or variable...</option>';
        
        if (!pageId) return;
        
        // Find the target page
        const targetPage = this.currentForm.pages.find(p => p.id === pageId);
        if (!targetPage) return;
        
        // Add regular form fields
        targetPage.fields.forEach(field => {
            if (!['display', 'file', 'signature'].includes(field.type)) {
                const option = document.createElement('option');
                option.value = field.id;
                option.textContent = `${field.label || field.id} (field)`;
                if (currentPage && currentPage.conditionalVisibility?.dependsOn === field.id) {
                    option.selected = true;
                }
                select.appendChild(option);
            }
        });
        
        // Add Login field variables
        targetPage.fields.forEach(field => {
            if (field.type === 'login' && field.loginConfig?.setVariables) {
                Object.keys(field.loginConfig.setVariables).forEach(varName => {
                    const option = document.createElement('option');
                    option.value = `${field.id}_${varName}`;
                    option.textContent = `${varName} (Login variable)`;
                    if (currentPage && currentPage.conditionalVisibility?.dependsOn === `${field.id}_${varName}`) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
            }
        });
        
        // Add page variables if they exist
        if (targetPage.variables) {
            Object.keys(targetPage.variables).forEach(varName => {
                const option = document.createElement('option');
                option.value = varName;
                option.textContent = `${varName} (page variable)`;
                if (currentPage && currentPage.conditionalVisibility?.dependsOn === varName) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
        }
    }

    needsValueInput(condition) {
        return condition && !['is_empty', 'is_not_empty'].includes(condition);
    }

    updatePageTabs() {
        // Re-render page tabs with updated names
        const pageTabs = document.getElementById('pageTabs');
        if (pageTabs && this.currentForm.pages.length > 1) {
            let tabsHtml = '';
            this.currentForm.pages.forEach((page, index) => {
                const isActive = index === this.currentPageIndex;
                const pageTitle = page.name || `Page ${index + 1}`;
                tabsHtml += `
                    <button class="page-tab ${isActive ? 'active' : ''}" 
                            data-page-id="${page.id}" 
                            data-page-index="${index}"
                            draggable="true">
                        <span class="page-tab-content">
                            ${pageTitle}
                        </span>
                        ${this.currentForm.pages.length > 1 ? 
                            `<span class="close-tab" onclick="window.AppModules.formBuilder.removePage('${page.id}')">×</span>` : 
                            ''
                        }
                    </button>
                `;
            });
            pageTabs.innerHTML = tabsHtml;
            pageTabs.style.display = 'flex';
            
            // Setup drag and drop functionality for page tabs
            this.setupPageTabDragAndDrop();
        }
    }

    setupPageTabDragAndDrop() {
        const pageTabs = document.getElementById('pageTabs');
        if (!pageTabs) return;

        // Add drag and drop event listeners to all page tabs
        const pageTabElements = pageTabs.querySelectorAll('.page-tab');
        pageTabElements.forEach(tab => {
            // Remove existing drag listeners if any
            tab.removeEventListener('dragstart', this.handlePageTabDragStart);
            tab.removeEventListener('dragover', this.handlePageTabDragOver);
            tab.removeEventListener('drop', this.handlePageTabDrop);
            tab.removeEventListener('dragend', this.handlePageTabDragEnd);
            
            // Add new listeners
            tab.addEventListener('dragstart', (e) => this.handlePageTabDragStart(e));
            tab.addEventListener('dragover', (e) => this.handlePageTabDragOver(e));
            tab.addEventListener('drop', (e) => this.handlePageTabDrop(e));
            tab.addEventListener('dragend', (e) => this.handlePageTabDragEnd(e));
        });

        // Ensure Add Page button remains visible and functional after page reordering
        const addPageBtn = pageTabs.querySelector('.add-page-btn');
        if (addPageBtn) {
            addPageBtn.style.display = 'flex';
            addPageBtn.style.visibility = 'visible';
            addPageBtn.style.opacity = '1';
            addPageBtn.style.pointerEvents = 'auto';
            addPageBtn.style.position = 'relative';
            addPageBtn.style.zIndex = '1';
        }
    }

    handlePageTabDragStart(e) {
        e.dataTransfer.setData('text/plain', e.target.dataset.pageIndex);
        e.target.classList.add('dragging');
        
        // Store the original page index
        this.draggedPageIndex = parseInt(e.target.dataset.pageIndex);
        
        debugInfo("FormBuilder", 'Started dragging page:', this.draggedPageIndex);
    }

    handlePageTabDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        // Add visual feedback
        e.target.closest('.page-tab')?.classList.add('drag-over');
    }

    handlePageTabDrop(e) {
        e.preventDefault();
        
        const targetTab = e.target.closest('.page-tab');
        if (!targetTab) return;
        
        const targetIndex = parseInt(targetTab.dataset.pageIndex);
        
        if (this.draggedPageIndex !== undefined && this.draggedPageIndex !== targetIndex) {
            this.reorderPages(this.draggedPageIndex, targetIndex);
        }
        
        // Clear visual feedback
        targetTab.classList.remove('drag-over');
        
        debugInfo("FormBuilder", 'Dropped page at index:', targetIndex);
    }

    handlePageTabDragEnd(e) {
        // Clean up drag states
        const allTabs = document.querySelectorAll('.page-tab');
        allTabs.forEach(tab => {
            tab.classList.remove('dragging', 'drag-over');
            tab.style.removeProperty('z-index');
            tab.style.removeProperty('transform');
            tab.style.removeProperty('opacity');
        });
        
        // Ensure Add Page button is still visible
        const pageTabs = document.getElementById('pageTabs');
        const addPageBtn = pageTabs?.querySelector('.add-page-btn');
        if (addPageBtn) {
            addPageBtn.style.display = 'flex';
            addPageBtn.style.visibility = 'visible';
            addPageBtn.style.opacity = '1';
            addPageBtn.style.pointerEvents = 'auto';
        }
        
        this.draggedPageIndex = undefined;
        
        debugInfo("FormBuilder", 'Drag operation completed and cleaned up');
    }

    reorderPages(fromIndex, toIndex) {
        if (fromIndex === toIndex) return;
        
        // Reorder pages in the form data
        const pages = this.currentForm.pages;
        const movedPage = pages.splice(fromIndex, 1)[0];
        pages.splice(toIndex, 0, movedPage);
        
        // Update current page index if necessary
        if (this.currentPageIndex === fromIndex) {
            this.currentPageIndex = toIndex;
        } else if (fromIndex < this.currentPageIndex && toIndex >= this.currentPageIndex) {
            this.currentPageIndex--;
        } else if (fromIndex > this.currentPageIndex && toIndex <= this.currentPageIndex) {
            this.currentPageIndex++;
        }
        
        // Update the page tabs
        this.updatePageTabs();
        
        // Re-render the current page
        this.renderFormPage();
        
        // Mark form as dirty
        this.markFormDirty();
        
        debugInfo("FormBuilder", `Reordered page from index ${fromIndex} to ${toIndex}`);
    }

    renderHiddenFields(page) {
        if (!page.hiddenFields || page.hiddenFields.length === 0) {
            return '<p class="text-muted">No hidden fields configured</p>';
        }

        return page.hiddenFields.map((field, index) => `
            <div class="hidden-field-item" style="background: var(--gray-50); padding: var(--space-4); border-radius: var(--radius-md); margin-bottom: var(--space-3); border: 1px solid var(--gray-200);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-2);">
                    <strong style="color: var(--gray-800);">${field.name}</strong>
                    <button type="button" class="button" onclick="window.AppModules.formBuilder?.removeHiddenField(${index})" 
                            style="background: var(--error); color: white; padding: var(--space-1) var(--space-2); font-size: 0.75rem;">
                        Remove
                    </button>
                </div>
                <div style="font-size: 0.875rem; color: var(--gray-600);">
                    <div><strong>Value Type:</strong> ${field.valueType}</div>
                    <div><strong>Value:</strong> ${field.value || '(empty)'}</div>
                </div>
            </div>
        `).join('');
    }

    // ========================================================================
    // RECORD ID VARIABLE OPTIONS RENDERING
    // ========================================================================

    renderRepeatRelationshipFieldOptions(selectedValue) {
        const options = ['<option value="">No relationship field (standalone records)</option>'];
        
        const currentPage = this.getCurrentPage();
        if (currentPage && currentPage.salesforceObject && window.AppState.salesforceConnected) {
            // Add a loading option that will be replaced by async loading
            options.push('<option value="_loading_" disabled>Loading relationship fields from Salesforce...</option>');
            
            // Trigger async loading of fields
            setTimeout(() => this.loadRepeatRelationshipFields(), 100);
        } else {
            options.push('<option value="" disabled>Connect to Salesforce to load relationship fields</option>');
        }
        
        // Add the currently selected value if it exists
        if (selectedValue && selectedValue !== '') {
            const isSelected = 'selected';
            options.splice(1, 0, `<option value="${selectedValue}" ${isSelected}>${selectedValue} (current)</option>`);
        }
        
        return options.join('');
    }

    async loadRepeatRelationshipFields() {
        const currentPage = this.getCurrentPage();
        const select = document.getElementById('page-repeat-relationship');
        
        if (!currentPage || !currentPage.salesforceObject || !select || !window.AppState.salesforceConnected) {
            return;
        }

        try {
            const salesforce = window.AppModules.salesforce;
            const fields = await salesforce.getObjectFields(currentPage.salesforceObject);
            
            // Filter for reference fields (relationship fields)
            const relationshipFields = fields.filter(f => f.type === 'reference');
            
            // Build options
            const options = ['<option value="">No relationship field (standalone records)</option>'];
            
            // Add current selection if it exists
            const currentValue = currentPage.repeatConfig?.relationshipField;
            if (currentValue && currentValue !== '') {
                options.push(`<option value="${currentValue}" selected>${currentValue} (current)</option>`);
            }
            
            // Add relationship fields
            relationshipFields.forEach(field => {
                if (field.name !== currentValue) { // Avoid duplicate
                    const label = field.label ? `${field.name} (${field.label})` : field.name;
                    const referenceTo = field.referenceTo ? ` → ${field.referenceTo.join(', ')}` : '';
                    options.push(`<option value="${field.name}">${label}${referenceTo}</option>`);
                }
            });

            // Add option to create custom field
            options.push('<option value="_create_custom_">+ Enter Custom Field Name</option>');
            
            select.innerHTML = options.join('');
            
            debugInfo("FormBuilder", `✅ Loaded ${relationshipFields.length} relationship fields for ${currentPage.salesforceObject}`);
            
        } catch (error) {
            debugError("FormBuilder", 'Error loading relationship fields:', error);
            select.innerHTML = `
                <option value="">No relationship field (standalone records)</option>
                <option value="" disabled>Error loading fields from Salesforce</option>
                <option value="_create_custom_">+ Enter Custom Field Name</option>
            `;
        }
    }

    renderRecordIdVariableOptions(selectedValue) {
        const options = ['<option value="">Select a variable...</option>'];
        const variableGroups = {
            lookup: [],
            login: [],
            global: [],
            suggested: []
        };
        
        // 1. Add variables from Global Variables system
        if (window.FormVariables && typeof window.FormVariables.getAll === 'function') {
            const globalVars = window.FormVariables.getAll();
            Object.keys(globalVars).forEach(varName => {
                if (varName.toLowerCase().includes('id')) {
                    variableGroups.global.push(varName);
                }
            });
        }
        
        // 2. Add variables from Lookup fields that store IDs (with context)
        this.currentForm.pages.forEach(page => {
            page.fields.forEach(field => {
                if (field.type === 'lookup' && field.storeIdVariable) {
                    variableGroups.lookup.push({
                        name: field.storeIdVariable,
                        context: `from ${field.label || 'Lookup'} (${field.salesforceObject || 'Object'})`
                    });
                }
            });
        });
        
        // 3. Add variables from Login fields
        this.currentForm.pages.forEach(page => {
            page.fields.forEach(field => {
                if (field.type === 'login' && field.loginConfig && field.loginConfig.setVariables) {
                    Object.keys(field.loginConfig.setVariables).forEach(varName => {
                        if (varName.toLowerCase().includes('id')) {
                            variableGroups.login.push({
                                name: varName,
                                context: `from ${field.label || 'Login'} field`
                            });
                        }
                    });
                }
            });
        });
        
        // 4. Add suggested patterns based on Salesforce object
        const currentPage = this.getCurrentPage();
        if (currentPage && currentPage.salesforceObject) {
            const objName = currentPage.salesforceObject.toLowerCase();
            variableGroups.suggested.push(
                `${objName}Id`,
                `${currentPage.salesforceObject}Id`,
                'recordId',
                'Id'
            );
        } else {
            variableGroups.suggested.push(
                'ContactId', 'AccountId', 'LeadId', 'OpportunityId', 'recordId', 'Id'
            );
        }
        
        // Build grouped options
        if (variableGroups.lookup.length > 0) {
            options.push('<optgroup label="📍 From Lookup Fields">');
            variableGroups.lookup.forEach(item => {
                const isSelected = item.name === selectedValue ? 'selected' : '';
                options.push(`<option value="${item.name}" ${isSelected}>${item.name} (${item.context})</option>`);
            });
            options.push('</optgroup>');
        }
        
        if (variableGroups.login.length > 0) {
            options.push('<optgroup label="🔐 From Login Fields">');
            variableGroups.login.forEach(item => {
                const isSelected = item.name === selectedValue ? 'selected' : '';
                options.push(`<option value="${item.name}" ${isSelected}>${item.name} (${item.context})</option>`);
            });
            options.push('</optgroup>');
        }
        
        if (variableGroups.global.length > 0) {
            options.push('<optgroup label="🌐 Global Variables">');
            variableGroups.global.forEach(varName => {
                const isSelected = varName === selectedValue ? 'selected' : '';
                options.push(`<option value="${varName}" ${isSelected}>${varName}</option>`);
            });
            options.push('</optgroup>');
        }
        
        if (variableGroups.suggested.length > 0) {
            options.push('<optgroup label="💡 Suggested Variables">');
            variableGroups.suggested.forEach(varName => {
                const isSelected = varName === selectedValue ? 'selected' : '';
                options.push(`<option value="${varName}" ${isSelected}>${varName}</option>`);
            });
            options.push('</optgroup>');
        }
        
        // Add option to create a new variable
        options.push('<option value="_create_new_">+ Create New Variable</option>');
        
        return options.join('');
    }
    
    // New method for lookup field Store ID Variable dropdown
    renderStoreIdVariableOptions(field) {
        const options = ['<option value="">Don\'t store record ID</option>'];
        const selectedValue = field.storeIdVariable || '';
        
        // Suggest variables based on the lookup field configuration
        const suggestions = [];
        
        if (field.salesforceObject) {
            const objName = field.salesforceObject.toLowerCase();
            suggestions.push(
                `selected${field.salesforceObject}Id`,
                `${objName}Id`,
                `${field.salesforceObject}Id`
            );
        }
        
        // Add common patterns
        suggestions.push(
            'recordId',
            'selectedRecordId',
            'ContactId',
            'AccountId',
            'LeadId'
        );
        
        // Remove duplicates and create options
        const uniqueSuggestions = [...new Set(suggestions)];
        uniqueSuggestions.forEach(suggestion => {
            const isSelected = suggestion === selectedValue ? 'selected' : '';
            options.push(`<option value="${suggestion}" ${isSelected}>${suggestion}</option>`);
        });
        
        // Add option for custom variable name
        if (selectedValue && !uniqueSuggestions.includes(selectedValue)) {
            options.push(`<option value="${selectedValue}" selected>${selectedValue}</option>`);
        }
        
        options.push('<option value="_custom_">+ Enter Custom Name</option>');
        
        return options.join('');
    }


    // ========================================================================
    // NAVIGATION BUTTON UTILITY METHODS
    // ========================================================================

    // Helper method to quickly set up "show button only after login" condition
    setupRequireLoginForButton(buttonType) {
        const currentPage = this.getCurrentPage();
        if (!currentPage) return;

        // Initialize navigationConfig if needed
        if (!currentPage.navigationConfig) {
            currentPage.navigationConfig = {
                next: { conditionalVisibility: { enabled: false, conditions: [], logic: 'AND' } },
                submit: { conditionalVisibility: { enabled: false, conditions: [], logic: 'AND' } }
            };
        }

        const config = currentPage.navigationConfig[buttonType];
        if (!config.conditionalVisibility) {
            config.conditionalVisibility = { enabled: false, conditions: [], logic: 'AND' };
        }

        // Enable conditional visibility
        config.conditionalVisibility.enabled = true;
        config.conditionalVisibility.logic = 'AND';

        // Add or update the isLoggedIn condition
        const existingCondition = config.conditionalVisibility.conditions.find(c => c.dependsOn === 'isLoggedIn');
        if (existingCondition) {
            existingCondition.condition = 'equals';
            existingCondition.value = 'true';
        } else {
            config.conditionalVisibility.conditions.push({
                dependsOn: 'isLoggedIn',
                condition: 'equals',
                value: 'true'
            });
        }

        // Refresh properties panel
        this.showPageProperties();
        this.markFormDirty();
        
        debugInfo("FormBuilder", `✅ Set up ${buttonType} button to require login on page "${currentPage.name}"`);
        alert(`${buttonType === 'next' ? 'Next' : 'Submit'} button will now only show after user login.`);
    }

    // ========================================================================
    // VARIABLES MANAGER MODAL METHODS
    // ========================================================================

    showVariablesManager() {
        const modal = document.getElementById('variablesModal');
        if (modal) {
            modal.style.display = 'block';
            this.refreshVariablesList();
            this.initializeSalesforceRecordBrowser();
        }
    }

    closeVariablesManager() {
        const modal = document.getElementById('variablesModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    refreshVariablesList() {
        const variablesList = document.getElementById('variablesList');
        if (!variablesList) return;

        const variables = window.FormVariables.getAll();
        const variableEntries = Object.entries(variables);

        if (variableEntries.length === 0) {
            variablesList.innerHTML = `
                <div class="empty-variables">
                    <p>No variables found. Variables will appear here when set by Login fields, Email Verify fields, or manually created.</p>
                </div>
            `;
            return;
        }

        variablesList.innerHTML = variableEntries.map(([name, value]) => {
            const valueType = typeof value;
            const displayValue = valueType === 'string' ? value : JSON.stringify(value);
            
            return `
                <div class="variable-item" data-variable-name="${name}">
                    <div class="variable-info">
                        <div class="variable-name">${name}</div>
                        <div class="variable-type ${valueType}">${valueType}</div>
                    </div>
                    <div class="variable-value" title="${displayValue}">
                        ${displayValue.length > 30 ? displayValue.substring(0, 30) + '...' : displayValue}
                    </div>
                    <div class="variable-actions">
                        <button class="button button-small" onclick="window.AppModules.formBuilder.editVariable('${name}')">✏️</button>
                        <button class="button button-small button-danger" onclick="window.AppModules.formBuilder.deleteVariable('${name}')">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    addVariable() {
        const nameInput = document.getElementById('newVariableName');
        const valueInput = document.getElementById('newVariableValue');
        
        if (!nameInput || !valueInput) return;

        const name = nameInput.value.trim();
        const value = valueInput.value.trim();

        if (!name) {
            alert('Variable name is required');
            return;
        }

        // Try to parse the value as JSON first, otherwise treat as string
        let parsedValue = value;
        try {
            // Check if it looks like JSON
            if (value.startsWith('{') || value.startsWith('[') || value === 'true' || value === 'false' || !isNaN(value)) {
                parsedValue = JSON.parse(value);
            }
        } catch (e) {
            // If parsing fails, use as string
            parsedValue = value;
        }

        // Set the variable
        window.FormVariables.set(name, parsedValue);

        // Clear inputs
        nameInput.value = '';
        valueInput.value = '';

        // Refresh the list
        this.refreshVariablesList();

        debugInfo("FormBuilder", `✅ Added variable: ${name} = ${JSON.stringify(parsedValue)}`);
    }

    editVariable(name) {
        const currentValue = window.FormVariables.get(name);
        const displayValue = typeof currentValue === 'string' ? currentValue : JSON.stringify(currentValue);
        
        const newValue = prompt(`Edit variable "${name}":`, displayValue);
        
        if (newValue !== null) {
            // Try to parse the new value
            let parsedValue = newValue;
            try {
                if (newValue.startsWith('{') || newValue.startsWith('[') || newValue === 'true' || newValue === 'false' || !isNaN(newValue)) {
                    parsedValue = JSON.parse(newValue);
                }
            } catch (e) {
                parsedValue = newValue;
            }

            window.FormVariables.set(name, parsedValue);
            this.refreshVariablesList();
            debugInfo("FormBuilder", `✏️ Updated variable: ${name} = ${JSON.stringify(parsedValue)}`);
        }
    }

    deleteVariable(name) {
        if (confirm(`Are you sure you want to delete the variable "${name}"?`)) {
            window.FormVariables.variables.delete(name);
            this.refreshVariablesList();
            debugInfo("FormBuilder", `🗑️ Deleted variable: ${name}`);
        }
    }

    debugConsole() {
        debugInfo("FormBuilder", '🔧 VARIABLES MANAGER DEBUG:');
        debugInfo("FormBuilder", '===========================');
        window.FormVariables.debug();
        alert('Variable data logged to console. Check Developer Tools > Console.');
    }

    exportVariables() {
        const variables = window.FormVariables.getAll();
        const json = JSON.stringify(variables, null, 2);
        
        // Create downloadable file
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `form-variables-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        debugInfo("FormBuilder", '💾 Variables exported:', variables);
        alert('Variables exported as JSON file!');
    }

    clearAllVariables() {
        if (confirm('Are you sure you want to clear ALL variables? This cannot be undone.')) {
            window.FormVariables.clear();
            this.refreshVariablesList();
            debugInfo("FormBuilder", '🗑️ All variables cleared');
            alert('All variables have been cleared.');
        }
    }

    // =============================================================================
    // QUERY FILTERS FUNCTIONALITY FOR GET ACTION TYPE
    // =============================================================================

    renderQueryFilters(filters = []) {
        if (!filters.length) {
            return '<div class="no-filters-message">No filters added yet. Click "Add Filter" to add query conditions.</div>';
        }

        return filters.map((filter, index) => `
            <div class="query-filter" data-filter-index="${index}">
                <div class="filter-header">
                    <span class="filter-number">Filter ${index + 1}</span>
                    <button type="button" class="remove-filter-btn" onclick="window.AppModules.formBuilder.removeQueryFilter(${index})" title="Remove Filter">
                        ×
                    </button>
                </div>
                <div class="filter-row-vertical">
                    <div class="filter-field">
                        <label class="filter-label">Field</label>
                        <select class="filter-field-select" onchange="window.AppModules.formBuilder.updateQueryFilter(${index}, 'field', this.value)">
                            <option value="">Select Field...</option>
                            ${this.renderFilterFieldOptions(filter.field)}
                        </select>
                    </div>
                    <div class="filter-operator">
                        <label class="filter-label">Operator</label>
                        <select class="filter-operator-select" onchange="window.AppModules.formBuilder.updateQueryFilter(${index}, 'operator', this.value)">
                            <option value="equals" ${filter.operator === 'equals' ? 'selected' : ''}>Equals</option>
                            <option value="not_equals" ${filter.operator === 'not_equals' ? 'selected' : ''}>Not Equals</option>
                            <option value="contains" ${filter.operator === 'contains' ? 'selected' : ''}>Contains</option>
                            <option value="starts_with" ${filter.operator === 'starts_with' ? 'selected' : ''}>Starts With</option>
                            <option value="greater_than" ${filter.operator === 'greater_than' ? 'selected' : ''}>Greater Than</option>
                            <option value="less_than" ${filter.operator === 'less_than' ? 'selected' : ''}>Less Than</option>
                        </select>
                    </div>
                    <div class="filter-value">
                        <label class="filter-label">Value Source</label>
                        <select class="filter-value-select" onchange="window.AppModules.formBuilder.updateQueryFilter(${index}, 'value', this.value)">
                            <option value="">Select Value Source...</option>
                            ${this.renderFilterValueOptions(filter.value)}
                        </select>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderFilterFieldOptions(selectedField) {
        const options = ['<option value="">Select Field...</option>'];
        const currentPage = this.getCurrentPage();
        
        if (currentPage && currentPage.salesforceObject) {
            // Add common Salesforce fields
            const commonFields = ['Id', 'Name', 'Email', 'Phone', 'CreatedDate', 'LastModifiedDate'];
            commonFields.forEach(field => {
                const isSelected = field === selectedField ? 'selected' : '';
                options.push(`<option value="${field}" ${isSelected}>${field}</option>`);
            });
            
            // Add object-specific fields if we have them cached
            const objectFields = this.salesforceFieldsCache?.[currentPage.salesforceObject];
            if (objectFields) {
                objectFields.forEach(field => {
                    if (!commonFields.includes(field.name)) {
                        const isSelected = field.name === selectedField ? 'selected' : '';
                        const label = field.label ? `${field.name} (${field.label})` : field.name;
                        options.push(`<option value="${field.name}" ${isSelected}>${label}</option>`);
                    }
                });
            }
        }
        
        options.push('<option value="_custom_">+ Enter Custom Field</option>');
        return options.join('');
    }

    renderFilterValueOptions(selectedValue) {
        const options = ['<option value="">Select Value Source...</option>'];
        
        // Add form field values
        options.push('<optgroup label="📝 Form Field Values">');
        this.currentForm.pages.forEach(page => {
            page.fields.forEach(field => {
                if (field.id && field.label) {
                    const isSelected = `field:${field.id}` === selectedValue ? 'selected' : '';
                    options.push(`<option value="field:${field.id}" ${isSelected}>${field.label} (${field.type})</option>`);
                }
            });
        });
        options.push('</optgroup>');
        
        // Add global variables
        if (window.FormVariables) {
            const variables = window.FormVariables.getAll();
            if (Object.keys(variables).length > 0) {
                options.push('<optgroup label="🌐 Global Variables">');
                Object.keys(variables).forEach(varName => {
                    const isSelected = `variable:${varName}` === selectedValue ? 'selected' : '';
                    options.push(`<option value="variable:${varName}" ${isSelected}>${varName}</option>`);
                });
                options.push('</optgroup>');
            }
        }
        
        // Add literal value option
        options.push('<optgroup label="💬 Literal Values">');
        options.push('<option value="_literal_">+ Enter Literal Value</option>');
        options.push('</optgroup>');
        
        return options.join('');
    }

    addQueryFilter() {
        const currentPage = this.getCurrentPage();
        if (!currentPage) return;
        
        if (!currentPage.queryFilters) {
            currentPage.queryFilters = [];
        }
        
        currentPage.queryFilters.push({
            field: '',
            operator: 'equals',
            value: ''
        });
        
        this.showPageProperties(); // Refresh to show new filter
        this.markFormDirty();
    }

    updateQueryFilter(index, property, value) {
        const currentPage = this.getCurrentPage();
        if (!currentPage || !currentPage.queryFilters || !currentPage.queryFilters[index]) return;
        
        // Handle custom field entry
        if (property === 'field' && value === '_custom_') {
            const customField = prompt('Enter custom field name:', '');
            if (customField !== null && customField.trim() !== '') {
                value = customField.trim();
            } else {
                return; // User cancelled
            }
        }
        
        // Handle literal value entry
        if (property === 'value' && value === '_literal_') {
            const literalValue = prompt('Enter literal value:', '');
            if (literalValue !== null) {
                value = `literal:${literalValue}`;
            } else {
                return; // User cancelled
            }
        }
        
        currentPage.queryFilters[index][property] = value;
        this.markFormDirty();
        
        // Refresh to update dependent dropdowns
        if (property === 'field') {
            this.showPageProperties();
        }
    }

    removeQueryFilter(index) {
        const currentPage = this.getCurrentPage();
        if (!currentPage || !currentPage.queryFilters) return;
        
        currentPage.queryFilters.splice(index, 1);
        this.showPageProperties(); // Refresh to remove filter UI
        this.markFormDirty();
    }

    renderSelectedQueryFields(fieldsStr = '') {
        if (!fieldsStr.trim()) {
            return '<div class="no-fields-selected">No fields selected</div>';
        }

        const fields = fieldsStr.split(',').map(f => f.trim()).filter(f => f);
        if (fields.length === 0) {
            return '<div class="no-fields-selected">No fields selected</div>';
        }

        return `
            <div class="selected-fields-list">
                ${fields.map(field => `
                    <span class="selected-field-tag">
                        ${field}
                        <button type="button" class="remove-field-btn" onclick="window.AppModules.formBuilder.removeQueryField('${field.replace(/'/g, "\\'")}')">×</button>
                    </span>
                `).join('')}
            </div>
        `;
    }

    async openQueryFieldsPicker() {
        const currentPage = this.getCurrentPage();
        if (!currentPage || !currentPage.salesforceObject) {
            alert('Please select a Salesforce object first');
            return;
        }

        try {
            // Show loading state
            const button = document.getElementById('query-fields-picker-btn');
            const originalText = button.textContent;
            button.textContent = '🔄 Loading fields...';
            button.disabled = true;

            // Load fields from Salesforce
            const salesforce = window.AppModules.salesforce;
            const fields = await salesforce.getObjectFields(currentPage.salesforceObject);

            // Create modal with field picker
            this.showQueryFieldsModal(fields, currentPage.queryFields || '');

        } catch (error) {
            debugError("FormBuilder", 'Error loading fields:', error);
            alert('Failed to load Salesforce fields. Please try again.');
        } finally {
            // Restore button state
            const button = document.getElementById('query-fields-picker-btn');
            if (button) {
                const fieldsCount = (currentPage.queryFields || '').split(',').filter(f => f.trim()).length;
                button.textContent = `📋 Select Fields (${fieldsCount} selected)`;
                button.disabled = false;
            }
        }
    }

    showQueryFieldsModal(fields, currentFieldsStr = '') {
        const currentFields = new Set(currentFieldsStr.split(',').map(f => f.trim()).filter(f => f));
        
        // Create modal HTML
        const modalHTML = `
            <div class="modal-overlay" id="queryFieldsModal">
                <div class="modal-content field-picker-modal">
                    <div class="modal-header">
                        <h3>Select Query Fields</h3>
                        <button type="button" class="modal-close" onclick="window.AppModules.formBuilder.closeQueryFieldsModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="field-picker-search">
                            <input type="text" id="fieldSearchInput" placeholder="Search fields..." class="form-input">
                        </div>
                        <div class="field-categories">
                            <div class="field-category">
                                <h4>🌟 Common Fields</h4>
                                <div class="fields-grid" id="commonFields">
                                    ${this.renderFieldCheckboxes(fields.filter(f => 
                                        ['Id', 'Name', 'Email', 'Phone', 'CreatedDate', 'LastModifiedDate', 'FirstName', 'LastName'].includes(f.name)
                                    ), currentFields)}
                                </div>
                            </div>
                            <div class="field-category">
                                <h4>📋 Standard Fields</h4>
                                <div class="fields-grid" id="standardFields">
                                    ${this.renderFieldCheckboxes(fields.filter(f => 
                                        !f.name.includes('__c') && !['Id', 'Name', 'Email', 'Phone', 'CreatedDate', 'LastModifiedDate', 'FirstName', 'LastName'].includes(f.name)
                                    ), currentFields)}
                                </div>
                            </div>
                            <div class="field-category">
                                <h4>🔧 Custom Fields</h4>
                                <div class="fields-grid" id="customFields">
                                    ${this.renderFieldCheckboxes(fields.filter(f => f.name.includes('__c')), currentFields)}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="button button-secondary" onclick="window.AppModules.formBuilder.closeQueryFieldsModal()">Cancel</button>
                        <button type="button" class="button button-primary" onclick="window.AppModules.formBuilder.saveSelectedQueryFields()">Save Selected Fields</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add search functionality
        const searchInput = document.getElementById('fieldSearchInput');
        searchInput.addEventListener('input', (e) => {
            this.filterFieldCheckboxes(e.target.value.toLowerCase());
        });
    }

    renderFieldCheckboxes(fields, selectedFields) {
        return fields.map(field => {
            const isSelected = selectedFields.has(field.name);
            return `
                <label class="field-checkbox-label">
                    <input type="checkbox" name="queryField" value="${field.name}" ${isSelected ? 'checked' : ''}>
                    <span class="field-name">${field.name}</span>
                    <span class="field-type">${field.type}</span>
                </label>
            `;
        }).join('');
    }

    filterFieldCheckboxes(searchTerm) {
        const labels = document.querySelectorAll('.field-checkbox-label');
        labels.forEach(label => {
            const fieldName = label.querySelector('.field-name').textContent.toLowerCase();
            const fieldType = label.querySelector('.field-type').textContent.toLowerCase();
            const matches = fieldName.includes(searchTerm) || fieldType.includes(searchTerm);
            label.style.display = matches ? 'flex' : 'none';
        });
    }

    saveSelectedQueryFields() {
        const checkboxes = document.querySelectorAll('input[name="queryField"]:checked');
        const selectedFields = Array.from(checkboxes).map(cb => cb.value);
        
        // Update the page property
        const fieldsStr = selectedFields.join(', ');
        this.updatePageProperty('queryFields', fieldsStr);
        
        // Update the hidden textarea
        const textarea = document.getElementById('page-query-fields');
        if (textarea) {
            textarea.value = fieldsStr;
        }

        // Close modal
        this.closeQueryFieldsModal();
        
        // Refresh the properties panel to show updated field count
        this.showPageProperties();
    }

    closeQueryFieldsModal() {
        const modal = document.getElementById('queryFieldsModal');
        if (modal) {
            modal.remove();
        }
    }

    removeQueryField(fieldName) {
        const currentPage = this.getCurrentPage();
        if (!currentPage) return;

        const currentFields = (currentPage.queryFields || '').split(',').map(f => f.trim()).filter(f => f);
        const updatedFields = currentFields.filter(f => f !== fieldName);
        
        const fieldsStr = updatedFields.join(', ');
        this.updatePageProperty('queryFields', fieldsStr);
        
        // Update the hidden textarea
        const textarea = document.getElementById('page-query-fields');
        if (textarea) {
            textarea.value = fieldsStr;
        }

        // Refresh the properties panel
        this.showPageProperties();
    }

    // =============================================================================
    // ORDER BY FIELD PICKER FUNCTIONALITY
    // =============================================================================

    getOrderByCount(orderByStr = '') {
        if (!orderByStr.trim()) return 0;
        return orderByStr.split(',').map(f => f.trim()).filter(f => f).length;
    }

    renderSelectedOrderBy(orderByStr = '') {
        if (!orderByStr.trim()) {
            return '<div class="no-order-selected">No ordering selected</div>';
        }

        const orderFields = orderByStr.split(',').map(f => f.trim()).filter(f => f);
        if (orderFields.length === 0) {
            return '<div class="no-order-selected">No ordering selected</div>';
        }

        return `
            <div class="selected-order-list">
                ${orderFields.map((orderField, index) => {
                    const [field, direction = 'ASC'] = orderField.split(/\s+/);
                    const isAsc = direction.toUpperCase() === 'ASC';
                    return `
                        <span class="selected-order-tag">
                            <span class="order-field">${field}</span>
                            <span class="order-direction ${isAsc ? 'asc' : 'desc'}">${isAsc ? '↑' : '↓'} ${direction.toUpperCase()}</span>
                            <button type="button" class="remove-order-btn" onclick="window.AppModules.formBuilder.removeOrderByField(${index})">×</button>
                        </span>
                    `;
                }).join('')}
            </div>
        `;
    }

    async openOrderByPicker() {
        const currentPage = this.getCurrentPage();
        if (!currentPage || !currentPage.salesforceObject) {
            alert('Please select a Salesforce object first');
            return;
        }

        try {
            // Show loading state
            const button = document.getElementById('order-by-picker-btn');
            const originalText = button.textContent;
            button.textContent = '🔄 Loading fields...';
            button.disabled = true;

            // Load fields from Salesforce
            const salesforce = window.AppModules.salesforce;
            const fields = await salesforce.getObjectFields(currentPage.salesforceObject);

            // Filter out fields that aren't suitable for ordering (like blob, textarea, etc.)
            const sortableFields = fields.filter(f => 
                !['textarea', 'base64', 'multipicklist'].includes(f.type.toLowerCase())
            );

            // Create modal with order picker
            this.showOrderByModal(sortableFields, currentPage.queryOrderBy || '');

        } catch (error) {
            debugError("FormBuilder", 'Error loading fields:', error);
            alert('Failed to load Salesforce fields. Please try again.');
        } finally {
            // Restore button state
            const button = document.getElementById('order-by-picker-btn');
            if (button) {
                const count = this.getOrderByCount(currentPage.queryOrderBy || '');
                button.textContent = `📊 Select Order (${count} fields)`;
                button.disabled = false;
            }
        }
    }

    showOrderByModal(fields, currentOrderByStr = '') {
        const currentOrders = this.parseOrderByString(currentOrderByStr);
        
        // Create modal HTML
        const modalHTML = `
            <div class="modal-overlay" id="orderByModal">
                <div class="modal-content order-by-modal">
                    <div class="modal-header">
                        <h3>Configure Field Ordering</h3>
                        <button type="button" class="modal-close" onclick="window.AppModules.formBuilder.closeOrderByModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="order-by-search">
                            <input type="text" id="orderBySearchInput" placeholder="Search fields..." class="form-input">
                        </div>
                        <div class="current-order-section">
                            <h4>📋 Current Order</h4>
                            <div class="current-order-list" id="currentOrderList">
                                ${this.renderCurrentOrderList(currentOrders)}
                            </div>
                            <div class="order-actions">
                                <button type="button" class="button button-secondary" onclick="window.AppModules.formBuilder.clearAllOrderBy()">Clear All</button>
                            </div>
                        </div>
                        <div class="available-fields-section">
                            <h4>📊 Available Fields</h4>
                            <div class="available-fields-grid" id="availableFieldsGrid">
                                ${this.renderOrderByFields(fields, currentOrders.map(o => o.field))}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="button button-secondary" onclick="window.AppModules.formBuilder.closeOrderByModal()">Cancel</button>
                        <button type="button" class="button button-primary" onclick="window.AppModules.formBuilder.saveOrderByConfiguration()">Save Order Configuration</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add search functionality
        const searchInput = document.getElementById('orderBySearchInput');
        searchInput.addEventListener('input', (e) => {
            this.filterOrderByFields(e.target.value.toLowerCase());
        });
    }

    parseOrderByString(orderByStr = '') {
        if (!orderByStr.trim()) return [];
        
        return orderByStr.split(',').map(orderClause => {
            const parts = orderClause.trim().split(/\s+/);
            return {
                field: parts[0],
                direction: (parts[1] || 'ASC').toUpperCase()
            };
        }).filter(order => order.field);
    }

    renderCurrentOrderList(currentOrders) {
        if (currentOrders.length === 0) {
            return '<div class="no-current-order">No ordering configured. Add fields from the Available Fields section.</div>';
        }

        return `
            <div class="sortable-order-list">
                ${currentOrders.map((order, index) => `
                    <div class="order-item" data-index="${index}">
                        <div class="order-item-content">
                            <span class="drag-handle">⋮⋮</span>
                            <span class="field-name">${order.field}</span>
                            <div class="direction-toggle">
                                <button type="button" 
                                        class="direction-btn ${order.direction === 'ASC' ? 'active' : ''}"
                                        onclick="window.AppModules.formBuilder.toggleOrderDirection(${index}, 'ASC')">↑ ASC</button>
                                <button type="button" 
                                        class="direction-btn ${order.direction === 'DESC' ? 'active' : ''}"
                                        onclick="window.AppModules.formBuilder.toggleOrderDirection(${index}, 'DESC')">↓ DESC</button>
                            </div>
                            <button type="button" class="remove-order-item-btn" onclick="window.AppModules.formBuilder.removeOrderByField(${index})">×</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderOrderByFields(fields, excludeFields = []) {
        const availableFields = fields.filter(f => !excludeFields.includes(f.name));
        
        return availableFields.map(field => `
            <div class="order-field-item" data-field="${field.name}">
                <span class="field-name">${field.name}</span>
                <span class="field-type">${field.type}</span>
                <div class="add-order-actions">
                    <button type="button" class="add-order-btn" onclick="window.AppModules.formBuilder.addOrderByField('${field.name}', 'ASC')">+ ASC</button>
                    <button type="button" class="add-order-btn" onclick="window.AppModules.formBuilder.addOrderByField('${field.name}', 'DESC')">+ DESC</button>
                </div>
            </div>
        `).join('');
    }

    addOrderByField(fieldName, direction) {
        // Get current orders
        const currentPage = this.getCurrentPage();
        const currentOrders = this.parseOrderByString(currentPage.queryOrderBy || '');
        
        // Check if field already exists
        if (currentOrders.some(order => order.field === fieldName)) {
            alert(`Field "${fieldName}" is already in the order list.`);
            return;
        }
        
        // Add new order
        currentOrders.push({ field: fieldName, direction });
        
        // Update UI
        this.updateOrderByInModal(currentOrders);
    }

    removeOrderByField(index) {
        const currentPage = this.getCurrentPage();
        const currentOrders = this.parseOrderByString(currentPage.queryOrderBy || '');
        
        if (index >= 0 && index < currentOrders.length) {
            currentOrders.splice(index, 1);
            this.updateOrderByInModal(currentOrders);
        }
    }

    toggleOrderDirection(index, direction) {
        const currentPage = this.getCurrentPage();
        const currentOrders = this.parseOrderByString(currentPage.queryOrderBy || '');
        
        if (index >= 0 && index < currentOrders.length) {
            currentOrders[index].direction = direction;
            this.updateOrderByInModal(currentOrders);
        }
    }

    clearAllOrderBy() {
        this.updateOrderByInModal([]);
    }

    updateOrderByInModal(orders) {
        // Update the current order list display
        const currentOrderList = document.getElementById('currentOrderList');
        if (currentOrderList) {
            currentOrderList.innerHTML = this.renderCurrentOrderList(orders);
        }
        
        // Update the available fields grid to hide/show fields
        const currentPage = this.getCurrentPage();
        const salesforce = window.AppModules.salesforce;
        
        if (currentPage && salesforce) {
            // We need the fields to re-render the available fields
            // For now, we'll just hide/show based on what's used
            const usedFields = orders.map(order => order.field);
            const fieldItems = document.querySelectorAll('.order-field-item');
            
            fieldItems.forEach(item => {
                const fieldName = item.dataset.field;
                item.style.display = usedFields.includes(fieldName) ? 'none' : 'block';
            });
        }
    }

    filterOrderByFields(searchTerm) {
        const fieldItems = document.querySelectorAll('.order-field-item');
        fieldItems.forEach(item => {
            const fieldName = item.querySelector('.field-name').textContent.toLowerCase();
            const fieldType = item.querySelector('.field-type').textContent.toLowerCase();
            const matches = fieldName.includes(searchTerm) || fieldType.includes(searchTerm);
            item.style.display = matches ? 'block' : 'none';
        });
    }

    saveOrderByConfiguration() {
        // Get current orders from the modal
        const orderItems = document.querySelectorAll('.order-item');
        const orders = [];
        
        orderItems.forEach(item => {
            const fieldName = item.querySelector('.field-name').textContent;
            const activeDirection = item.querySelector('.direction-btn.active').textContent.includes('ASC') ? 'ASC' : 'DESC';
            orders.push({ field: fieldName, direction: activeDirection });
        });
        
        // Convert to ORDER BY string
        const orderByStr = orders.map(order => `${order.field} ${order.direction}`).join(', ');
        
        // Update the page property
        this.updatePageProperty('queryOrderBy', orderByStr);
        
        // Update the hidden input
        const input = document.getElementById('page-query-order');
        if (input) {
            input.value = orderByStr;
        }

        // Close modal
        this.closeOrderByModal();
        
        // Refresh the properties panel to show updated field count
        this.showPageProperties();
    }

    closeOrderByModal() {
        const modal = document.getElementById('orderByModal');
        if (modal) {
            modal.remove();
        }
    }

    // =============================================================================
    // WHERE CLAUSE BUILDER FUNCTIONALITY
    // =============================================================================

    getWhereConditionCount(conditions = []) {
        return conditions?.length || 0;
    }

    renderWhereConditionsDisplay(conditions = []) {
        if (!conditions || conditions.length === 0) {
            return '<div class="no-where-conditions">No WHERE conditions configured</div>';
        }

        return `
            <div class="where-conditions-list">
                ${conditions.map((condition, index) => `
                    <div class="where-condition-tag">
                        <span class="condition-field">${condition.field || 'Field'}</span>
                        <span class="condition-operator">${this.getOperatorLabel(condition.operator || 'equals')}</span>
                        <span class="condition-value">${this.getValueLabel(condition.valueType, condition.value)}</span>
                        <button type="button" class="remove-condition-btn" onclick="window.AppModules.formBuilder.removeWhereCondition(${index})">×</button>
                    </div>
                `).join('')}
            </div>
        `;
    }

    getOperatorLabel(operator) {
        const operators = {
            'equals': '=',
            'not_equals': '≠',
            'contains': 'LIKE %...%',
            'starts_with': 'LIKE ...%',
            'ends_with': 'LIKE %...',
            'greater_than': '>',
            'greater_equal': '≥',
            'less_than': '<',
            'less_equal': '≤',
            'in': 'IN',
            'not_in': 'NOT IN',
            'is_null': 'IS NULL',
            'is_not_null': 'IS NOT NULL'
        };
        return operators[operator] || operator;
    }

    getValueLabel(valueType, value) {
        switch (valueType) {
            case 'literal':
                return `'${value}'`;
            case 'variable':
                return `{{${value}}}`;
            case 'field':
                return `[${value}]`;
            case 'null':
                return 'NULL';
            default:
                return value || 'Value';
        }
    }

    async openWhereBuilder() {
        const currentPage = this.getCurrentPage();
        if (!currentPage || !currentPage.salesforceObject) {
            alert('Please select a Salesforce object first');
            return;
        }

        try {
            // Show loading state
            const button = document.getElementById('where-builder-btn');
            const originalText = button.textContent;
            button.textContent = '🔄 Loading fields...';
            button.disabled = true;

            // Load fields from Salesforce
            const salesforce = window.AppModules.salesforce;
            const fields = await salesforce.getObjectFields(currentPage.salesforceObject);

            // Create modal with WHERE builder
            this.showWhereBuilderModal(fields, currentPage.queryWhereConditions || []);

        } catch (error) {
            debugError("FormBuilder", 'Error loading fields:', error);
            alert('Failed to load Salesforce fields. Please try again.');
        } finally {
            // Restore button state
            const button = document.getElementById('where-builder-btn');
            if (button) {
                const count = this.getWhereConditionCount(currentPage.queryWhereConditions || []);
                button.textContent = `🔍 Build WHERE Clause (${count} conditions)`;
                button.disabled = false;
            }
        }
    }

    showWhereBuilderModal(fields, currentConditions = []) {
        // Create modal HTML
        const modalHTML = `
            <div class="modal-overlay" id="whereBuilderModal">
                <div class="modal-content where-builder-modal">
                    <div class="modal-header">
                        <h3>Build WHERE Conditions</h3>
                        <button type="button" class="modal-close" onclick="window.AppModules.formBuilder.closeWhereBuilderModal()">×</button>
                    </div>
                    <div class="modal-body">
                        <div class="where-builder-info">
                            <p>Build conditions to filter your query results. Multiple conditions will be joined with AND.</p>
                        </div>
                        <div class="current-conditions-section">
                            <h4>📋 Current Conditions</h4>
                            <div class="current-conditions-list" id="currentConditionsList">
                                ${this.renderCurrentConditionsList(currentConditions)}
                            </div>
                            <div class="condition-actions">
                                <button type="button" class="button button-primary" onclick="window.AppModules.formBuilder.addNewWhereCondition()">➕ Add Condition</button>
                                <button type="button" class="button button-secondary" onclick="window.AppModules.formBuilder.clearAllWhereConditions()">Clear All</button>
                            </div>
                        </div>
                        <div class="where-preview-section">
                            <h4>👁️ Generated WHERE Clause</h4>
                            <div class="where-preview" id="wherePreview">
                                ${this.generateWhereClause(currentConditions)}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="button button-secondary" onclick="window.AppModules.formBuilder.closeWhereBuilderModal()">Cancel</button>
                        <button type="button" class="button button-primary" onclick="window.AppModules.formBuilder.saveWhereConditions()">Save WHERE Conditions</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Store fields data for use in dropdowns
        this.currentWhereBuilderFields = fields;
    }

    renderCurrentConditionsList(conditions) {
        if (conditions.length === 0) {
            return '<div class="no-current-conditions">No conditions configured. Click "Add Condition" to create your first WHERE condition.</div>';
        }

        return `
            <div class="where-conditions-list">
                ${conditions.map((condition, index) => `
                    <div class="where-condition-item" data-index="${index}">
                        <div class="condition-row-vertical">
                            <div class="condition-field-group">
                                <label class="condition-label">Field</label>
                                <select class="condition-field-select" onchange="window.AppModules.formBuilder.updateWhereCondition(${index}, 'field', this.value)">
                                    <option value="">Select Field...</option>
                                    ${this.renderWhereFieldOptions(condition.field)}
                                </select>
                            </div>
                            <div class="condition-operator-group">
                                <label class="condition-label">Operator</label>
                                <select class="condition-operator-select" onchange="window.AppModules.formBuilder.updateWhereCondition(${index}, 'operator', this.value)">
                                    ${this.renderWhereOperatorOptions(condition.operator)}
                                </select>
                            </div>
                            <div class="condition-value-group">
                                <label class="condition-label">Value Type</label>
                                <select class="condition-value-type-select" onchange="window.AppModules.formBuilder.updateWhereCondition(${index}, 'valueType', this.value)">
                                    <option value="literal" ${condition.valueType === 'literal' ? 'selected' : ''}>Literal Value</option>
                                    <option value="variable" ${condition.valueType === 'variable' ? 'selected' : ''}>Form Variable</option>
                                    <option value="field" ${condition.valueType === 'field' ? 'selected' : ''}>Form Field</option>
                                    <option value="null" ${condition.valueType === 'null' ? 'selected' : ''}>NULL</option>
                                </select>
                            </div>
                            <div class="condition-value-group">
                                <label class="condition-label">Value</label>
                                ${this.renderWhereValueInput(condition, index)}
                            </div>
                        </div>
                        <div class="condition-actions">
                            <button type="button" class="remove-condition-item-btn" onclick="window.AppModules.formBuilder.removeWhereCondition(${index})">×</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderWhereFieldOptions(selectedField) {
        if (!this.currentWhereBuilderFields) return '';

        return this.currentWhereBuilderFields.map(field => `
            <option value="${field.name}" ${field.name === selectedField ? 'selected' : ''}>${field.name} (${field.type})</option>
        `).join('');
    }

    renderWhereOperatorOptions(selectedOperator) {
        const operators = [
            { value: 'equals', label: 'Equals (=)' },
            { value: 'not_equals', label: 'Not Equals (≠)' },
            { value: 'contains', label: 'Contains (LIKE %...%)' },
            { value: 'starts_with', label: 'Starts With (LIKE ...%)' },
            { value: 'ends_with', label: 'Ends With (LIKE %...)' },
            { value: 'greater_than', label: 'Greater Than (>)' },
            { value: 'greater_equal', label: 'Greater Than or Equal (≥)' },
            { value: 'less_than', label: 'Less Than (<)' },
            { value: 'less_equal', label: 'Less Than or Equal (≤)' },
            { value: 'in', label: 'In (IN)' },
            { value: 'not_in', label: 'Not In (NOT IN)' },
            { value: 'is_null', label: 'Is NULL' },
            { value: 'is_not_null', label: 'Is Not NULL' }
        ];

        return operators.map(op => `
            <option value="${op.value}" ${op.value === selectedOperator ? 'selected' : ''}>${op.label}</option>
        `).join('');
    }

    renderWhereValueInput(condition, index) {
        const baseId = `where-value-${index}`;
        
        switch (condition.valueType) {
            case 'variable':
                // Get all available variables
                const variables = window.FormVariables ? Object.keys(window.FormVariables.getAll()) : [];
                return `
                    <select class="condition-value-input" id="${baseId}" onchange="window.AppModules.formBuilder.updateWhereCondition(${index}, 'value', this.value)">
                        <option value="">Select Variable...</option>
                        ${variables.map(varName => `
                            <option value="${varName}" ${varName === condition.value ? 'selected' : ''}>${varName}</option>
                        `).join('')}
                    </select>
                `;
            case 'field':
                // Get form fields from current form
                return `
                    <select class="condition-value-input" id="${baseId}" onchange="window.AppModules.formBuilder.updateWhereCondition(${index}, 'value', this.value)">
                        <option value="">Select Field...</option>
                        ${this.renderFormFieldOptions(condition.value)}
                    </select>
                `;
            case 'null':
                return '<input type="text" class="condition-value-input" value="NULL" disabled>';
            default:
                // Literal value
                return `<input type="text" class="condition-value-input" id="${baseId}" value="${condition.value || ''}" onchange="window.AppModules.formBuilder.updateWhereCondition(${index}, 'value', this.value)" placeholder="Enter value...">`;
        }
    }

    renderFormFieldOptions(selectedField) {
        // Get all form fields across all pages
        const currentForm = this.currentForm;
        if (!currentForm || !currentForm.pages) return '';

        const allFields = [];
        currentForm.pages.forEach(page => {
            if (page.fields) {
                page.fields.forEach(field => {
                    allFields.push({
                        id: field.id,
                        name: field.name || field.label || field.id,
                        type: field.type
                    });
                });
            }
        });

        return allFields.map(field => `
            <option value="${field.id}" ${field.id === selectedField ? 'selected' : ''}>${field.name} (${field.type})</option>
        `).join('');
    }

    addNewWhereCondition() {
        const currentPage = this.getCurrentPage();
        if (!currentPage.queryWhereConditions) {
            currentPage.queryWhereConditions = [];
        }

        const newCondition = {
            field: '',
            operator: 'equals',
            valueType: 'literal',
            value: ''
        };

        currentPage.queryWhereConditions.push(newCondition);
        this.updateWhereBuilderModal(currentPage.queryWhereConditions);
    }

    updateWhereCondition(index, property, value) {
        const currentPage = this.getCurrentPage();
        if (!currentPage.queryWhereConditions || index >= currentPage.queryWhereConditions.length) return;

        currentPage.queryWhereConditions[index][property] = value;

        // If changing valueType, reset the value
        if (property === 'valueType') {
            currentPage.queryWhereConditions[index].value = '';
        }

        this.updateWhereBuilderModal(currentPage.queryWhereConditions);
        this.markFormDirty();
    }

    removeWhereCondition(index) {
        const currentPage = this.getCurrentPage();
        if (!currentPage.queryWhereConditions) return;

        currentPage.queryWhereConditions.splice(index, 1);
        this.updateWhereBuilderModal(currentPage.queryWhereConditions);
        this.markFormDirty();
    }

    clearAllWhereConditions() {
        const currentPage = this.getCurrentPage();
        currentPage.queryWhereConditions = [];
        this.updateWhereBuilderModal([]);
        this.markFormDirty();
    }

    updateWhereBuilderModal(conditions) {
        // Update the conditions list
        const conditionsList = document.getElementById('currentConditionsList');
        if (conditionsList) {
            conditionsList.innerHTML = this.renderCurrentConditionsList(conditions);
        }

        // Update the WHERE preview
        const preview = document.getElementById('wherePreview');
        if (preview) {
            preview.innerHTML = this.generateWhereClause(conditions);
        }
    }

    generateWhereClause(conditions) {
        if (!conditions || conditions.length === 0) {
            return '<div class="no-where-clause">No conditions configured</div>';
        }

        const clauses = conditions.map(condition => {
            if (!condition.field || !condition.operator) return '';

            let value = '';
            switch (condition.valueType) {
                case 'literal':
                    value = condition.value ? `'${condition.value}'` : "''";
                    break;
                case 'variable':
                    value = `{{${condition.value || 'variable'}}}`;
                    break;
                case 'field':
                    value = `[${condition.value || 'field'}]`;
                    break;
                case 'null':
                    value = 'NULL';
                    break;
                default:
                    value = condition.value || '';
            }

            const operator = this.getSoqlOperator(condition.operator, condition.valueType, condition.value);
            return `${condition.field} ${operator} ${value}`;
        }).filter(clause => clause);

        const whereClause = clauses.join(' AND ');
        return `<div class="where-clause-preview">${whereClause || 'No valid conditions'}</div>`;
    }

    getSoqlOperator(operator, valueType, value) {
        switch (operator) {
            case 'equals': return '=';
            case 'not_equals': return '!=';
            case 'contains': return 'LIKE';
            case 'starts_with': return 'LIKE';
            case 'ends_with': return 'LIKE';
            case 'greater_than': return '>';
            case 'greater_equal': return '>=';
            case 'less_than': return '<';
            case 'less_equal': return '<=';
            case 'in': return 'IN';
            case 'not_in': return 'NOT IN';
            case 'is_null': return 'IS NULL';
            case 'is_not_null': return 'IS NOT NULL';
            default: return '=';
        }
    }

    saveWhereConditions() {
        const currentPage = this.getCurrentPage();
        const conditions = currentPage.queryWhereConditions || [];
        
        // Generate the SOQL WHERE clause from conditions
        const whereClause = this.generateSoqlWhereClause(conditions);
        
        // Update the page property
        this.updatePageProperty('queryWhere', whereClause);
        
        // Update the hidden textarea
        const textarea = document.getElementById('page-query-where');
        if (textarea) {
            textarea.value = whereClause;
        }

        // Close modal
        this.closeWhereBuilderModal();
        
        // Refresh the properties panel
        this.showPageProperties();
    }

    generateSoqlWhereClause(conditions) {
        if (!conditions || conditions.length === 0) return '';

        const clauses = conditions.map(condition => {
            if (!condition.field || !condition.operator) return '';

            let value = '';
            let operator = condition.operator;

            switch (condition.valueType) {
                case 'literal':
                    value = condition.value || '';
                    // Handle LIKE operators
                    if (operator === 'contains') {
                        value = `'%${value}%'`;
                        operator = 'LIKE';
                    } else if (operator === 'starts_with') {
                        value = `'${value}%'`;
                        operator = 'LIKE';
                    } else if (operator === 'ends_with') {
                        value = `'%${value}'`;
                        operator = 'LIKE';
                    } else if (operator === 'equals') {
                        value = `'${value}'`;
                        operator = '=';
                    } else if (operator === 'not_equals') {
                        value = `'${value}'`;
                        operator = '!=';
                    } else {
                        value = `'${value}'`;
                        operator = this.getSoqlOperator(operator);
                    }
                    break;
                case 'variable':
                    // Variables will be replaced at runtime
                    value = `{{${condition.value}}}`;
                    operator = this.getSoqlOperator(operator);
                    break;
                case 'field':
                    // Field references will be replaced at runtime
                    value = `[${condition.value}]`;
                    operator = this.getSoqlOperator(operator);
                    break;
                case 'null':
                    value = 'NULL';
                    operator = condition.operator === 'is_null' ? 'IS' : 'IS NOT';
                    break;
            }

            return `${condition.field} ${operator} ${value}`;
        }).filter(clause => clause);

        return clauses.join(' AND ');
    }

    closeWhereBuilderModal() {
        const modal = document.getElementById('whereBuilderModal');
        if (modal) {
            modal.remove();
        }
        this.currentWhereBuilderFields = null;
    }

    // =============================================================================
    // SALESFORCE RECORD BROWSER FOR VARIABLES MANAGER
    // =============================================================================

    initializeSalesforceRecordBrowser() {
        debugInfo("FormBuilder", '🔍 Initializing Salesforce Record Browser...');
        
        // Check connection status
        this.updateSalesforceRecordBrowserStatus();
        
        // Load objects if connected
        if (window.AppState.salesforceConnected) {
            this.loadSalesforceObjectsForBrowser();
        }
    }

    updateSalesforceRecordBrowserStatus() {
        const statusDiv = document.getElementById('sfBrowserConnectionStatus');
        const interfaceDiv = document.getElementById('sfBrowserInterface');
        
        if (!statusDiv || !interfaceDiv) return;

        if (window.AppState.salesforceConnected) {
            statusDiv.innerHTML = `
                <div class="connection-check connected">
                    <span class="status-icon">✅</span>
                    <span class="status-text">Connected to Salesforce - Ready to browse records</span>
                </div>
            `;
            statusDiv.style.display = 'block';
            interfaceDiv.style.display = 'block';
        } else {
            statusDiv.innerHTML = `
                <div class="connection-check disconnected">
                    <span class="status-icon">⚠️</span>
                    <span class="status-text">Connect to Salesforce to browse records</span>
                </div>
            `;
            statusDiv.style.display = 'block';
            interfaceDiv.style.display = 'none';
        }
    }

    async loadSalesforceObjectsForBrowser() {
        const selector = document.getElementById('sfObjectSelector');
        if (!selector || !window.AppState.salesforceConnected) return;

        try {
            const salesforce = window.AppModules.salesforce;
            const objects = await salesforce.getObjects();
            
            selector.innerHTML = '<option value="">Select Object...</option>';
            
            // Add common objects first
            const commonObjects = ['Account', 'Contact', 'Lead', 'Opportunity', 'Case'];
            const otherObjects = [];
            
            objects.forEach(obj => {
                if (commonObjects.includes(obj.name)) {
                    const index = commonObjects.indexOf(obj.name);
                    commonObjects[index] = obj; // Replace string with object
                } else {
                    otherObjects.push(obj);
                }
            });

            // Add common objects (in order)
            commonObjects.forEach(obj => {
                if (typeof obj === 'object') {
                    selector.appendChild(this.createObjectOption(obj, true));
                }
            });

            // Add separator
            if (commonObjects.length > 0 && otherObjects.length > 0) {
                const separator = document.createElement('option');
                separator.disabled = true;
                separator.textContent = '──────────';
                selector.appendChild(separator);
            }

            // Add other objects
            otherObjects.forEach(obj => {
                selector.appendChild(this.createObjectOption(obj, false));
            });

            debugInfo("FormBuilder", `✅ Loaded ${objects.length} Salesforce objects for browser`);
            
        } catch (error) {
            debugError("FormBuilder", '❌ Error loading Salesforce objects for browser:', error);
            selector.innerHTML = '<option value="" disabled>Error loading objects</option>';
        }
    }

    createObjectOption(obj, isCommon) {
        const option = document.createElement('option');
        option.value = obj.name;
        const prefix = isCommon ? '⭐' : '📦';
        option.textContent = `${prefix} ${obj.label} (${obj.name})`;
        return option;
    }

    async loadObjectFieldsForBrowser() {
        const selector = document.getElementById('sfObjectSelector');
        const fieldRow = document.getElementById('sfFieldSelectionRow');
        const searchRow = document.getElementById('sfSearchRow');
        const checkboxContainer = document.getElementById('sfFieldCheckboxes');
        
        if (!selector || !fieldRow || !searchRow || !checkboxContainer) return;

        const selectedObject = selector.value;
        
        // Hide subsequent sections if no object selected
        if (!selectedObject) {
            fieldRow.style.display = 'none';
            searchRow.style.display = 'none';
            this.clearSalesforceSearchResults();
            return;
        }

        try {
            fieldRow.style.display = 'block';
            checkboxContainer.innerHTML = '<div class="loading-fields">Loading fields...</div>';

            const salesforce = window.AppModules.salesforce;
            const fields = await salesforce.getObjectFields(selectedObject);
            
            // Filter for commonly useful fields
            const importantFields = fields.filter(field => 
                !field.name.includes('__c') || // Include custom fields
                ['Id', 'Name', 'Email', 'Phone', 'FirstName', 'LastName', 'Title', 
                 'AccountName', 'CompanyName', 'Industry', 'Rating', 'Type', 
                 'Status', 'CreatedDate', 'LastModifiedDate'].includes(field.name)
            ).slice(0, 20); // Limit to 20 fields

            // Render field checkboxes
            checkboxContainer.innerHTML = importantFields.map(field => `
                <div class="field-checkbox-item">
                    <label class="field-checkbox-label">
                        <input type="checkbox" class="field-checkbox" value="${field.name}" 
                               ${['Id', 'Name', 'Email'].includes(field.name) ? 'checked' : ''}>
                        <span class="field-name">${field.name}</span>
                        <span class="field-label">${field.label}</span>
                        <span class="field-type">${field.type}</span>
                    </label>
                </div>
            `).join('');

            // Show search row
            searchRow.style.display = 'block';
            
            debugInfo("FormBuilder", `✅ Loaded ${importantFields.length} fields for ${selectedObject}`);
            
        } catch (error) {
            debugError("FormBuilder", '❌ Error loading object fields:', error);
            checkboxContainer.innerHTML = '<div class="error-message">Error loading fields. Please try again.</div>';
        }
    }

    async searchSalesforceRecords() {
        const objectSelector = document.getElementById('sfObjectSelector');
        const searchInput = document.getElementById('sfRecordSearch');
        const loadingDiv = document.getElementById('sfSearchLoading');
        
        if (!objectSelector || !searchInput || !loadingDiv) return;

        const selectedObject = objectSelector.value;
        if (!selectedObject) {
            alert('Please select a Salesforce object first.');
            return;
        }

        // Get selected fields
        const selectedFields = this.getSelectedSalesforceFields();
        if (selectedFields.length === 0) {
            alert('Please select at least one field to import.');
            return;
        }

        const searchTerm = searchInput.value.trim();
        
        try {
            this.showSalesforceSearchLoading(true);
            this.clearSalesforceSearchResults();

            const salesforce = window.AppModules.salesforce;
            let records;

            if (searchTerm) {
                // Search with term
                records = await salesforce.searchRecords(selectedObject, searchTerm, selectedFields, 50);
            } else {
                // Browse all records (limited)
                const soql = `SELECT ${selectedFields.join(', ')} FROM ${selectedObject} ORDER BY Name LIMIT 50`;
                const result = await salesforce.query(soql);
                records = result.records || [];
            }

            this.displaySalesforceSearchResults(records, selectedFields, searchTerm);
            
        } catch (error) {
            debugError("FormBuilder", '❌ Error searching Salesforce records:', error);
            this.showSalesforceError('Failed to search records. Please check your connection and try again.');
        } finally {
            this.showSalesforceSearchLoading(false);
        }
    }

    getSelectedSalesforceFields() {
        const checkboxes = document.querySelectorAll('#sfFieldCheckboxes .field-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    showSalesforceSearchLoading(show) {
        const loadingDiv = document.getElementById('sfSearchLoading');
        const resultsContainer = document.getElementById('sfResultsContainer');
        const emptyState = document.getElementById('sfEmptyState');
        
        if (loadingDiv) loadingDiv.style.display = show ? 'block' : 'none';
        if (resultsContainer) resultsContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
    }

    displaySalesforceSearchResults(records, selectedFields, searchTerm) {
        const resultsContainer = document.getElementById('sfResultsContainer');
        const resultsTable = document.getElementById('sfResultsTable');
        const resultsTitle = document.getElementById('sfResultsTitle');
        const emptyState = document.getElementById('sfEmptyState');
        
        if (!resultsContainer || !resultsTable || !resultsTitle || !emptyState) return;

        if (records.length === 0) {
            resultsContainer.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        // Update title
        const searchText = searchTerm ? `"${searchTerm}"` : 'all records';
        resultsTitle.textContent = `Found ${records.length} records for ${searchText}`;

        // Build table
        const headerRow = selectedFields.map(field => `<th>${field}</th>`).join('');
        const tableHeaders = `
            <thead>
                <tr>
                    <th width="40"><input type="checkbox" id="selectAllRecords" onchange="window.AppModules.formBuilder.toggleAllRecordSelection()"></th>
                    ${headerRow}
                </tr>
            </thead>
        `;

        const tableRows = records.map((record, index) => {
            const cells = selectedFields.map(field => {
                const value = record[field] || '';
                return `<td title="${this.escapeHtml(String(value))}">${this.truncateText(String(value), 40)}</td>`;
            }).join('');
            
            return `
                <tr data-record-index="${index}">
                    <td><input type="checkbox" class="record-checkbox" data-record='${JSON.stringify(record).replace(/'/g, "&apos;")}'></td>
                    ${cells}
                </tr>
            `;
        }).join('');

        resultsTable.innerHTML = `${tableHeaders}<tbody>${tableRows}</tbody>`;

        // Show results and set up event listeners
        resultsContainer.style.display = 'block';
        emptyState.style.display = 'none';
        
        this.setupRecordSelectionListeners();
        this.updateSelectionInfo();
    }

    setupRecordSelectionListeners() {
        const checkboxes = document.querySelectorAll('.record-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => this.updateSelectionInfo());
        });
    }

    updateSelectionInfo() {
        const selectedCheckboxes = document.querySelectorAll('.record-checkbox:checked');
        const countSpan = document.getElementById('sfSelectedCount');
        const importButton = document.getElementById('sfImportButton');
        
        if (countSpan) countSpan.textContent = selectedCheckboxes.length;
        if (importButton) {
            importButton.disabled = selectedCheckboxes.length === 0;
            importButton.textContent = selectedCheckboxes.length > 0 
                ? `📥 Import ${selectedCheckboxes.length} Record${selectedCheckboxes.length > 1 ? 's' : ''} as Variables`
                : '📥 Import Selected Variables';
        }
    }

    toggleAllRecordSelection() {
        const selectAllCheckbox = document.getElementById('selectAllRecords');
        const recordCheckboxes = document.querySelectorAll('.record-checkbox');
        
        recordCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });
        
        this.updateSelectionInfo();
    }

    selectAllSalesforceRecords() {
        const recordCheckboxes = document.querySelectorAll('.record-checkbox');
        const selectAllCheckbox = document.getElementById('selectAllRecords');
        
        recordCheckboxes.forEach(checkbox => {
            checkbox.checked = true;
        });
        
        if (selectAllCheckbox) selectAllCheckbox.checked = true;
        this.updateSelectionInfo();
    }

    clearSalesforceSelection() {
        const recordCheckboxes = document.querySelectorAll('.record-checkbox');
        const selectAllCheckbox = document.getElementById('selectAllRecords');
        
        recordCheckboxes.forEach(checkbox => {
            checkbox.checked = false;
        });
        
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        this.updateSelectionInfo();
    }

    async importSelectedRecords() {
        const selectedCheckboxes = document.querySelectorAll('.record-checkbox:checked');
        const objectSelector = document.getElementById('sfObjectSelector');
        
        if (selectedCheckboxes.length === 0) {
            alert('Please select at least one record to import.');
            return;
        }

        const selectedObject = objectSelector?.value;
        if (!selectedObject) {
            alert('No object selected.');
            return;
        }

        try {
            const importButton = document.getElementById('sfImportButton');
            if (importButton) {
                importButton.disabled = true;
                importButton.innerHTML = '⏳ Importing...';
            }

            const variablesToSet = {};
            let totalVariables = 0;

            selectedCheckboxes.forEach((checkbox, recordIndex) => {
                const recordData = JSON.parse(checkbox.dataset.record.replace(/&apos;/g, "'"));
                
                Object.keys(recordData).forEach(fieldName => {
                    if (fieldName === 'attributes') return; // Skip Salesforce metadata
                    
                    const value = recordData[fieldName];
                    if (value !== null && value !== undefined && value !== '') {
                        const variableName = selectedCheckboxes.length > 1 
                            ? `${selectedObject}_${recordIndex + 1}_${fieldName}`
                            : `${selectedObject}_${fieldName}`;
                        
                        variablesToSet[variableName] = String(value);
                        totalVariables++;
                    }
                });
            });

            // Import variables using batched setting
            if (window.FormVariables.setMultiple) {
                window.FormVariables.setMultiple(variablesToSet);
            } else {
                Object.entries(variablesToSet).forEach(([name, value]) => {
                    window.FormVariables.set(name, value);
                });
            }

            // Refresh variables list
            this.refreshVariablesList();
            
            // Show success message
            const message = `Successfully imported ${totalVariables} variables from ${selectedCheckboxes.length} record${selectedCheckboxes.length > 1 ? 's' : ''}!`;
            alert(message);
            debugInfo("FormBuilder", '✅ Salesforce records imported:', { totalVariables, records: selectedCheckboxes.length });

            // Clear selection
            this.clearSalesforceSelection();
            
        } catch (error) {
            debugError("FormBuilder", '❌ Error importing Salesforce records:', error);
            alert('Failed to import records. Please try again.');
        } finally {
            const importButton = document.getElementById('sfImportButton');
            if (importButton) {
                importButton.disabled = false;
                importButton.innerHTML = '📥 Import Selected Variables';
            }
        }
    }

    clearSalesforceSearchResults() {
        const resultsContainer = document.getElementById('sfResultsContainer');
        const emptyState = document.getElementById('sfEmptyState');
        
        if (resultsContainer) resultsContainer.style.display = 'none';
        if (emptyState) emptyState.style.display = 'none';
    }

    showSalesforceError(message) {
        const emptyState = document.getElementById('sfEmptyState');
        if (emptyState) {
            emptyState.innerHTML = `
                <div class="empty-icon">❌</div>
                <h4>Error</h4>
                <p>${message}</p>
            `;
            emptyState.style.display = 'block';
        }
    }

    truncateText(text, maxLength) {
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength - 3) + '...';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    renderVariableOptions(selectedVariable = '') {
        const variables = window.GlobalVariables?.getAllVariables() || {};
        return Object.keys(variables).map(variableName => {
            const selected = variableName === selectedVariable ? 'selected' : '';
            return `<option value="${variableName}" ${selected}>${variableName}</option>`;
        }).join('');
    }

    renderPageOptions(selectedPageId = '') {
        const pages = this.currentForm?.pages || [];
        return pages.map(page => {
            const selected = page.id === selectedPageId ? 'selected' : '';
            return `<option value="${page.id}" ${selected}>${page.name || 'Unnamed Page'}</option>`;
        }).join('');
    }

    // DataTable Configuration Methods
    updateDataTableConfig(property, value) {
        const field = this.selectedField;
        if (!field || field.type !== 'datatable') return;
        
        if (!field.dataTableConfig) field.dataTableConfig = {};
        field.dataTableConfig[property] = value;
        
        // Show/hide relevant sections based on data source
        if (property === 'dataSource') {
            const variableConfig = document.getElementById('variable-source-config');
            const queryConfig = document.getElementById('query-source-config');
            
            if (variableConfig) {
                variableConfig.style.display = value === 'variable' ? 'block' : 'none';
            }
            if (queryConfig) {
                queryConfig.style.display = value === 'query' ? 'block' : 'none';
            }
        }
        
        // Show/hide pagination config based on showPagination
        if (property === 'showPagination') {
            const paginationConfig = document.getElementById('pagination-config');
            if (paginationConfig) {
                paginationConfig.style.display = value ? 'block' : 'none';
            }
        }
        
        // Refresh properties UI when sourcePageId changes to show field selection
        if (property === 'sourcePageId') {
            setTimeout(() => {
                this.showFieldProperties();
                this.loadAvailableFieldsForPage(value);
            }, 100);
        }
        
        this.renderFormCanvas();
        this.markFormDirty();
        debugInfo("FormBuilder", `Updated DataTable config ${property}:`, value);
    }

    renderDataTableColumns(columns) {
        if (!columns || columns.length === 0) {
            return '<p class="no-columns">No columns configured. Add columns to display data.</p>';
        }
        
        let html = '';
        columns.forEach((column, index) => {
            html += `
                <div class="datatable-column-config" data-column-index="${index}">
                    <div class="column-header">
                        <h5>Column ${index + 1}: ${column.label || column.field}</h5>
                        <button type="button" class="button button-small button-danger" 
                                onclick="window.AppModules.formBuilder.removeDataTableColumn(${index})" 
                                title="Remove Column">🗑️</button>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Field Name</label>
                            <input type="text" value="${column.field || ''}" 
                                   onchange="window.AppModules.formBuilder.updateDataTableColumn(${index}, 'field', this.value)"
                                   placeholder="fieldName">
                        </div>
                        <div class="form-group">
                            <label>Display Label</label>
                            <input type="text" value="${column.label || ''}" 
                                   onchange="window.AppModules.formBuilder.updateDataTableColumn(${index}, 'label', this.value)"
                                   placeholder="Display Name">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>Column Type</label>
                            <select onchange="window.AppModules.formBuilder.updateDataTableColumn(${index}, 'type', this.value)">
                                <option value="text" ${column.type === 'text' ? 'selected' : ''}>Text</option>
                                <option value="number" ${column.type === 'number' ? 'selected' : ''}>Number</option>
                                <option value="date" ${column.type === 'date' ? 'selected' : ''}>Date</option>
                                <option value="checkbox" ${column.type === 'checkbox' ? 'selected' : ''}>Checkbox</option>
                                <option value="select" ${column.type === 'select' ? 'selected' : ''}>Dropdown</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Default Value</label>
                            <input type="text" value="${column.defaultValue || ''}" 
                                   onchange="window.AppModules.formBuilder.updateDataTableColumn(${index}, 'defaultValue', this.value)"
                                   placeholder="Default value">
                        </div>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label>
                                <input type="checkbox" ${column.editable ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateDataTableColumn(${index}, 'editable', this.checked)">
                                Editable
                            </label>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" ${column.sortable ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateDataTableColumn(${index}, 'sortable', this.checked)">
                                Sortable
                            </label>
                        </div>
                    </div>
                    
                    ${column.type === 'select' ? `
                    <div class="form-group">
                        <label>Dropdown Options (one per line)</label>
                        <textarea onchange="window.AppModules.formBuilder.updateDataTableColumnOptions(${index}, this.value)"
                                  rows="3" placeholder="Option 1\nOption 2\nOption 3">${(column.options || []).join('\n')}</textarea>
                    </div>
                    ` : ''}
                </div>
            `;
        });
        
        return html;
    }

    renderQueryPagesDropdown(selectedPageId) {
        const form = this.currentForm;
        if (!form || !form.pages) return '';
        
        let html = '';
        form.pages.forEach(page => {
            if (page.actionType === 'get') {
                const selected = selectedPageId === page.id ? 'selected' : '';
                html += `<option value="${page.id}" ${selected}>${page.title || `Page ${page.id}`} (${page.salesforceObject || 'No Object'})</option>`;
            }
        });
        
        return html;
    }

    addDataTableColumn() {
        const field = this.selectedField;
        if (!field || field.type !== 'datatable') return;
        
        if (!field.dataTableConfig) field.dataTableConfig = {};
        if (!field.dataTableConfig.columns) field.dataTableConfig.columns = [];
        
        const newColumn = {
            field: `column${field.dataTableConfig.columns.length + 1}`,
            label: `Column ${field.dataTableConfig.columns.length + 1}`,
            type: 'text',
            editable: true,
            sortable: false,
            defaultValue: ''
        };
        
        field.dataTableConfig.columns.push(newColumn);
        
        // Re-render properties
        this.showFieldProperties();
        this.renderFormCanvas();
        this.markFormDirty();
        debugInfo("FormBuilder", 'Added new DataTable column:', newColumn);
    }

    removeDataTableColumn(columnIndex) {
        const field = this.selectedField;
        if (!field || field.type !== 'datatable' || !field.dataTableConfig?.columns) return;
        
        if (confirm('Are you sure you want to remove this column?')) {
            field.dataTableConfig.columns.splice(columnIndex, 1);
            
            // Re-render properties
            this.showFieldProperties();
            this.renderFormCanvas();
            this.markFormDirty();
            debugInfo("FormBuilder", 'Removed DataTable column at index:', columnIndex);
        }
    }

    updateDataTableColumn(columnIndex, property, value) {
        const field = this.selectedField;
        if (!field || field.type !== 'datatable' || !field.dataTableConfig?.columns) return;
        
        const column = field.dataTableConfig.columns[columnIndex];
        if (!column) return;
        
        column[property] = value;
        
        // Re-render properties if field name changed (affects label)
        if (property === 'field' || property === 'type') {
            this.showFieldProperties();
        }
        
        this.renderFormCanvas();
        this.markFormDirty();
        debugInfo("FormBuilder", `Updated DataTable column ${columnIndex} ${property}:`, value);
    }

    updateDataTableColumnOptions(columnIndex, optionsText) {
        const field = this.selectedField;
        if (!field || field.type !== 'datatable' || !field.dataTableConfig?.columns) return;
        
        const column = field.dataTableConfig.columns[columnIndex];
        if (!column) return;
        
        // Parse options from textarea (one per line)
        const options = optionsText.split('\n').filter(option => option.trim() !== '').map(option => option.trim());
        column.options = options;
        
        this.renderFormCanvas();
        this.markFormDirty();
        debugInfo("FormBuilder", `Updated DataTable column ${columnIndex} options:`, options);
    }

    renderAvailableFields(sourcePageId) {
        const form = this.currentForm;
        if (!form || !form.pages) return '<p class="no-fields">No pages found.</p>';
        
        const sourcePage = form.pages.find(page => page.id === sourcePageId);
        if (!sourcePage) return '<p class="no-fields">Selected page not found.</p>';
        
        // Parse fields from the query configuration
        const queryFields = sourcePage.queryFields;
        if (!queryFields) {
            return '<p class="no-fields">No fields configured in the Get Records query. Configure the query fields first.</p>';
        }
        
        // Split fields by comma and clean them up
        const fields = queryFields.split(',').map(field => field.trim()).filter(field => field);
        
        if (fields.length === 0) {
            return '<p class="no-fields">No fields found in query configuration.</p>';
        }
        
        // Generate field checkboxes
        let html = '';
        fields.forEach((field, index) => {
            // Handle dot notation fields (e.g., Account.Name)
            const displayName = field.includes('.') ? field : this.formatFieldName(field);
            const fieldId = `field_${sourcePageId}_${index}`;
            
            html += `
                <div class="field-selection-item">
                    <input type="checkbox" id="${fieldId}" value="${field}" 
                           onchange="window.AppModules.formBuilder.toggleFieldSelection(this)">
                    <label for="${fieldId}">${displayName}</label>
                </div>
            `;
        });
        
        return html;
    }

    formatFieldName(fieldName) {
        // Convert camelCase and underscores to readable format
        return fieldName
            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
            .replace(/_/g, ' ') // Replace underscores with spaces
            .trim()
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    toggleFieldSelection(checkbox) {
        // Visual feedback - could add logic here if needed
        const item = checkbox.closest('.field-selection-item');
        if (item) {
            item.style.background = checkbox.checked ? 'var(--make-purple-light)' : '';
        }
    }

    selectAllFields() {
        const checkboxes = document.querySelectorAll('#available-fields-list input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = true;
            this.toggleFieldSelection(checkbox);
        });
    }

    createColumnsFromSelectedFields() {
        const field = this.selectedField;
        if (!field || field.type !== 'datatable') return;
        
        const checkboxes = document.querySelectorAll('#available-fields-list input[type="checkbox"]:checked');
        if (checkboxes.length === 0) {
            alert('Please select at least one field to create columns.');
            return;
        }
        
        // Clear existing columns or confirm replacement
        if (field.dataTableConfig.columns && field.dataTableConfig.columns.length > 0) {
            if (!confirm('This will replace existing columns. Are you sure?')) {
                return;
            }
        }
        
        // Create new columns based on selected fields
        const newColumns = [];
        checkboxes.forEach(checkbox => {
            const fieldName = checkbox.value;
            const displayName = checkbox.nextElementSibling.textContent;
            
            // Determine column type based on field name patterns
            let columnType = 'text'; // default
            const lowerFieldName = fieldName.toLowerCase();
            
            if (lowerFieldName.includes('date') || lowerFieldName.includes('created') || lowerFieldName.includes('modified')) {
                columnType = 'date';
            } else if (lowerFieldName.includes('amount') || lowerFieldName.includes('price') || lowerFieldName.includes('number')) {
                columnType = 'number';
            } else if (lowerFieldName.includes('active') || lowerFieldName.includes('enabled') || lowerFieldName.includes('deleted')) {
                columnType = 'checkbox';
            }
            
            newColumns.push({
                field: fieldName,
                label: displayName,
                type: columnType,
                editable: false, // Query results are typically read-only
                sortable: true,
                defaultValue: ''
            });
        });
        
        // Update the field configuration
        if (!field.dataTableConfig) field.dataTableConfig = {};
        field.dataTableConfig.columns = newColumns;
        
        // Re-render properties and canvas
        this.showFieldProperties();
        this.renderFormCanvas();
        this.markFormDirty();
        
        debugInfo("FormBuilder", `Created ${newColumns.length} columns from selected fields:`, newColumns.map(col => col.field));
        
        // Show success message
        const info = document.querySelector('.field-selection-info');
        if (info) {
            const originalText = info.textContent;
            info.textContent = `✅ Created ${newColumns.length} columns successfully!`;
            info.style.color = 'var(--make-purple-600)';
            
            setTimeout(() => {
                info.textContent = originalText;
                info.style.color = '';
            }, 3000);
        }
    }

    updateFieldStyling(property, value) {
        try {
            const field = this.selectedField;
            if (!field) {
                debugWarn("FormBuilder", '⚠️ No field selected for styling update');
                return;
            }
            
            if (!field.styling) field.styling = {};
            field.styling[property] = value;
            
            debugInfo("FormBuilder", `🎨 Updated field styling: ${property} =`, value, `for field:`, field.id);
            
            // If width changed to custom, refresh properties to show custom width input
            if (property === 'width' && value === 'custom') {
                setTimeout(() => this.showFieldProperties(), 100);
            }
            
            this.renderFormCanvas();
            this.markFormDirty();
        } catch (error) {
            debugError("FormBuilder", '❌ Error updating field styling:', error, { property, value });
        }
    }

    applyFormThemePreset(preset) {
        if (!this.currentForm.settings) {
            this.currentForm.settings = {};
        }
        
        const themes = {
            modern: {
                primaryColor: '#8b5cf6',
                backgroundColor: '#ffffff',
                textColor: '#111827',
                fontFamily: 'Inter',
                fontSize: '16px',
                maxWidth: '800px',
                padding: '2rem',
                roundedCorners: true,
                showShadows: true
            },
            corporate: {
                primaryColor: '#1e40af',
                backgroundColor: '#f9fafb',
                textColor: '#1f2937',
                fontFamily: 'Arial',
                fontSize: '16px',
                maxWidth: '900px',
                padding: '2.5rem',
                roundedCorners: false,
                showShadows: false
            },
            playful: {
                primaryColor: '#ec4899',
                backgroundColor: '#fef3c7',
                textColor: '#7c2d12',
                fontFamily: 'Georgia',
                fontSize: '18px',
                maxWidth: '700px',
                padding: '3rem',
                roundedCorners: true,
                showShadows: true
            },
            minimal: {
                primaryColor: '#000000',
                backgroundColor: '#ffffff',
                textColor: '#000000',
                fontFamily: 'Helvetica',
                fontSize: '14px',
                maxWidth: '600px',
                padding: '1.5rem',
                roundedCorners: false,
                showShadows: false
            },
            dark: {
                primaryColor: '#a78bfa',
                backgroundColor: '#1f2937',
                textColor: '#f3f4f6',
                fontFamily: 'Inter',
                fontSize: '16px',
                maxWidth: '800px',
                padding: '2rem',
                roundedCorners: true,
                showShadows: true,
                theme: 'dark'
            }
        };
        
        if (preset && themes[preset]) {
            Object.assign(this.currentForm.settings, themes[preset]);
            this.showFormProperties(); // Refresh to show updated values
            this.markFormDirty();
        }
    }

    applyFieldStylePreset(preset) {
        const field = this.selectedField;
        if (!field) return;
        
        if (!field.styling) field.styling = {};
        field.styling.preset = preset;
        
        // Apply preset styles
        const presets = {
            modern: {
                borderRadius: '8px',
                borderWidth: '2px',
                borderColor: '#e5e7eb',
                padding: '12px 16px',
                fontSize: '16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            },
            minimal: {
                borderRadius: '0',
                borderWidth: '0 0 1px 0',
                borderColor: '#e5e7eb',
                padding: '8px 0',
                fontSize: '14px',
                boxShadow: 'none'
            },
            rounded: {
                borderRadius: '24px',
                borderWidth: '1px',
                borderColor: '#e5e7eb',
                padding: '12px 20px',
                fontSize: '14px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            },
            material: {
                borderRadius: '4px',
                borderWidth: '1px',
                borderColor: '#e0e0e0',
                padding: '16px 12px 8px',
                fontSize: '16px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            },
            bold: {
                borderRadius: '4px',
                borderWidth: '3px',
                borderColor: '#374151',
                padding: '14px 18px',
                fontSize: '16px',
                fontWeight: '600',
                boxShadow: 'none'
            }
        };
        
        if (preset && presets[preset]) {
            Object.assign(field.styling, presets[preset]);
            this.showFieldProperties(); // Refresh to show updated values
        }
        
        this.renderFormCanvas();
        this.markFormDirty();
    }

    // ==========================================================================
    // FIELD-LEVEL CUSTOM STYLES FUNCTIONALITY
    // ==========================================================================

    resetFieldStyles() {
        const field = this.selectedField;
        if (!field) return;

        debugInfo("FormBuilder", '🔄 Resetting field styles to default');

        // Reset field styling to defaults
        field.styling = {};

        // Refresh properties panel and canvas
        this.showFieldProperties();
        this.renderFormCanvas();
        this.markFormDirty();
        debugInfo("FormBuilder", '✅ Field styles reset to default');
    }

    formatFieldCSS() {
        const cssEditor = document.getElementById('prop-customCSS');
        if (!cssEditor) return;

        try {
            // Basic CSS formatting
            let css = cssEditor.value;
            css = css.replace(/;\s*}/g, ';\n}');
            css = css.replace(/{/g, ' {\n    ');
            css = css.replace(/;(?!\s*})/g, ';\n    ');
            css = css.replace(/}\s*/g, '}\n\n');
            css = css.replace(/,\s*/g, ',\n');
            css = css.trim();

            cssEditor.value = css;
            this.updateFieldStyling('customCSS', css);
            debugInfo("FormBuilder", '✨ Field CSS formatted successfully');
        } catch (error) {
            debugError("FormBuilder", '❌ Error formatting field CSS:', error);
        }
    }

    insertFieldCSSTemplate() {
        const template = `/* Field Container */
.field-wrapper {
    margin-bottom: 1rem;
    position: relative;
}

/* Field Label */
.field-label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 600;
    color: #374151;
}

/* Field Input */
.field-input {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 1rem;
    transition: border-color 0.2s ease;
}

.field-input:focus {
    outline: none;
    border-color: #8b5cf6;
    box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

/* Field Help Text */
.field-help {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: #6b7280;
}`;

        const cssEditor = document.getElementById('prop-customCSS');
        if (cssEditor) {
            cssEditor.value = template;
            this.updateFieldStyling('customCSS', template);
            debugInfo("FormBuilder", '📝 Field CSS template inserted');
        }
    }

    clearFieldCSS() {
        if (confirm('🗑️ Clear field CSS? This cannot be undone.')) {
            const cssEditor = document.getElementById('prop-customCSS');
            if (cssEditor) {
                cssEditor.value = '';
                this.updateFieldStyling('customCSS', '');
                debugInfo("FormBuilder", '🗑️ Field CSS cleared');
            }
        }
    }

    toggleCustomEmail(enabled) {
        this.updateFormSetting('useCustomEmail', enabled);
        const customEmailConfig = document.getElementById('custom-email-config');
        if (customEmailConfig) {
            customEmailConfig.style.display = enabled ? 'block' : 'none';
        }
    }

    updateEmailProvider(provider) {
        this.updateFormSetting('emailProvider', provider);
        
        // Show/hide appropriate config sections
        const smtpConfig = document.getElementById('smtp-config');
        const gmailConfig = document.getElementById('gmail-config');
        const sendgridConfig = document.getElementById('sendgrid-config');
        
        if (smtpConfig) smtpConfig.style.display = (provider !== 'gmail' && provider !== 'sendgrid') ? 'block' : 'none';
        if (gmailConfig) gmailConfig.style.display = provider === 'gmail' ? 'block' : 'none';
        if (sendgridConfig) sendgridConfig.style.display = provider === 'sendgrid' ? 'block' : 'none';
    }

    async testEmailConfiguration() {
        const settings = this.currentForm.settings || {};
        const formId = this.currentForm.id;
        
        debugInfo("FormBuilder", '🧪 Testing email configuration:', { settings, formId });
        
        if (!settings.useCustomEmail) {
            alert('Please enable "Use Custom SMTP Server" first');
            return;
        }
        
        // Collect email configuration based on provider
        let emailConfig = {
            provider: settings.emailProvider || 'smtp',
            fromEmail: settings.emailFrom || 'test@example.com',
            fromName: settings.emailFromName || 'Test Form'
        };
        
        // Ensure we have required fields
        if (!emailConfig.fromEmail || emailConfig.fromEmail.trim() === '') {
            alert('Please enter a valid "From Email Address" first');
            return;
        }
        
        switch (settings.emailProvider) {
            case 'gmail':
                emailConfig.gmailUser = settings.gmailUser;
                emailConfig.gmailPass = settings.gmailPass;
                break;
            case 'sendgrid':
                emailConfig.sendgridKey = settings.sendgridKey;
                break;
            default: // smtp
                emailConfig.host = settings.emailHost;
                emailConfig.port = settings.emailPort || 587;
                emailConfig.user = settings.emailUser;
                emailConfig.pass = settings.emailPass;
                emailConfig.secure = settings.emailSecure || false;
                break;
        }
        
        try {
            debugInfo("FormBuilder", '📤 Sending test email request:', {
                formId: formId,
                emailConfig: emailConfig,
                testEmail: emailConfig.fromEmail
            });
            
            const response = await fetch('/api/test-email-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    formId: formId,
                    emailConfig: emailConfig,
                    testEmail: emailConfig.fromEmail // Send test to same address for safety
                })
            });
            
            debugInfo("FormBuilder", '📥 Response status:', response.status, response.statusText);
            
            if (!response.ok) {
                const errorText = await response.text();
                debugError("FormBuilder", '❌ Response error:', errorText);
                throw new Error(`Server error (${response.status}): ${errorText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                alert('✅ Email configuration test successful! Test email sent.');
            } else {
                alert(`❌ Email configuration test failed: ${result.error}`);
            }
        } catch (error) {
            debugError("FormBuilder", 'Error testing email configuration:', error);
            alert(`❌ Test failed: ${error.message}`);
        }
    }

    loadAvailableFieldsForPage(pageId) {
        const availableFieldsList = document.getElementById('available-fields-list');
        if (!availableFieldsList || !pageId) return;

        const selectedPage = this.currentForm?.pages?.find(page => page.id === pageId);
        if (!selectedPage) {
            availableFieldsList.innerHTML = '<div class="field-selection-info">Selected page not found</div>';
            return;
        }

        const salesforceObject = selectedPage.salesforceObject;
        if (!salesforceObject) {
            availableFieldsList.innerHTML = '<div class="field-selection-info">Selected page does not have a Salesforce object configured</div>';
            return;
        }

        // Show loading state
        availableFieldsList.innerHTML = '<div class="field-selection-info">⏳ Loading fields from Salesforce...</div>';

        // Load object fields from Salesforce
        this.loadSalesforceObjectFields(salesforceObject)
            .then(fields => {
                if (!fields || fields.length === 0) {
                    availableFieldsList.innerHTML = '<div class="field-selection-info">No fields found for this object</div>';
                    return;
                }

                let fieldsHtml = '<div class="field-selection-info">Select fields to create table columns:</div>';
                fieldsHtml += '<div class="field-selection-controls">';
                fieldsHtml += '<button type="button" class="property-button-compact" onclick="window.AppModules.formBuilder.selectAllFields()">Select All</button>';
                fieldsHtml += '</div>';
                
                fields.forEach(field => {
                    fieldsHtml += `
                        <div class="field-selection-item">
                            <input type="checkbox" id="field-${field.name}" value="${field.name}" 
                                   onchange="window.AppModules.formBuilder.toggleFieldSelection(this)">
                            <label for="field-${field.name}">
                                <strong>${field.label || field.name}</strong>
                                <span class="field-type">${field.type}</span>
                            </label>
                        </div>
                    `;
                });

                availableFieldsList.innerHTML = fieldsHtml;
            })
            .catch(error => {
                debugError("FormBuilder", 'Error loading Salesforce fields:', error);
                availableFieldsList.innerHTML = '<div class="field-selection-info error">Error loading fields. Please try again.</div>';
            });
    }
    
    updateSectionConfig(property, value) {
        const field = this.selectedField;
        if (!field || field.type !== 'section') return;
        
        if (!field.sectionConfig) field.sectionConfig = {};
        field.sectionConfig[property] = value;
        
        // Update the field
        this.updateField(field.id, { sectionConfig: field.sectionConfig });
        
        // Re-render if collapsible changed to update UI
        if (property === 'collapsible' || property === 'collapsed') {
            this.renderFormCanvas();
        }
        
        this.markFormDirty();
        debugInfo("FormBuilder", `Updated Section config ${property}:`, value);
    }
    
    updateColumnsConfig(property, value) {
        const field = this.selectedField;
        if (!field || field.type !== 'columns') return;
        
        if (!field.columnsConfig) field.columnsConfig = {};
        field.columnsConfig[property] = value;
        
        // Update the field
        this.updateField(field.id, { columnsConfig: field.columnsConfig });
        this.renderFormCanvas();
        this.markFormDirty();
        debugInfo("FormBuilder", `Updated Columns config ${property}:`, value);
    }
    
    updateColumnsCount(count) {
        const field = this.selectedField;
        if (!field || field.type !== 'columns') return;
        
        if (!field.columnsConfig) field.columnsConfig = {};
        
        const oldCount = field.columnsConfig.columnCount || 2;
        field.columnsConfig.columnCount = count;
        
        // Adjust columns array
        if (!field.columnsConfig.columns) {
            field.columnsConfig.columns = [];
        }
        
        // Add new columns if needed
        while (field.columnsConfig.columns.length < count) {
            field.columnsConfig.columns.push({
                width: `${Math.floor(100 / count)}%`,
                fields: []
            });
        }
        
        // Remove extra columns if needed (move fields to first column)
        if (field.columnsConfig.columns.length > count) {
            const removedColumns = field.columnsConfig.columns.splice(count);
            // Move fields from removed columns to the first column
            removedColumns.forEach(col => {
                if (col.fields && col.fields.length > 0) {
                    field.columnsConfig.columns[0].fields.push(...col.fields);
                }
            });
        }
        
        // Update column widths
        const defaultWidth = `${Math.floor(100 / count)}%`;
        field.columnsConfig.columns.forEach(col => {
            col.width = defaultWidth;
        });
        
        // Update the field
        this.updateField(field.id, { columnsConfig: field.columnsConfig });
        this.renderFormCanvas();
        this.showFieldProperties(); // Refresh properties to show new column width inputs
        this.markFormDirty();
        debugInfo("FormBuilder", `Updated column count to ${count}`);
    }
    
    updateColumnWidth(columnIndex, width) {
        const field = this.selectedField;
        if (!field || field.type !== 'columns' || !field.columnsConfig?.columns) return;
        
        if (field.columnsConfig.columns[columnIndex]) {
            field.columnsConfig.columns[columnIndex].width = width;
            
            // Update the field
            this.updateField(field.id, { columnsConfig: field.columnsConfig });
            this.renderFormCanvas();
            this.markFormDirty();
            debugInfo("FormBuilder", `Updated column ${columnIndex} width to ${width}`);
        }
    }
}