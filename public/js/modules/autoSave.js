// AutoSave Module - Handles automatic saving of form data and user progress

export class AutoSave {
    constructor() {
        this.autoSaveInterval = 3000; // 3 seconds - reduced from 500ms to prevent server overload
        this.debounceTimer = null;
        this.enabled = true;
        this.storageKey = 'sfb_autosave_';
        this.formDataKey = 'sfb_form_data';
        this.userProgressKey = 'sfb_user_progress';
        this.lastSaveTime = null;
    }
    
    async initialize() {
        console.log('Initializing AutoSave module...');
        this.setupEventListeners();
        this.checkRestorationNeeded();
        this.startPeriodicSave();
    }
    
    setupEventListeners() {
        // Listen for form builder changes
        document.addEventListener('formChanged', () => {
            this.scheduleAutoSave('builder');
        });
        
        // Listen for user input in published forms
        document.addEventListener('input', (e) => {
            if (this.isPublishedForm()) {
                this.scheduleAutoSave('user');
            }
        });
        
        document.addEventListener('change', (e) => {
            if (this.isPublishedForm()) {
                this.scheduleAutoSave('user');
            }
        });
        
        // Listen for page navigation in multi-page forms
        document.addEventListener('pageChanged', (e) => {
            if (this.isPublishedForm()) {
                this.saveUserProgress();
            }
        });
        
        // Clear auto-save data on successful form submission
        document.addEventListener('formSubmitted', () => {
            this.clearUserData();
        });
        
        // Handle window beforeunload
        window.addEventListener('beforeunload', () => {
            this.saveImmediately();
        });
        
        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.saveImmediately();
            }
        });
    }
    
    scheduleAutoSave(type = 'builder') {
        if (!this.enabled) return;
        
        // Clear existing timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        // Schedule new save with debouncing
        this.debounceTimer = setTimeout(() => {
            if (type === 'builder') {
                this.saveBuilderData();
            } else {
                this.saveUserData();
            }
        }, this.autoSaveInterval);
    }
    
    async saveBuilderData() {
        try {
            const formBuilder = window.AppModules.formBuilder;
            if (!formBuilder) return;
            
            const formData = formBuilder.getFormData();
            
            // Don't auto-save if the form is empty or has no title
            if (!formData.title && (!formData.pages || formData.pages.length === 0 || formData.pages[0].fields.length === 0)) {
                return;
            }
            
            // Send to server as draft
            const response = await fetch('/api/save-draft', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });
            
            if (response.ok) {
                const result = await response.json();
                // Update the form ID if it was a new draft
                if (result.draftId && !formData.id) {
                    formBuilder.currentForm.id = result.draftId;
                }
                
                this.lastSaveTime = new Date().toISOString();
                this.showAutoSaveIndicator('Draft saved to My Forms');
                console.log('Auto-saved draft to server:', result.draftId);
            } else {
                console.error('Failed to save draft:', response.status);
            }
        } catch (error) {
            console.error('Error auto-saving builder data:', error);
        }
    }
    
    async saveUserData() {
        if (!this.isPublishedForm()) return;
        
        try {
            const formData = this.collectUserFormData();
            const formId = this.getFormId();
            const timestamp = new Date().toISOString();
            
            const saveData = {
                formId,
                formData,
                timestamp,
                type: 'user',
                currentPage: this.getCurrentPageIndex(),
                version: '1.0'
            };
            
            localStorage.setItem(this.storageKey + 'user_' + formId, JSON.stringify(saveData));
            this.lastSaveTime = timestamp;
            
            this.showAutoSaveIndicator('Progress saved');
            console.log('Auto-saved user data for form:', formId);
        } catch (error) {
            console.error('Error auto-saving user data:', error);
        }
    }
    
    saveUserProgress() {
        if (!this.isPublishedForm()) return;
        
        try {
            const formId = this.getFormId();
            const currentPage = this.getCurrentPageIndex();
            const timestamp = new Date().toISOString();
            
            const progressData = {
                formId,
                currentPage,
                timestamp,
                type: 'progress'
            };
            
            localStorage.setItem(this.userProgressKey + '_' + formId, JSON.stringify(progressData));
            console.log('Saved user progress:', progressData);
        } catch (error) {
            console.error('Error saving user progress:', error);
        }
    }
    
    saveImmediately() {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        if (this.isPublishedForm()) {
            this.saveUserData();
        } else {
            this.saveBuilderData();
        }
    }
    
    collectUserFormData() {
        const formData = {};
        const form = document.querySelector('form');
        
        if (form) {
            // Collect regular form fields
            const formElements = form.querySelectorAll('input, select, textarea');
            
            formElements.forEach(element => {
                const name = element.name || element.id;
                if (!name) return;
                
                switch (element.type) {
                    case 'checkbox':
                        formData[name] = element.checked;
                        break;
                    case 'radio':
                        if (element.checked) {
                            formData[name] = element.value;
                        }
                        break;
                    case 'file':
                        // Store file information for auto-save (files themselves cannot be saved to localStorage)
                        if (element.files && element.files.length > 0) {
                            formData[name] = Array.from(element.files).map(file => ({
                                name: file.name,
                                size: file.size,
                                type: file.type,
                                lastModified: file.lastModified
                            }));
                        }
                        break;
                    default:
                        formData[name] = element.value;
                }
            });
            
            // Collect rich text editor content
            const richTextFields = document.querySelectorAll('[data-field-type="richtext"]');
            richTextFields.forEach(field => {
                const hiddenInput = field.querySelector('input[type="hidden"]');
                if (hiddenInput) {
                    formData[hiddenInput.name] = hiddenInput.value;
                }
            });
            
            // Collect signature data
            const signatureFields = document.querySelectorAll('[data-field-type="signature"]');
            signatureFields.forEach(field => {
                const hiddenInput = field.querySelector('input[type="hidden"]');
                if (hiddenInput && hiddenInput.value) {
                    formData[hiddenInput.name] = {
                        signature: hiddenInput.value,
                        timestamp: new Date().toISOString()
                    };
                }
            });
            
            // Collect repeat instance data
            this.collectRepeatInstanceData(formData);
        }
        
        return formData;
    }
    
    collectRepeatInstanceData(formData) {
        // Find repeat sections (explicit repeat containers)
        const repeatSections = document.querySelectorAll('[data-repeat-section]');
        
        repeatSections.forEach(section => {
            const pageId = section.dataset.pageId;
            const instances = section.querySelectorAll('[data-repeat-instance]');
            
            if (instances.length > 0) {
                formData[`${pageId}_instances`] = [];
                
                instances.forEach((instance, index) => {
                    const instanceData = {};
                    const instanceFields = instance.querySelectorAll('input, select, textarea');
                    
                    instanceFields.forEach(field => {
                        const fieldName = field.name || field.id;
                        if (fieldName) {
                            // Remove instance suffix to get base field name
                            const baseFieldName = fieldName.replace(/_\d+$/, '');
                            instanceData[baseFieldName] = this.getFieldValue(field);
                        }
                    });
                    
                    formData[`${pageId}_instances`].push(instanceData);
                });
            }
        });
        
        // Also collect data from pages that have repeat configuration but may not have explicit instances yet
        const pages = document.querySelectorAll('[data-page-id]');
        pages.forEach(page => {
            const pageId = page.dataset.pageId;
            const hasRepeatData = formData[`${pageId}_instances`];
            
            // Check if this page has repeat configuration in the form data
            if (!hasRepeatData && this.isRepeatPage(pageId)) {
                const pageFields = page.querySelectorAll('.page-fields input, .page-fields select, .page-fields textarea');
                if (pageFields.length > 0) {
                    const instanceData = {};
                    pageFields.forEach(field => {
                        const fieldName = field.name || field.id;
                        if (fieldName) {
                            // Remove instance suffix to get base field name  
                            const baseFieldName = fieldName.replace(/_\d+$/, '');
                            instanceData[baseFieldName] = this.getFieldValue(field);
                        }
                    });
                    
                    // Only save if there's actual data
                    if (Object.values(instanceData).some(value => value && value !== '')) {
                        formData[`${pageId}_instances`] = [instanceData];
                    }
                }
            }
        });
    }
    
    isRepeatPage(pageId) {
        // Check if the page has repeat configuration
        const formViewer = window.AppModules.formViewer;
        if (formViewer && formViewer.formData && formViewer.formData.pages) {
            const page = formViewer.formData.pages.find(p => p.id === pageId);
            return page && page.repeatConfig && page.repeatConfig.enabled;
        }
        return false;
    }
    
    getFieldValue(field) {
        switch (field.type) {
            case 'checkbox':
                return field.checked;
            case 'radio':
                return field.checked ? field.value : null;
            default:
                return field.value;
        }
    }
    
    checkRestorationNeeded() {
        // Only check for user data restoration on published forms
        // Form builder drafts are now handled via "My Forms" - no localStorage restoration needed
        if (this.isPublishedForm()) {
            this.checkUserDataRestoration();
        }
    }
    
    checkUserDataRestoration() {
        const formId = this.getFormId();
        if (!formId) return;
        
        const savedData = localStorage.getItem(this.storageKey + 'user_' + formId);
        
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                const saveTime = new Date(data.timestamp);
                const timeDiff = Date.now() - saveTime.getTime();
                
                // Only offer restoration if saved within the last 24 hours
                if (timeDiff < 24 * 60 * 60 * 1000) {
                    this.offerUserDataRestoration(data);
                } else {
                    this.clearUserData(formId);
                }
            } catch (error) {
                console.error('Error parsing saved user data:', error);
                this.clearUserData(formId);
            }
        }
    }
    
    offerUserDataRestoration(data) {
        // Seamlessly restore user data without popup
        console.log('Auto-restoring form progress from:', new Date(data.timestamp).toLocaleString());
        this.restoreUserData(data);
    }
    restoreUserData(data) {
        try {
            // Restore form field values
            Object.entries(data.formData).forEach(([fieldName, value]) => {
                this.setFieldValue(fieldName, value);
            });
            
            // Restore page position if multi-page form
            if (data.currentPage !== undefined) {
                const multiPage = window.AppModules.multiPage;
                if (multiPage) {
                    multiPage.goToPage(data.currentPage);
                }
            }
            
            // Restore repeat instances
            this.restoreRepeatInstances(data.formData);
            
            // Silently restore without showing indicator to user
            console.log('Form progress restored silently');
            console.log('Restored user data from auto-save');
        } catch (error) {
            console.error('Error restoring user data:', error);
            this.showAutoSaveIndicator('Restore failed', 'error');
        }
    }
    
    restoreRepeatInstances(formData) {
        // Find repeat instance data
        Object.entries(formData).forEach(([key, value]) => {
            if (key.endsWith('_instances') && Array.isArray(value) && value.length > 0) {
                const pageId = key.replace('_instances', '');
                const multiPage = window.AppModules.multiPage;
                
                if (multiPage) {
                    console.log(`Restoring ${value.length} repeat instances for page ${pageId}`);
                    
                    // Create additional instances if needed (delay to ensure DOM is ready)
                    if (value.length > 1) {
                        // Use setTimeout to ensure DOM is ready and multiPage is initialized
                        setTimeout(() => {
                            // Create additional instances
                            for (let i = 1; i < value.length; i++) {
                                multiPage.addRepeatInstance(pageId);
                            }
                            
                            // Wait a bit more for DOM updates, then populate all instances
                            setTimeout(() => {
                                this.populateRepeatInstanceData(pageId, value);
                            }, 100);
                        }, 200);
                    } else {
                        // For single instance, populate immediately
                        setTimeout(() => {
                            this.populateRepeatInstanceData(pageId, value);
                        }, 100);
                    }
                }
            }
        });
    }
    
    populateRepeatInstanceData(pageId, instancesData) {
        instancesData.forEach((instanceData, index) => {
            Object.entries(instanceData).forEach(([fieldName, fieldValue]) => {
                const fullFieldName = index === 0 ? fieldName : `${fieldName}_${index}`;
                this.setFieldValue(fullFieldName, fieldValue);
            });
        });
        console.log(`Populated ${instancesData.length} repeat instances for page ${pageId}`);
    }
    
    setFieldValue(fieldName, value) {
        const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
        if (!field) return;
        
        switch (field.type) {
            case 'checkbox':
                field.checked = !!value;
                break;
            case 'radio':
                if (field.value === value) {
                    field.checked = true;
                }
                break;
            case 'select-one':
            case 'select-multiple':
                field.value = value;
                break;
            default:
                field.value = value || '';
        }
        
        // Trigger change event to update conditional logic
        field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    startPeriodicSave() {
        // Save every 5 minutes as a backup
        setInterval(() => {
            if (this.enabled) {
                this.saveImmediately();
            }
        }, 5 * 60 * 1000);
    }
    
    showAutoSaveIndicator(message, type = 'info') {
        const indicator = document.getElementById('autoSaveIndicator');
        
        if (indicator) {
            const textElement = indicator.querySelector('.save-text');
            if (textElement) {
                textElement.textContent = message;
            }
            
            indicator.className = `auto-save-indicator show ${type}`;
            
            // Auto-hide after 2 seconds
            setTimeout(() => {
                indicator.classList.remove('show');
            }, 2000);
        }
    }
    
    // Utility methods
    isPublishedForm() {
        return window.location.pathname.startsWith('/form/');
    }
    
    getFormId() {
        const path = window.location.pathname;
        const match = path.match(/\/form\/([^\/]+)/);
        return match ? match[1] : null;
    }
    
    getCurrentPageIndex() {
        const multiPage = window.AppModules.multiPage;
        return multiPage ? multiPage.getCurrentPageIndex() : 0;
    }
    
    // Clear methods - builder data is no longer stored in localStorage
    
    clearUserData(formId = null) {
        if (formId) {
            localStorage.removeItem(this.storageKey + 'user_' + formId);
            localStorage.removeItem(this.userProgressKey + '_' + formId);
        } else {
            // Clear all user data
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.storageKey + 'user_') || key.startsWith(this.userProgressKey)) {
                    localStorage.removeItem(key);
                }
            });
        }
    }
    
    clearAllAutoSaveData() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(this.storageKey) || key.startsWith(this.userProgressKey)) {
                localStorage.removeItem(key);
            }
        });
    }
    
    // Configuration methods
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled && this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }
    
    setInterval(milliseconds) {
        this.autoSaveInterval = milliseconds;
    }
    
    // Debug methods
    getStoredData() {
        const data = {};
        const keys = Object.keys(localStorage);
        
        keys.forEach(key => {
            if (key.startsWith(this.storageKey) || key.startsWith(this.userProgressKey)) {
                try {
                    data[key] = JSON.parse(localStorage.getItem(key));
                } catch (error) {
                    data[key] = localStorage.getItem(key);
                }
            }
        });
        
        return data;
    }
    
    getStorageUsage() {
        let totalSize = 0;
        const keys = Object.keys(localStorage);
        
        keys.forEach(key => {
            if (key.startsWith(this.storageKey) || key.startsWith(this.userProgressKey)) {
                totalSize += localStorage.getItem(key).length;
            }
        });
        
        return {
            bytes: totalSize,
            kb: Math.round(totalSize / 1024 * 100) / 100,
            mb: Math.round(totalSize / (1024 * 1024) * 100) / 100
        };
    }
}