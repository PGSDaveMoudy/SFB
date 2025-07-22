// Debug script to test column dropzone functionality
console.log('=== Column Dropzone Debug ===');

// Test column dropzone selection
const columns = document.querySelectorAll('.column-dropzone[data-column-index]');
console.log(`Found ${columns.length} column dropzones with data-column-index attribute`);

columns.forEach((column, index) => {
    console.log(`Column ${index}:`, {
        className: column.className,
        dataColumnIndex: column.dataset.columnIndex,
        dataColumnsId: column.dataset.columnsId,
        listenersSetup: column.dataset.listenersSetup,
        hasEventListeners: !!column.onclick
    });
});

// Test if DragDrop module is available
if (window.AppModules && window.AppModules.dragDrop) {
    console.log('DragDrop module is available');
    
    // Test container listener setup
    try {
        window.AppModules.dragDrop.setupContainerListeners();
        console.log('Container listeners setup completed');
    } catch (error) {
        console.error('Error setting up container listeners:', error);
    }
} else {
    console.error('DragDrop module not found');
}

// Test event listener attachment
columns.forEach((column, index) => {
    const events = ['dragover', 'drop', 'dragenter', 'dragleave'];
    events.forEach(eventType => {
        const hasListener = column.addEventListener ? true : false;
        console.log(`Column ${index} can add ${eventType} listener:`, hasListener);
    });
});

console.log('=== End Debug ===');