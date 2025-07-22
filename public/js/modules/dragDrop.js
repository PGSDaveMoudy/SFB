// DragDrop Module - Handles drag and drop functionality for form builder

export class DragDrop {
    constructor() {
        this.draggedElement = null;
        this.draggedFieldType = null;
        this.draggedFieldId = null;
        this.dropIndicator = null;
        this.isReordering = false;
    }
    
    async initialize() {
        console.log('Initializing DragDrop module...');
        this.setupDropIndicator();
        this.setupPaletteListeners();
        this.setupCanvasListeners();
        
        // Initial setup of container listeners
        setTimeout(() => {
            this.setupContainerListeners();
        }, 500); // Allow time for initial form rendering
    }
    
    setupDropIndicator() {
        this.dropIndicator = document.createElement('div');
        this.dropIndicator.className = 'drop-indicator';
        this.dropIndicator.style.cssText = `
            height: 2px;
            background-color: var(--accent-blue);
            margin: 8px 0;
            border-radius: 1px;
            display: none;
            position: relative;
        `;
        
        // Add glowing effect
        this.dropIndicator.innerHTML = '<div style="height: 100%; background: linear-gradient(90deg, transparent, var(--accent-blue), transparent); animation: pulse 1s ease-in-out infinite;"></div>';
    }
    
    setupPaletteListeners() {
        const fieldBlocks = document.querySelectorAll('.field-block[draggable="true"]');
        
        fieldBlocks.forEach(block => {
            block.addEventListener('dragstart', (e) => this.handlePaletteDragStart(e));
            block.addEventListener('dragend', (e) => this.handleDragEnd(e));
        });
    }
    
    setupCanvasListeners() {
        const canvas = document.getElementById('formCanvas');
        
        // Canvas drop events
        canvas.addEventListener('dragover', (e) => this.handleCanvasDragOver(e));
        canvas.addEventListener('drop', (e) => this.handleCanvasDrop(e));
        canvas.addEventListener('dragenter', (e) => this.handleCanvasDragEnter(e));
        canvas.addEventListener('dragleave', (e) => this.handleCanvasDragLeave(e));
        
        // Set up mutation observer to handle dynamically added form fields and containers
        this.setupFieldObserver();
        
        // Set up container-specific listeners
        this.setupContainerListeners();
    }
    
    setupFieldObserver() {
        const canvas = document.getElementById('formCanvas');
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.classList.contains('form-field')) {
                            console.log('🔍 Setting up drag listeners for field:', node.dataset.fieldId);
                            this.setupFieldDragListeners(node);
                        }
                        
                        // Set up listeners for any nested fields within the added node
                        const nestedFields = node.querySelectorAll && node.querySelectorAll('.form-field');
                        if (nestedFields && nestedFields.length > 0) {
                            console.log(`🔍 Setting up drag listeners for ${nestedFields.length} nested fields`);
                            nestedFields.forEach(field => this.setupFieldDragListeners(field));
                        }
                        
                        // Set up listeners for new container elements
                        if (node.classList.contains('section-fields-dropzone') || 
                            node.classList.contains('column-dropzone') || 
                            node.classList.contains('columns-container') ||
                            node.querySelector('.section-fields-dropzone') ||
                            node.querySelector('.column-dropzone') ||
                            node.querySelector('.columns-container')) {
                            console.log('🔍 Setting up container listeners due to DOM change - detected:', node.className);
                            // Use setTimeout to ensure DOM is fully rendered
                            setTimeout(() => {
                                this.setupContainerListeners();
                            }, 10);
                        }
                    }
                });
            });
        });
        
        observer.observe(canvas, { childList: true, subtree: true });
    }
    
    setupFieldDragListeners(fieldElement) {
        fieldElement.addEventListener('dragstart', (e) => this.handleFieldDragStart(e));
        fieldElement.addEventListener('dragend', (e) => this.handleDragEnd(e));
        fieldElement.addEventListener('dragover', (e) => this.handleFieldDragOver(e));
    }
    
    setupContainerListeners() {
        // Set up listeners for section dropzones
        const sectionDropzones = document.querySelectorAll('.section-fields-dropzone');
        console.log(`🔧 Setting up listeners for ${sectionDropzones.length} section dropzones`);
        sectionDropzones.forEach(dropzone => {
            if (!dropzone.dataset.listenersSetup) {
                dropzone.addEventListener('dragover', (e) => this.handleContainerDragOver(e));
                dropzone.addEventListener('drop', (e) => this.handleContainerDrop(e));
                dropzone.addEventListener('dragenter', (e) => this.handleContainerDragEnter(e));
                dropzone.addEventListener('dragleave', (e) => this.handleContainerDragLeave(e));
                dropzone.dataset.listenersSetup = 'true';
                console.log('✅ Section dropzone listeners set up:', dropzone.dataset.sectionId);
            }
        });
        
        // Set up listeners for column containers - ENHANCED
        const columns = document.querySelectorAll('.column-dropzone');
        console.log(`🔧 Setting up listeners for ${columns.length} column dropzones (all columns)`);
        columns.forEach((column, index) => {
            console.log(`🔍 Column ${index}:`, {
                hasDataColumnIndex: column.hasAttribute('data-column-index'),
                hasDataColumnsId: column.hasAttribute('data-columns-id'),
                dataColumnIndex: column.dataset.columnIndex,
                dataColumnsId: column.dataset.columnsId,
                className: column.className,
                listenersSetup: column.dataset.listenersSetup
            });
            
            // Setup listeners for all column dropzones, not just those with data-column-index
            if (!column.dataset.listenersSetup) {
                column.addEventListener('dragover', (e) => this.handleContainerDragOver(e));
                column.addEventListener('drop', (e) => this.handleContainerDrop(e));
                column.addEventListener('dragenter', (e) => this.handleContainerDragEnter(e));
                column.addEventListener('dragleave', (e) => this.handleContainerDragLeave(e));
                column.dataset.listenersSetup = 'true';
                console.log('✅ Column dropzone listeners set up:', `${column.dataset.columnsId}_${column.dataset.columnIndex}`);
            }
        });
        
        // Additional check - setup listeners specifically for columns with data-column-index
        const columnsWithIndex = document.querySelectorAll('.column-dropzone[data-column-index]');
        if (columnsWithIndex.length !== columns.length) {
            console.log(`⚠️  Mismatch: Found ${columns.length} .column-dropzone elements but ${columnsWithIndex.length} with [data-column-index]`);
        }
    }
    
    handlePaletteDragStart(e) {
        this.draggedFieldType = e.currentTarget.dataset.fieldType;
        this.draggedElement = e.currentTarget;
        this.draggedFieldId = null;
        this.isReordering = false;
        
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/field-type', this.draggedFieldType);
        
        // Add visual feedback
        e.currentTarget.style.opacity = '0.5';
        
        // Add CSS class for styling
        document.body.classList.add('dragging-field');
        
        console.log(`Started dragging field type: ${this.draggedFieldType}`);
    }
    
    handleFieldDragStart(e) {
        this.draggedFieldId = e.currentTarget.dataset.fieldId;
        this.draggedElement = e.currentTarget;
        this.draggedFieldType = null;
        this.isReordering = true;
        
        // Check if we're dragging a container field (columns or section)
        const formBuilder = window.AppModules.formBuilder;
        if (formBuilder) {
            const field = formBuilder.findFieldById(this.draggedFieldId);
            if (field && (field.type === 'columns' || field.type === 'section')) {
                console.log(`🚫 Preventing drag of container field: ${this.draggedFieldId} (${field.type})`);
                // Allow dragging container fields, but we'll handle them specially
                this.isContainerDrag = true;
            } else {
                this.isContainerDrag = false;
            }
        }
        
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/field-id', this.draggedFieldId);
        
        // Add visual feedback
        e.currentTarget.classList.add('dragging');
        
        // Add CSS class for styling
        document.body.classList.add('dragging-field');
        
        console.log(`Started dragging existing field: ${this.draggedFieldId}`);
    }
    
    // Container drag and drop handlers
    handleContainerDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const container = e.currentTarget;
        console.log('🎯 Container drag enter:', container.classList.toString());
        container.classList.add('container-drag-over');
        
        // Prevent the canvas from also receiving the drag enter event
        const canvas = document.getElementById('formCanvas');
        canvas.classList.remove('drag-over');
    }
    
    handleContainerDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        
        // Only remove drag-over if we're actually leaving the container
        const container = e.currentTarget;
        if (!container.contains(e.relatedTarget)) {
            container.classList.remove('container-drag-over');
            this.hideContainerDropIndicator(container);
        }
    }
    
    handleContainerDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = this.isReordering ? 'move' : 'copy';
        
        const container = e.currentTarget;
        console.log('🔄 Container drag over:', container.classList.toString());
        this.showContainerDropIndicator(container, e);
    }
    
    handleContainerDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const container = e.currentTarget;
        console.log('🎯 Container drop:', container.classList.toString(), 'Field type:', this.draggedFieldType, 'Field ID:', this.draggedFieldId);
        container.classList.remove('container-drag-over');
        
        // Prevent dropping container fields into containers
        if (this.isContainerDrag) {
            console.warn('⚠️ Cannot drop container fields into other containers');
            this.hideContainerDropIndicator(container);
            return;
        }
        
        const dropIndex = this.calculateContainerDropIndex(container);
        console.log('📍 Drop index:', dropIndex);
        
        if (this.isReordering && this.draggedFieldId) {
            // Reordering existing field into container
            console.log('🔄 Reordering field into container');
            this.handleFieldReorderToContainer(container, dropIndex);
        } else if (this.draggedFieldType) {
            // Adding new field from palette to container
            console.log('➕ Adding new field to container');
            this.handleNewFieldDropToContainer(container, dropIndex);
        } else {
            console.warn('❌ No field type or field ID found for drop');
        }
        
        this.hideContainerDropIndicator(container);
        window.AppModules.formBuilder.renderFormCanvas();
    }
    
    handleCanvasDragEnter(e) {
        e.preventDefault();
        const canvas = document.getElementById('formCanvas');
        canvas.classList.add('drag-over');
    }
    
    handleCanvasDragLeave(e) {
        // Only remove drag-over if we're actually leaving the canvas
        if (!e.currentTarget.contains(e.relatedTarget)) {
            const canvas = document.getElementById('formCanvas');
            canvas.classList.remove('drag-over');
            this.hideDropIndicator();
        }
    }
    
    handleCanvasDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = this.isReordering ? 'move' : 'copy';
        
        // Show drop indicator at appropriate position
        this.showDropIndicator(e);
    }
    
    handleFieldDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        
        if (this.isReordering && this.draggedElement !== e.currentTarget) {
            this.showDropIndicatorNearField(e.currentTarget, e);
        }
    }
    
    showDropIndicator(e) {
        const canvas = document.getElementById('formCanvas');
        const formFields = Array.from(canvas.querySelectorAll('.form-field')).filter(f => !f.classList.contains('dragging'));
        
        if (formFields.length === 0) {
            // Empty canvas - show indicator in center
            this.showDropIndicatorInCanvas(canvas);
            return;
        }
        
        const mouseY = e.clientY;
        let insertIndex = formFields.length;
        
        // Find the closest field
        for (let i = 0; i < formFields.length; i++) {
            const field = formFields[i];
            const rect = field.getBoundingClientRect();
            const fieldMiddle = rect.top + rect.height / 2;
            
            if (mouseY < fieldMiddle) {
                insertIndex = i;
                break;
            }
        }
        
        // Show indicator at the appropriate position
        if (insertIndex === 0) {
            this.showDropIndicatorBefore(formFields[0]);
        } else if (insertIndex >= formFields.length) {
            this.showDropIndicatorAfter(formFields[formFields.length - 1]);
        } else {
            this.showDropIndicatorBefore(formFields[insertIndex]);
        }
    }
    
    showDropIndicatorNearField(targetField, e) {
        const rect = targetField.getBoundingClientRect();
        const mouseY = e.clientY;
        const fieldMiddle = rect.top + rect.height / 2;
        
        if (mouseY < fieldMiddle) {
            this.showDropIndicatorBefore(targetField);
        } else {
            this.showDropIndicatorAfter(targetField);
        }
    }
    
    showDropIndicatorBefore(field) {
        this.hideDropIndicator();
        field.parentNode.insertBefore(this.dropIndicator, field);
        this.dropIndicator.style.display = 'block';
    }
    
    showDropIndicatorAfter(field) {
        this.hideDropIndicator();
        if (field.nextSibling) {
            field.parentNode.insertBefore(this.dropIndicator, field.nextSibling);
        } else {
            field.parentNode.appendChild(this.dropIndicator);
        }
        this.dropIndicator.style.display = 'block';
    }
    
    showDropIndicatorInCanvas(canvas) {
        this.hideDropIndicator();
        canvas.appendChild(this.dropIndicator);
        this.dropIndicator.style.display = 'block';
    }
    
    hideDropIndicator() {
        if (this.dropIndicator.parentNode) {
            this.dropIndicator.parentNode.removeChild(this.dropIndicator);
        }
        this.dropIndicator.style.display = 'none';
    }
    
    handleCanvasDrop(e) {
        e.preventDefault();
        
        const canvas = document.getElementById('formCanvas');
        canvas.classList.remove('drag-over');
        
        let dropIndex = this.calculateDropIndex();
        
        if (this.isReordering && this.draggedFieldId) {
            // Reordering existing field
            this.handleFieldReorder(dropIndex);
        } else if (this.draggedFieldType) {
            // Adding new field from palette
            this.handleNewFieldDrop(dropIndex);
        }
        
        this.hideDropIndicator();
        window.AppModules.formBuilder.renderFormCanvas();
    }
    
    calculateDropIndex() {
        if (!this.dropIndicator.parentNode) {
            return null;
        }
        
        const canvas = document.getElementById('formCanvas');
        const formFields = Array.from(canvas.querySelectorAll('.form-field')).filter(f => !f.classList.contains('dragging'));
        const indicatorIndex = Array.from(canvas.children).indexOf(this.dropIndicator);
        
        // Count how many form fields are before the indicator
        let dropIndex = 0;
        for (let i = 0; i < indicatorIndex; i++) {
            const child = canvas.children[i];
            if (child.classList.contains('form-field') && !child.classList.contains('dragging')) {
                dropIndex++;
            }
        }
        
        return dropIndex;
    }
    
    handleFieldReorder(dropIndex) {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) return;
        
        const currentPage = formBuilder.getCurrentPage();
        const oldIndex = currentPage.fields.findIndex(f => f.id === this.draggedFieldId);
        
        if (oldIndex !== -1 && dropIndex !== null && dropIndex !== oldIndex) {
            // Adjust drop index if moving down
            if (dropIndex > oldIndex) {
                dropIndex--;
            }
            
            formBuilder.moveField(this.draggedFieldId, dropIndex);
            console.log(`Moved field ${this.draggedFieldId} from index ${oldIndex} to ${dropIndex}`);
        }
    }
    
    handleNewFieldDrop(dropIndex) {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) return;
        
        const field = formBuilder.addField(this.draggedFieldType, dropIndex);
        console.log(`Added new ${this.draggedFieldType} field at index ${dropIndex}`);
        
        // Auto-select the new field
        setTimeout(() => {
            const fieldElement = document.querySelector(`[data-field-id="${field.id}"]`);
            if (fieldElement) {
                formBuilder.selectField(fieldElement);
            }
        }, 100);
    }
    
    handleDragEnd(e) {
        // Clean up visual feedback
        document.body.classList.remove('dragging-field');
        
        if (this.draggedElement) {
            this.draggedElement.style.opacity = '';
            this.draggedElement.classList.remove('dragging');
        }
        
        // Reset container drag flag
        this.isContainerDrag = false;
        
        // Clean up canvas state
        const canvas = document.getElementById('formCanvas');
        canvas.classList.remove('drag-over');
        
        // Clean up container states
        const containers = document.querySelectorAll('.section-fields-dropzone, .column-dropzone');
        containers.forEach(container => {
            container.classList.remove('container-drag-over');
            this.hideContainerDropIndicator(container);
        });
        
        this.hideDropIndicator();
        
        // Reset state
        this.draggedElement = null;
        this.draggedFieldType = null;
        this.draggedFieldId = null;
        this.isReordering = false;
        
        console.log('Drag operation ended');
    }
    
    // Container-specific helper methods
    showContainerDropIndicator(container, e) {
        const fields = Array.from(container.querySelectorAll('.form-field')).filter(f => !f.classList.contains('dragging'));
        
        // Remove existing container indicators
        this.hideContainerDropIndicator(container);
        
        if (fields.length === 0) {
            // Empty container - show indicator in center
            const emptyDiv = container.querySelector('.empty-section, .empty-column');
            if (emptyDiv) {
                emptyDiv.style.display = 'none';
            }
            container.appendChild(this.dropIndicator);
            this.dropIndicator.style.display = 'block';
            return;
        }
        
        const mouseY = e.clientY;
        let insertIndex = fields.length;
        
        // Find the closest field
        for (let i = 0; i < fields.length; i++) {
            const field = fields[i];
            const rect = field.getBoundingClientRect();
            const fieldMiddle = rect.top + rect.height / 2;
            
            if (mouseY < fieldMiddle) {
                insertIndex = i;
                break;
            }
        }
        
        // Show indicator at the appropriate position
        if (insertIndex === 0) {
            container.insertBefore(this.dropIndicator, fields[0]);
        } else if (insertIndex >= fields.length) {
            container.appendChild(this.dropIndicator);
        } else {
            container.insertBefore(this.dropIndicator, fields[insertIndex]);
        }
        
        this.dropIndicator.style.display = 'block';
    }
    
    hideContainerDropIndicator(container) {
        if (this.dropIndicator.parentNode === container) {
            container.removeChild(this.dropIndicator);
            this.dropIndicator.style.display = 'none';
            
            // Show empty state if needed
            const fields = container.querySelectorAll('.form-field');
            if (fields.length === 0) {
                const emptyDiv = container.querySelector('.empty-section, .empty-column');
                if (emptyDiv) {
                    emptyDiv.style.display = 'block';
                }
            }
        }
    }
    
    calculateContainerDropIndex(container) {
        if (!this.dropIndicator.parentNode || this.dropIndicator.parentNode !== container) {
            return null;
        }
        
        const fields = Array.from(container.querySelectorAll('.form-field')).filter(f => !f.classList.contains('dragging'));
        const indicatorIndex = Array.from(container.children).indexOf(this.dropIndicator);
        
        // Count how many form fields are before the indicator
        let dropIndex = 0;
        for (let i = 0; i < indicatorIndex; i++) {
            const child = container.children[i];
            if (child.classList.contains('form-field') && !child.classList.contains('dragging')) {
                dropIndex++;
            }
        }
        
        return dropIndex;
    }
    
    handleFieldReorderToContainer(container, dropIndex) {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) return;
        
        // Determine container type and ID
        let containerId, containerType;
        if (container.classList.contains('section-fields-dropzone')) {
            containerId = container.dataset.sectionId;
            containerType = 'section';
        } else if (container.classList.contains('column-dropzone')) {
            // Check if we have the required attributes
            if (container.hasAttribute('data-column-index') && container.hasAttribute('data-columns-id')) {
                const columnsId = container.dataset.columnsId;
                const columnIndex = parseInt(container.dataset.columnIndex);
                containerId = `${columnsId}_${columnIndex}`;
                containerType = 'column';
                console.log('✅ Column container detected:', {columnsId, columnIndex, containerId});
            } else {
                console.warn('❌ Column dropzone missing required attributes:', {
                    hasColumnIndex: container.hasAttribute('data-column-index'),
                    hasColumnsId: container.hasAttribute('data-columns-id'),
                    columnIndex: container.dataset.columnIndex,
                    columnsId: container.dataset.columnsId,
                    className: container.className
                });
            }
        }
        
        if (containerId) {
            formBuilder.moveFieldToContainer(this.draggedFieldId, containerId, containerType, dropIndex);
            console.log(`Moved field ${this.draggedFieldId} to ${containerType} ${containerId} at index ${dropIndex}`);
        }
    }
    
    handleNewFieldDropToContainer(container, dropIndex) {
        const formBuilder = window.AppModules.formBuilder;
        if (!formBuilder) return;
        
        // Determine container type and ID
        let containerId, containerType;
        if (container.classList.contains('section-fields-dropzone')) {
            containerId = container.dataset.sectionId;
            containerType = 'section';
        } else if (container.classList.contains('column-dropzone')) {
            // Check if we have the required attributes
            if (container.hasAttribute('data-column-index') && container.hasAttribute('data-columns-id')) {
                const columnsId = container.dataset.columnsId;
                const columnIndex = parseInt(container.dataset.columnIndex);
                containerId = `${columnsId}_${columnIndex}`;
                containerType = 'column';
                console.log('✅ Column container detected:', {columnsId, columnIndex, containerId});
            } else {
                console.warn('❌ Column dropzone missing required attributes:', {
                    hasColumnIndex: container.hasAttribute('data-column-index'),
                    hasColumnsId: container.hasAttribute('data-columns-id'),
                    columnIndex: container.dataset.columnIndex,
                    columnsId: container.dataset.columnsId,
                    className: container.className
                });
            }
        }
        
        if (containerId) {
            const field = formBuilder.addFieldToContainer(this.draggedFieldType, containerId, containerType, dropIndex);
            console.log(`Added new ${this.draggedFieldType} field to ${containerType} ${containerId} at index ${dropIndex}`);
            console.log('🔍 Created field details:', field);
            
            // Debug: Check if field appears in DOM after render completes
            setTimeout(() => {
                const fieldElement = document.querySelector(`[data-field-id="${field.id}"]`);
                console.log('🔍 Field element in DOM:', fieldElement);
                
                if (fieldElement) {
                    formBuilder.selectField(fieldElement);
                    console.log('✅ Field selected successfully');
                } else {
                    console.error('❌ Field element not found in DOM after creation');
                    console.log('🔍 All field elements:', document.querySelectorAll('.form-field'));
                    
                    // Check if the column container has the field
                    if (containerType === 'column') {
                        const [columnsId, columnIndex] = containerId.split('_');
                        const container = document.querySelector(`.column-dropzone[data-columns-id="${columnsId}"][data-column-index="${columnIndex}"]`);
                        if (container) {
                            console.log('🔍 Container found:', container);
                            console.log('🔍 Container innerHTML:', container.innerHTML);
                            
                            // Try to find the field within the specific column container
                            const fieldInColumn = container.querySelector(`[data-field-id="${field.id}"]`);
                            if (fieldInColumn) {
                                console.log('✅ Found field in column container, selecting it');
                                formBuilder.selectField(fieldInColumn);
                            } else {
                                console.error('❌ Field not found even in column container');
                            }
                        } else {
                            console.error('❌ Container not found in DOM');
                        }
                    }
                }
            }, 100); // Reduced timeout since we have better error handling
        }
    }
    
    // Method to programmatically trigger field reordering
    moveFieldToIndex(fieldId, newIndex) {
        const formBuilder = window.AppModules.formBuilder;
        if (formBuilder) {
            formBuilder.moveField(fieldId, newIndex);
        }
    }
    
    // Method to get current field order
    getFieldOrder() {
        const canvas = document.getElementById('formCanvas');
        const fieldElements = canvas.querySelectorAll('.form-field');
        return Array.from(fieldElements).map(el => el.dataset.fieldId);
    }
    
    // Method to enable/disable drag and drop
    setEnabled(enabled) {
        const fieldBlocks = document.querySelectorAll('.field-block');
        const formFields = document.querySelectorAll('.form-field');
        
        fieldBlocks.forEach(block => {
            block.draggable = enabled;
        });
        
        formFields.forEach(field => {
            field.draggable = enabled;
        });
    }
    
    // Enhanced touch support for mobile devices
    setupTouchSupport() {
        let touchItem = null;
        let touchOffset = { x: 0, y: 0 };
        let touchStartTime = 0;
        let touchMoved = false;
        let longPressTimer = null;
        const longPressDelay = 500; // milliseconds
        
        document.addEventListener('touchstart', (e) => {
            const target = e.target.closest('.field-block, .form-field');
            if (target && target.draggable) {
                touchStartTime = Date.now();
                touchMoved = false;
                
                const touch = e.touches[0];
                const rect = target.getBoundingClientRect();
                touchOffset.x = touch.clientX - rect.left;
                touchOffset.y = touch.clientY - rect.top;
                
                // Start long press detection
                longPressTimer = setTimeout(() => {
                    if (!touchMoved && touchItem === null) {
                        touchItem = target;
                        
                        // Visual feedback for drag start
                        target.style.opacity = '0.7';
                        target.style.transform = 'scale(1.05)';
                        target.style.zIndex = '1000';
                        target.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.2)';
                        
                        // Haptic feedback if available
                        if (navigator.vibrate) {
                            navigator.vibrate(50);
                        }
                        
                        // Set drag type based on target
                        if (target.classList.contains('field-block')) {
                            this.draggedFieldType = target.dataset.fieldType;
                            this.draggedFieldId = null;
                            this.isReordering = false;
                        } else if (target.classList.contains('form-field')) {
                            this.draggedFieldId = target.dataset.fieldId;
                            this.draggedFieldType = null;
                            this.isReordering = true;
                        }
                        
                        console.log('📱 Touch drag started:', this.draggedFieldType || this.draggedFieldId);
                    }
                }, longPressDelay);
            }
        }, { passive: false });
        
        document.addEventListener('touchmove', (e) => {
            touchMoved = true;
            
            // Clear long press timer if user moves
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            if (touchItem) {
                const touch = e.touches[0];
                
                // Update item position
                touchItem.style.position = 'fixed';
                touchItem.style.left = (touch.clientX - touchOffset.x) + 'px';
                touchItem.style.top = (touch.clientY - touchOffset.y) + 'px';
                touchItem.style.pointerEvents = 'none';
                
                // Find drop target
                const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                
                // Check for canvas drop
                const canvas = document.getElementById('formCanvas');
                if (canvas && (canvas.contains(elementBelow) || elementBelow === canvas)) {
                    this.showDropIndicator({ clientY: touch.clientY });
                    canvas.classList.add('drag-over');
                }
                
                // Check for container drops (sections and columns)
                const container = elementBelow?.closest('.section-fields-dropzone, .column-dropzone');
                if (container) {
                    container.classList.add('container-drag-over');
                    this.showContainerDropIndicator(container, { clientY: touch.clientY });
                }
                
                e.preventDefault();
            }
        }, { passive: false });
        
        document.addEventListener('touchend', (e) => {
            // Clear long press timer
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
            
            if (touchItem) {
                const touch = e.changedTouches[0];
                const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
                
                console.log('📱 Touch drop at:', touch.clientX, touch.clientY, elementBelow);
                
                // Check for container drop first
                const container = elementBelow?.closest('.section-fields-dropzone, .column-dropzone');
                if (container) {
                    console.log('📱 Dropping in container:', container.className);
                    const dropIndex = this.calculateContainerDropIndex(container);
                    
                    if (this.isReordering && this.draggedFieldId) {
                        this.handleFieldReorderToContainer(container, dropIndex);
                    } else if (this.draggedFieldType) {
                        this.handleNewFieldDropToContainer(container, dropIndex);
                    }
                } else {
                    // Check for canvas drop
                    const canvas = document.getElementById('formCanvas');
                    if (canvas && (canvas.contains(elementBelow) || elementBelow === canvas)) {
                        console.log('📱 Dropping in canvas');
                        const dropIndex = this.calculateDropIndex();
                        
                        if (this.isReordering && this.draggedFieldId) {
                            this.handleFieldReorder(dropIndex);
                        } else if (this.draggedFieldType) {
                            this.handleNewFieldDrop(dropIndex);
                        }
                    }
                }
                
                // Cleanup
                this.resetTouchItem(touchItem);
                touchItem = null;
                touchMoved = false;
                
                // Haptic feedback for successful drop
                if (navigator.vibrate) {
                    navigator.vibrate(25);
                }
            }
        }, { passive: false });
    }
    
    // Helper method to reset touch item styles
    resetTouchItem(item) {
        item.style.position = '';
        item.style.left = '';
        item.style.top = '';
        item.style.zIndex = '';
        item.style.opacity = '';
        item.style.transform = '';
        item.style.boxShadow = '';
        item.style.pointerEvents = '';
        
        // Clear visual feedback
        document.querySelectorAll('.drag-over, .container-drag-over').forEach(el => {
            el.classList.remove('drag-over', 'container-drag-over');
        });
        
        this.hideDropIndicator();
        
        // Reset drag state
        this.draggedElement = null;
        this.draggedFieldType = null;
        this.draggedFieldId = null;
        this.isReordering = false;
    }
}