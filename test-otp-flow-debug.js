// Test OTP Flow Debug - Test the complete flow with logging
// This script tests send OTP -> verify OTP to identify the issue

const http = require('http');

async function makeRequest(path, data) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(data);
        
        const options = {
            hostname: 'localhost',
            port: 8443,
            path: path,
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

async function testCompleteOTPFlow() {
    console.log('🧪 Testing Complete OTP Flow with Debug Logging...\n');
    
    const testEmail = 'debug@example.com';
    const testContactId = 'debug123';
    
    try {
        console.log('Step 1: Sending OTP...');
        const sendResult = await makeRequest('/api/send-otp', {
            email: testEmail,
            contactId: testContactId,
            isResend: false
        });
        
        console.log('Send OTP Response:');
        console.log(`  Status: ${sendResult.status}`);
        console.log(`  Data: ${JSON.stringify(sendResult.data, null, 2)}`);
        
        if (sendResult.status !== 200) {
            console.log('❌ Send OTP failed, aborting test');
            return;
        }
        
        const sessionId = sendResult.data.sessionId;
        console.log(`\n📊 Session ID: ${sessionId}`);
        
        // Wait a moment for the email to be processed
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Now we need the actual OTP from the email or logs
        // For testing, let's try a few common test scenarios
        
        console.log('\nStep 2: Testing OTP verification...');
        console.log('Note: Check server logs for the actual OTP generated');
        
        // Test with dummy OTP first to see the debug output
        console.log('\nTesting with dummy OTP (123456) to see debug info...');
        const verifyResult = await makeRequest('/api/verify-otp', {
            email: testEmail,
            otp: '123456',
            sessionId: sessionId
        });
        
        console.log('Verify OTP Response:');
        console.log(`  Status: ${verifyResult.status}`);
        console.log(`  Data: ${JSON.stringify(verifyResult.data, null, 2)}`);
        
        console.log('\n📋 Instructions:');
        console.log('1. Check the server logs (pm2 logs pilotforms) for the actual OTP');
        console.log('2. The server logs should show the generated OTP and verification attempts');
        console.log('3. Look for lines like: "🔐 OTP GENERATED:" and "🔍 OTP VERIFICATION ATTEMPT:"');
        
    } catch (error) {
        console.log('❌ Test failed with error:', error.message);
    }
}

// Run the test
testCompleteOTPFlow();