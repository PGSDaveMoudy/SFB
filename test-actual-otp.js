// Test with Actual OTP from logs
// This test uses the actual OTP we saw in the logs

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

async function testWithActualOTP() {
    console.log('🧪 Testing with Actual OTP from Server Logs...\n');
    
    const testEmail = 'actual-test@example.com';
    const testContactId = 'actual123';
    
    try {
        console.log('Step 1: Sending OTP and getting sessionId...');
        const sendResult = await makeRequest('/api/send-otp', {
            email: testEmail,
            contactId: testContactId,
            isResend: false
        });
        
        console.log('Send OTP Response:');
        console.log(`  Status: ${sendResult.status}`);
        console.log(`  SessionId: ${sendResult.data.sessionId}`);
        
        if (sendResult.status !== 200) {
            console.log('❌ Send OTP failed, aborting test');
            return;
        }
        
        const sessionId = sendResult.data.sessionId;
        
        // Wait for email to be processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log('\n📋 Next Steps:');
        console.log('1. Check the server logs for the OTP generated for this session');
        console.log(`2. Use this command: pm2 logs pilotforms | grep -A5 "${sessionId}"`);
        console.log('3. Look for the "🔐 OTP GENERATED:" line');
        console.log('4. Then run the verification test with the actual OTP');
        
        return sessionId;
        
    } catch (error) {
        console.log('❌ Test failed with error:', error.message);
    }
}

async function verifyWithOTP(sessionId, email, otp) {
    console.log(`\n🔍 Verifying OTP: ${otp} for session: ${sessionId}`);
    
    const verifyResult = await makeRequest('/api/verify-otp', {
        email: email,
        otp: otp,
        sessionId: sessionId
    });
    
    console.log('Verify OTP Response:');
    console.log(`  Status: ${verifyResult.status}`);
    console.log(`  Data: ${JSON.stringify(verifyResult.data, null, 2)}`);
    
    if (verifyResult.data.verified) {
        console.log('✅ OTP verification successful!');
    } else {
        console.log('❌ OTP verification failed');
    }
}

// Run the test
testWithActualOTP().then(sessionId => {
    if (sessionId) {
        console.log(`\nTo test verification, run:`);
        console.log(`node -e "const test = require('./test-actual-otp.js'); test.verifyWithOTP('${sessionId}', 'actual-test@example.com', 'ACTUAL_OTP_HERE');"`);
    }
});

// Export for manual testing
module.exports = { verifyWithOTP };