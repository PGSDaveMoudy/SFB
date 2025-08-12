// Test Corrected OTP Implementation
// Tests the fixed rate limiting with reduced timeouts

const http = require('http');

async function makeRequest(data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: 'localhost',
            port: 8443,
            path: '/api/send-otp',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': postData.length
            }
        };
        
        const req = http.request(options, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve({
                        status: res.statusCode,
                        data: parsed
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: { raw: data }
                    });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testCorrectedOTPImplementation() {
    console.log('🧪 Testing Corrected OTP Implementation...\n');
    
    const testEmail = 'corrected-test@example.com';
    const testContactId = 'corrected123';
    
    console.log('Configuration:');
    console.log('  - Client-side debounce: 500ms (prevents double-clicks)');
    console.log('  - Server-side rate limit: 30 seconds');
    console.log('  - Resend bypasses rate limit');
    console.log('');
    
    try {
        // Test 1: First request should always succeed
        console.log('📧 Test 1: Fresh OTP request should succeed...');
        const result1 = await makeRequest({
            email: testEmail,
            contactId: testContactId,
            isResend: false
        });
        
        console.log(`   Status: ${result1.status}`);
        console.log(`   Message: ${result1.data.message || result1.data.error}`);
        
        if (result1.status === 200) {
            console.log('   ✅ First request successful');
        } else {
            console.log('   ❌ First request failed');
        }
        
        console.log('');
        
        // Test 2: Immediate duplicate should be rate limited
        console.log('📧 Test 2: Immediate duplicate should be rate limited...');
        const result2 = await makeRequest({
            email: testEmail,
            contactId: testContactId,
            isResend: false
        });
        
        console.log(`   Status: ${result2.status}`);
        console.log(`   Message: ${result2.data.message || result2.data.error}`);
        
        if (result2.status === 429) {
            console.log('   ✅ Correctly rate limited');
        } else {
            console.log('   ❌ Should have been rate limited');
        }
        
        console.log('');
        
        // Test 3: Resend should bypass rate limit
        console.log('📧 Test 3: Resend should bypass rate limit...');
        const result3 = await makeRequest({
            email: testEmail,
            contactId: testContactId,
            isResend: true
        });
        
        console.log(`   Status: ${result3.status}`);
        console.log(`   Message: ${result3.data.message || result3.data.error}`);
        
        if (result3.status === 200) {
            console.log('   ✅ Resend worked correctly');
        } else {
            console.log('   ❌ Resend should have worked');
        }
        
        console.log('');
        
        // Test 4: After 30+ seconds, new request should work
        console.log('📧 Test 4: Waiting 31 seconds then trying again...');
        console.log('   (This simulates a real user scenario)');
        
        // Wait 31 seconds
        await sleep(31000);
        
        const result4 = await makeRequest({
            email: testEmail,
            contactId: testContactId,
            isResend: false
        });
        
        console.log(`   Status: ${result4.status}`);
        console.log(`   Message: ${result4.data.message || result4.data.error}`);
        
        if (result4.status === 200) {
            console.log('   ✅ Request after timeout successful');
        } else {
            console.log('   ❌ Request after timeout failed');
        }
        
        console.log('\n🏁 Test Summary:');
        console.log(`   Fresh request: ${result1.status === 200 ? '✅' : '❌'}`);
        console.log(`   Duplicate prevention: ${result2.status === 429 ? '✅' : '❌'}`);
        console.log(`   Resend bypass: ${result3.status === 200 ? '✅' : '❌'}`);
        console.log(`   After timeout: ${result4.status === 200 ? '✅' : '❌'}`);
        
        const allPassed = result1.status === 200 && result2.status === 429 && result3.status === 200 && result4.status === 200;
        console.log(`\n${allPassed ? '🎉' : '⚠️'} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
        
        if (allPassed) {
            console.log('\n✅ OTP implementation is working correctly!');
            console.log('   - Users can request OTP immediately');
            console.log('   - Prevents spam with 30-second rate limit');  
            console.log('   - Resend functionality works as expected');
            console.log('   - Users can request new OTP after timeout');
        }
        
    } catch (error) {
        console.log('❌ Test failed with error:', error.message);
    }
}

// Run the test
testCorrectedOTPImplementation();