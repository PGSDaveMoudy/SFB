// Test OTP Duplicate Prevention
// This script tests the rate limiting and duplicate prevention fixes

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

async function testOTPDuplicatePrevention() {
    console.log('🧪 Testing OTP Duplicate Prevention...\n');
    
    const testEmail = 'duplicate-test@example.com';
    const testContactId = 'test123';
    
    console.log('Test Parameters:');
    console.log(`  Email: ${testEmail}`);
    console.log(`  Contact ID: ${testContactId}`);
    console.log('');
    
    try {
        // Test 1: First request should succeed
        console.log('📧 Test 1: First OTP request...');
        const result1 = await makeRequest({
            email: testEmail,
            contactId: testContactId,
            isResend: false
        });
        
        console.log(`   Status: ${result1.status}`);
        console.log(`   Response: ${JSON.stringify(result1.data)}`);
        
        if (result1.status === 200) {
            console.log('   ✅ First request successful');
        } else {
            console.log('   ❌ First request failed');
        }
        
        console.log('');
        
        // Test 2: Immediate second request should be rate limited
        console.log('📧 Test 2: Immediate duplicate request...');
        const result2 = await makeRequest({
            email: testEmail,
            contactId: testContactId,
            isResend: false
        });
        
        console.log(`   Status: ${result2.status}`);
        console.log(`   Response: ${JSON.stringify(result2.data)}`);
        
        if (result2.status === 429) {
            console.log('   ✅ Duplicate request properly rate limited');
        } else {
            console.log('   ❌ Duplicate request was not rate limited');
        }
        
        console.log('');
        
        // Test 3: Resend should still work
        console.log('📧 Test 3: Resend request (should work)...');
        const result3 = await makeRequest({
            email: testEmail,
            contactId: testContactId,
            isResend: true
        });
        
        console.log(`   Status: ${result3.status}`);
        console.log(`   Response: ${JSON.stringify(result3.data)}`);
        
        if (result3.status === 200) {
            console.log('   ✅ Resend request successful');
        } else {
            console.log('   ❌ Resend request failed');
        }
        
        console.log('');
        
        // Test 4: Different email should work
        console.log('📧 Test 4: Different email should work...');
        const result4 = await makeRequest({
            email: 'different@example.com',
            contactId: 'different123',
            isResend: false
        });
        
        console.log(`   Status: ${result4.status}`);
        console.log(`   Response: ${JSON.stringify(result4.data)}`);
        
        if (result4.status === 200) {
            console.log('   ✅ Different email request successful');
        } else {
            console.log('   ❌ Different email request failed');
        }
        
        console.log('\n🏁 Test Summary:');
        console.log(`   First request: ${result1.status === 200 ? '✅' : '❌'}`);
        console.log(`   Duplicate prevention: ${result2.status === 429 ? '✅' : '❌'}`);
        console.log(`   Resend works: ${result3.status === 200 ? '✅' : '❌'}`);
        console.log(`   Different email works: ${result4.status === 200 ? '✅' : '❌'}`);
        
        const allPassed = result1.status === 200 && result2.status === 429 && result3.status === 200 && result4.status === 200;
        console.log(`\n${allPassed ? '🎉' : '⚠️'} Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'}`);
        
    } catch (error) {
        console.log('❌ Test failed with error:', error.message);
    }
}

// Run the test
testOTPDuplicatePrevention();