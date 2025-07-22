// Test Email Verify API Endpoint
const http = require('http');

function testEmailVerifyAPI() {
    console.log('🧪 Testing Email Verify API Endpoint\n');
    
    const testData = JSON.stringify({
        email: 'davemoudy@gmail.com'
    });
    
    const options = {
        hostname: 'localhost',
        port: 8080,
        path: '/api/send-otp',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': testData.length
        }
    };
    
    console.log('Making API request to:', `http://${options.hostname}:${options.port}${options.path}`);
    console.log('Request data:', testData);
    console.log('');
    
    const req = http.request(options, (res) => {
        console.log(`Status Code: ${res.statusCode}`);
        console.log('Headers:', res.headers);
        console.log('');
        
        let responseData = '';
        res.on('data', (chunk) => {
            responseData += chunk;
        });
        
        res.on('end', () => {
            console.log('Response body:', responseData);
            
            try {
                const parsedResponse = JSON.parse(responseData);
                console.log('\n📊 Parsed Response:');
                console.log('  Success:', parsedResponse.success);
                console.log('  Email Sent:', parsedResponse.emailSent);
                console.log('  Message:', parsedResponse.message);
                
                if (parsedResponse.demoOtp) {
                    console.log('  🎭 DEMO OTP:', parsedResponse.demoOtp);
                    console.log('  ⚠️  Email verification is in DEMO MODE');
                } else if (parsedResponse.emailSent) {
                    console.log('  ✅ Real email sent successfully');
                } else {
                    console.log('  ❌ Email sending failed');
                }
                
                if (parsedResponse.sessionId) {
                    console.log('  Session ID:', parsedResponse.sessionId);
                }
                
            } catch (error) {
                console.log('❌ Failed to parse JSON response:', error.message);
            }
        });
    });
    
    req.on('error', (error) => {
        console.log('❌ Request failed:', error.message);
    });
    
    req.write(testData);
    req.end();
}

// Run the test
testEmailVerifyAPI();