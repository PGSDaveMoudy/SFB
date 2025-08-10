// FormStorage Module - Handles form save/load functionality

const { debugError, debugWarn, debugInfo, debugDebug, debugVerbose } = window.SFBDebug;

export class FormStorage {
    constructor() {
        this.forms = new Map();
        this.isDirty = false;
        this.currentFormId = null;
    }
    
    async initialize() {
        debugInfo('FormStorage', 'Initializing FormStorage module...');
        this.setupEventListeners();
        await this.loadAllForms();
    }
    
    setupEventListeners() {
        // Listen for form changes to mark as dirty
        document.addEventListener('formChanged', () => {
            this.isDirty = true;
        });
        
        // Warn before leaving with unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.isDirty) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
    }
    
    async loadAllForms() {
        try {
            const response = await fetch('/api/forms');
            const forms = await response.json();
            
            this.forms.clear();
            forms.forEach(form => {
                this.forms.set(form.id, form);
            });
            
            debugInfo('FormStorage', `Loaded ${forms.length} forms`);
        } catch (error) {
            debugError('FormStorage', 'Error loading forms:', error);
        }
    }
    
    async saveForm(formData = null) {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder && !formData) {
            alert('No form data to save');
            return null;
        }
        
        const dataToSave = formData || formBuilder.getFormData();
        
        // Ensure form has a name
        if (!dataToSave.name || dataToSave.name === 'Untitled Form') {
            const name = prompt('Enter a name for your form:', dataToSave.name || 'My Form');
            if (!name) return null;
            dataToSave.name = name;
        }
        
        try {
            // Show loading state
            this.showSaveStatus('Saving...');
            
            const response = await fetch('/api/save-form', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataToSave)
            });
            
            const result = await response.json();
            
            debugInfo('FormStorage', '🔍 Save form response:', result);
            debugInfo('FormStorage', '🔍 Result success:', result.success);
            debugInfo('FormStorage', '🔍 Result formId:', result.formId);
            debugInfo('FormStorage', '🔍 Result form:', result.form);
            
            if (result.success) {
                // Ensure form has the correct ID
                if (result.form && result.formId) {
                    result.form.id = result.formId;
                    debugInfo('FormStorage', '✅ Set form.id to:', result.form.id);
                } else {
                    debugError('FormStorage', '❌ Missing formId or form in response:', { formId: result.formId, form: result.form });
                }
                
                // Update local cache
                this.forms.set(result.formId, result.form);
                this.currentFormId = result.formId;
                this.isDirty = false;
                
                // Update form builder if available
                if (formBuilder) {
                    formBuilder.currentForm.id = result.formId;
                    window.AppState.currentForm = result.form;
                    debugInfo('FormStorage', '✅ Updated formBuilder.currentForm.id to:', formBuilder.currentForm.id);
                }
                
                this.showSaveStatus('Saved successfully!', 'success');
                
                debugInfo('FormStorage', 'Form saved:', result.formId);
                debugInfo('FormStorage', '🔍 Returning form with id:', result.form?.id);
                return result.form;
            } else {
                throw new Error(result.error || 'Save failed');
            }
        } catch (error) {
            debugError('FormStorage', 'Error saving form:', error);
            this.showSaveStatus('Save failed', 'error');
            alert(`Failed to save form: ${error.message}`);
            return null;
        }
    }
    
    async loadForm(formId) {
        try {
            const response = await fetch(`/api/forms/${formId}`);
            
            if (!response.ok) {
                throw new Error('Form not found');
            }
            
            const form = await response.json();
            
            // Update local cache
            this.forms.set(formId, form);
            this.currentFormId = formId;
            this.isDirty = false;
            
            // Load into form builder
            const formBuilder = window.AppModules.formBuilder;
            if (formBuilder) {
                formBuilder.loadForm(form);
                window.AppState.currentForm = form;
            }
            
            debugInfo('FormStorage', 'Form loaded:', formId);
            return form;
        } catch (error) {
            debugError('FormStorage', 'Error loading form:', error);
            alert(`Failed to load form: ${error.message}`);
            return null;
        }
    }
    
    async duplicateForm(formId) {
        const originalForm = this.forms.get(formId);
        if (!originalForm) {
            alert('Form not found');
            return null;
        }
        
        // Create a copy with new ID and name
        const duplicatedForm = {
            ...originalForm,
            id: null, // Will be assigned by server
            name: `${originalForm.name} (Copy)`,
            published: false,
            publishedAt: null,
            publicUrl: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        return await this.saveForm(duplicatedForm);
    }
    
    async deleteForm(formId) {
        if (!confirm('Are you sure you want to delete this form? This action cannot be undone.')) {
            return false;
        }
        
        try {
            const response = await fetch(`/api/forms/${formId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Remove from local cache
                this.forms.delete(formId);
                
                // If this was the current form, clear it
                if (this.currentFormId === formId) {
                    this.currentFormId = null;
                    this.isDirty = false;
                    
                    // Clear form builder
                    const formBuilder = window.AppModules.formBuilder;
                    if (formBuilder) {
                        formBuilder.currentForm = this.createNewForm();
                        formBuilder.renderFormCanvas();
                    }
                }
                
                debugInfo('FormStorage', 'Form deleted:', formId);
                return true;
            } else {
                throw new Error('Delete failed');
            }
        } catch (error) {
            debugError('FormStorage', 'Error deleting form:', error);
            alert(`Failed to delete form: ${error.message}`);
            return false;
        }
    }
    
    async publishForm(formId, publishSettings = {}) {
        try {
            const response = await fetch(`/api/forms/${formId}/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(publishSettings)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Update local cache
                this.forms.set(formId, result.form);
                
                debugInfo('FormStorage', 'Form published:', result.publicUrl);
                return result;
            } else {
                throw new Error(result.error || 'Publish failed');
            }
        } catch (error) {
            debugError('FormStorage', 'Error publishing form:', error);
            alert(`Failed to publish form: ${error.message}`);
            return null;
        }
    }
    
    async unpublishForm(formId) {
        try {
            const response = await fetch(`/api/forms/${formId}/unpublish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Update local cache
                this.forms.set(formId, result.form);
                
                debugInfo('FormStorage', 'Form unpublished successfully');
                return result;
            } else {
                throw new Error(result.error || 'Unpublish failed');
            }
        } catch (error) {
            debugError('FormStorage', 'Error unpublishing form:', error);
            alert(`Failed to unpublish form: ${error.message}`);
            return null;
        }
    }
    
    async exportForm(formId) {
        try {
            const response = await fetch(`/api/forms/${formId}/export`, {
                method: 'GET'
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const filename = `form_${formId}.json`;
                
                // Create download link
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                debugInfo('FormStorage', 'Form exported successfully');
                return true;
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            debugError('FormStorage', 'Error exporting form:', error);
            alert(`Failed to export form: ${error.message}`);
            return false;
        }
    }

    async bulkDeleteForms(formIds) {
        if (!formIds || formIds.length === 0) {
            return true;
        }
        
        let successCount = 0;
        let errorCount = 0;
        
        for (const formId of formIds) {
            try {
                const response = await fetch(`/api/forms/${formId}`, {
                    method: 'DELETE'
                });
                
                if (response.ok) {
                    // Remove from local cache
                    this.forms.delete(formId);
                    successCount++;
                    
                    // If this was the current form, clear it
                    if (this.currentFormId === formId) {
                        this.currentFormId = null;
                        this.isDirty = false;
                        
                        // Clear form builder
                        const formBuilder = window.AppModules.formBuilder;
                        if (formBuilder) {
                            formBuilder.currentForm = this.createNewForm();
                            formBuilder.renderFormCanvas();
                        }
                    }
                } else {
                    errorCount++;
                    debugError('FormStorage', `Failed to delete form ${formId}: ${response.status}`);
                }
            } catch (error) {
                errorCount++;
                debugError('FormStorage', `Error deleting form ${formId}:`, error);
            }
        }
        
        if (successCount > 0) {
            debugInfo('FormStorage', `Successfully deleted ${successCount} form(s)`);
        }
        
        if (errorCount > 0) {
            alert(`Successfully deleted ${successCount} form(s). Failed to delete ${errorCount} form(s).`);
        } else {
            alert(`Successfully deleted ${successCount} form(s).`);
        }
        
        return errorCount === 0;
    }
    
    async showMyForms() {
        await this.loadAllForms();
        
        const modal = document.getElementById('myFormsModal');
        const formsList = document.getElementById('formsList');
        
        // Setup search functionality
        this.setupFormSearchListeners();
        
        if (this.forms.size === 0) {
            formsList.innerHTML = `
                <div class="empty-state">
                    <p>No forms found. Create your first form!</p>
                </div>
            `;
        } else {
            this.renderFormsList();
        }
        
        modal.style.display = 'block';
    }
    
    setupFormSearchListeners() {
        const searchInput = document.getElementById('formsSearchInput');
        if (searchInput && !searchInput.hasAttribute('data-listener-attached')) {
            searchInput.addEventListener('input', (e) => {
                this.filterForms(e.target.value);
            });
            
            searchInput.addEventListener('keyup', (e) => {
                const clearBtn = document.querySelector('.search-clear-btn');
                if (clearBtn) {
                    clearBtn.style.display = e.target.value ? 'block' : 'none';
                }
            });
            
            searchInput.setAttribute('data-listener-attached', 'true');
        }
    }
    
    renderFormsList(searchTerm = '') {
        const formsList = document.getElementById('formsList');
        let formsArray = Array.from(this.forms.values());
        
        // Apply search filter
        if (searchTerm) {
            formsArray = formsArray.filter(form => {
                const searchText = searchTerm.toLowerCase();
                const formName = (form.name || form.title || '').toLowerCase();
                const formDesc = (form.description || '').toLowerCase();
                return formName.includes(searchText) || formDesc.includes(searchText);
            });
        }
        
        // Sort by updated date
        formsArray.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        
        if (formsArray.length === 0) {
            formsList.innerHTML = `
                <div class="empty-state">
                    ${searchTerm ? 
                        `<p>No forms found matching "${searchTerm}"</p>
                         <button class="button button-secondary" onclick="clearFormsSearch()">Clear Search</button>` :
                        `<p>No forms found. Create your first form!</p>`
                    }
                </div>
            `;
        } else {
            formsList.innerHTML = formsArray
                .map(form => this.renderFormListItem(form))
                .join('');
        }
    }
    
    filterForms(searchTerm = '') {
        this.renderFormsList(searchTerm);
    }
    
    renderFormListItem(form) {
        const updatedDate = new Date(form.updatedAt).toLocaleDateString();
        const updatedTime = new Date(form.updatedAt).toLocaleTimeString();
        
        // Determine status badge
        let statusBadge;
        if (form.published) {
            statusBadge = `<span class="status-badge published">✅ Published</span>`;
        } else if (form.isDraft) {
            statusBadge = `<span class="status-badge auto-draft">💾 Auto-Draft</span>`;
        } else {
            statusBadge = `<span class="status-badge draft">📝 Draft</span>`;
        }
        
        return `
            <div class="form-card" data-form-id="${form.id}">
                <div class="form-card-header">
                    <div class="form-card-title-section">
                        <div class="form-card-checkbox">
                            <input type="checkbox" class="form-select-checkbox" 
                                   data-form-id="${form.id}" onchange="updateBulkActionsVisibility()">
                        </div>
                        <h4 class="form-card-title">${this.escapeHtml(form.name || form.title || 'Untitled Form')}</h4>
                        ${statusBadge}
                    </div>
                    <div class="form-card-actions">
                        <button class="icon-btn" onclick="window.AppModules.formStorage.loadForm('${form.id}')" title="Load Form">
                            📂
                        </button>
                        <button class="icon-btn" onclick="window.AppModules.formStorage.duplicateFormAction('${form.id}')" title="Duplicate">
                            📄
                        </button>
                        <button class="icon-btn" onclick="window.AppModules.formStorage.deleteFormAction('${form.id}')" title="Delete">
                            🗑️
                        </button>
                    </div>
                </div>
                
                ${form.description ? `
                <div class="form-card-description">
                    <p>${this.escapeHtml(form.description)}</p>
                </div>
                ` : ''}
                
                <div class="form-card-meta">
                    <div class="form-card-stats">
                        <span class="meta-item">
                            <span class="meta-icon">📅</span>
                            Updated: ${updatedDate} ${form.isDraft ? `at ${updatedTime}` : ''}
                        </span>
                        <span class="meta-item">
                            <span class="meta-icon">📄</span>
                            ${form.pages?.length || 1} page(s)
                        </span>
                        <span class="meta-item">
                            <span class="meta-icon">🏷️</span>
                            ${this.getTotalFieldCount(form)} field(s)
                        </span>
                        ${form.isDraft ? `<span class="meta-item auto-draft-indicator">
                            <span class="meta-icon">💾</span>
                            Auto-saved
                        </span>` : ''}
                    </div>
                </div>
                
                ${form.published ? `
                <div class="form-card-links">
                    <button class="link-btn" onclick="window.AppModules.formStorage.copyFormLink('${form.publicUrl}')" title="Copy Form Link">
                        🔗 Copy Link
                    </button>
                    <button class="link-btn" onclick="window.AppModules.formStorage.copyEmbedCode('${form.publicUrl}')" title="Copy Embed Code">
                        📋 Embed Code
                    </button>
                    <button class="link-btn" onclick="window.AppModules.formStorage.exportSubmissions('${form.id}', 'csv')" title="Export Submissions">
                        📥 Export CSV
                    </button>
                    <button class="link-btn" onclick="window.open('${form.publicUrl}', '_blank')" title="View Form">
                        👁️ View Form
                    </button>
                    <button class="secondary-btn" onclick="window.AppModules.formStorage.unpublishFormAction('${form.id}')">
                        🔒 Unpublish
                    </button>
                </div>
                ` : `
                <div class="form-card-links">
                    <button class="primary-btn" onclick="window.AppModules.formStorage.loadForm('${form.id}')">
                        ✏️ Edit Form
                    </button>
                    <button class="secondary-btn" onclick="window.AppModules.formStorage.publishFormAction('${form.id}')">
                        🚀 Publish
                    </button>
                </div>
                `}
            </div>
        `;
    }
    
    getTotalFieldCount(form) {
        return form.pages?.reduce((total, page) => total + (page.fields?.length || 0), 0) || 0;
    }
    
    async editForm(formId) {
        // Check for unsaved changes
        if (this.isDirty) {
            const save = confirm('You have unsaved changes. Do you want to save them first?');
            if (save) {
                await this.saveForm();
            }
        }
        
        // Load the form
        await this.loadForm(formId);
        
        // Close the modal
        document.getElementById('myFormsModal').style.display = 'none';
    }
    
    async duplicateFormAction(formId) {
        const duplicatedForm = await this.duplicateForm(formId);
        if (duplicatedForm) {
            // Refresh the forms list
            await this.showMyForms();
        }
    }
    
    async publishFormAction(formId) {
        const result = await this.publishForm(formId);
        if (result) {
            this.showPublishSuccessModal(result.publicUrl);
            // Refresh the forms list
            await this.showMyForms();
        }
    }
    
    async unpublishFormAction(formId) {
        if (confirm('Are you sure you want to unpublish this form? It will no longer be accessible via the public link.')) {
            const result = await this.unpublishForm(formId);
            if (result) {
                alert('Form unpublished successfully');
                // Refresh the forms list
                await this.showMyForms();
            }
        }
    }
    
    showPublishSuccessModal(publicUrl) {
        const embedCode = `<iframe src="${publicUrl}" width="100%" height="600" frameborder="0"></iframe>`;
        
        // Use the existing modal in index.html
        const modal = document.getElementById('publishSuccessModal');
        const linkInput = document.getElementById('formLinkInput');
        const embedInput = document.getElementById('embedCodeInput');
        
        if (modal && linkInput && embedInput) {
            // Populate the existing modal fields
            linkInput.value = publicUrl;
            embedInput.value = embedCode;
            
            // Show the modal with celebration animation
            modal.style.display = 'block';
            
            // Add celebration animation class
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.style.animation = 'celebrationBounce 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            }
        } else {
            // Fallback: create dynamic modal if static one doesn't exist
            this.createDynamicPublishModal(publicUrl, embedCode);
        }
    }
    
    createDynamicPublishModal(publicUrl, embedCode) {
        // Remove any existing dynamic modal
        const existingModal = document.getElementById('publishSuccessModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Create beautiful modal HTML as fallback
        const modalHtml = `
            <div id="publishSuccessModal" class="modal" style="display: block;">
                <div class="modal-content">
                    <span class="close" onclick="document.getElementById('publishSuccessModal').remove()">&times;</span>
                    <h2>🎉 Form Published Successfully!</h2>
                    <p>Your form is now live and ready to collect submissions.</p>
                    
                    <div class="publish-links">
                        <div class="link-group">
                            <label>Form Link:</label>
                            <div class="copy-group">
                                <input type="text" value="${publicUrl}" readonly>
                                <button class="button button-primary" onclick="window.AppModules.formStorage?.copyFormLinkFromModal('${publicUrl}')">📋 Copy Link</button>
                            </div>
                        </div>
                        
                        <div class="link-group">
                            <label>Embed Code:</label>
                            <div class="copy-group">
                                <textarea readonly rows="3">${embedCode}</textarea>
                                <button class="button button-primary" onclick="window.AppModules.formStorage?.copyEmbedCodeFromModal('${publicUrl}')">📋 Copy Code</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button class="button button-secondary" onclick="window.open('${publicUrl}', '_blank')">🌐 View Form</button>
                        <button class="button button-primary" onclick="document.getElementById('publishSuccessModal').remove()">Done</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    async copyFormLinkFromModal(formUrl) {
        try {
            await navigator.clipboard.writeText(formUrl);
            // Update button text temporarily
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '✅ Copied!';
            btn.style.background = 'var(--success)';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 2000);
        } catch (err) {
            // Fallback for older browsers
            const urlDisplay = document.getElementById('formUrlDisplay');
            urlDisplay.select();
            document.execCommand('copy');
            this.showSaveIndicator('Form link copied to clipboard!');
        }
    }
    
    async copyEmbedCodeFromModal(formUrl) {
        const embedCode = `<iframe src="${formUrl}" width="100%" height="600" frameborder="0"></iframe>`;
        try {
            await navigator.clipboard.writeText(embedCode);
            // Update button text temporarily
            const btn = event.target;
            const originalText = btn.textContent;
            btn.textContent = '✅ Copied!';
            btn.style.background = 'var(--success)';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 2000);
        } catch (err) {
            // Fallback for older browsers
            const embedDisplay = document.getElementById('embedCodeDisplay');
            embedDisplay.select();
            document.execCommand('copy');
            this.showSaveIndicator('Embed code copied to clipboard!');
        }
    }
    
    async deleteFormAction(formId) {
        const form = this.forms.get(formId);
        if (form && confirm(`Are you sure you want to delete "${form.name}"? This action cannot be undone.`)) {
            const deleted = await this.deleteForm(formId);
            if (deleted) {
                // Refresh the forms list
                await this.showMyForms();
            }
        }
    }
    
    async copyFormLink(formUrl) {
        try {
            await navigator.clipboard.writeText(formUrl);
            this.showSaveIndicator('Form link copied to clipboard!');
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = formUrl;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showSaveIndicator('Form link copied to clipboard!');
        }
    }
    
    async copyEmbedCode(formUrl) {
        const embedCode = `<iframe src="${formUrl}" width="100%" height="600" frameborder="0"></iframe>`;
        try {
            await navigator.clipboard.writeText(embedCode);
            this.showSaveIndicator('Embed code copied to clipboard!');
        } catch (err) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = embedCode;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.showSaveIndicator('Embed code copied to clipboard!');
        }
    }
    
    createNewForm() {
        return {
            id: null,
            name: 'Untitled Form',
            description: '',
            pages: [{
                id: 'page_1',
                name: 'Page 1',
                fields: [],
                salesforceObject: null,
                hiddenFields: [],
                conditionalVisibility: null,
                repeatConfig: null,
                variables: new Map()
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
    }
    
    newForm() {
        // Check for unsaved changes
        if (this.isDirty) {
            const save = confirm('You have unsaved changes. Do you want to save them first?');
            if (save) {
                this.saveForm();
                return;
            }
        }
        
        // Create new form
        const formBuilder = window.AppModules.formBuilder;
        if (formBuilder) {
            formBuilder.currentForm = this.createNewForm();
            formBuilder.currentPageIndex = 0;
            formBuilder.fieldIdCounter = 1;
            formBuilder.renderFormCanvas();
            
            this.currentFormId = null;
            this.isDirty = false;
            window.AppState.currentForm = null;
        }
    }
    
    showSaveStatus(message, type = 'info') {
        // Create or update status indicator
        let indicator = document.getElementById('saveStatusIndicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'saveStatusIndicator';
            indicator.className = 'save-status-indicator';
            document.body.appendChild(indicator);
        }
        
        indicator.textContent = message;
        indicator.className = `save-status-indicator ${type}`;
        indicator.style.display = 'block';
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            indicator.style.display = 'none';
        }, 3000);
    }
    
    // Import/Export functionality
    async exportForm(formId) {
        const form = this.forms.get(formId);
        if (!form) {
            alert('Form not found');
            return;
        }
        
        const exportData = {
            ...form,
            exportedAt: new Date().toISOString(),
            exportVersion: '1.0'
        };
        
        // Create and download file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${form.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    async importForm(file) {
        try {
            const text = await file.text();
            const formData = JSON.parse(text);
            
            // Validate imported data
            if (!formData.pages || !Array.isArray(formData.pages)) {
                throw new Error('Invalid form data');
            }
            
            // Remove ID to create new form
            formData.id = null;
            formData.name = `${formData.name} (Imported)`;
            formData.published = false;
            formData.publishedAt = null;
            formData.publicUrl = null;
            
            return await this.saveForm(formData);
        } catch (error) {
            debugError('FormStorage', 'Error importing form:', error);
            alert(`Failed to import form: ${error.message}`);
            return null;
        }
    }
    
    async exportAllFormsSubmissions() {
        try {
            this.showSaveStatus('Exporting all submissions...', 'info');
            const allForms = Array.from(this.forms.values());
            let allSubmissions = [];

            for (const form of allForms) {
                try {
                    const response = await fetch(`/api/forms/${form.id}/submissions`);
                    if (!response.ok) {
                        debugWarn('FormStorage', `Failed to fetch submissions for form ${form.id}: ${response.statusText}`);
                        continue; // Skip to next form if submissions can't be fetched
                    }
                    const submissions = await response.json();
                    // Add form name to each submission for context in the combined CSV
                    submissions.forEach(s => s.formName = form.name || 'Untitled Form');
                    allSubmissions = allSubmissions.concat(submissions);
                } catch (error) {
                    debugError('FormStorage', `Error fetching submissions for form ${form.id}:`, error);
                }
            }

            if (allSubmissions.length === 0) {
                this.showSaveStatus('No submissions found to export.', 'info');
                return;
            }

            // Sort submissions by date for consistent output
            allSubmissions.sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt));

            this.downloadCSV(allSubmissions, 'all_forms_submissions.csv', true); // Pass true for combined export
            this.showSaveStatus('All submissions exported successfully!', 'success');

        } catch (error) {
            debugError('FormStorage', 'Error exporting all submissions:', error);
            this.showSaveStatus(`Failed to export all submissions: ${error.message}`, 'error');
        }
    }

    downloadCSV(submissions, filename, isCombinedExport = false) {
        if (!submissions || submissions.length === 0) {
            alert('No data to export');
            return;
        }
        
        // Collect all unique field names across all submissions
        const allFields = new Set();
        submissions.forEach(submission => {
            Object.keys(submission.submissionData).forEach(field => allFields.add(field));
        });
        
        // Define standard headers. Add 'Form Name' for combined export.
        let headers = ['Submission ID', 'Submission Date', 'Status', 'Submitter Email', 'Submitter IP', 'Salesforce Record ID', 'Salesforce Object Type', 'Files Count'];
        if (isCombinedExport) {
            headers.unshift('Form Name');
        }

        // Add dynamic form fields, ensuring no duplicates and sorted for consistency
        const dynamicFields = Array.from(allFields).sort();
        headers = [...headers, ...dynamicFields];

        // Create CSV rows
        const rows = submissions.map(submission => {
            const row = [];
            if (isCombinedExport) {
                row.push(this.csvEscape(submission.formName || ''));
            }
            row.push(this.csvEscape(submission.id || ''));
            row.push(this.csvEscape(new Date(submission.submittedAt).toLocaleString()));
            row.push(this.csvEscape(submission.status || ''));
            row.push(this.csvEscape(submission.submitterEmail || ''));
            row.push(this.csvEscape(submission.submitterIp || ''));
            row.push(this.csvEscape(submission.salesforceRecordId || ''));
            row.push(this.csvEscape(submission.salesforceObjectType || ''));
            row.push(this.csvEscape(submission.files?.length || 0));

            dynamicFields.forEach(field => {
                const value = submission.submissionData[field] || '';
                row.push(this.csvEscape(value));
            });
            return row.join(',');
        });
        
        const csvContent = [headers.map(h => this.csvEscape(h)).join(','), ...rows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    csvEscape(value) {
        if (value === null || value === undefined) {
            return '';
        }
        let stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('\n') || stringValue.includes('"')) {
            return '"' + stringValue.replace(/"/g, '""') + '"'
        }
        return stringValue;
    }

    // Template functionality
    async saveAsTemplate(formId, templateName) {
        const form = this.forms.get(formId);
        if (!form) {
            alert('Form not found');
            return null;
        }
        
        const template = {
            ...form,
            id: null,
            name: templateName,
            description: `Template based on ${form.name}`,
            isTemplate: true,
            published: false,
            publishedAt: null,
            publicUrl: null
        };
        
        return await this.saveForm(template);
    }
    
    async loadTemplates() {
        // This would load predefined templates
        return [];
    }
    
    // Auto-save related methods
    scheduleAutoSave() {
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            this.autoSave();
        }, 30000); // Auto-save after 30 seconds of inactivity
    }
    
    async autoSave() {
        if (!this.isDirty || !this.currentFormId) {
            return;
        }
        
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) {
            return;
        }
        
        try {
            await this.saveForm();
            debugInfo('FormStorage', 'Auto-saved form');
        } catch (error) {
            debugError('FormStorage', 'Auto-save failed:', error);
        }
    }
    
    async viewSubmissions(formId) {
        try {
            const form = this.forms.get(formId);
            if (!form) {
                alert('Form not found');
                return;
            }

            // Fetch submissions from server
            const response = await fetch(`/api/forms/${formId}/submissions`);
            if (!response.ok) {
                throw new Error('Failed to fetch submissions');
            }
            
            const submissions = await response.json();
            
            // Fetch analytics
            const analyticsResponse = await fetch(`/api/forms/${formId}/analytics`);
            const analytics = analyticsResponse.ok ? await analyticsResponse.json() : { totalSubmissions: 0, successfulSubmissions: 0 };
            
            this.showSubmissionsModal(form, submissions, analytics);
        } catch (error) {
            debugError('FormStorage', 'Error fetching submissions:', error);
            alert(`Failed to load submissions: ${error.message}`);
        }
    }
    
    showSubmissionsModal(form, submissions, analytics) {
        const modalHtml = `
            <div id="submissionsModal" class="modal" style="display: block;">
                <div class="modal-content" style="max-width: 900px; max-height: 80vh; overflow-y: auto;">
                    <div class="modal-header">
                        <h3>📊 Submissions for "${this.escapeHtml(form.name)}"</h3>
                        <span class="close" onclick="document.getElementById('submissionsModal').remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        ${this.renderSubmissionsAnalytics(analytics)}
                        ${this.renderSubmissionsList(submissions, form)}
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    renderSubmissionsAnalytics(analytics) {
        return `
            <div class="submissions-analytics">
                <h4>📈 Analytics</h4>
                <div class="analytics-grid">
                    <div class="analytics-card">
                        <div class="analytics-number">${analytics.totalSubmissions || 0}</div>
                        <div class="analytics-label">Total Submissions</div>
                    </div>
                    <div class="analytics-card">
                        <div class="analytics-number">${analytics.successfulSubmissions || 0}</div>
                        <div class="analytics-label">Successful</div>
                    </div>
                    <div class="analytics-card">
                        <div class="analytics-number">${(analytics.totalSubmissions || 0) - (analytics.successfulSubmissions || 0)}</div>
                        <div class="analytics-label">Failed</div>
                    </div>
                    <div class="analytics-card">
                        <div class="analytics-number">${analytics.lastSubmission ? new Date(analytics.lastSubmission).toLocaleDateString() : 'None'}</div>
                        <div class="analytics-label">Last Submission</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderSubmissionsList(submissions, form) {
        if (!submissions || submissions.length === 0) {
            return `
                <div class="submissions-list">
                    <h4>📋 Submissions</h4>
                    <div class="empty-state">
                        <p>No submissions found for this form yet.</p>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="submissions-list">
                <h4>📋 Recent Submissions (${submissions.length})</h4>
                <div class="submissions-actions">
                    <button class="button button-secondary" onclick="window.AppModules.formStorage?.exportSubmissions('${form.id}', 'json')">
                        📄 Export JSON
                    </button>
                    <button class="button button-secondary" onclick="window.AppModules.formStorage?.exportSubmissions('${form.id}', 'csv')">
                        📊 Export CSV
                    </button>
                </div>
                <div class="submissions-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Status</th>
                                <th>Data</th>
                                <th>Files</th>
                                <th>Salesforce ID</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${submissions.map(submission => this.renderSubmissionRow(submission)).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
    
    renderSubmissionRow(submission) {
        const submissionDate = new Date(submission.submittedAt).toLocaleString();
        const statusBadge = submission.status === 'success' 
            ? '<span class="status-badge published">Success</span>' 
            : '<span class="status-badge draft">Failed</span>';
        
        const salesforceId = submission.salesforceResults?.[0]?.id || 'N/A';
        const fileCount = submission.files?.length || 0;
        
        // Extract key submission data for display
        const keyData = this.extractKeySubmissionData(submission.submissionData);
        
        return `
            <tr>
                <td>${submissionDate}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="submission-data-preview">
                        ${keyData.map(item => `<div><strong>${item.key}:</strong> ${this.escapeHtml(item.value)}</div>`).join('')}
                        ${Object.keys(submission.submissionData).length > 3 ? `<div class="data-more">+${Object.keys(submission.submissionData).length - 3} more fields</div>` : ''}
                    </div>
                </td>
                <td>${fileCount > 0 ? `${fileCount} file(s)` : 'None'}</td>
                <td>${salesforceId}</td>
                <td>
                    <button class="action-btn" onclick="window.AppModules.formStorage?.viewSubmissionDetails('${submission.id}')" title="View Details">
                        👁️
                    </button>
                </td>
            </tr>
        `;
    }
    
    extractKeySubmissionData(submissionData) {
        const keyData = [];
        let count = 0;
        
        for (const [key, value] of Object.entries(submissionData)) {
            if (count >= 3) break;
            if (value && typeof value === 'string' && value.trim() !== '') {
                keyData.push({
                    key: key.replace(/^field_\d+_?/, '').replace(/_/g, ' '),
                    value: value.length > 50 ? value.substring(0, 50) + '...' : value
                });
                count++;
            }
        }
        
        return keyData;
    }
    
    async viewSubmissionDetails(submissionId) {
        // This would show a detailed view of a specific submission
        alert(`Detailed view for submission ${submissionId} - Coming soon!`);
    }
    
    async exportSubmissions(formId, format) {
        try {
            const response = await fetch(`/api/forms/${formId}/submissions`);
            if (!response.ok) {
                throw new Error('Failed to fetch submissions');
            }
            
            const submissions = await response.json();
            const form = this.forms.get(formId);
            
            if (format === 'json') {
                this.downloadJSON(submissions, `${form.name}_submissions.json`);
            } else if (format === 'csv') {
                this.downloadCSV(submissions, `${form.name}_submissions.csv`);
            }
        } catch (error) {
            debugError('FormStorage', 'Error exporting submissions:', error);
            alert(`Failed to export submissions: ${error.message}`);
        }
    }
    
    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    downloadCSV(submissions, filename) {
        if (!submissions || submissions.length === 0) {
            alert('No data to export');
            return;
        }
        
        // Collect all unique field names
        const allFields = new Set();
        submissions.forEach(submission => {
            Object.keys(submission.submissionData).forEach(field => allFields.add(field));
        });
        
        // Create CSV header
        const headers = ['Submission Date', 'Status', 'Salesforce ID', ...Array.from(allFields), 'Files Count'];
        
        // Create CSV rows
        const rows = submissions.map(submission => {
            const row = [
                new Date(submission.submittedAt).toLocaleString(),
                submission.status,
                submission.salesforceResults?.[0]?.id || '',
                ...Array.from(allFields).map(field => {
                    const value = submission.submissionData[field] || '';
                    return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
                }),
                submission.files?.length || 0
            ];
            return row.join(',');
        });
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    generateFormId() {
        return 'form_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    getFormSummary(form) {
        const fieldCount = this.getTotalFieldCount(form);
        const pageCount = form.pages?.length || 1;
        const hasConditionalLogic = form.pages?.some(page => 
            page.fields?.some(field => field.conditionalVisibility?.enabled)
        ) || false;
        
        return {
            fieldCount,
            pageCount,
            hasConditionalLogic,
            published: !!form.published,
            lastUpdated: form.updatedAt
        };
    }
}