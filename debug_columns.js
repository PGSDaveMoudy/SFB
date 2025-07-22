// Debug script for column drag and drop functionality
// Run this in the browser console after loading the form builder

console.log('🐛 Column Drag & Drop Debug Script');

function debugColumnSetup() {
    console.log('--- Column Setup Debug ---');
    
    // Check if columns exist
    const columns = document.querySelectorAll('.column-dropzone');
    console.log(`Found ${columns.length} column dropzones:`, columns);
    
    columns.forEach((column, index) => {
        console.log(`Column ${index}:`, {
            classes: column.className,
            columnIndex: column.dataset.columnIndex,
            columnsId: column.dataset.columnsId,
            hasListeners: column.dataset.listenersSetup,
            innerHTML: column.innerHTML.substring(0, 100) + '...'
        });
    });
    
    // Check specific selectors
    const columnsBySelector = document.querySelectorAll('.column-dropzone[data-column-index]');
    console.log(`Found ${columnsBySelector.length} columns by specific selector`);
    
    // Check if drag and drop module exists
    if (window.AppModules && window.AppModules.dragDrop) {
        console.log('✅ Drag and drop module found');
        
        // Try to manually trigger setup
        try {
            window.AppModules.dragDrop.setupContainerListeners();
            console.log('✅ Container listeners setup completed');
        } catch (error) {
            console.error('❌ Error setting up container listeners:', error);
        }
    } else {
        console.error('❌ Drag and drop module not found');
    }
    
    // Check for form fields
    const formFields = document.querySelectorAll('.form-field');
    console.log(`Found ${formFields.length} form fields`);
}

function debugDragStart() {
    console.log('--- Testing Drag Start ---');
    
    // Find a draggable field block
    const fieldBlocks = document.querySelectorAll('.field-block[draggable="true"]');
    console.log(`Found ${fieldBlocks.length} draggable field blocks`);
    
    if (fieldBlocks.length > 0) {
        const firstBlock = fieldBlocks[0];
        console.log('First field block:', firstBlock.dataset.fieldType);
        
        // Simulate drag start
        const dragStartEvent = new DragEvent('dragstart', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer()
        });
        
        firstBlock.dispatchEvent(dragStartEvent);
        console.log('Simulated drag start event');
    }
}

function testColumnEventListeners() {
    console.log('--- Testing Column Event Listeners ---');
    
    const columns = document.querySelectorAll('.column-dropzone[data-column-index]');
    
    columns.forEach((column, index) => {
        console.log(`Testing column ${index}:`);
        
        // Test dragover event
        const dragOverEvent = new DragEvent('dragover', {
            bubbles: true,
            cancelable: true,
            dataTransfer: new DataTransfer()
        });
        
        try {
            column.dispatchEvent(dragOverEvent);
            console.log('✅ Dragover event dispatched successfully');
        } catch (error) {
            console.error('❌ Error dispatching dragover event:', error);
        }
    });
}

// Auto-run debug functions
setTimeout(() => {
    debugColumnSetup();
    setTimeout(() => {
        debugDragStart();
        setTimeout(() => {
            testColumnEventListeners();
        }, 1000);
    }, 1000);
}, 1000);

// Export functions for manual testing
window.debugColumns = {
    debugColumnSetup,
    debugDragStart,
    testColumnEventListeners
};