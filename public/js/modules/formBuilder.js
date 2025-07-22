// FormBuilder Module - Core form building functionality

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
        console.log('Initializing FormBuilder module...');
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
                console.log('Switching to property tab:', tabType);
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
        console.log('🔄 renderFormCanvas called');
        const canvas = document.getElementById('formCanvas');
        const currentPage = this.getCurrentPage();
        
        // Debug: Log current DOM state before render
        const existingColumns = document.querySelectorAll('.column-dropzone');
        console.log('📊 Before render - existing columns in DOM:', existingColumns.length);
        existingColumns.forEach((col, i) => {
            console.log(`  Column ${i}:`, col.dataset.columnsId, col.dataset.columnIndex);
        });
        
        if (!currentPage.fields || currentPage.fields.length === 0) {
            canvas.innerHTML = `
                <div class="empty-state">
                    <h2>Start Building Your Form</h2>
                    <p>Drag fields from the sidebar to begin</p>
                </div>
            `;
        } else {
            console.log('🔄 Rendering', currentPage.fields.length, 'fields');
            canvas.innerHTML = '';
            currentPage.fields.forEach((field, index) => {
                console.log(`📝 Rendering field ${index}:`, field.id, field.type);
                canvas.appendChild(this.createFieldElement(field));
            });
        }
        
        // Debug: Log DOM state after render
        const newColumns = document.querySelectorAll('.column-dropzone');
        console.log('📊 After render - columns in DOM:', newColumns.length);
        newColumns.forEach((col, i) => {
            console.log(`  Column ${i}:`, col.dataset.columnsId, col.dataset.columnIndex);
            const fieldsInColumn = col.querySelectorAll('.form-field');
            console.log(`    Fields in column: ${fieldsInColumn.length}`);
        });
        
        this.renderPageTabs();
        
        // Ensure container drag and drop listeners are set up
        setTimeout(() => {
            if (window.AppModules.dragDrop) {
                console.log('🔧 FormBuilder: Setting up container listeners after render');
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
            console.warn(`Field with ID ${fieldId} not found for update`);
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
            }
        }
    }
    
    removeField(fieldId) {
        // Use the enhanced removal method that handles nested fields
        const removedField = this.removeFieldFromAnyLocation(fieldId);
        
        if (removedField) {
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
        console.log('🚀 addFieldToContainer called:', { fieldType, containerId, containerType, targetIndex });
        
        // First create the field
        const field = this.createField(fieldType);
        console.log('📝 Created field:', field);
        
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
                console.log('✅ Added field to section:', sectionField.sectionConfig.fields);
            }
        } else if (containerType === 'column') {
            // containerId format is "field_X_Y" where X is part of columnsId and Y is columnIndex
            const parts = containerId.split('_');
            const columnIndex = parts.pop(); // Get the last part (column index)
            const columnsId = parts.join('_'); // Join the rest back together
            console.log('🔍 Column container info:', { columnsId, columnIndex, originalContainerId: containerId });
            
            const columnsField = this.findFieldById(columnsId);
            console.log('📋 Found columns field:', columnsField);
            
            if (columnsField && columnsField.type === 'columns') {
                const colIndex = parseInt(columnIndex);
                console.log('📍 Column index:', colIndex);
                console.log('📋 Columns config:', columnsField.columnsConfig);
                
                if (columnsField.columnsConfig.columns[colIndex]) {
                    if (!columnsField.columnsConfig.columns[colIndex].fields) {
                        columnsField.columnsConfig.columns[colIndex].fields = [];
                    }
                    if (targetIndex !== null && targetIndex >= 0) {
                        columnsField.columnsConfig.columns[colIndex].fields.splice(targetIndex, 0, field);
                    } else {
                        columnsField.columnsConfig.columns[colIndex].fields.push(field);
                    }
                    console.log('✅ Added field to column:', columnsField.columnsConfig.columns[colIndex].fields);
                    console.log('🔍 Full columns field after addition:', JSON.stringify(columnsField, null, 2));
                } else {
                    console.error('❌ Column not found:', colIndex);
                }
            } else {
                console.error('❌ Columns field not found or wrong type:', columnsField);
            }
        }
        
        console.log('🔄 Re-rendering form canvas...');
        this.markFormDirty();
        document.dispatchEvent(new CustomEvent('fieldAdded', { detail: field }));
        
        return field;
    }
    
    moveFieldToContainer(fieldId, containerId, containerType, targetIndex = null) {
        console.log('🔄 moveFieldToContainer called:', { fieldId, containerId, containerType, targetIndex });
        
        // Safety check: Don't allow moving a columns field into itself
        if (containerType === 'column' && containerId.startsWith(fieldId)) {
            console.warn('⚠️ Cannot move columns field into itself');
            return;
        }
        
        const fieldLocation = this.findFieldLocation(fieldId);
        if (!fieldLocation) {
            console.error(`❌ Field ${fieldId} not found - cannot move to container`);
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
            console.error(`❌ Target container ${containerId} not found or invalid type`);
            return;
        }

        // Ensure targetArray.fields exists
        if (!targetArray) {
            targetArray = [];
        }

        // Check if moving within the same array
        if (parentArray === targetArray) {
            console.log(`🔄 Reordering field ${fieldId} within the same array (index ${oldIndex} to ${targetIndex})`);
            // Adjust targetIndex if moving from a lower index to a higher index
            const adjustedTargetIndex = (oldIndex < targetIndex) ? targetIndex - 1 : targetIndex;
            parentArray.splice(oldIndex, 1);
            parentArray.splice(adjustedTargetIndex, 0, field);
        } else {
            console.log(`🔄 Moving field ${fieldId} from one container to another`);
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
                console.error('❌ Too many attempts to create unique field ID');
                break;
            }
        } while (this.findFieldById(newFieldId) !== null);
        
        console.log('🆔 Creating field with ID:', newFieldId, 'Counter now:', this.fieldIdCounter, 'Attempts:', attempts);
        
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
        // Safety check: Prevent removing container fields when we're just moving fields within them
        const field = this.findFieldById(fieldId);
        if (field && (field.type === 'columns' || field.type === 'section')) {
            console.warn(`⚠️ Attempting to remove container field ${fieldId} - checking if this is intentional`);
            // Only remove container fields if they're explicitly being deleted, not during moves
            const isExplicitDelete = new Error().stack.includes('removeField');
            if (!isExplicitDelete) {
                console.warn(`⚠️ Preventing accidental removal of container field ${fieldId}`);
                return null;
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
            console.warn(`Field with ID ${fieldId} not found`);
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
            <!-- Field Header with Delete Button -->
            <div class="field-property-header">
                <div class="field-info">
                    <h3>${field.label || 'Field Properties'}</h3>
                    <span class="field-type-badge">${field.type}</span>
                </div>
                <button class="delete-field-btn" onclick="window.AppModules.formBuilder.deleteField('${field.id}')" title="Delete Field">
                    🗑️ Delete
                </button>
            </div>

            <!-- Basic Properties Section -->
            <div class="field-property-section">
                <div class="section-header">
                    <h4 class="section-title">⚙️ Basic Properties</h4>
                    <p class="section-description">Essential field configuration and settings</p>
                </div>
                
                <div class="property-group">
                    <label>Field Label</label>
                    <input type="text" id="prop-label" value="${field.label || ''}" 
                           onchange="window.AppModules.formBuilder.updateFieldProperty('label', this.value)">
                    <div class="help-text">Label shown to users above the field</div>
                </div>
                
                <div class="property-group">
                    <label>Field ID</label>
                    <input type="text" id="prop-fieldId" value="${field.id}" 
                           onchange="window.AppModules.formBuilder.updateFieldId(this.value)"
                           pattern="[a-zA-Z][a-zA-Z0-9_-]*"
                           title="Must start with a letter and contain only letters, numbers, hyphens, and underscores">
                    <div class="help-text">Unique identifier for this field. Click to edit or use default generated ID.</div>
                </div>
                
                <div class="property-group">
                    <div class="form-checkbox">
                        <input type="checkbox" id="prop-required" ${field.required ? 'checked' : ''}
                               onchange="window.AppModules.formBuilder.updateFieldProperty('required', this.checked)">
                        <label for="prop-required">Required Field</label>
                    </div>
                    <div class="help-text">Users must fill this field before submitting</div>
                </div>
            </div>
        `;
        
        // Add type-specific properties
        switch (field.type) {
            case 'text':
            case 'email':
            case 'phone':
            case 'textarea':
                html += `
                    <div class="property-group">
                        <label>Placeholder</label>
                        <input type="text" id="prop-placeholder" value="${field.placeholder || ''}"
                               onchange="window.AppModules.formBuilder.updateFieldProperty('placeholder', this.value)">
                    </div>
                `;
                break;
            
            case 'checkbox':
                html += `
                    <div class="property-group">
                        <label>Checkbox Text</label>
                        <input type="text" id="prop-checkboxLabel" value="${field.checkboxLabel || 'Check this box'}"
                               onchange="window.AppModules.formBuilder.updateFieldProperty('checkboxLabel', this.value)">
                    </div>
                `;
                break;
            
            case 'select':
            case 'radio':
                html += `
                    <div class="property-group">
                        <label>
                            <input type="checkbox" id="prop-usePicklist" ${field.usePicklist ? 'checked' : ''}
                                   onchange="window.AppModules.formBuilder.togglePicklist(this.checked)">
                            Use Salesforce Picklist
                        </label>
                    </div>
                    
                    <div id="picklistConfig" style="display: ${field.usePicklist ? 'block' : 'none'}">
                        <div class="property-group">
                            <label>Salesforce Object</label>
                            <select id="prop-picklistObject" onchange="window.AppModules.formBuilder.updatePicklistObject(this.value)">
                                <option value="">Select Object...</option>
                            </select>
                        </div>
                        
                        <div class="property-group">
                            <label>Picklist Field</label>
                            <select id="prop-picklistField" onchange="window.AppModules.formBuilder.updatePicklistField(this.value)">
                                <option value="">Select Field...</option>
                            </select>
                        </div>
                    </div>
                    
                    <div id="manualOptions" style="display: ${field.usePicklist ? 'none' : 'block'}">
                        <div class="property-group">
                            <label>Options</label>
                            <div id="optionsList">
                                ${this.renderOptionsList(field.options || [])}
                            </div>
                            <button class="button button-secondary" onclick="window.AppModules.formBuilder.addOption()">
                                Add Option
                            </button>
                        </div>
                    </div>
                `;
                break;
            
            case 'lookup':
                html += `
                    <!-- Lookup Configuration Section -->
                    <div class="field-property-section">
                        <div class="section-header">
                            <h4 class="section-title">🔍 Lookup Configuration</h4>
                            <p class="section-description">Configure which Salesforce records to search</p>
                        </div>
                        
                        <div class="property-group">
                            <label>Salesforce Object</label>
                            <select id="prop-lookupObject" onchange="window.AppModules.formBuilder.updateLookupObject(this.value)">
                                <option value="">Select Object...</option>
                            </select>
                            <div class="help-text">The Salesforce object type to search (e.g., Account, Contact, Lead)</div>
                        </div>
                        
                        <div class="property-group">
                            <label>Display Field</label>
                            <select id="prop-displayField" onchange="window.AppModules.formBuilder.updateFieldProperty('displayField', this.value)">
                                <option value="Name">Name</option>
                            </select>
                            <div class="help-text">Field shown in the dropdown results</div>
                        </div>
                        
                        <div class="property-group">
                            <label>Search Field</label>
                            <select id="prop-searchField" onchange="window.AppModules.formBuilder.updateFieldProperty('searchField', this.value)">
                                <option value="Name">Name</option>
                            </select>
                            <div class="help-text">Field used to match user's search input</div>
                        </div>
                        
                        <div class="property-group">
                            <label>Maximum Results</label>
                            <input type="number" id="prop-maxResults" value="${field.maxResults || 10}" min="1" max="50"
                                   onchange="window.AppModules.formBuilder.updateFieldProperty('maxResults', parseInt(this.value))">
                            <div class="help-text">Limit the number of results shown in dropdown</div>
                        </div>
                    </div>
                    
                    <!-- Variable Storage Section -->
                    <div class="field-property-section">
                        <div class="section-header">
                            <h4 class="section-title">📊 Variable Storage</h4>
                            <p class="section-description">Store selected record data for use elsewhere</p>
                        </div>
                        
                        <div class="property-group">
                            <label>Store Record ID as Variable</label>
                            <select id="prop-storeIdVariable" 
                                    onchange="window.AppModules.formBuilder.updateFieldProperty('storeIdVariable', this.value)">
                                ${this.renderStoreIdVariableOptions(field)}
                            </select>
                            <div class="help-text">Variable name to store the selected record's ID. Use this in conditions or for update operations.</div>
                        </div>
                        
                        <div class="property-group">
                            <label>
                                <input type="checkbox" id="prop-storeAllFields" ${field.storeAllFields ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateFieldProperty('storeAllFields', this.checked)">
                                Store All Record Fields
                            </label>
                            <div class="help-text">When enabled, stores all selected record fields as variables (e.g., Account.Name, Account.Phone)</div>
                        </div>
                    </div>
                    
                    <!-- Advanced Filtering Section -->
                    <div class="field-property-section">
                        <div class="section-header">
                            <h4 class="section-title">🎯 Advanced Filtering</h4>
                            <p class="section-description">Add filters to limit which records are shown</p>
                        </div>
                        
                        <div class="property-group">
                            <label>Lookup Filters</label>
                            <div id="lookup-filters-container">
                                <div class="lookup-filters-list" id="lookup-filters-list">
                                    ${this.renderLookupFilters(field.lookupFilters || [], this.lookupObjectFieldsCache[field.lookupObject] || [])}
                                </div>
                                <button type="button" class="add-condition-btn" onclick="window.AppModules.formBuilder.addLookupFilter()">
                                    ➕ Add Filter
                                </button>
                            </div>
                            <div class="help-text">Filter records based on field values (e.g., only active accounts)</div>
                        </div>
                    </div>
                `;
                break;
            
            case 'signature':
                html += `
                    <div class="property-group">
                        <label>Signature Width</label>
                        <input type="number" id="prop-sigWidth" value="${field.signatureConfig?.width || 500}"
                               min="300" max="800" step="50"
                               onchange="window.AppModules.formBuilder.updateSignatureConfig('width', this.value)">
                    </div>
                    
                    <div class="property-group">
                        <label>Signature Height</label>
                        <input type="number" id="prop-sigHeight" value="${field.signatureConfig?.height || 200}"
                               min="100" max="400" step="50"
                               onchange="window.AppModules.formBuilder.updateSignatureConfig('height', this.value)">
                    </div>
                    
                    <div class="property-group">
                        <label>Pen Color</label>
                        <input type="color" id="prop-penColor" value="${field.signatureConfig?.penColor || '#000000'}"
                               onchange="window.AppModules.formBuilder.updateSignatureConfig('penColor', this.value)">
                    </div>
                    
                    <div class="property-group">
                        <label>
                            <input type="checkbox" ${field.signatureConfig?.requireLegalText ? 'checked' : ''}
                                   onchange="window.AppModules.formBuilder.updateSignatureConfig('requireLegalText', this.checked)">
                            Require Legal Agreement
                        </label>
                    </div>
                    
                    ${field.signatureConfig?.requireLegalText ? `
                        <div class="property-group">
                            <label>Legal Text</label>
                            <textarea onchange="window.AppModules.formBuilder.updateSignatureConfig('legalText', this.value)">${field.signatureConfig?.legalText || ''}</textarea>
                        </div>
                    ` : ''}
                `;
                break;
                
            case 'login':
                html += `
                    <div class="property-group">
                        <label>Login Title</label>
                        <input type="text" id="prop-loginTitle" value="${field.loginConfig?.title || 'Login Required'}"
                               onchange="window.AppModules.formBuilder.updateLoginConfig('title', this.value)">
                    </div>
                    
                    <div class="property-group">
                        <label>Instructions</label>
                        <textarea id="prop-loginInstructions" onchange="window.AppModules.formBuilder.updateLoginConfig('instructions', this.value)">${field.loginConfig?.instructions || 'Please enter your email address to continue.'}</textarea>
                    </div>
                    
                    <div class="property-group">
                        <label>Success Message</label>
                        <textarea id="prop-successMessage" onchange="window.AppModules.formBuilder.updateLoginConfig('successMessage', this.value)">${field.loginConfig?.successMessage || 'Login successful! You can now continue.'}</textarea>
                    </div>
                    
                    <div class="property-group">
                        <label>New User Message</label>
                        <textarea id="prop-newUserMessage" onchange="window.AppModules.formBuilder.updateLoginConfig('newUserMessage', this.value)">${field.loginConfig?.newUserMessage || 'Welcome! You can proceed to create your account.'}</textarea>
                    </div>
                    
                    <div class="property-group">
                        <label>
                            <input type="checkbox" ${field.loginConfig?.enableOTP ? 'checked' : ''}
                                   onchange="window.AppModules.formBuilder.updateLoginConfig('enableOTP', this.checked)">
                            Enable OTP Verification
                        </label>
                    </div>
                    
                    <div class="property-group">
                        <label>
                            <input type="checkbox" ${field.loginConfig?.enableContactLookup ? 'checked' : ''}
                                   onchange="window.AppModules.formBuilder.updateLoginConfig('enableContactLookup', this.checked)">
                            Enable Contact Lookup
                        </label>
                    </div>
                    
                    <div class="property-group">
                        <h4>Variables to Set</h4>
                        <div id="login-variables-list">
                            ${this.renderLoginVariables(field.loginConfig?.setVariables || {})}
                        </div>
                        <button type="button" class="button button-secondary" onclick="window.AppModules.formBuilder.addLoginVariable()">
                            Add Variable
                        </button>
                    </div>
                `;
                break;
                
            case 'email-verify':
                html += `
                    <!-- Basic Configuration Section -->
                    <div class="field-property-section">
                        <div class="section-header">
                            <h4 class="section-title">📧 Basic Configuration</h4>
                            <p class="section-description">Configure the email verification appearance</p>
                        </div>
                        
                        <div class="property-group">
                            <label>Verification Title</label>
                            <input type="text" id="prop-verifyTitle" value="${field.verifyConfig?.title || 'Email Verification'}"
                                   onchange="window.AppModules.formBuilder.updateVerifyConfig('title', this.value)">
                        </div>
                        
                        <div class="property-group">
                            <label>Instructions</label>
                            <textarea id="prop-verifyInstructions" onchange="window.AppModules.formBuilder.updateVerifyConfig('instructions', this.value)">${field.verifyConfig?.instructions || 'Enter your email address and click verify to continue.'}</textarea>
                        </div>
                        
                        <div class="property-group">
                            <label>Verify Button Text</label>
                            <input type="text" id="prop-buttonText" value="${field.verifyConfig?.buttonText || 'Verify Email'}"
                                   onchange="window.AppModules.formBuilder.updateVerifyConfig('buttonText', this.value)">
                        </div>
                        
                        <div class="property-group">
                            <label>Success Message</label>
                            <textarea id="prop-verifySuccessMessage" onchange="window.AppModules.formBuilder.updateVerifyConfig('successMessage', this.value)">${field.verifyConfig?.successMessage || 'Email verified successfully!'}</textarea>
                        </div>
                        
                        <div class="property-group">
                            <label>Resend Button Text</label>
                            <input type="text" id="prop-resendText" value="${field.verifyConfig?.resendText || 'Resend Code'}"
                                   onchange="window.AppModules.formBuilder.updateVerifyConfig('resendText', this.value)">
                        </div>
                        
                        <div class="property-group">
                            <label>
                                <input type="checkbox" ${field.verifyConfig?.requiredToSubmit ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateVerifyConfig('requiredToSubmit', this.checked)">
                                Required to Submit Form
                            </label>
                        </div>
                    </div>
                    
                    <!-- Contact Lookup Configuration Section -->
                    <div class="field-property-section">
                        <div class="section-header">
                            <h4 class="section-title">🔍 Contact Lookup Settings</h4>
                            <p class="section-description">Configure Salesforce contact verification</p>
                        </div>
                        
                        <div class="property-group">
                            <label>
                                <input type="checkbox" ${field.verifyConfig?.enableContactLookup ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateVerifyConfig('enableContactLookup', this.checked); window.AppModules.formBuilder.showFieldProperties();">
                                Enable Contact Lookup
                            </label>
                            <div class="help-text">Check if contact exists in Salesforce before sending OTP</div>
                        </div>
                        
                        <div id="contactLookupOptions" style="display: ${field.verifyConfig?.enableContactLookup ? 'block' : 'none'}">
                            <div class="property-group">
                                <label>
                                    <input type="checkbox" ${field.verifyConfig?.requireExistingContact ? 'checked' : ''}
                                           onchange="window.AppModules.formBuilder.updateVerifyConfig('requireExistingContact', this.checked)">
                                    Require Existing Contact
                                </label>
                                <div class="help-text">Only allow verification for existing Salesforce contacts</div>
                            </div>
                            
                            <div class="property-group">
                                <label>Contact Not Found Message</label>
                                <textarea id="prop-contactNotFoundMessage" onchange="window.AppModules.formBuilder.updateVerifyConfig('contactNotFoundMessage', this.value)">${field.verifyConfig?.contactNotFoundMessage || 'No account found with this email address.'}</textarea>
                                <div class="help-text">Message shown when email is not found in Salesforce</div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Variables Configuration Section -->
                    <div class="field-property-section">
                        <div class="section-header">
                            <h4 class="section-title">🔧 Variables to Set</h4>
                            <p class="section-description">Configure variables set after successful verification</p>
                        </div>
                        
                        <div class="property-group">
                            <div id="verify-variables-list">
                                ${this.renderVerifyVariables(field.verifyConfig?.setVariables || {})}
                            </div>
                            <button type="button" class="button button-secondary" onclick="window.AppModules.formBuilder.addVerifyVariable()">
                                Add Variable
                            </button>
                            <div class="help-text">Available templates: {{email}}, {{Contact.Name}}, {{Contact.Phone}}, {{Contact.Id}}</div>
                        </div>
                    </div>
                `;
                break;
                
            case 'display':
                const escapedContent = (field.displayContent || '').replace(/"/g, '&quot;');
                html += `
                    <div class="property-group">
                        <label>Display Content</label>
                        <div id="display-content-editor" style="min-height: 200px; border: 1px solid #ddd; border-radius: 4px;"></div>
                        <input type="hidden" id="prop-displayContent" value="${escapedContent}">
                    </div>
                `;
                break;
                
            case 'datatable':
                html += `
                    <!-- Basic Configuration Section -->
                    <div class="field-property-section">
                        <div class="section-header">
                            <h4 class="section-title">📊 Basic Configuration</h4>
                            <p class="section-description">Configure the data table appearance and behavior</p>
                        </div>
                        
                        <div class="property-group">
                            <label>Table Title</label>
                            <input type="text" id="prop-datatableTitle" value="${field.dataTableConfig?.title || 'Data Table'}"
                                   onchange="window.AppModules.formBuilder.updateDataTableConfig('title', this.value)">
                        </div>
                        
                        <div class="property-group">
                            <label>Description</label>
                            <textarea id="prop-datatableDescription" 
                                      onchange="window.AppModules.formBuilder.updateDataTableConfig('description', this.value)">${field.dataTableConfig?.description || ''}</textarea>
                        </div>
                        
                        <div class="form-row">
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" ${field.dataTableConfig?.allowAdd ? 'checked' : ''}
                                           onchange="window.AppModules.formBuilder.updateDataTableConfig('allowAdd', this.checked)">
                                    Allow Add Rows
                                </label>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" ${field.dataTableConfig?.allowEdit ? 'checked' : ''}
                                           onchange="window.AppModules.formBuilder.updateDataTableConfig('allowEdit', this.checked)">
                                    Allow Edit Cells
                                </label>
                            </div>
                            <div class="form-group">
                                <label>
                                    <input type="checkbox" ${field.dataTableConfig?.allowDelete ? 'checked' : ''}
                                           onchange="window.AppModules.formBuilder.updateDataTableConfig('allowDelete', this.checked)">
                                    Allow Delete Rows
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Data Source Section -->
                    <div class="field-property-section">
                        <div class="section-header">
                            <h4 class="section-title">📥 Data Source</h4>
                            <p class="section-description">Configure where the table data comes from</p>
                        </div>
                        
                        <div class="property-group">
                            <label>Data Source</label>
                            <select id="prop-dataSource" onchange="window.AppModules.formBuilder.updateDataTableConfig('dataSource', this.value)">
                                <option value="static" ${field.dataTableConfig?.dataSource === 'static' ? 'selected' : ''}>Static Data</option>
                                <option value="variable" ${field.dataTableConfig?.dataSource === 'variable' ? 'selected' : ''}>Form Variable</option>
                                <option value="query" ${field.dataTableConfig?.dataSource === 'query' ? 'selected' : ''}>Get Records Page</option>
                            </select>
                        </div>
                        
                        <div id="variable-source-config" style="display: ${field.dataTableConfig?.dataSource === 'variable' ? 'block' : 'none'};">
                            <div class="property-group">
                                <label>Variable Name</label>
                                <input type="text" id="prop-sourceVariable" value="${field.dataTableConfig?.sourceVariable || ''}"
                                       placeholder="QueryResults"
                                       onchange="window.AppModules.formBuilder.updateDataTableConfig('sourceVariable', this.value)">
                                <div class="help-text">Variable containing JSON array of data objects</div>
                            </div>
                        </div>
                        
                        <div id="query-source-config" style="display: ${field.dataTableConfig?.dataSource === 'query' ? 'block' : 'none'};">
                            <div class="property-group">
                                <label>Get Records Page</label>
                                <select id="prop-sourcePageId" onchange="window.AppModules.formBuilder.updateDataTableConfig('sourcePageId', this.value)">
                                    <option value="">Select Page...</option>
                                    ${this.renderQueryPagesDropdown(field.dataTableConfig?.sourcePageId)}
                                </select>
                                <div class="help-text">Page with actionType "Get/Query Records"</div>
                            </div>
                            
                            ${field.dataTableConfig?.sourcePageId ? `
                            <div class="field-selection-container">
                                <div class="field-selection-header">
                                    <h4>🎯 Available Fields</h4>
                                    <p>Select fields from the Get Records query to display in the table</p>
                                </div>
                                
                                <div class="field-selection-list" id="available-fields-list">
                                    ${this.renderAvailableFields(field.dataTableConfig.sourcePageId)}
                                </div>
                                
                                <div class="field-selection-actions">
                                    <div class="field-selection-info">
                                        Select fields to automatically create table columns
                                    </div>
                                    <div>
                                        <button type="button" class="button button-secondary button-small" onclick="window.AppModules.formBuilder.selectAllFields()">
                                            Select All
                                        </button>
                                        <button type="button" class="button button-primary button-small" onclick="window.AppModules.formBuilder.createColumnsFromSelectedFields()">
                                            Create Columns
                                        </button>
                                    </div>
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <!-- Columns Configuration Section -->
                    <div class="field-property-section">
                        <div class="section-header">
                            <h4 class="section-title">📋 Columns</h4>
                            <p class="section-description">Configure table columns and their properties</p>
                        </div>
                        
                        <div class="property-group">
                            <div id="datatable-columns-list">
                                ${this.renderDataTableColumns(field.dataTableConfig?.columns || [])}
                            </div>
                            <button type="button" class="button button-secondary" onclick="window.AppModules.formBuilder.addDataTableColumn()">
                                ➕ Add Column
                            </button>
                        </div>
                    </div>
                `;
                break;
                
            case 'section':
                html += `
                    <!-- Section Configuration -->
                    <div class="field-property-section">
                        <div class="section-header">
                            <h4 class="section-title">📦 Section Configuration</h4>
                            <p class="section-description">Configure the section container properties</p>
                        </div>
                        
                        <div class="property-group">
                            <label>Section Title</label>
                            <input type="text" value="${field.sectionConfig?.title || 'Section'}"
                                   onchange="window.AppModules.formBuilder.updateSectionConfig('title', this.value)">
                        </div>
                        
                        <div class="property-group">
                            <label>Description</label>
                            <textarea onchange="window.AppModules.formBuilder.updateSectionConfig('description', this.value)">${field.sectionConfig?.description || ''}</textarea>
                        </div>
                        
                        <div class="property-group">
                            <label>
                                <input type="checkbox" ${field.sectionConfig?.collapsible ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateSectionConfig('collapsible', this.checked)">
                                Allow Collapse/Expand
                            </label>
                        </div>
                        
                        <div class="property-group">
                            <label>
                                <input type="checkbox" ${field.sectionConfig?.collapsed ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateSectionConfig('collapsed', this.checked)">
                                Start Collapsed
                            </label>
                        </div>
                        
                        <div class="property-group">
                            <label>
                                <input type="checkbox" ${field.sectionConfig?.showBorder ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateSectionConfig('showBorder', this.checked)">
                                Show Border
                            </label>
                        </div>
                        
                        <div class="property-group">
                            <label>Background Color</label>
                            <input type="color" value="${field.sectionConfig?.backgroundColor || '#ffffff'}"
                                   onchange="window.AppModules.formBuilder.updateSectionConfig('backgroundColor', this.value)">
                        </div>
                        
                        <div class="property-group">
                            <label>Padding</label>
                            <select onchange="window.AppModules.formBuilder.updateSectionConfig('padding', this.value)">
                                <option value="small" ${field.sectionConfig?.padding === 'small' ? 'selected' : ''}>Small</option>
                                <option value="medium" ${field.sectionConfig?.padding === 'medium' ? 'selected' : ''}>Medium</option>
                                <option value="large" ${field.sectionConfig?.padding === 'large' ? 'selected' : ''}>Large</option>
                            </select>
                        </div>
                    </div>
                `;
                break;
                
            case 'columns':
                html += `
                    <!-- Columns Configuration -->
                    <div class="field-property-section">
                        <div class="section-header">
                            <h4 class="section-title">📐 Columns Configuration</h4>
                            <p class="section-description">Configure the column layout</p>
                        </div>
                        
                        <div class="property-group">
                            <label>Number of Columns</label>
                            <select onchange="window.AppModules.formBuilder.updateColumnsCount(parseInt(this.value))">
                                <option value="2" ${field.columnsConfig?.columnCount === 2 ? 'selected' : ''}>2 Columns</option>
                                <option value="3" ${field.columnsConfig?.columnCount === 3 ? 'selected' : ''}>3 Columns</option>
                                <option value="4" ${field.columnsConfig?.columnCount === 4 ? 'selected' : ''}>4 Columns</option>
                            </select>
                        </div>
                        
                        <div class="property-group">
                            <label>Column Gap</label>
                            <select onchange="window.AppModules.formBuilder.updateColumnsConfig('columnGap', this.value)">
                                <option value="small" ${field.columnsConfig?.columnGap === 'small' ? 'selected' : ''}>Small</option>
                                <option value="medium" ${field.columnsConfig?.columnGap === 'medium' ? 'selected' : ''}>Medium</option>
                                <option value="large" ${field.columnsConfig?.columnGap === 'large' ? 'selected' : ''}>Large</option>
                            </select>
                        </div>
                        
                        <div class="property-group">
                            <label>
                                <input type="checkbox" ${field.columnsConfig?.mobileStack ? 'checked' : ''}
                                       onchange="window.AppModules.formBuilder.updateColumnsConfig('mobileStack', this.checked)">
                                Stack on Mobile
                            </label>
                            <div class="help-text">Columns will stack vertically on mobile devices</div>
                        </div>
                        
                        <div class="property-group">
                            <h4>Column Widths</h4>
                            ${field.columnsConfig?.columns.map((col, index) => `
                                <div class="form-row">
                                    <label>Column ${index + 1} Width</label>
                                    <input type="text" value="${col.width || '50%'}"
                                           onchange="window.AppModules.formBuilder.updateColumnWidth(${index}, this.value)"
                                           placeholder="e.g., 50%, 300px, 1fr">
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
                break;
        }
        
        // Add help text field
        html += `
            <div class="property-group">
                <label>Help Text</label>
                <textarea id="prop-helpText" onchange="window.AppModules.formBuilder.updateFieldProperty('helpText', this.value)">${field.helpText || ''}</textarea>
            </div>
        `;
        
        // Add Salesforce field mapping (exclude file, signature, display, and login fields as they are handled differently)
        if (!['display', 'file', 'signature', 'login'].includes(field.type)) {
            html += `
                <div class="property-group">
                    <label>Salesforce Field</label>
                    <select id="prop-salesforceField" onchange="window.AppModules.formBuilder.updateFieldProperty('salesforceField', this.value)">
                        <option value="">Not Mapped</option>
                    </select>
                </div>
            `;
        }
        
        // Add variable setting for all field types (except display fields)
        if (field.type !== 'display') {
            html += `
                <div class="property-group">
                    <h4>🔧 Variable Setting</h4>
                    <p class="help-text">Set variables based on field values for use in conditional logic</p>
                    
                    <label>
                        <input type="checkbox" ${field.setVariablesConfig?.enabled ? 'checked' : ''}
                               onchange="window.AppModules.formBuilder.toggleVariableSetting(this.checked)">
                        Enable Variable Setting
                    </label>
                </div>
            `;
            
            if (field.setVariablesConfig?.enabled) {
                html += `
                    <div id="variable-setting-config" class="variable-config">
                        <div class="property-group">
                            <h4>Variables to Set</h4>
                            <div id="field-variables-list">
                                ${this.renderFieldVariables(field.setVariablesConfig?.setVariables || {})}
                            </div>
                            <button type="button" class="button button-secondary" onclick="window.AppModules.formBuilder.addFieldVariable()">
                                Add Variable
                            </button>
                        </div>
                    </div>
                `;
            }
        }
        
        // Add conditional visibility
        html += `
            <div class="property-group">
                <h4>Conditional Visibility</h4>
                <label>
                    <input type="checkbox" ${field.conditionalVisibility?.enabled ? 'checked' : ''}
                           onchange="window.AppModules.formBuilder.toggleConditionalVisibility(this.checked)">
                    Enable Conditional Logic
                </label>
            </div>
        `;
        
        const conditionalVisibility = field.conditionalVisibility || {};
        if (conditionalVisibility.enabled) {
            html += window.AppModules.conditionalLogic?.renderConditionalConfig(field) || '';
        }
        
        // Add styling section
        const styling = field.styling || {};
        html += `
            <div class="field-property-section styling-section">
                <div class="section-header">
                    <h4 class="section-title">🎨 Field Styling</h4>
                    <p class="section-description">Customize field appearance and layout</p>
                </div>
                
                <div class="styling-grid">
                    <div class="property-group">
                        <label>Width</label>
                        <input type="text" value="${styling.width || ''}" placeholder="auto"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('width', this.value)">
                    </div>
                    
                    <div class="property-group">
                        <label>Height</label>
                        <input type="text" value="${styling.height || ''}" placeholder="auto"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('height', this.value)">
                    </div>
                    
                    <div class="property-group">
                        <label>Padding</label>
                        <input type="text" value="${styling.padding || ''}" placeholder="8px"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('padding', this.value)">
                    </div>
                    
                    <div class="property-group">
                        <label>Margin</label>
                        <input type="text" value="${styling.margin || ''}" placeholder="0px"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('margin', this.value)">
                    </div>
                    
                    <div class="property-group">
                        <label>Background Color</label>
                        <div class="color-input-group">
                            <input type="color" value="${styling.backgroundColor || '#ffffff'}"
                                   onchange="window.AppModules.formBuilder.updateFieldStyling('backgroundColor', this.value)">
                            <input type="text" value="${styling.backgroundColor || ''}" placeholder="#ffffff"
                                   onchange="window.AppModules.formBuilder.updateFieldStyling('backgroundColor', this.value)">
                        </div>
                    </div>
                    
                    <div class="property-group">
                        <label>Text Color</label>
                        <div class="color-input-group">
                            <input type="color" value="${styling.color || '#000000'}"
                                   onchange="window.AppModules.formBuilder.updateFieldStyling('color', this.value)">
                            <input type="text" value="${styling.color || ''}" placeholder="#000000"
                                   onchange="window.AppModules.formBuilder.updateFieldStyling('color', this.value)">
                        </div>
                    </div>
                    
                    <div class="property-group">
                        <label>Font Size</label>
                        <input type="text" value="${styling.fontSize || ''}" placeholder="14px"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('fontSize', this.value)">
                    </div>
                    
                    <div class="property-group">
                        <label>Font Weight</label>
                        <select onchange="window.AppModules.formBuilder.updateFieldStyling('fontWeight', this.value)">
                            <option value="">Default</option>
                            <option value="normal" ${styling.fontWeight === 'normal' ? 'selected' : ''}>Normal</option>
                            <option value="bold" ${styling.fontWeight === 'bold' ? 'selected' : ''}>Bold</option>
                            <option value="lighter" ${styling.fontWeight === 'lighter' ? 'selected' : ''}>Lighter</option>
                        </select>
                    </div>
                    
                    <div class="property-group">
                        <label>Text Align</label>
                        <select onchange="window.AppModules.formBuilder.updateFieldStyling('textAlign', this.value)">
                            <option value="">Default</option>
                            <option value="left" ${styling.textAlign === 'left' ? 'selected' : ''}>Left</option>
                            <option value="center" ${styling.textAlign === 'center' ? 'selected' : ''}>Center</option>
                            <option value="right" ${styling.textAlign === 'right' ? 'selected' : ''}>Right</option>
                        </select>
                    </div>
                    
                    <div class="property-group">
                        <label>Border Radius</label>
                        <input type="text" value="${styling.borderRadius || ''}" placeholder="4px"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('borderRadius', this.value)">
                    </div>
                    
                    <div class="property-group">
                        <label>Border Width</label>
                        <input type="text" value="${styling.borderWidth || ''}" placeholder="1px"
                               onchange="window.AppModules.formBuilder.updateFieldStyling('borderWidth', this.value)">
                    </div>
                    
                    <div class="property-group">
                        <label>Border Color</label>
                        <div class="color-input-group">
                            <input type="color" value="${styling.borderColor || '#cccccc'}"
                                   onchange="window.AppModules.formBuilder.updateFieldStyling('borderColor', this.value)">
                            <input type="text" value="${styling.borderColor || ''}" placeholder="#cccccc"
                                   onchange="window.AppModules.formBuilder.updateFieldStyling('borderColor', this.value)">
                        </div>
                    </div>
                </div>
                
                <div class="property-group">
                    <label>Custom CSS</label>
                    <textarea rows="4" placeholder="Add custom CSS properties..."
                              onchange="window.AppModules.formBuilder.updateFieldStyling('customCSS', this.value)">${styling.customCSS || ''}</textarea>
                    <div class="help-text">Enter CSS properties like "box-shadow: 0 2px 4px rgba(0,0,0,0.1);"</div>
                </div>
            </div>
        `;

        // Add delete button
        html += `
            <div class="property-group mt-lg">
                <button class="button button-secondary" style="background-color: var(--accent-red); color: white;"
                        onclick="window.AppModules.formBuilder.deleteSelectedField()">
                    Delete Field
                </button>
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
        console.log(`Field styling ${property} updated to:`, value);
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
        
        console.log(`✅ Field ID updated from "${oldId}" to "${newId}"`);
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
            console.error('Email verification error:', error);
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
            console.error('Email confirmation error:', error);
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
        this.showFieldProperties(); // Re-render to show/hide variable config
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
            document.getElementById('picklistConfig').style.display = enabled ? 'block' : 'none';
            document.getElementById('manualOptions').style.display = enabled ? 'none' : 'block';
            
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
            this.showFieldProperties(); // Re-render to show/hide conditional config
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
            console.warn('Quill is not loaded, cannot initialize display content editor');
            return;
        }
        
        const editorContainer = document.getElementById('display-content-editor');
        const hiddenInput = document.getElementById('prop-displayContent');
        
        if (!editorContainer || !hiddenInput) {
            console.warn('Display content editor elements not found');
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
            console.log('🔄 PREVIEW: Initializing conditional logic module');
            conditionalLogic.initializePreview();
            conditionalLogic.setupConditionalLogic();
        }
    }
    
    setupPreviewConditionalLogicListeners() {
        console.log('🔄 PREVIEW: Setting up conditional logic field listeners');
        
        const conditionalLogic = window.AppModules.conditionalLogic;
        if (!conditionalLogic) {
            console.warn('ConditionalLogic module not available');
            return;
        }
        
        // Find all form fields in the preview and add change listeners
        const formFields = document.querySelectorAll('#previewForm input, #previewForm select, #previewForm textarea');
        
        formFields.forEach(field => {
            const events = ['change', 'input', 'keyup'];
            
            events.forEach(eventType => {
                field.addEventListener(eventType, () => {
                    console.log('🔄 PREVIEW FIELD CHANGE: Field changed:', field.name || field.id, 'Value:', field.value);
                    conditionalLogic.handleFieldChange(field);
                });
            });
        });
        
        // Initial evaluation of all conditions
        console.log('🔄 PREVIEW: Performing initial conditional logic evaluation');
        conditionalLogic.evaluateAllConditions();
        
        console.log('🔄 PREVIEW: Conditional logic listeners setup complete');
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
        console.log('📋 Form loaded, fieldIdCounter set to:', this.fieldIdCounter);
        
        // Show form builder UI
        document.getElementById('buildingBlocks').style.display = 'block';
        document.getElementById('formActions').style.display = 'block';
        
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
        
        console.log('🔢 Calculated next field ID:', maxId + 1);
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
                console.error('Error loading Salesforce objects for page:', error);
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
                console.error('Error loading Salesforce objects for page:', error);
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
                console.error('Error loading Salesforce objects for page:', error);
            });
        }
    }

    // Property Tab Management
    switchPropertyTab(tabType) {
        console.log('switchPropertyTab called with:', tabType);
        
        // Update tab visual state
        document.querySelectorAll('.property-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const targetTab = document.querySelector(`[data-tab="${tabType}"]`);
        if (targetTab) {
            targetTab.classList.add('active');
            console.log('✅ Tab visual state updated for:', tabType);
        } else {
            console.error('❌ Tab not found:', tabType);
            return;
        }

        // Hide all property sections
        document.querySelectorAll('.property-section').forEach(section => {
            section.style.display = 'none';
        });
        console.log('🔧 All property sections hidden');

        // Show selected section and render content
        const section = document.getElementById(`${tabType}Properties`);
        if (section) {
            section.style.display = 'block';
            console.log('✅ Property section shown:', `${tabType}Properties`);
        } else {
            console.error('❌ Property section not found:', `${tabType}Properties`);
            return;
        }

        switch (tabType) {
            case 'form':
                console.log('📋 Showing form properties');
                this.showFormProperties();
                break;
            case 'page':
                console.log('📄 Showing page properties');
                this.showPageProperties();
                break;
            case 'field':
                console.log('🔧 Showing field properties');
                this.showFieldProperties();
                break;
            default:
                console.error('❌ Unknown tab type:', tabType);
        }
        
        console.log('🎉 switchPropertyTab completed for:', tabType);
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
            <div class="form-properties-container">
                <!-- General Settings Section -->
                <div class="property-section">
                    <div class="section-header">
                        <h3 class="section-title">📋 General Settings</h3>
                        <p class="section-description">Configure basic form information and metadata</p>
                    </div>
                    
                    <div class="property-group">
                        <label>Form Name</label>
                        <input type="text" id="form-name" value="${form.name || ''}" placeholder="Enter a descriptive form name (e.g., Contact Registration)">
                        <div class="help-text">This name is used for internal reference and form management</div>
                    </div>
                    
                    <div class="property-group">
                        <label>Form Description</label>
                        <textarea id="form-description" rows="3" placeholder="Brief description of what this form collects...">${form.description || ''}</textarea>
                        <div class="help-text">Optional description for documentation and form overview</div>
                    </div>
                </div>

                <!-- User Experience Section -->
                <div class="property-section">
                    <div class="section-header">
                        <h3 class="section-title">✨ User Experience</h3>
                        <p class="section-description">Customize how users interact with your form</p>
                    </div>
                    
                    <div class="property-group">
                        <label>Submit Button Text</label>
                        <input type="text" id="form-submit-text" value="${settings.submitButtonText || 'Submit'}" placeholder="Submit">
                        <div class="help-text">Text displayed on the final submission button</div>
                    </div>
                    
                    <div class="property-group">
                        <label>Success Message</label>
                        <textarea id="form-success-message" rows="3" placeholder="Thank you for your submission! We'll get back to you soon.">${settings.successMessage || ''}</textarea>
                        <div class="help-text">Message shown after successful form submission</div>
                    </div>
                    
                    <div class="property-group">
                        <label>Redirect URL <span class="optional-tag">Optional</span></label>
                        <input type="url" id="form-redirect-url" value="${settings.redirectUrl || ''}" placeholder="https://example.com/thank-you">
                        <div class="help-text">Redirect users to this URL after successful submission</div>
                    </div>
                </div>

                <!-- Appearance Section -->
                <div class="property-section">
                    <div class="section-header">
                        <h3 class="section-title">🎨 Appearance</h3>
                        <p class="section-description">Customize the visual appearance of your published form</p>
                    </div>
                    
                    <div class="property-group">
                        <label>Theme</label>
                        <div class="theme-selector">
                            <div class="theme-option ${settings.theme === 'light' || !settings.theme ? 'selected' : ''}" data-theme="light">
                                <div class="theme-preview light-preview"></div>
                                <span>Light</span>
                            </div>
                            <div class="theme-option ${settings.theme === 'dark' ? 'selected' : ''}" data-theme="dark">
                                <div class="theme-preview dark-preview"></div>
                                <span>Dark</span>
                            </div>
                        </div>
                        <select id="form-theme" style="display: none;">
                            <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Light</option>
                            <option value="dark" ${settings.theme === 'dark' ? 'selected' : ''}>Dark</option>
                        </select>
                    </div>
                    
                    <div class="property-group">
                        <label>Primary Color</label>
                        <div class="color-picker-wrapper">
                            <input type="text" id="form-primary-color" value="${settings.primaryColor || '#8b5cf6'}" placeholder="#8b5cf6">
                            <input type="color" class="color-picker" id="form-primary-color-picker" value="${settings.primaryColor || '#8b5cf6'}">
                        </div>
                        <div class="help-text">Main accent color used for buttons and interactive elements</div>
                    </div>
                    
                    <div class="property-group">
                        <label>Background Color</label>
                        <div class="color-picker-wrapper">
                            <input type="text" id="form-bg-color" value="${settings.backgroundColor || '#ffffff'}" placeholder="#ffffff">
                            <input type="color" class="color-picker" id="form-bg-color-picker" value="${settings.backgroundColor || '#ffffff'}">
                        </div>
                        <div class="help-text">Background color for the form container</div>
                    </div>
                </div>

                <!-- Advanced Section -->
                <div class="property-section">
                    <div class="section-header">
                        <h3 class="section-title">⚙️ Advanced Settings</h3>
                        <p class="section-description">Custom styling and advanced configuration options</p>
                    </div>
                    
                    <div class="property-group">
                        <label>Custom CSS <span class="optional-tag">Advanced</span></label>
                        <textarea id="form-custom-css" rows="6" placeholder="/* Enter custom CSS to override default styles */">${settings.customCSS || ''}</textarea>
                        <div class="help-text">Add custom CSS to further customize your form's appearance</div>
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
            { id: 'form-theme', event: 'change', handler: (e) => { this.updateFormSetting('theme', e.target.value); } },
            { id: 'form-primary-color', event: 'input', handler: (e) => { this.updateFormSetting('primaryColor', e.target.value); const picker = document.getElementById('form-primary-color-picker'); if (picker) picker.value = e.target.value; } },
            { id: 'form-primary-color-picker', event: 'input', handler: (e) => { this.updateFormSetting('primaryColor', e.target.value); const input = document.getElementById('form-primary-color'); if (input) input.value = e.target.value; } },
            { id: 'form-bg-color', event: 'input', handler: (e) => { this.updateFormSetting('backgroundColor', e.target.value); const picker = document.getElementById('form-bg-color-picker'); if (picker) picker.value = e.target.value; } },
            { id: 'form-bg-color-picker', event: 'input', handler: (e) => { this.updateFormSetting('backgroundColor', e.target.value); const input = document.getElementById('form-bg-color'); if (input) input.value = e.target.value; } },
            { id: 'form-custom-css', event: 'input', handler: (e) => { this.updateFormSetting('customCSS', e.target.value); } }
        ];

        elements.forEach(elConfig => {
            const element = document.getElementById(elConfig.id);
            if (element) {
                element.addEventListener(elConfig.event, elConfig.handler);
            }
        });
    }

    updateFormSetting(key, value) {
        if (!this.currentForm.settings) {
            this.currentForm.settings = {};
        }
        this.currentForm.settings[key] = value;
        this.markFormDirty();
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
        console.log(`Navigation config updated for ${buttonType}: ${property} = ${value}`);
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
        console.log('📄 showPageProperties called');
        const pageSection = document.getElementById('pageProperties');
        console.log('📄 pageSection element:', pageSection);
        
        const currentPage = this.getCurrentPage();
        console.log('📄 currentPage:', currentPage);

        if (!currentPage) {
            console.log('❌ No current page found');
            pageSection.innerHTML = '<p class="empty-state">Select a page to view properties</p>';
            return;
        }

        console.log('📄 Rendering page properties...');
        const renderedHTML = this.renderPageProperties(currentPage);
        console.log('📄 Rendered HTML length:', renderedHTML.length);
        pageSection.innerHTML = renderedHTML;

        console.log('📄 Attaching page property listeners...');
        // Attach listeners for page properties
        this.attachPagePropertyListeners(currentPage);

        console.log('📄 Loading Salesforce objects...');
        // Load Salesforce objects for mapping
        this.loadSalesforceObjectsForPage();
        
        console.log('✅ showPageProperties completed');
    }

    renderPageProperties(page) {
        const conditionalLogic = window.AppModules.conditionalLogic;
        const availableFields = this.getAvailableFieldsForPageConditions(page);
        const availableObjects = this.getAvailableSalesforceObjects();

        return `
            <div class="page-properties-container">
                <!-- Basic Page Settings -->
                <div class="property-section">
                    <div class="section-header">
                        <h3 class="section-title">📄 Basic Settings</h3>
                        <p class="section-description">Configure basic page information and display options</p>
                    </div>
                    
                    <div class="property-group">
                        <label>Page Name</label>
                        <input type="text" id="page-name" value="${page.name || ''}" 
                               placeholder="Enter page name (e.g., Contact Information)"
                               onchange="window.AppModules.formBuilder.updatePageProperty('name', this.value)">
                    </div>

                    <div class="property-group">
                        <label>Page Description</label>
                        <textarea id="page-description" rows="2" 
                                  placeholder="Optional description shown to users"
                                  onchange="window.AppModules.formBuilder.updatePageProperty('description', this.value)">${page.description || ''}</textarea>
                        <div class="help-text">Brief description displayed at the top of the page for users</div>
                    </div>
                </div>

                <!-- Salesforce Integration -->
                <div class="property-section">
                    <div class="section-header">
                        <h3 class="section-title">🔗 Salesforce Integration</h3>
                        <p class="section-description">Configure how this page interacts with Salesforce</p>
                    </div>

                    <div class="property-group">
                        <label>Salesforce Object</label>
                        <select id="page-salesforce-object" onchange="window.AppModules.formBuilder.updatePageProperty('salesforceObject', this.value)">
                            <option value="">Not Mapped</option>
                            ${availableObjects.map(obj => `
                                <option value="${obj.name}" ${page.salesforceObject === obj.name ? 'selected' : ''}>
                                    ${obj.label} (${obj.name})
                                </option>
                            `).join('')}
                        </select>
                        <div class="help-text">Select the Salesforce object this page will create/update</div>
                    </div>

                    <div class="property-group">
                        <label>Action Type</label>
                        <select id="page-action-type" onchange="window.AppModules.formBuilder.updatePageProperty('actionType', this.value)">
                            <option value="create" ${page.actionType === 'create' ? 'selected' : ''}>Create New Record</option>
                            <option value="update" ${page.actionType === 'update' ? 'selected' : ''}>Update Existing Record</option>
                            <option value="get" ${page.actionType === 'get' ? 'selected' : ''}>Get/Query Records</option>
                        </select>
                        <div class="help-text">Choose whether to create a new record or update an existing one</div>
                    </div>
                    
                    <div class="property-group" id="record-id-group" style="display: ${page.actionType === 'update' ? 'block' : 'none'};">
                        <label>Record ID Variable</label>
                        <select id="page-record-id-variable" 
                                onchange="window.AppModules.formBuilder.updatePageProperty('recordIdVariable', this.value)">
                            ${this.renderRecordIdVariableOptions(page.recordIdVariable)}
                        </select>
                        <div class="help-text">
                            Variable containing the Salesforce record ID to update (set by Login field, lookup field, or manually created)
                        </div>
                    </div>
                    
                    <div class="property-group" id="query-config-group" style="display: ${page.actionType === 'get' ? 'block' : 'none'};">
                        <label>Query Configuration</label>
                        <div class="query-builder">
                            <div class="query-fields-selection">
                                <label class="sub-label">Fields to Retrieve</label>
                                <div class="field-picker-container">
                                    <button type="button" id="query-fields-picker-btn" 
                                            class="button button-secondary field-picker-btn"
                                            onclick="window.AppModules.formBuilder.openQueryFieldsPicker()">
                                        📋 Select Fields (${(page.queryFields || '').split(',').filter(f => f.trim()).length} selected)
                                    </button>
                                    <div class="selected-fields-display" id="query-selected-fields">
                                        ${this.renderSelectedQueryFields(page.queryFields || '')}
                                    </div>
                                </div>
                                <textarea id="page-query-fields" 
                                          placeholder="Name, Email, Phone, Account.Name (comma-separated)"
                                          onchange="window.AppModules.formBuilder.updatePageProperty('queryFields', this.value)"
                                          rows="2" 
                                          style="display: none;">${page.queryFields || ''}</textarea>
                                <div class="help-text">Click "Select Fields" to choose from available Salesforce fields, or manually enter comma-separated field names</div>
                            </div>
                            
                            <div class="query-filters">
                                <label class="sub-label">Query Filters</label>
                                <div id="query-filters-list" class="query-filters-list">
                                    ${this.renderQueryFilters(page.queryFilters || [])}
                                </div>
                                <button type="button" class="add-condition-btn" onclick="window.AppModules.formBuilder.addQueryFilter()">
                                    ➕ Add Filter
                                </button>
                                <div class="help-text">Filter records based on form field values (e.g., Email equals field value)</div>
                            </div>
                            
                            <div class="query-options">
                                <div class="form-row">
                                    <div class="form-group">
                                        <label class="sub-label">WHERE Conditions</label>
                                        <div class="where-builder-container">
                                            <button type="button" id="where-builder-btn" 
                                                    class="button button-secondary where-builder-btn"
                                                    onclick="window.AppModules.formBuilder.openWhereBuilder()">
                                                🔍 Build WHERE Clause (${this.getWhereConditionCount(page.queryWhereConditions || [])} conditions)
                                            </button>
                                            <div class="where-conditions-display" id="where-conditions-display">
                                                ${this.renderWhereConditionsDisplay(page.queryWhereConditions || [])}
                                            </div>
                                        </div>
                                        <textarea id="page-query-where" 
                                                  placeholder="Name LIKE 'John%' OR Email = 'test@example.com'"
                                                  onchange="window.AppModules.formBuilder.updatePageProperty('queryWhere', this.value)"
                                                  rows="2" 
                                                  style="display: none;">${page.queryWhere || ''}</textarea>
                                        <div class="help-text">Click "Build WHERE Clause" to create conditions visually, or manually enter SOQL WHERE clause</div>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label class="sub-label">ORDER BY</label>
                                        <div class="order-by-container">
                                            <button type="button" id="order-by-picker-btn" 
                                                    class="button button-secondary order-by-btn"
                                                    onclick="window.AppModules.formBuilder.openOrderByPicker()">
                                                📊 Select Order (${this.getOrderByCount(page.queryOrderBy || '')} fields)
                                            </button>
                                            <div class="selected-order-display" id="order-selected-fields">
                                                ${this.renderSelectedOrderBy(page.queryOrderBy || '')}
                                            </div>
                                        </div>
                                        <input type="text" id="page-query-order" 
                                               placeholder="Name ASC, CreatedDate DESC"
                                               onchange="window.AppModules.formBuilder.updatePageProperty('queryOrderBy', this.value)"
                                               value="${page.queryOrderBy || ''}"
                                               style="display: none;">
                                        <div class="help-text">Click "Select Order" to choose fields and sort direction, or manually enter ORDER BY clause</div>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label class="sub-label">Record Limit</label>
                                        <input type="number" id="page-query-limit" 
                                               placeholder="100"
                                               min="1" max="2000"
                                               onchange="window.AppModules.formBuilder.updatePageProperty('queryLimit', parseInt(this.value))"
                                               value="${page.queryLimit || 100}">
                                        <div class="help-text">Maximum records to retrieve (1-2000, default 100)</div>
                                    </div>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-group">
                                        <label class="sub-label">Result Variable Name</label>
                                        <input type="text" id="page-result-variable" 
                                               placeholder="QueryResults (optional)"
                                               onchange="window.AppModules.formBuilder.updatePageProperty('resultVariable', this.value)"
                                               value="${page.resultVariable || ''}">
                                        <div class="help-text">Custom variable name for query results (optional)</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Page Conditional Visibility -->
                ${this.renderPageConditionalVisibilitySection(page, availableFields)}

                <!-- Navigation Button Controls -->
                ${this.renderNavigationButtonSection(page, availableFields)}

                <!-- Repeat Configuration -->
                ${this.renderRepeatConfigurationSection(page)}

                <!-- Hidden Fields -->
                ${this.renderHiddenFieldsSection(page)}

                <!-- Advanced Settings -->
                ${this.renderAdvancedSettingsSection(page)}
            </div>
        `;
    }

    // Helper method for Page Conditional Visibility Section
    renderPageConditionalVisibilitySection(page, availableFields) {
        return `
            <div class="property-section">
                <div class="section-header">
                    <h3 class="section-title">🔍 Page Conditional Visibility</h3>
                    <p class="section-description">Show or hide this entire page based on field values from previous pages</p>
                </div>
                
                <div class="property-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="page-conditional-enabled" ${page.conditionalVisibility?.enabled ? 'checked' : ''}
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
                console.log(`  ✅ PAGE CONDITIONS: Added variable "${id}" (${source})`);
            } else {
                const existing = variableMap.get(id);
                // Update label to show multiple sources if different
                if (existing.source !== source) {
                    existing.label = `${id} (${existing.source} + ${source})`;
                    console.log(`  🔄 PAGE CONDITIONS: Updated variable "${id}" to show multiple sources`);
                }
            }
        };
        
        // Get fields from all previous pages (pages before current page)
        for (let i = 0; i < currentPageIndex; i++) {
            const prevPage = this.currentForm.pages[i];
            prevPage.fields.forEach(field => {
                if (field.type !== 'display') {
                    addVariable(
                        field.id,
                        `${field.label} (${prevPage.name})`,
                        prevPage.name,
                        'Field'
                    );
                }
            });
        }
        
        // Add global variables
        console.log('🔍 PAGE CONDITIONS: Checking FormVariables availability...');
        if (window.FormVariables) {
            try {
                // Check if getAll method exists
                if (typeof window.FormVariables.getAll === 'function') {
                    const globalVars = window.FormVariables.getAll();
                    const varCount = Object.keys(globalVars).length;
                    console.log(`📊 PAGE CONDITIONS: Found ${varCount} global variables:`, globalVars);
                    
                    Object.entries(globalVars).forEach(([varName, value]) => {
                        addVariable(
                            varName,
                            `${varName} (${typeof value})`,
                            'Global Variables',
                            'Global'
                        );
                    });
                } else {
                    console.warn('⚠️ PAGE CONDITIONS: FormVariables.getAll method not available');
                    // Fallback: try to access the variables Map directly
                    if (window.FormVariables.variables && window.FormVariables.variables instanceof Map) {
                        console.log('🔄 PAGE CONDITIONS: Using direct Map access as fallback...');
                        window.FormVariables.variables.forEach((value, varName) => {
                            addVariable(
                                varName,
                                `${varName} (${typeof value})`,
                                'Global Variables',
                                'Global'
                            );
                        });
                    }
                }
            } catch (error) {
                console.warn('Error accessing FormVariables in getAvailableFieldsForPageConditions:', error);
            }
        } else {
            console.warn('⚠️ PAGE CONDITIONS: FormVariables not available');
        }
        
        // Add Login field variables from ALL pages
        console.log('🔍 PAGE CONDITIONS: Checking Login field variables...');
        this.currentForm.pages.forEach((formPage, pageIdx) => {
            formPage.fields.forEach(field => {
                if (field.type === 'login' && field.loginConfig && field.loginConfig.setVariables) {
                    console.log(`📝 PAGE CONDITIONS: Found login field "${field.label}" (${field.id}) with variables:`, Object.keys(field.loginConfig.setVariables));
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
        console.log('🔍 PAGE CONDITIONS: Checking field setVariablesConfig variables...');
        this.currentForm.pages.forEach((formPage, pageIdx) => {
            formPage.fields.forEach(field => {
                if (field.setVariablesConfig && field.setVariablesConfig.enabled && field.setVariablesConfig.setVariables) {
                    console.log(`📝 PAGE CONDITIONS: Found field "${field.label}" (${field.id}) with setVariablesConfig:`, Object.keys(field.setVariablesConfig.setVariables));
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
        console.log('🔍 PAGE CONDITIONS: Checking Email Verify field variables...');
        this.currentForm.pages.forEach((formPage, pageIdx) => {
            formPage.fields.forEach(field => {
                if (field.type === 'email-verify' && field.verifyConfig && field.verifyConfig.setVariables) {
                    console.log(`📝 PAGE CONDITIONS: Found email verify field "${field.label}" (${field.id}) with variables:`, Object.keys(field.verifyConfig.setVariables));
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
        console.log(`🔍 PAGE CONDITIONS: Found ${variableMap.size} unique variables total`);
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
                    console.log(`Created new RecordId variable: ${varName}`);
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
        // Page Name
        document.getElementById('page-name').addEventListener('input', (e) => {
            this.updatePageProperty('name', e.target.value);
        });

        // Salesforce Object
        document.getElementById('page-salesforce-object').addEventListener('change', (e) => {
            this.updatePageProperty('salesforceObject', e.target.value);
        });

        // Action Type
        document.getElementById('page-action-type').addEventListener('change', (e) => {
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

        // Page Conditional Visibility Toggle
        document.getElementById('page-conditional-enabled').addEventListener('change', (e) => {
            this.togglePageConditionalVisibility(e.target.checked);
        });

        // Page Conditional Logic (AND/OR)
        const pageConditionLogic = document.getElementById('page-condition-logic');
        if (pageConditionLogic) {
            pageConditionLogic.addEventListener('change', (e) => {
                this.updatePageConditionalProperty('logic', e.target.value);
            });
        }

        // Page Navigation Button Conditional Visibility Toggles
        document.getElementById('page-next-btn-conditional').addEventListener('change', (e) => {
            this.togglePageNavigationButtonConditionalVisibility('next', e.target.checked);
        });
        document.getElementById('page-submit-btn-conditional').addEventListener('change', (e) => {
            this.togglePageNavigationButtonConditionalVisibility('submit', e.target.checked);
        });

        // Page Navigation Button Conditional Logic (AND/OR)
        const pageNextConditionLogic = document.getElementById('page-next-condition-logic');
        if (pageNextConditionLogic) {
            pageNextConditionLogic.addEventListener('change', (e) => {
                this.updatePageNavigationButtonConditionalProperty('next', 'logic', e.target.value);
            });
        }
        const pageSubmitConditionLogic = document.getElementById('page-submit-condition-logic');
        if (pageSubmitConditionLogic) {
            pageSubmitConditionLogic.addEventListener('change', (e) => {
                this.updatePageNavigationButtonConditionalProperty('submit', 'logic', e.target.value);
            });
        }
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
            console.error('No current page found for adding condition');
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
            console.error('No current page found for removing condition');
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
            console.error('No current page found for updating condition');
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
            console.error('No current page found for navigation button conditional visibility');
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
            console.error('No current page found for navigation button property update');
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
            console.error('No current page found for adding navigation button condition');
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

        // Get fields from current page (excluding the current field)
        currentPage.fields.forEach(field => {
            if (field.id !== excludeField.id && field.type !== 'display') {
                fields.push({
                    id: field.id,
                    label: field.label,
                    page: currentPage.name
                });
            }
        });

        // Get fields from previous pages
        const currentPageIndex = form.pages.indexOf(currentPage);
        for (let i = 0; i < currentPageIndex; i++) {
            const page = form.pages[i];
            page.fields.forEach(field => {
                if (field.type !== 'display') {
                    fields.push({
                        id: field.id,
                        label: `${field.label} (${page.name})`,
                        page: page.name
                    });
                }
            });
        }

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
                    document.getElementById('field-mapping-section').style.display = 'none';
                }
            }
        });

        // Action type selection
        document.getElementById('page-action-type').addEventListener('change', (e) => {
            const currentPage = this.getCurrentPage();
            if (currentPage) {
                currentPage.actionType = e.target.value;
                this.markFormDirty();
                console.log(`Page action type changed to: ${e.target.value}`);
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
                    document.getElementById('parent-field-section').style.display = 'block';
                } else {
                    document.getElementById('parent-field-section').style.display = 'none';
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
                document.getElementById('page-conditional-options').style.display = e.target.checked ? 'block' : 'none';
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
                document.getElementById('page-conditional-value-group').style.display = this.needsValueInput(e.target.value) ? 'block' : 'none';
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
                document.getElementById('repeat-options').style.display = e.target.checked ? 'block' : 'none';
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
            console.warn('page-parent-page element not found, skipping loadParentPages');
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
        if (currentPage && currentPage.parentPageId) {
            this.loadParentFields(currentPage.parentPageId);
            document.getElementById('parent-field-section').style.display = 'block';
        } else {
            document.getElementById('parent-field-section').style.display = 'none';
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
                            console.log(`Auto-selected relationship field: ${autoSelectedField.name} for ${currentPage.salesforceObject} → ${parentObjectName}`);
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
            console.warn('page-conditional-depends-page element not found, skipping loadConditionalPages');
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
        
        console.log('Started dragging page:', this.draggedPageIndex);
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
        
        console.log('Dropped page at index:', targetIndex);
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
        
        console.log('Drag operation completed and cleaned up');
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
        
        console.log(`Reordered page from index ${fromIndex} to ${toIndex}`);
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
            
            console.log(`✅ Loaded ${relationshipFields.length} relationship fields for ${currentPage.salesforceObject}`);
            
        } catch (error) {
            console.error('Error loading relationship fields:', error);
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
        
        console.log(`✅ Set up ${buttonType} button to require login on page "${currentPage.name}"`);
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

        console.log(`✅ Added variable: ${name} = ${JSON.stringify(parsedValue)}`);
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
            console.log(`✏️ Updated variable: ${name} = ${JSON.stringify(parsedValue)}`);
        }
    }

    deleteVariable(name) {
        if (confirm(`Are you sure you want to delete the variable "${name}"?`)) {
            window.FormVariables.variables.delete(name);
            this.refreshVariablesList();
            console.log(`🗑️ Deleted variable: ${name}`);
        }
    }

    debugConsole() {
        console.log('🔧 VARIABLES MANAGER DEBUG:');
        console.log('===========================');
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

        console.log('💾 Variables exported:', variables);
        alert('Variables exported as JSON file!');
    }

    clearAllVariables() {
        if (confirm('Are you sure you want to clear ALL variables? This cannot be undone.')) {
            window.FormVariables.clear();
            this.refreshVariablesList();
            console.log('🗑️ All variables cleared');
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
            console.error('Error loading fields:', error);
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
            console.error('Error loading fields:', error);
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
            console.error('Error loading fields:', error);
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
        console.log('🔍 Initializing Salesforce Record Browser...');
        
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

            console.log(`✅ Loaded ${objects.length} Salesforce objects for browser`);
            
        } catch (error) {
            console.error('❌ Error loading Salesforce objects for browser:', error);
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
            
            console.log(`✅ Loaded ${importantFields.length} fields for ${selectedObject}`);
            
        } catch (error) {
            console.error('❌ Error loading object fields:', error);
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
            console.error('❌ Error searching Salesforce records:', error);
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
            console.log('✅ Salesforce records imported:', { totalVariables, records: selectedCheckboxes.length });

            // Clear selection
            this.clearSalesforceSelection();
            
        } catch (error) {
            console.error('❌ Error importing Salesforce records:', error);
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
        
        // Refresh properties UI when sourcePageId changes to show field selection
        if (property === 'sourcePageId') {
            setTimeout(() => {
                this.showFieldProperties();
            }, 100);
        }
        
        this.renderFormCanvas();
        this.markFormDirty();
        console.log(`Updated DataTable config ${property}:`, value);
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
        console.log('Added new DataTable column:', newColumn);
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
            console.log('Removed DataTable column at index:', columnIndex);
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
        console.log(`Updated DataTable column ${columnIndex} ${property}:`, value);
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
        console.log(`Updated DataTable column ${columnIndex} options:`, options);
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
        
        console.log(`Created ${newColumns.length} columns from selected fields:`, newColumns.map(col => col.field));
        
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
        console.log(`Updated Section config ${property}:`, value);
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
        console.log(`Updated Columns config ${property}:`, value);
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
        console.log(`Updated column count to ${count}`);
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
            console.log(`Updated column ${columnIndex} width to ${width}`);
        }
    }
}