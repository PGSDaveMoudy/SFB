// Test script for conditional visibility in form viewer
// This script can be run in the browser console on a published form

// Test 1: Check if conditional logic module is loaded
console.log('=== Testing Conditional Visibility ===');
console.log('1. Conditional Logic Module:', window.AppModules?.conditionalLogic ? 'Loaded' : 'Not loaded');

// Test 2: Check field values tracking
if (window.AppModules?.conditionalLogic) {
    const cl = window.AppModules.conditionalLogic;
    console.log('2. Field Values Map:', cl.fieldValues);
    console.log('   - Size:', cl.fieldValues.size);
    console.log('   - Values:', Array.from(cl.fieldValues.entries()));
}

// Test 3: Check page conditions
if (window.AppModules?.conditionalLogic) {
    const cl = window.AppModules.conditionalLogic;
    console.log('3. Page Conditions Map:', cl.pageConditions);
    console.log('   - Size:', cl.pageConditions.size);
    console.log('   - Conditions:', Array.from(cl.pageConditions.entries()));
}

// Test 4: Check field conditions
if (window.AppModules?.conditionalLogic) {
    const cl = window.AppModules.conditionalLogic;
    console.log('4. Field Conditions Map:', cl.conditions);
    console.log('   - Size:', cl.conditions.size);
    console.log('   - Conditions:', Array.from(cl.conditions.entries()));
}

// Test 5: Check navigation button visibility
if (window.AppModules?.multiPage) {
    const mp = window.AppModules.multiPage;
    console.log('5. Navigation Button Checks:');
    console.log('   - Current Page Index:', mp.currentPageIndex);
    console.log('   - Should Show Next:', mp.shouldShowNavigationButton('next'));
    console.log('   - Should Show Submit:', mp.shouldShowNavigationButton('submit'));
    console.log('   - Page Visibility Map:', Array.from(mp.pageVisibility.entries()));
}

// Test 6: Trigger field change to test dynamic updates
console.log('6. Testing Field Change Trigger:');
const testField = document.querySelector('input, select, textarea');
if (testField) {
    console.log('   - Triggering change on field:', testField.name || testField.id);
    const event = new Event('change', { bubbles: true });
    testField.dispatchEvent(event);
    console.log('   - Change event dispatched');
}

// Test 7: Force re-evaluation of all conditions
console.log('7. Force Re-evaluation:');
if (window.AppModules?.conditionalLogic) {
    window.AppModules.conditionalLogic.evaluateAllConditions();
    console.log('   - All conditions re-evaluated');
}

// Test 8: Check current navigation button states
console.log('8. Current Navigation Button States:');
const prevBtn = document.getElementById('prevPageBtn');
const nextBtn = document.getElementById('nextPageBtn');
const submitBtn = document.getElementById('submitBtn');
console.log('   - Previous Button:', prevBtn ? prevBtn.style.display : 'Not found');
console.log('   - Next Button:', nextBtn ? nextBtn.style.display : 'Not found');
console.log('   - Submit Button:', submitBtn ? submitBtn.style.display : 'Not found');

console.log('=== Test Complete ===');