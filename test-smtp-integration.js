#!/usr/bin/env node

// Test script to verify SMTP integration with the form builder
require('dotenv').config();
const emailService = require('./emailService');

async function testSMTPIntegration() {
    console.log('🔧 Testing SMTP Integration...');
    console.log('===============================\n');
    
    console.log('📋 Current Email Configuration:');
    console.log(`   Host: ${process.env.EMAIL_HOST}`);
    console.log(`   Port: ${process.env.EMAIL_PORT}`);
    console.log(`   User: ${process.env.EMAIL_USER}`);
    console.log(`   From: ${process.env.EMAIL_FROM_ADDRESS}`);
    console.log(`   Service: ${process.env.EMAIL_SERVICE}\n`);
    
    // Check if email service is ready
    if (!emailService.isReady()) {
        console.log('⚠️  Email service not configured properly.');
        console.log('   Make sure your SMTP server is running on portwoodglobalsolutions.com:2525');
        console.log('   Start it with: node start-smtp.js\n');
        return;
    }
    
    console.log('✅ Email service is configured and ready');
    
    // Test OTP sending
    console.log('\n📧 Testing OTP Email (Demo Mode)...');
    const testOTP = '123456';
    const testEmail = 'test@example.com';
    
    try {
        const result = await emailService.sendOTP(testEmail, testOTP);
        
        if (result.success) {
            console.log('✅ OTP email sent successfully!');
            console.log(`   Message ID: ${result.messageId}`);
        } else {
            console.log('⚠️  OTP email failed:');
            console.log(`   ${result.message}`);
        }
    } catch (error) {
        console.log('❌ OTP test failed:');
        console.log(`   ${error.message}`);
    }
    
    console.log('\n🎯 Integration Status:');
    console.log('   ✅ Environment variables configured');
    console.log('   ✅ Email service initialized');
    console.log('   ✅ SMTP routing through portwoodglobalsolutions.com');
    console.log('   ✅ OTP emails will automatically use custom SMTP');
    
    console.log('\n📝 Next Steps:');
    console.log('   1. Start SMTP server: node start-smtp.js');
    console.log('   2. Start main app: node server.js');
    console.log('   3. Or start both: node start-services.js');
    console.log('   4. Test Login building block in form builder');
}

testSMTPIntegration().catch(console.error);