// Test script to verify container drag and drop functionality
// This should be run in the browser console after loading the form builder

console.log('🧪 Starting Container Functionality Tests...');

// Test 1: Verify drag and drop module is loaded
if (window.AppModules && window.AppModules.dragDrop) {
    console.log('✅ Drag and drop module is loaded');
} else {
    console.error('❌ Drag and drop module not found');
}

// Test 2: Check if container listeners are set up
function testContainerListeners() {
    const sections = document.querySelectorAll('.section-fields-dropzone');
    const columns = document.querySelectorAll('.column-dropzone[data-column-index]');
    
    console.log(`📊 Found ${sections.length} section dropzones`);
    console.log(`📊 Found ${columns.length} column dropzones`);
    
    let listenersSetup = 0;
    sections.forEach(section => {
        if (section.dataset.listenersSetup) listenersSetup++;
    });
    columns.forEach(column => {
        if (column.dataset.listenersSetup) listenersSetup++;
    });
    
    console.log(`📊 Listeners setup on ${listenersSetup} containers`);
}

// Test 3: Check field removal functionality
function testFieldRemoval() {
    const allFields = document.querySelectorAll('.form-field');
    console.log(`📊 Found ${allFields.length} total fields`);
    
    // Check if delete buttons exist
    const deleteButtons = document.querySelectorAll('.field-delete-btn');
    console.log(`📊 Found ${deleteButtons.length} delete buttons`);
    
    if (deleteButtons.length > 0) {
        console.log('✅ Delete buttons are present');
    } else {
        console.warn('⚠️ No delete buttons found');
    }
}

// Test 4: Check field selection functionality
function testFieldSelection() {
    const fields = document.querySelectorAll('.form-field');
    if (fields.length > 0) {
        const firstField = fields[0];
        const fieldId = firstField.dataset.fieldId;
        
        // Simulate field selection
        firstField.click();
        
        if (window.AppModules.formBuilder.selectedField && 
            window.AppModules.formBuilder.selectedField.id === fieldId) {
            console.log('✅ Field selection working');
        } else {
            console.error('❌ Field selection not working');
        }
    } else {
        console.warn('⚠️ No fields available for testing selection');
    }
}

// Test 5: Verify CSS classes are correct
function testCSSClasses() {
    const expectedClasses = [
        '.section-fields-dropzone',
        '.column-dropzone',
        '.empty-section',
        '.empty-column'
    ];
    
    expectedClasses.forEach(className => {
        const elements = document.querySelectorAll(className);
        console.log(`📊 Found ${elements.length} elements with class ${className}`);
    });
}

// Run all tests
setTimeout(() => {
    testContainerListeners();
    testFieldRemoval();
    testFieldSelection();
    testCSSClasses();
    
    console.log('🏁 Container functionality tests completed');
    console.log('📝 Check the output above for any issues');
}, 1000);

// Export test functions for manual testing
window.containerTests = {
    testContainerListeners,
    testFieldRemoval,
    testFieldSelection,
    testCSSClasses
};