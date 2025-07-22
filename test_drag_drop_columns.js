// Test script for column drag and drop functionality
console.log('🧪 Testing Column Drag & Drop Functionality...');

// Wait for DOM and modules to load
setTimeout(() => {
    // Test 1: Check if DragDrop module is available
    if (window.AppModules && window.AppModules.dragDrop) {
        console.log('✅ DragDrop module found');
        
        // Test 2: Check container listener setup
        try {
            window.AppModules.dragDrop.setupContainerListeners();
            console.log('✅ Container listeners setup completed');
        } catch (error) {
            console.error('❌ Error setting up container listeners:', error);
        }
        
        // Test 3: Count dropzones
        const sections = document.querySelectorAll('.section-fields-dropzone');
        const columns = document.querySelectorAll('.column-dropzone');
        const columnsWithIndex = document.querySelectorAll('.column-dropzone[data-column-index]');
        
        console.log(`📊 Found dropzones:
        - Sections: ${sections.length}
        - Columns (all): ${columns.length}  
        - Columns (with index): ${columnsWithIndex.length}`);
        
        // Test 4: Check listeners on columns
        columns.forEach((column, index) => {
            const hasListeners = column.dataset.listenersSetup === 'true';
            console.log(`Column ${index + 1}:`, {
                hasListeners,
                dataColumnIndex: column.dataset.columnIndex,
                dataColumnsId: column.dataset.columnsId,
                className: column.className
            });
        });
        
        // Test 5: Create a test drag event (simulation)
        const testFieldBlock = document.querySelector('.field-block[data-field-type="text"]');
        if (testFieldBlock) {
            console.log('✅ Found test field block:', testFieldBlock.dataset.fieldType);
            
            // Simulate drag start
            const dragEvent = new DragEvent('dragstart', {
                bubbles: true,
                cancelable: true,
                dataTransfer: new DataTransfer()
            });
            
            testFieldBlock.dispatchEvent(dragEvent);
            console.log('✅ Drag event simulation successful');
        } else {
            console.warn('⚠️ No test field block found for simulation');
        }
        
    } else {
        console.error('❌ DragDrop module not found');
    }
    
    // Test 6: FormBuilder module check
    if (window.AppModules && window.AppModules.formBuilder) {
        console.log('✅ FormBuilder module found');
        
        // Check if addFieldToContainer method exists
        if (typeof window.AppModules.formBuilder.addFieldToContainer === 'function') {
            console.log('✅ addFieldToContainer method available');
        } else {
            console.error('❌ addFieldToContainer method missing');
        }
    } else {
        console.error('❌ FormBuilder module not found');
    }
    
    console.log('🧪 Column drag & drop test completed!');
    
}, 2000); // Wait 2 seconds for modules to initialize