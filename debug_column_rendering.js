// Debug script to test column field rendering
console.log('🧪 Column Rendering Debug Script');

// Function to test column field structure
function debugColumnField() {
    console.log('=== Column Field Debug ===');
    
    // Find all columns fields in the current page
    if (window.AppModules && window.AppModules.formBuilder) {
        const formBuilder = window.AppModules.formBuilder;
        const currentPage = formBuilder.getCurrentPage();
        
        console.log('Current page fields:', currentPage.fields);
        
        // Find column fields
        const columnFields = currentPage.fields.filter(f => f.type === 'columns');
        console.log(`Found ${columnFields.length} column field(s):`, columnFields);
        
        columnFields.forEach((field, index) => {
            console.log(`\nColumn Field ${index + 1}:`, {
                id: field.id,
                type: field.type,
                columnsConfig: field.columnsConfig
            });
            
            if (field.columnsConfig && field.columnsConfig.columns) {
                field.columnsConfig.columns.forEach((column, colIndex) => {
                    console.log(`  Column ${colIndex}:`, {
                        width: column.width,
                        fieldsCount: column.fields ? column.fields.length : 0,
                        fields: column.fields || []
                    });
                });
            }
        });
        
        // Test DOM rendering
        console.log('\n=== DOM Debug ===');
        const columnDropzones = document.querySelectorAll('.column-dropzone');
        console.log(`Found ${columnDropzones.length} column dropzones in DOM`);
        
        columnDropzones.forEach((dropzone, index) => {
            const fieldsInDropzone = dropzone.querySelectorAll('.form-field');
            console.log(`Column dropzone ${index}:`, {
                dataColumnIndex: dropzone.dataset.columnIndex,
                dataColumnsId: dropzone.dataset.columnsId,
                fieldsInDOM: fieldsInDropzone.length,
                innerHTML: dropzone.innerHTML.length > 200 ? `${dropzone.innerHTML.substring(0, 200)}...` : dropzone.innerHTML
            });
        });
    } else {
        console.error('FormBuilder not available');
    }
}

// Function to test adding a field
function testAddFieldToColumn() {
    console.log('\n=== Test Add Field to Column ===');
    
    if (window.AppModules && window.AppModules.formBuilder) {
        const formBuilder = window.AppModules.formBuilder;
        
        // Find the first column dropzone
        const columnDropzone = document.querySelector('.column-dropzone[data-columns-id][data-column-index]');
        
        if (columnDropzone) {
            const columnsId = columnDropzone.dataset.columnsId;
            const columnIndex = columnDropzone.dataset.columnIndex;
            const containerId = `${columnsId}_${columnIndex}`;
            
            console.log('Testing with:', { columnsId, columnIndex, containerId });
            
            try {
                const field = formBuilder.addFieldToContainer('text', containerId, 'column', 0);
                console.log('✅ Field added successfully:', field);
                
                // Check the data structure again
                setTimeout(() => {
                    debugColumnField();
                }, 100);
                
            } catch (error) {
                console.error('❌ Error adding field:', error);
            }
        } else {
            console.error('No column dropzone found for testing');
        }
    }
}

// Auto-run debug after a delay
setTimeout(() => {
    debugColumnField();
}, 1000);

// Make functions available globally for manual testing
window.debugColumnField = debugColumnField;
window.testAddFieldToColumn = testAddFieldToColumn;