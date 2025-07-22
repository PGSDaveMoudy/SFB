// Test OTP Email Functionality
const emailService = require('./emailService.js');

async function testOTPEmail() {
    console.log('🧪 Testing OTP Email Functionality...\n');
    
    // Test data
    const testEmail = 'test@example.com';
    const testOTP = '123456';
    const testName = 'Test User';
    
    console.log('Test Parameters:');
    console.log(`  Email: ${testEmail}`);
    console.log(`  OTP: ${testOTP}`);
    console.log(`  Name: ${testName}`);
    console.log('');
    
    if (!emailService.isReady()) {
        console.log('❌ Email service not configured');
        return;
    }
    
    try {
        // Test OTP email generation
        console.log('📧 Generating OTP email content...');
        const htmlContent = emailService.generateOTPEmailHTML(testOTP, `Hello ${testName}`, null);
        const textContent = emailService.generateOTPEmailText(testOTP, `Hello ${testName}`, null);
        
        console.log('✅ Email content generated successfully');
        console.log(`   HTML length: ${htmlContent.length} characters`);
        console.log(`   Text length: ${textContent.length} characters`);
        console.log(`   OTP appears in HTML: ${htmlContent.includes(testOTP) ? '✅ Yes' : '❌ No'}`);
        console.log(`   OTP appears in text: ${textContent.includes(testOTP) ? '✅ Yes' : '❌ No'}`);
        console.log('');
        
        // Show HTML preview
        console.log('📄 HTML Email Preview (first 500 chars):');
        console.log(htmlContent.substring(0, 500) + '...');
        console.log('');
        
        // Test actual sending (dry run - will log instead of sending)
        console.log('📤 Testing email sending...');
        const result = await emailService.sendOTP(testEmail, testOTP, testName);
        
        if (result.success) {
            console.log('✅ Email sending test completed successfully');
            console.log(`   Message ID: ${result.messageId}`);
        } else {
            console.log('⚠️ Email sending test failed:');
            console.log(`   Reason: ${result.message}`);
        }
        
    } catch (error) {
        console.log('❌ Test failed with error:', error.message);
    }
}

// Run the test
testOTPEmail();