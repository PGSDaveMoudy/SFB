// ConditionalLogic Module - Handles conditional field visibility and logic

export class ConditionalLogic {
    constructor() {
        this.conditions = new Map();
        this.fieldValues = new Map();
        this.pageConditions = new Map();
    }
    
    async initialize() {
        console.log('Initializing ConditionalLogic module...');
        this.setupEventListeners();
        this.setupVariableChangeListener();
    }
    
    setupEventListeners() {
        // Listen for field value changes
        document.addEventListener('input', (e) => {
            if (e.target.matches('input, select, textarea')) {
                this.handleFieldChange(e.target);
            }
        });
        
        document.addEventListener('change', (e) => {
            if (e.target.matches('input[type="checkbox"], input[type="radio"]')) {
                this.handleFieldChange(e.target);
            }
        });
        
        // Listen for form rendering to setup conditional logic
        document.addEventListener('formRendered', () => {
            this.setupConditionalLogic();
        });
        
        // Listen for page changes
        document.addEventListener('pageChanged', (e) => {
            this.evaluatePageConditions(e.detail.pageIndex);
        });
    }
    
    setupVariableChangeListener() {
        // Listen for variable changes via custom events for additional reactivity
        document.addEventListener('variableChanged', (e) => {
            const { name, newValue, oldValue } = e.detail;
            console.log(`🔄 REACTIVE: Variable change detected via event - "${name}": "${oldValue}" -> "${newValue}"`);
            
            // This provides an additional layer of reactivity beyond the automatic triggering
            // in FormVariables.set() - useful for modules that need immediate notification
        });
        
        console.log('🔄 REACTIVE: Variable change listener setup complete');
    }
    
    setupConditionalLogic() {
        // Clear existing conditions
        this.conditions.clear();
        this.fieldValues.clear();
        
        // Get current form configuration from either builder or viewer
        const formBuilder = window.AppModules.formBuilder;
        const formViewer = window.AppModules.formViewer;
        
        let currentForm = null;
        if (formBuilder) {
            currentForm = formBuilder.getFormData();
        } else if (formViewer && formViewer.formData) {
            currentForm = formViewer.formData;
        }
        
        if (!currentForm) {
            console.warn('No form data available for conditional logic setup');
            return;
        }
        
        console.log('🔄 CONDITIONAL: Setting up conditional logic for form:', currentForm.name || 'Untitled');
        
        // Setup field-level conditional logic
        currentForm.pages.forEach((page, pageIndex) => {
            page.fields.forEach(field => {
                if (field.conditionalVisibility?.enabled) {
                    this.registerFieldCondition(field, pageIndex);
                }
            });
            
            // Setup page-level conditional logic
            if (page.conditionalVisibility?.enabled) {
                this.registerPageCondition(page, pageIndex);
            }
        });
        
        // Initial evaluation
        this.evaluateAllConditions();
    }
    
    registerFieldCondition(field, pageIndex) {
        const condition = {
            fieldId: field.id,
            pageIndex: pageIndex,
            dependsOn: field.conditionalVisibility.dependsOn,
            condition: field.conditionalVisibility.condition,
            value: field.conditionalVisibility.value,
            dependsOnPage: field.conditionalVisibility.dependsOnPage || pageIndex
        };
        
        this.conditions.set(field.id, condition);
    }
    
    registerPageCondition(page, pageIndex) {
        // Page conditional visibility can now have multiple conditions
        const conditions = page.conditionalVisibility.conditions || [];
        const logic = page.conditionalVisibility.logic || 'AND'; // Default to AND

        this.pageConditions.set(page.id, {
            pageId: page.id,
            pageIndex: pageIndex,
            conditions: conditions,
            logic: logic
        });
    }

    handleFieldChange(field) {
        const fieldId = field.name || field.id;
        const value = this.getFieldValue(field);

        // Store field value
        this.fieldValues.set(fieldId, value);

        // Handle variable setting for fields that have setVariablesConfig
        this.handleFieldVariableSetting(fieldId, value);

        // Evaluate conditions that depend on this field
        this.evaluateConditionsForField(fieldId);

        // Trigger auto-save if available
        const autoSave = window.AppModules.autoSave;
        if (autoSave) {
            autoSave.scheduleAutoSave();
        }
    }

    getFieldValue(field) {
        switch (field.type) {
            case 'checkbox':
                return field.checked;
            case 'radio':
                return field.checked ? field.value : null;
            case 'select':
                return field.value;
            default:
                return field.value;
        }
    }

    evaluateConditionsForField(changedFieldId) {
        // Evaluate field conditions
        for (const [fieldId, condition] of this.conditions) {
            if (condition.dependsOn === changedFieldId) {
                this.evaluateFieldCondition(fieldId, condition);
            }
        }

        // Evaluate page conditions
        for (const [pageId, pageConditionConfig] of this.pageConditions) {
            // Check if any of the page's conditions depend on the changed field
            const dependsOnChangedField = pageConditionConfig.conditions.some(cond => cond.dependsOn === changedFieldId);
            if (dependsOnChangedField) {
                this.evaluatePageCondition(pageId, pageConditionConfig);
            }
        }
        
        // Update navigation button visibility when field changes
        const multiPage = window.AppModules?.multiPage;
        if (multiPage) {
            multiPage.updateNavigationButtons();
        }
    }

    evaluateAllConditions() {
        // Evaluate all field conditions
        for (const [fieldId, condition] of this.conditions) {
            this.evaluateFieldCondition(fieldId, condition);
        }

        // Evaluate all page conditions
        for (const [pageId, pageConditionConfig] of this.pageConditions) {
            this.evaluatePageCondition(pageId, pageConditionConfig);
        }
    }

    evaluateFieldCondition(fieldId, condition) {
        const dependentValue = this.fieldValues.get(condition.dependsOn);
        const shouldShow = this.evaluateSingleCondition(dependentValue, condition.condition, condition.value);

        this.setFieldVisibility(fieldId, shouldShow);
    }

    evaluatePageCondition(pageId, pageConditionConfig) {
        const { conditions, logic } = pageConditionConfig;
        let shouldShow = true; // Default for AND logic

        console.group(`🔍 Page Visibility Evaluation for ${pageId} (Logic: ${logic})`);

        if (conditions.length === 0) {
            console.log('No conditions defined, page is visible.');
            shouldShow = true;
        } else {
            const results = conditions.map(condition => {
                let dependentValue = null;

                // PRIORITY 1: Check global variables first
                if (window.FormVariables?.has(condition.dependsOn)) {
                    dependentValue = window.FormVariables.get(condition.dependsOn);
                }

                // PRIORITY 2: Check field values as fallback
                if (dependentValue === null || dependentValue === undefined) {
                    dependentValue = this.fieldValues.get(condition.dependsOn);
                }

                // PRIORITY 3: Check multiPage module as final fallback
                if (dependentValue === null || dependentValue === undefined) {
                    const multiPage = window.AppModules.multiPage;
                    if (multiPage) {
                        dependentValue = multiPage.getVariable(condition.dependsOn);
                    }
                }

                // Check if this is a Login variable (format: fieldId_variableName)
                if (!dependentValue && condition.dependsOn.includes('_')) {
                    const flowLogic = window.AppModules.flowLogic;
                    if (flowLogic) {
                        const flowState = flowLogic.getFlowState(condition.dependsOn);
                        if (flowState && flowState.state === 'variable_set') {
                            dependentValue = flowState.data.value;
                        } else if (flowState && flowState.state === 'login_complete') {
                            dependentValue = 'true';
                        }
                    }
                }

                const result = this.evaluateSingleCondition(dependentValue, condition.condition, condition.value);
                console.log(`  Condition: ${condition.dependsOn} ${condition.condition} ${condition.value} -> Value: ${dependentValue} -> Result: ${result}`);
                return result;
            });

            if (logic === 'AND') {
                shouldShow = results.every(res => res === true);
            } else if (logic === 'OR') {
                shouldShow = results.some(res => res === true);
            }
        }

        console.log(`🎯 Final Result for Page ${pageId}: ${shouldShow ? 'SHOW' : 'HIDE'}`);
        console.groupEnd();

        this.setPageVisibility(pageId, shouldShow);
    }

    evaluateSingleCondition(fieldValue, conditionType, targetValue) {
        // Handle null/undefined values
        if (fieldValue === null || fieldValue === undefined) {
            fieldValue = '';
        }

        switch (conditionType) {
            case 'equals':
                return String(fieldValue).toLowerCase() === String(targetValue).toLowerCase();

            case 'not_equals':
                return String(fieldValue).toLowerCase() !== String(targetValue).toLowerCase();

            case 'contains':
                return String(fieldValue).toLowerCase().includes(String(targetValue).toLowerCase());

            case 'not_contains':
                return !String(fieldValue).toLowerCase().includes(String(targetValue).toLowerCase());

            case 'starts_with':
                return String(fieldValue).toLowerCase().startsWith(String(targetValue).toLowerCase());

            case 'ends_with':
                return String(fieldValue).toLowerCase().endsWith(String(targetValue).toLowerCase());

            case 'is_empty':
                return fieldValue === '' || fieldValue === null || fieldValue === undefined;

            case 'is_not_empty':
                return fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;

            case 'greater_than':
                return Number(fieldValue) > Number(targetValue);

            case 'less_than':
                return Number(fieldValue) < Number(targetValue);

            case 'greater_equal':
                return Number(fieldValue) >= Number(targetValue);

            case 'less_equal':
                return Number(fieldValue) <= Number(targetValue);

            default:
                return false;
        }
    }

    // New method to evaluate a set of conditions (for pages and navigation buttons)
    evaluateConditionSet(conditions, logic) {
        if (!conditions || conditions.length === 0) {
            return true; // No conditions means always visible
        }

        const results = conditions.map(condition => {
            let dependentValue = null;

            // PRIORITY 1: Check global variables first
            if (window.FormVariables?.has(condition.dependsOn)) {
                dependentValue = window.FormVariables.get(condition.dependsOn);
            }

            // PRIORITY 2: Check field values as fallback
            if (dependentValue === null || dependentValue === undefined) {
                dependentValue = this.fieldValues.get(condition.dependsOn);
            }

            // PRIORITY 3: Check multiPage module as final fallback
            if (dependentValue === null || dependentValue === undefined) {
                const multiPage = window.AppModules.multiPage;
                if (multiPage) {
                    dependentValue = multiPage.getVariable(condition.dependsOn);
                }
            }

            // Check if this is a Login variable (format: fieldId_variableName)
            if (!dependentValue && condition.dependsOn.includes('_')) {
                const flowLogic = window.AppModules.flowLogic;
                if (flowLogic) {
                    const flowState = flowLogic.getFlowState(condition.dependsOn);
                    if (flowState && flowState.state === 'variable_set') {
                        dependentValue = flowState.data.value;
                    } else if (flowState && flowState.state === 'login_complete') {
                        dependentValue = 'true';
                    }
                }
            }
            return this.evaluateSingleCondition(dependentValue, condition.condition, condition.value);
        });

        if (logic === 'AND') {
            return results.every(res => res === true);
        } else if (logic === 'OR') {
            return results.some(res => res === true);
        }
        return false; // Should not happen
    }

    setFieldVisibility(fieldId, visible) {
        const fieldElement = document.querySelector(`[data-field-id="${fieldId}"]`);
        
        // Only apply actual visibility in form viewer, not form builder
        const isFormBuilder = document.getElementById('formCanvas') !== null && 
                              window.AppModules.formBuilder !== undefined;

        if (fieldElement) {
            if (isFormBuilder) {
                // In form builder, just add/remove visual indicators
                if (visible) {
                    fieldElement.classList.remove('conditionally-hidden');
                } else {
                    fieldElement.classList.add('conditionally-hidden');
                }
            } else {
                // In form viewer, actually hide/show the field
                if (visible) {
                    fieldElement.style.display = '';
                    fieldElement.classList.remove('conditionally-hidden');

                    // Re-enable form controls
                    const controls = fieldElement.querySelectorAll('input, select, textarea');
                    controls.forEach(control => {
                        control.disabled = false;
                    });
                } else {
                    fieldElement.style.display = 'none';
                    fieldElement.classList.add('conditionally-hidden');

                    // Disable form controls to prevent submission
                    const controls = fieldElement.querySelectorAll('input, select, textarea');
                    controls.forEach(control => {
                        control.disabled = true;
                    });
                }
            }
        }
    }

    setPageVisibility(pageId, visible) {
        const multiPage = window.AppModules.multiPage;
        if (multiPage) {
            multiPage.setPageVisibility(pageId, visible);
        }
    }

    // Method to render conditional configuration UI
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

        // Use a Map to track variables and their sources to avoid duplicates
        const variableMap = new Map();
        
        // Helper function to add variable to map with source tracking
        const addVariable = (id, label, page, source) => {
            if (!variableMap.has(id)) {
                variableMap.set(id, { id, label, page, source });
                console.log(`  ✅ FIELD CONDITIONS: Added variable "${id}" (${source})`);
            } else {
                const existing = variableMap.get(id);
                // Update label to show multiple sources if different
                if (existing.source !== source) {
                    existing.label = `${id} (${existing.source} + ${source})`;
                    console.log(`  🔄 FIELD CONDITIONS: Updated variable "${id}" to show multiple sources`);
                }
            }
        };

        // Add global variables from FormVariables system
        console.log('🔍 FIELD CONDITIONS: Checking FormVariables availability...');
        if (window.FormVariables) {
            try {
                if (typeof window.FormVariables.getAll === 'function') {
                    const globalVars = window.FormVariables.getAll();
                    const varCount = Object.keys(globalVars).length;
                    console.log(`📊 FIELD CONDITIONS: Found ${varCount} global variables:`, globalVars);
                    
                    Object.keys(globalVars).forEach(varName => {
                        const value = globalVars[varName];
                        addVariable(
                            varName, 
                            `${varName} (${typeof value})`, 
                            'Global Variables',
                            'Global'
                        );
                    });
                } else {
                    console.warn('⚠️ FIELD CONDITIONS: FormVariables.getAll method not available');
                }
            } catch (error) {
                console.warn('Error accessing FormVariables in getAvailableFields:', error);
            }
        } else {
            console.warn('⚠️ FIELD CONDITIONS: FormVariables not available');
        }

        // Add Login field variables from ALL pages (not just previous pages)
        console.log('🔍 FIELD CONDITIONS: Checking Login field variables...');
        form.pages.forEach((page, pageIndex) => {
            page.fields.forEach(field => {
                if (field.type === 'login' && field.loginConfig && field.loginConfig.setVariables) {
                    console.log(`📝 FIELD CONDITIONS: Found login field "${field.label}" (${field.id}) with variables:`, Object.keys(field.loginConfig.setVariables));
                    Object.keys(field.loginConfig.setVariables).forEach(varName => {
                        // Only add the simple variable name (stored in FormVariables) - no field-specific duplicates
                        addVariable(
                            varName,
                            `${varName} (Login)`,
                            page.name,
                            'Login'
                        );
                    });
                    
                    // Add login completion variable (field-specific)
                    const loginCompleteVar = `${field.id}_loginComplete`;
                    addVariable(
                        loginCompleteVar,
                        `${loginCompleteVar} (Login Status)`,
                        page.name,
                        'Login Status'
                    );
                }
            });
        });

        // Add field setVariablesConfig variables
        console.log('🔍 FIELD CONDITIONS: Checking field setVariablesConfig variables...');
        form.pages.forEach((page, pageIndex) => {
            page.fields.forEach(field => {
                if (field.setVariablesConfig && field.setVariablesConfig.setVariables) {
                    console.log(`📝 FIELD CONDITIONS: Found field "${field.label}" (${field.id}) with setVariablesConfig:`, Object.keys(field.setVariablesConfig.setVariables));
                    Object.keys(field.setVariablesConfig.setVariables).forEach(varName => {
                        addVariable(
                            varName,
                            `${varName} (Field: ${field.label})`,
                            page.name,
                            'Field'
                        );
                    });
                }
            });
        });

        // Add Email Verify field variables
        console.log('🔍 FIELD CONDITIONS: Checking Email Verify field variables...');
        form.pages.forEach((page, pageIndex) => {
            page.fields.forEach(field => {
                if (field.type === 'email-verify' && field.verifyConfig && field.verifyConfig.setVariables) {
                    console.log(`📝 FIELD CONDITIONS: Found email verify field "${field.label}" (${field.id}) with variables:`, Object.keys(field.verifyConfig.setVariables));
                    Object.keys(field.verifyConfig.setVariables).forEach(varName => {
                        addVariable(
                            varName,
                            `${varName} (Email Verify)`,
                            page.name,
                            'Email Verify'
                        );
                    });
                }
            });
        });

        // Convert variableMap back to fields array
        console.log(`🔍 FIELD CONDITIONS: Found ${variableMap.size} unique variables total`);
        variableMap.forEach(variable => {
            fields.push(variable);
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
        console.log('🔄 CONDITIONAL: Initializing preview mode');
        
        // Get all form fields and setup value tracking
        const formFields = document.querySelectorAll('input, select, textarea');
        console.log(`🔄 CONDITIONAL: Found ${formFields.length} form fields`);

        formFields.forEach(field => {
            const fieldId = field.name || field.id;
            const initialValue = this.getFieldValue(field);
            this.fieldValues.set(fieldId, initialValue);
            console.log(`🔄 CONDITIONAL: Set initial value for ${fieldId}:`, initialValue);

            // Add event listeners
            field.addEventListener('input', (e) => this.handleFieldChange(e.target));
            field.addEventListener('change', (e) => this.handleFieldChange(e.target));
        });

        // Don't call setupConditionalLogic here - it will be called separately
        console.log('🔄 CONDITIONAL: Preview initialization complete');
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
    
    // Method to evaluate a condition group (for navigation buttons)
    evaluateConditionGroup(conditionGroup) {
        if (!conditionGroup || !conditionGroup.conditions || conditionGroup.conditions.length === 0) {
            return true; // Show by default if no conditions
        }
        
        console.log('🔄 CONDITIONAL: Evaluating condition group:', conditionGroup);
        
        const results = conditionGroup.conditions.map(condition => {
            // Get field value using the same priority system as other evaluation methods
            let dependentValue = null;
            
            // PRIORITY 1: Check global variables first
            if (window.FormVariables?.has(condition.dependsOn)) {
                dependentValue = window.FormVariables.get(condition.dependsOn);
            }
            
            // PRIORITY 2: Check field values as fallback
            if (dependentValue === null || dependentValue === undefined) {
                dependentValue = this.fieldValues.get(condition.dependsOn);
            }
            
            // PRIORITY 3: Check multiPage module as final fallback
            if (dependentValue === null || dependentValue === undefined) {
                const multiPage = window.AppModules.multiPage;
                if (multiPage) {
                    dependentValue = multiPage.getVariable(condition.dependsOn);
                }
            }
            
            // Check if this is a Login variable (format: fieldId_variableName)
            if (!dependentValue && condition.dependsOn.includes('_')) {
                const flowLogic = window.AppModules.flowLogic;
                if (flowLogic) {
                    const flowState = flowLogic.getFlowState(condition.dependsOn);
                    if (flowState && flowState.state === 'variable_set') {
                        dependentValue = flowState.data.value;
                    } else if (flowState && flowState.state === 'login_complete') {
                        dependentValue = 'true';
                    }
                }
            }
            
            const result = this.evaluateSingleCondition(dependentValue, condition.condition, condition.value);
            
            console.log(`  Condition: ${condition.dependsOn} ${condition.condition} ${condition.value} -> Value: ${dependentValue} -> Result: ${result}`);
            return result;
        });
        
        let finalResult;
        if (conditionGroup.logic === 'AND') {
            finalResult = results.every(res => res === true);
        } else if (conditionGroup.logic === 'OR') {
            finalResult = results.some(res => res === true);
        } else {
            finalResult = results.length > 0 ? results[0] : true;
        }
        
        console.log('🔄 CONDITIONAL: Condition group result:', finalResult);
        return finalResult;
    }
    
    // Method to handle field variable setting
    handleFieldVariableSetting(fieldId, value) {
        // Get current form configuration from either builder or viewer
        const formBuilder = window.AppModules.formBuilder;
        const formViewer = window.AppModules.formViewer;
        
        let currentForm = null;
        if (formBuilder) {
            currentForm = formBuilder.getFormData();
        } else if (formViewer && formViewer.formData) {
            currentForm = formViewer.formData;
        }
        
        if (!currentForm) {
            return; // No form data available
        }
        
        // Find the field configuration that matches this fieldId
        let fieldConfig = null;
        currentForm.pages.forEach(page => {
            page.fields.forEach(field => {
                if (field.id === fieldId && field.setVariablesConfig?.enabled) {
                    fieldConfig = field;
                }
            });
        });
        
        if (!fieldConfig || !fieldConfig.setVariablesConfig?.setVariables) {
            return; // No variable configuration found
        }
        
        console.log(`🔧 VARIABLES: Processing field "${fieldId}" value change:`, value);
        console.log(`🔧 VARIABLES: Field has variable config:`, fieldConfig.setVariablesConfig.setVariables);
        
        // Collect all variables to set for batched processing
        const variablesToSet = {};
        
        // Process each variable in the configuration
        Object.entries(fieldConfig.setVariablesConfig.setVariables).forEach(([varName, varTemplate]) => {
            let finalValue = varTemplate;
            
            // Handle template variables like {value}
            if (typeof varTemplate === 'string') {
                finalValue = varTemplate.replace(/\{value\}/g, value || '');
                
                // Handle other template variables if needed
                finalValue = finalValue.replace(/\{fieldId\}/g, fieldId);
                finalValue = finalValue.replace(/\{timestamp\}/g, new Date().toISOString());
            }
            
            variablesToSet[varName] = finalValue;
            console.log(`🔧 VARIABLES: Prepared variable "${varName}" = "${finalValue}"`);
            
            // Also set in multiPage for compatibility
            const multiPage = window.AppModules.multiPage;
            if (multiPage) {
                multiPage.setVariable(varName, finalValue);
            }
        });
        
        // Set all variables at once using the new batching system
        if (window.FormVariables && Object.keys(variablesToSet).length > 0) {
            console.log(`🔧 VARIABLES: Setting ${Object.keys(variablesToSet).length} variables via batching system`);
            
            if (window.FormVariables.setMultiple) {
                // Use the new batched setting method for better performance
                window.FormVariables.setMultiple(variablesToSet);
            } else {
                // Fallback for older systems
                Object.entries(variablesToSet).forEach(([varName, finalValue]) => {
                    window.FormVariables.set(varName, finalValue);
                });
            }
        }
    }
}