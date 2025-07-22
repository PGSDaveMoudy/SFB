// Test OTP Email to Real Address
const emailService = require('./emailService.js');

async function testRealEmail() {
    console.log('📧 Testing OTP Email to Real Address\n');
    
    const realEmail = 'davemoudy@gmail.com';
    const testOTP = '789123';
    const testName = 'Dave';
    
    console.log(`Sending OTP to: ${realEmail}`);
    console.log(`OTP Code: ${testOTP}`);
    console.log('');
    
    try {
        const result = await emailService.sendOTP(realEmail, testOTP, testName);
        
        if (result.success) {
            console.log('✅ OTP Email sent successfully!');
            console.log(`   Message ID: ${result.messageId}`);
            console.log(`   Status: ${result.message}`);
            console.log('');
            console.log('📬 Check your Gmail inbox and spam folder');
            console.log('   Look for email from: Portwood Global Solutions');
            console.log('   Subject: Your Login Verification Code - Portwood Global Solutions');
            console.log(`   OTP in email should be: ${testOTP}`);
        } else {
            console.log('❌ Failed to send OTP email');
            console.log(`   Error: ${result.message}`);
            if (result.error) {
                console.log(`   Details: ${result.error}`);
            }
        }
        
    } catch (error) {
        console.log('❌ Test failed with error:', error.message);
    }
}

// Run the test
testRealEmail();