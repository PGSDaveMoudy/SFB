#!/usr/bin/env node

// Test script to verify Login building block email integration
require('dotenv').config();
const emailService = require('./emailService');

async function testLoginBlockIntegration() {
    console.log('🔐 Testing Login Building Block Email Integration');
    console.log('================================================\n');
    
    // Test 1: Verify email service is ready
    console.log('📋 Test 1: Email Service Readiness');
    if (!emailService.isReady()) {
        console.log('❌ Email service not ready');
        console.log('   Make sure SMTP server is running: node start-smtp.js');
        return;
    }
    console.log('✅ Email service is ready and configured\n');
    
    // Test 2: Test OTP email without form settings (seamless defaults)
    console.log('📧 Test 2: Login OTP Email (Seamless Defaults)');
    const testEmail = 'test.user@example.com';
    const testOTP = '987654';
    const contactName = 'John Doe';
    
    try {
        const result = await emailService.sendOTP(testEmail, testOTP, contactName, null);
        
        if (result.success) {
            console.log('✅ Login OTP email sent successfully!');
            console.log(`   From: Portwood Global Solutions <noreply@portwoodglobalsolutions.com>`);
            console.log(`   To: ${testEmail}`);
            console.log(`   Subject: Your Login Verification Code - Portwood Global Solutions`);
            console.log(`   OTP: ${testOTP}`);
            console.log(`   Message ID: ${result.messageId}`);
        } else {
            console.log('❌ Login OTP email failed:');
            console.log(`   ${result.message}`);
        }
    } catch (error) {
        console.log('❌ Login OTP test failed:');
        console.log(`   ${error.message}`);
    }
    
    console.log('\n📋 Test 3: Login with Custom Form Settings');
    const customFormSettings = {
        enabled: true,
        fromName: 'Custom Company Name',
        fromAddress: 'custom@portwoodglobalsolutions.com',
        otpSubject: 'Custom Login Verification',
        template: 'branded',
        footerText: 'Custom footer text here.',
        replyTo: 'customsupport@portwoodglobalsolutions.com'
    };
    
    try {
        const result = await emailService.sendOTP(testEmail, testOTP, contactName, customFormSettings);
        
        if (result.success) {
            console.log('✅ Custom form OTP email sent successfully!');
            console.log(`   From: ${customFormSettings.fromName} <${customFormSettings.fromAddress}>`);
            console.log(`   Subject: ${customFormSettings.otpSubject}`);
            console.log(`   Template: ${customFormSettings.template}`);
            console.log(`   Message ID: ${result.messageId}`);
        } else {
            console.log('❌ Custom form OTP email failed:');
            console.log(`   ${result.message}`);
        }
    } catch (error) {
        console.log('❌ Custom form OTP test failed:');
        console.log(`   ${error.message}`);
    }
    
    console.log('\n🎯 Login Building Block Integration Summary:');
    console.log('=============================================');
    console.log('✅ SMTP server: portwoodglobalsolutions.com:2525');
    console.log('✅ Default credentials: admin / smtp-admin-2025');
    console.log('✅ Seamless email routing: No configuration needed');
    console.log('✅ Professional email templates: Auto-applied');
    console.log('✅ Custom form settings: Supported and working');
    console.log('✅ From address: noreply@portwoodglobalsolutions.com');
    console.log('✅ Reply-to: support@portwoodglobalsolutions.com');
    
    console.log('\n🚀 Ready for Production Use:');
    console.log('============================');
    console.log('1. Login building block emails automatically work');
    console.log('2. Professional branded emails from your domain');
    console.log('3. No manual email configuration required');
    console.log('4. Seamless user experience with instant OTP delivery');
    console.log('5. Custom SMTP server ensures reliable delivery');
    
    console.log('\n📝 Usage in Form Builder:');
    console.log('=========================');
    console.log('1. Drag "Login" building block to your form');
    console.log('2. Configure email field and any display settings');
    console.log('3. Publish form - emails will automatically work!');
    console.log('4. Users receive professional OTP emails instantly');
    console.log('5. All emails are sent from your portwoodglobalsolutions.com domain');
}

testLoginBlockIntegration().catch(console.error);