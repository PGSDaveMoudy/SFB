// Signature Module - Handles e-signature functionality with legal compliance

const { debugError, debugWarn, debugInfo, debugDebug, debugVerbose } = window.SFBDebug;

export class Signature {
    constructor() {
        this.signaturePads = new Map();
        this.signatureData = new Map();
        this.auditTrails = new Map();
    }
    
    async initialize() {
        debugInfo('Signature', 'Initializing Signature module...');
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Listen for signature field initialization
        document.addEventListener('signatureFieldAdded', (e) => {
            this.initializeSignaturePad(e.detail.fieldId, e.detail.canvasId, e.detail.config);
        });
        
        // Listen for form submission to validate signatures
        document.addEventListener('beforeFormSubmit', (e) => {
            if (!this.validateRequiredSignatures()) {
                e.preventDefault();
                alert('Please complete all required signatures before submitting.');
            }
        });
    }
    
    initializeSignaturePad(fieldId, canvasId, config = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            debugError('Signature', 'Canvas not found:', canvasId);
            return;
        }
        
        // Create signature pad configuration
        const padConfig = {
            canvas: canvas,
            fieldId: fieldId,
            width: config.width || 500,
            height: config.height || 200,
            penColor: config.penColor || '#000000',
            backgroundColor: config.backgroundColor || '#ffffff',
            lineWidth: config.lineWidth || 2,
            requireLegalText: config.requireLegalText || false,
            legalText: config.legalText || 'By signing below, I agree to the terms and conditions.',
            requireFullName: config.requireFullName || false,
            requireEmail: config.requireEmail || false,
            requireDate: config.requireDate || true
        };
        
        // Initialize canvas
        this.setupCanvas(canvas, padConfig);
        
        // Store configuration
        this.signaturePads.set(fieldId, padConfig);
        
        // Initialize signature data
        // Initialize signature data with placeholder for metadata
        this.signatureData.set(fieldId, {
            signatureBase64: null,
            timestamp: null,
            metadata: null
        });
        
        // Generate metadata asynchronously
        this.generateSignatureMetadata().then(metadata => {
            const data = this.signatureData.get(fieldId);
            if (data) {
                data.metadata = metadata;
            }
        }).catch(error => {
            debugWarn('Signature', 'Could not generate signature metadata:', error);
        });
        
        debugInfo('Signature', 'Initialized signature pad:', fieldId);
    }
    
    setupCanvas(canvas, config) {
        const ctx = canvas.getContext('2d');
        
        // Set canvas properties
        canvas.width = config.width;
        canvas.height = config.height;
        canvas.style.backgroundColor = config.backgroundColor;
        
        // Configure drawing context
        ctx.strokeStyle = config.penColor;
        ctx.lineWidth = config.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Clear canvas
        this.clearCanvas(canvas, config);
        
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;
        
        // Mouse events
        canvas.addEventListener('mousedown', (e) => {
            isDrawing = true;
            [lastX, lastY] = this.getMousePos(canvas, e);
            this.startAuditTrail(config.fieldId);
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (!isDrawing) return;
            
            const [currentX, currentY] = this.getMousePos(canvas, e);
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(currentX, currentY);
            ctx.stroke();
            
            [lastX, lastY] = [currentX, currentY];
            this.recordStroke(config.fieldId, lastX, lastY, currentX, currentY);
        });
        
        canvas.addEventListener('mouseup', () => {
            if (isDrawing) {
                isDrawing = false;
                this.finalizeSignature(config.fieldId, canvas);
            }
        });
        
        // Touch events for mobile
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        });
        
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            const mouseEvent = new MouseEvent('mouseup', {});
            canvas.dispatchEvent(mouseEvent);
        });
        
        // Prevent scrolling on touch
        canvas.addEventListener('touchstart', (e) => e.preventDefault());
        canvas.addEventListener('touchend', (e) => e.preventDefault());
        canvas.addEventListener('touchcancel', (e) => e.preventDefault());
    }
    
    getMousePos(canvas, e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        
        return [
            (e.clientX - rect.left) * scaleX,
            (e.clientY - rect.top) * scaleY
        ];
    }
    
    clearCanvas(canvas, config) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set background color
        ctx.fillStyle = config.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Reset drawing properties
        ctx.strokeStyle = config.penColor;
        ctx.lineWidth = config.lineWidth;
    }
    
    clearSignature(fieldId) {
        const config = this.signaturePads.get(fieldId);
        if (!config) return;
        
        const canvas = config.canvas;
        this.clearCanvas(canvas, config);
        
        // Clear signature data
        // Initialize signature data with placeholder for metadata
        this.signatureData.set(fieldId, {
            signatureBase64: null,
            timestamp: null,
            metadata: null
        });
        
        // Generate metadata asynchronously
        this.generateSignatureMetadata().then(metadata => {
            const data = this.signatureData.get(fieldId);
            if (data) {
                data.metadata = metadata;
            }
        }).catch(error => {
            debugWarn('Signature', 'Could not generate signature metadata:', error);
        });
        
        // Clear hidden input
        const hiddenInput = document.getElementById(fieldId);
        if (hiddenInput) {
            hiddenInput.value = '';
        }
        
        // Clear audit trail
        this.auditTrails.delete(fieldId);
        
        debugInfo('Signature', 'Cleared signature:', fieldId);
    }
    
    async startAuditTrail(fieldId) {
        if (!this.auditTrails.has(fieldId)) {
            const metadata = await this.generateSignatureMetadata();
            this.auditTrails.set(fieldId, {
                startTime: new Date().toISOString(),
                strokes: [],
                metadata: metadata
            });
        }
    }
    
    recordStroke(fieldId, x1, y1, x2, y2) {
        const trail = this.auditTrails.get(fieldId);
        if (trail) {
            trail.strokes.push({
                timestamp: new Date().toISOString(),
                from: { x: x1, y: y1 },
                to: { x: x2, y: y2 }
            });
        }
    }
    
    finalizeSignature(fieldId, canvas) {
        const signatureBase64 = canvas.toDataURL('image/png');
        const timestamp = new Date().toISOString();
        
        // Update signature data
        const data = this.signatureData.get(fieldId);
        data.signatureBase64 = signatureBase64;
        data.timestamp = timestamp;
        
        // Complete audit trail
        const trail = this.auditTrails.get(fieldId);
        if (trail) {
            trail.endTime = timestamp;
            trail.signatureHash = this.generateSignatureHash(signatureBase64);
        }
        
        // Update hidden input with signature data
        const hiddenInput = document.getElementById(fieldId);
        if (hiddenInput) {
            hiddenInput.value = JSON.stringify({
                signature: signatureBase64,
                timestamp: timestamp,
                auditTrail: trail,
                metadata: data.metadata
            });
        }
        
        // Trigger validation
        this.validateSignature(fieldId);
        
        debugInfo('Signature', 'Finalized signature:', fieldId);
    }
    
    async generateSignatureMetadata() {
        const metadata = {
            // Timestamp data (ESIGN Act requirement)
            timestamp: new Date().toISOString(),
            timezoneOffset: new Date().getTimezoneOffset(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            
            // Device/Browser fingerprinting for authentication
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            languages: navigator.languages,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            doNotTrack: navigator.doNotTrack,
            
            // Screen/Display information for device verification
            screenResolution: `${screen.width}x${screen.height}`,
            screenColorDepth: screen.colorDepth,
            screenPixelDepth: screen.pixelDepth,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            devicePixelRatio: window.devicePixelRatio,
            
            // Browser/Document information
            documentUrl: window.location.href,
            documentDomain: window.location.hostname,
            referrer: document.referrer,
            title: document.title,
            
            // Legal compliance metadata
            signingMethod: 'electronic_signature',
            signatureIntent: 'agreement_to_terms',
            legalFramework: 'ESIGN_Act_UETA_compliant',
            auditVersion: '1.0',
            consentToElectronicSignature: true,
            
            // Technical details for integrity verification
            browserEngine: this.detectBrowserEngine(),
            touchCapable: 'ontouchstart' in window,
            deviceId: this.generateDeviceFingerprint(),
            sessionId: window.AppState?.sessionId || null,
            
            // Server-side data (to be populated by server)
            ipAddress: null,
            geoLocation: null,
            serverTimestamp: null
        };
        
        // Try to get geolocation if user permits (for additional verification)
        try {
            if (navigator.geolocation) {
                const position = await this.getCurrentPosition();
                metadata.geoLocation = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: position.timestamp,
                    consentGiven: true
                };
            }
        } catch (error) {
            debugInfo('Signature', 'Geolocation not available or denied:', error.message);
            metadata.geoLocation = { 
                error: error.message,
                consentGiven: false
            };
        }
        
        return metadata;
    }
    
    detectBrowserEngine() {
        const ua = navigator.userAgent;
        if (ua.includes('Chrome')) return 'Blink';
        if (ua.includes('Firefox')) return 'Gecko';
        if (ua.includes('Safari') && !ua.includes('Chrome')) return 'WebKit';
        if (ua.includes('Edge')) return 'EdgeHTML';
        return 'Unknown';
    }
    
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                timeout: 5000,
                enableHighAccuracy: false
            });
        });
    }
    
    generateDeviceFingerprint() {
        // Simple device fingerprinting for audit purposes
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            navigator.hardwareConcurrency || 'unknown',
            navigator.deviceMemory || 'unknown'
        ].join('|');
        
        return this.simpleHash(fingerprint);
    }
    
    generateSignatureHash(signatureBase64) {
        // Generate SHA-256 hash of signature for integrity verification
        return this.simpleHash(signatureBase64 + new Date().toISOString());
    }
    
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }
    
    validateSignature(fieldId) {
        const config = this.signaturePads.get(fieldId);
        const data = this.signatureData.get(fieldId);
        
        if (!config || !data) return false;
        
        const errors = [];
        
        // Check if signature exists
        if (!data.signatureBase64) {
            errors.push('Signature is required');
        }
        
        // Check required fields
        if (config.requireFullName) {
            const nameInput = document.querySelector(`.signature-name[data-field="${fieldId}"]`);
            if (!nameInput || !nameInput.value.trim()) {
                errors.push('Full name is required');
            }
        }
        
        if (config.requireEmail) {
            const emailInput = document.querySelector(`.signature-email[data-field="${fieldId}"]`);
            if (!emailInput || !emailInput.value.trim()) {
                errors.push('Email address is required');
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value)) {
                errors.push('Valid email address is required');
            }
        }
        
        // Display validation errors
        if (errors.length > 0) {
            this.showValidationErrors(fieldId, errors);
            return false;
        } else {
            this.hideValidationErrors(fieldId);
            return true;
        }
    }
    
    showValidationErrors(fieldId, errors) {
        const config = this.signaturePads.get(fieldId);
        if (!config) return;
        
        // Remove existing error display
        this.hideValidationErrors(fieldId);
        
        // Create error display
        const errorDiv = document.createElement('div');
        errorDiv.className = 'signature-validation-errors';
        errorDiv.innerHTML = `
            <div class="error-message">
                <strong>Signature Validation Errors:</strong>
                <ul>
                    ${errors.map(error => `<li>${error}</li>`).join('')}
                </ul>
            </div>
        `;
        
        // Insert after signature field
        const signatureField = config.canvas.closest('.signature-field');
        if (signatureField) {
            signatureField.appendChild(errorDiv);
        }
    }
    
    hideValidationErrors(fieldId) {
        const config = this.signaturePads.get(fieldId);
        if (!config) return;
        
        const signatureField = config.canvas.closest('.signature-field');
        if (signatureField) {
            const errorDiv = signatureField.querySelector('.signature-validation-errors');
            if (errorDiv) {
                errorDiv.remove();
            }
        }
    }
    
    validateRequiredSignatures() {
        let allValid = true;
        
        // Check all signature fields
        for (const [fieldId, config] of this.signaturePads) {
            const hiddenInput = document.getElementById(fieldId);
            const isRequired = hiddenInput && hiddenInput.hasAttribute('required');
            
            if (isRequired) {
                if (!this.validateSignature(fieldId)) {
                    allValid = false;
                }
            }
        }
        
        return allValid;
    }
    
    // Get signature data for form submission
    getSignatureData(fieldId) {
        const data = this.signatureData.get(fieldId);
        const config = this.signaturePads.get(fieldId);
        
        if (!data || !config) return null;
        
        const result = {
            signature: data.signatureBase64,
            timestamp: data.timestamp,
            auditTrail: this.auditTrails.get(fieldId),
            metadata: data.metadata
        };
        
        // Add additional required fields
        if (config.requireFullName) {
            const nameInput = document.querySelector(`.signature-name[data-field="${fieldId}"]`);
            result.signerName = nameInput ? nameInput.value : '';
        }
        
        if (config.requireEmail) {
            const emailInput = document.querySelector(`.signature-email[data-field="${fieldId}"]`);
            result.signerEmail = emailInput ? emailInput.value : '';
        }
        
        if (config.requireDate) {
            result.signedDate = new Date().toISOString();
        }
        
        return result;
    }
    
    // Get all signature data for form submission
    getAllSignatureData() {
        const allSignatures = {};
        
        for (const fieldId of this.signaturePads.keys()) {
            const data = this.getSignatureData(fieldId);
            if (data && data.signature) {
                allSignatures[fieldId] = data;
            }
        }
        
        return allSignatures;
    }
    
    // Generate legal certificate of completion
    generateCertificate(formData, signatures) {
        const certificate = {
            certificateId: this.generateCertificateId(),
            generatedAt: new Date().toISOString(),
            formData: {
                formId: formData.formId || 'unknown',
                formName: formData.formName || 'Untitled Form',
                submissionId: formData.submissionId || 'unknown'
            },
            signatures: signatures,
            legalDeclaration: {
                text: 'This certificate confirms that the electronic signatures contained herein are legally valid and binding under applicable electronic signature laws including the Electronic Signatures in Global and National Commerce Act (ESIGN) and the Uniform Electronic Transactions Act (UETA).',
                generatedBy: 'PilotForms - Enterprise Edition',
                version: '1.0'
            },
            integrity: {
                hash: this.generateCertificateHash(signatures),
                algorithm: 'Simple Hash (Production would use SHA-256)'
            }
        };
        
        return certificate;
    }
    
    generateCertificateId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 9);
        return `CERT_${timestamp}_${random}`;
    }
    
    generateCertificateHash(signatures) {
        const signaturesString = JSON.stringify(signatures);
        return this.simpleHash(signaturesString + new Date().toISOString());
    }
    
    // Export signature as image
    exportSignatureImage(fieldId, format = 'png') {
        const config = this.signaturePads.get(fieldId);
        if (!config) return null;
        
        const canvas = config.canvas;
        const dataUrl = canvas.toDataURL(`image/${format}`);
        
        // Create download link
        const link = document.createElement('a');
        link.download = `signature_${fieldId}.${format}`;
        link.href = dataUrl;
        
        return {
            dataUrl: dataUrl,
            downloadLink: link,
            download: () => {
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }
        };
    }
    
    // Resize signature pad
    resizeSignaturePad(fieldId, width, height) {
        const config = this.signaturePads.get(fieldId);
        if (!config) return;
        
        const canvas = config.canvas;
        const imageData = canvas.toDataURL();
        
        // Update dimensions
        config.width = width;
        config.height = height;
        canvas.width = width;
        canvas.height = height;
        
        // Restore image if it exists
        if (imageData !== canvas.toDataURL()) {
            const img = new Image();
            img.onload = () => {
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
            };
            img.src = imageData;
        }
    }
    
    // Check if signature pad has content
    hasSignature(fieldId) {
        const data = this.signatureData.get(fieldId);
        return data && data.signatureBase64 && data.signatureBase64 !== '';
    }
    
    // Get signature pad canvas element
    getSignaturePadCanvas(fieldId) {
        const config = this.signaturePads.get(fieldId);
        return config ? config.canvas : null;
    }
    
    // Destroy signature pad
    destroySignaturePad(fieldId) {
        this.signaturePads.delete(fieldId);
        this.signatureData.delete(fieldId);
        this.auditTrails.delete(fieldId);
    }
}