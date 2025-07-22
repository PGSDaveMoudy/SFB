// FlowLogic Module - Handles complex flow logic for forms including email lookup and OTP
export class FlowLogic {
    constructor() {
        this.flowActions = new Map();
        this.pendingOTPs = new Map();
        this.emailCache = new Map();
        this.flowStates = new Map();
    }
    
    async initialize() {
        console.log('Initializing FlowLogic module...');
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Listen for field value changes to trigger flow actions
        document.addEventListener('input', (e) => {
            this.handleFieldChange(e.target);
        });
        
        document.addEventListener('change', (e) => {
            this.handleFieldChange(e.target);
        });
        
        // Listen for form page changes
        document.addEventListener('pageChanged', (e) => {
            this.handlePageChange(e.detail);
        });
    }
    
    async handleFieldChange(field) {
        const fieldId = field.id || field.name;
        if (!fieldId) return;
        
        const fieldType = field.dataset.fieldType;
        const value = this.getFieldValue(field);
        
        // Check if this field has flow actions
        const actions = this.getFieldFlowActions(fieldId);
        if (actions && actions.length > 0) {
            for (const action of actions) {
                await this.executeFlowAction(action, fieldId, value, field);
            }
        }
        
        // Special handling for email fields
        // Note: Email field API calls have been removed. 
        // - Regular email fields (type="email") now work as simple inputs with no API calls
        // - Email-verify fields (type="email-verify") handle verification via button clicks, not automatic lookup
        // - Login fields (type="login") handle their own contact lookup via button clicks
        // This ensures email fields are simple inputs unless explicitly designed for verification
    }
    
    async handleEmailFieldChange(fieldId, email, field) {
        if (!email || !this.isValidEmail(email)) {
            this.clearEmailLookupState(fieldId);
            return;
        }
        
        // Check if we have a cached lookup result
        if (this.emailCache.has(email)) {
            const cachedResult = this.emailCache.get(email);
            await this.handleEmailLookupResult(fieldId, email, cachedResult, field);
            return;
        }
        
        // Perform email lookup
        try {
            const result = await this.performEmailLookup(email);
            this.emailCache.set(email, result);
            await this.handleEmailLookupResult(fieldId, email, result, field);
        } catch (error) {
            console.error('Email lookup error:', error);
        }
    }
    
    async performEmailLookup(email) {
        try {
            const requestBody = { email };
            
            // Include formId for public forms to use creator credentials
            if (window.currentFormId) {
                requestBody.formId = window.currentFormId;
            }
            
            const response = await fetch('/api/contact-lookup', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                throw new Error('Email lookup failed');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Email lookup error:', error);
            return { found: false, contact: null };
        }
    }
    
    async handleEmailLookupResult(fieldId, email, result, field) {
        const formViewer = window.AppModules.formViewer;
        if (!formViewer) return;
        
        if (result.found && result.contact) {
            // Contact exists - show OTP verification UI
            this.showOTPVerification(fieldId, email, result.contact);
        } else {
            // Contact doesn't exist - allow proceeding to create new account
            this.showNewAccountFlow(fieldId, email);
        }
    }
    
    showOTPVerification(fieldId, email, contact) {
        // Create OTP verification UI
        const otpContainer = this.createOTPContainer(fieldId, email, contact);
        
        // Insert after the email field
        const emailField = document.getElementById(fieldId) || document.querySelector(`[name="${fieldId}"]`);
        if (emailField) {
            const fieldContainer = emailField.closest('.form-field-container');
            if (fieldContainer) {
                // Remove any existing OTP container
                const existingOTP = fieldContainer.querySelector('.otp-verification-container');
                if (existingOTP) {
                    existingOTP.remove();
                }
                
                fieldContainer.appendChild(otpContainer);
            }
        }
        
        // Do NOT send OTP email automatically here. It will be sent when the user clicks the button.
        // await this.sendOTPEmail(email, contact);
    }
    
    createOTPContainer(fieldId, email, contact) {
        const container = document.createElement('div');
        container.className = 'otp-verification-container';
        container.innerHTML = `
            <div class="otp-verification">
                <div class="otp-message">
                    <h4>📧 Email Verification Required</h4>
                    <p>We found an existing account for <strong>${email}</strong>.</p>
                    <p>An OTP has been sent to verify your identity.</p>
                </div>
                <div class="otp-input-group">
                    <label for="otp_${fieldId}">Enter OTP Code:</label>
                    <div class="otp-input-container">
                        <input type="text" id="otp_${fieldId}" class="otp-input" placeholder="Enter 6-digit code" maxlength="6" autocomplete="off">
                    </div>
                    <div class="otp-verify-container">
                        <button type="button" class="button button-primary verify-otp-btn" data-field-id="${fieldId}" data-email="${email}">
                            Verify OTP
                        </button>
                    </div>
                </div>
                <div class="otp-actions">
                    <button type="button" class="button button-secondary resend-otp-btn" data-field-id="${fieldId}" data-email="${email}">
                        Resend OTP
                    </button>
                    <button type="button" class="button button-secondary cancel-otp-btn" data-field-id="${fieldId}">
                        Use Different Email
                    </button>
                </div>
                <div class="otp-error" style="display: none;"></div>
            </div>
        `;
        
        // Add event listeners
        const verifyBtn = container.querySelector('.verify-otp-btn');
        const resendBtn = container.querySelector('.resend-otp-btn');
        const cancelBtn = container.querySelector('.cancel-otp-btn');
        const otpInput = container.querySelector('.otp-input');
        
        verifyBtn.addEventListener('click', () => this.verifyOTP(fieldId, email, contact));
        resendBtn.addEventListener('click', () => this.sendOTPEmail(email, contact, true));
        cancelBtn.addEventListener('click', () => this.cancelOTPVerification(fieldId));
        
        // Auto-verify when 6 digits entered
        otpInput.addEventListener('input', (e) => {
            if (e.target.value.length === 6) {
                this.verifyOTP(fieldId, email, contact);
            }
        });
        
        return container;
    }
    
    showNewAccountFlow(fieldId, email) {
        // Show message that no account was found and they can proceed
        const container = document.createElement('div');
        container.className = 'new-account-container';
        container.innerHTML = `
            <div class="new-account-message">
                <div class="info-message">
                    <span class="info-icon">ℹ️</span>
                    <span>No existing account found for ${email}. You can proceed to create a new account.</span>
                </div>
            </div>
        `;
        
        const emailField = document.getElementById(fieldId) || document.querySelector(`[name="${fieldId}"]`);
        if (emailField) {
            const fieldContainer = emailField.closest('.form-field-container');
            if (fieldContainer) {
                // Remove any existing containers
                const existingContainers = fieldContainer.querySelectorAll('.otp-verification-container, .new-account-container');
                existingContainers.forEach(c => c.remove());
                
                fieldContainer.appendChild(container);
            }
        }
        
        // Set flow state to allow proceeding
        this.setFlowState(fieldId, 'new_account_allowed');
    }
    
    async sendOTPEmail(email, contact, isResend = false) {
        try {
            // Get current form ID from URL or global state
            const formId = this.getCurrentFormId();
            
            const response = await fetch('/api/send-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    email, 
                    contactId: contact.Id,
                    isResend,
                    formId 
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to send OTP');
            }
            
            const result = await response.json();
            
            // Store OTP session info
            this.pendingOTPs.set(email, {
                sessionId: result.sessionId,
                expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
                contact: contact
            });
            
            if (isResend) {
                this.showOTPMessage('OTP resent successfully!', 'success');
            }
            
            // Show appropriate message based on email service status
            if (result.emailSent) {
                setTimeout(() => {
                    this.showOTPMessage(`OTP sent to ${email}. Please check your email.`, 'success');
                }, 1000);
            } else if (result.demoOtp) {
                setTimeout(() => {
                    this.showOTPMessage(`Demo Mode - OTP: ${result.demoOtp} (configure email service for production)`, 'info');
                }, 1000);
            }
            
        } catch (error) {
            console.error('Error sending OTP:', error);
            this.showOTPMessage('Failed to send OTP. Please try again.', 'error');
        }
    }
    
    async verifyOTP(fieldId, email, contact) {
        const otpInput = document.getElementById(`otp_${fieldId}`);
        const otp = otpInput?.value?.trim();
        
        if (!otp || otp.length !== 6) {
            this.showOTPMessage('Please enter a valid 6-digit OTP code.', 'error');
            return;
        }
        
        const pendingOTP = this.pendingOTPs.get(email);
        if (!pendingOTP) {
            this.showOTPMessage('OTP session expired. Please request a new code.', 'error');
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
                    sessionId: pendingOTP.sessionId
                })
            });
            
            if (!response.ok) {
                throw new Error('OTP verification failed');
            }
            
            const result = await response.json();
            
            if (result.verified) {
                // OTP verified successfully
                this.handleSuccessfulOTPVerification(fieldId, email, contact);
            } else {
                this.showOTPMessage('Invalid OTP code. Please try again.', 'error');
            }
            
        } catch (error) {
            console.error('OTP verification error:', error);
            this.showOTPMessage('Verification failed. Please try again.', 'error');
        }
    }
    
    handleSuccessfulOTPVerification(fieldId, email, contact) {
        // Remove OTP container
        const otpContainer = document.querySelector('.otp-verification-container');
        if (otpContainer) {
            otpContainer.remove();
        }
        
        // Show success message
        const successContainer = document.createElement('div');
        successContainer.className = 'otp-success-container';
        successContainer.innerHTML = `
            <div class="success-message">
                <span class="success-icon">✅</span>
                <span>Email verified! Welcome back, ${contact.Name || email}.</span>
            </div>
        `;
        
        const emailField = document.getElementById(fieldId) || document.querySelector(`[name="${fieldId}"]`);
        if (emailField) {
            const fieldContainer = emailField.closest('.form-field-container');
            if (fieldContainer) {
                fieldContainer.appendChild(successContainer);
            }
        }
        
        // Set flow state and populate known data
        this.setFlowState(fieldId, 'verified_user', contact);
        this.populateKnownContactData(contact);
        
        // Set global login variables for conditional logic using batching
        if (window.FormVariables) {
            const loginVariables = {
                'isLoggedIn': 'true',
                'loggedIn': 'true'
            };
            
            console.log('🔐 OTP SUCCESS: Setting login variables via batching system:', loginVariables);
            
            if (window.FormVariables.setMultiple) {
                window.FormVariables.setMultiple(loginVariables);
            } else {
                // Fallback for older systems
                window.FormVariables.set('isLoggedIn', 'true');
                window.FormVariables.set('loggedIn', 'true');
            }
        }
        
        // Note: Conditional logic evaluation is now automatically triggered by FormVariables.set()
        
        // Clean up
        this.pendingOTPs.delete(email);
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
    
    cancelOTPVerification(fieldId) {
        // Remove OTP container
        const otpContainer = document.querySelector('.otp-verification-container');
        if (otpContainer) {
            otpContainer.remove();
        }
        
        // Clear the email field so user can enter different email
        const emailField = document.getElementById(fieldId) || document.querySelector(`[name="${fieldId}"]`);
        if (emailField) {
            emailField.value = '';
            emailField.focus();
        }
        
        // Clear flow state
        this.clearFlowState(fieldId);
    }
    
    showOTPMessage(message, type = 'info') {
        const errorDiv = document.querySelector('.otp-error');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.className = `otp-error ${type}`;
            errorDiv.style.display = 'block';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                errorDiv.style.display = 'none';
            }, 5000);
        }
    }
    
    clearEmailLookupState(fieldId) {
        // Remove any existing containers
        const containers = document.querySelectorAll('.otp-verification-container, .new-account-container, .otp-success-container');
        containers.forEach(container => container.remove());
        
        this.clearFlowState(fieldId);
    }
    
    // Flow action management
    addFlowAction(fieldId, action) {
        if (!this.flowActions.has(fieldId)) {
            this.flowActions.set(fieldId, []);
        }
        this.flowActions.get(fieldId).push(action);
    }
    
    getFieldFlowActions(fieldId) {
        return this.flowActions.get(fieldId) || [];
    }
    
    async executeFlowAction(action, fieldId, value, field) {
        switch (action.type) {
            case 'email_lookup':
                await this.handleEmailFieldChange(fieldId, value, field);
                break;
            case 'conditional_navigation':
                this.handleConditionalNavigation(action, value);
                break;
            case 'populate_field':
                this.populateField(action.targetField, action.value || value);
                break;
            // Add more action types as needed
        }
    }
    
    handleConditionalNavigation(action, value) {
        const multiPage = window.AppModules.multiPage;
        if (!multiPage) return;
        
        // Check condition
        if (this.evaluateCondition(action.condition, value)) {
            if (action.targetPage) {
                multiPage.goToPage(action.targetPage);
            } else if (action.skipPages) {
                // Skip specified pages
                const currentIndex = multiPage.getCurrentPageIndex();
                multiPage.goToPage(currentIndex + action.skipPages + 1);
            }
        }
    }
    
    evaluateCondition(condition, value) {
        switch (condition.operator) {
            case 'equals':
                return value === condition.value;
            case 'not_equals':
                return value !== condition.value;
            case 'contains':
                return value.includes(condition.value);
            case 'not_contains':
                return !value.includes(condition.value);
            case 'empty':
                return !value || value.trim() === '';
            case 'not_empty':
                return value && value.trim() !== '';
            default:
                return false;
        }
    }
    
    populateField(fieldId, value) {
        const field = document.getElementById(fieldId) || document.querySelector(`[name="${fieldId}"]`);
        if (field) {
            field.value = value;
            field.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
    
    // Flow state management
    setFlowState(fieldId, state, data = null) {
        this.flowStates.set(fieldId, { state, data, timestamp: Date.now() });
    }
    
    getFlowState(fieldId) {
        return this.flowStates.get(fieldId);
    }
    
    clearFlowState(fieldId) {
        this.flowStates.delete(fieldId);
    }
    
    // Utility methods
    getFieldValue(field) {
        switch (field.type) {
            case 'checkbox':
                return field.checked;
            case 'radio':
                return field.checked ? field.value : null;
            case 'select-multiple':
                return Array.from(field.selectedOptions).map(option => option.value);
            default:
                return field.value;
        }
    }
    
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
    
    handlePageChange(pageInfo) {
        // Handle any page-specific flow logic
        console.log('Page changed:', pageInfo);
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
        
        console.warn('Could not determine current form ID for email configuration');
        return null;
    }
}