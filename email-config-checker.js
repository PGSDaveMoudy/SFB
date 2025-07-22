// Email Configuration Checker and Setup Guide
const { exec } = require('child_process');
const fs = require('fs');
const dns = require('dns').promises;

class EmailConfigChecker {
    constructor() {
        this.domain = 'portwoodglobalsolutions.com';
        this.serverIP = '159.196.64.152';
        this.hostname = 'server1.portwoodglobalsolutions.com';
    }

    async checkAll() {
        console.log('🔍 Email Configuration Health Check\n');
        console.log(`Domain: ${this.domain}`);
        console.log(`Server IP: ${this.serverIP}`);
        console.log(`Hostname: ${this.hostname}\n`);
        
        await this.checkDNSRecords();
        await this.checkMailServer();
        await this.checkEmailService();
        this.provideRecommendations();
    }

    async checkDNSRecords() {
        console.log('📋 DNS Records Check:');
        
        // Check SPF
        try {
            const spfRecords = await dns.resolveTxt(this.domain);
            const spfRecord = spfRecords.find(record => record.join('').includes('v=spf1'));
            
            if (spfRecord) {
                const spf = spfRecord.join('');
                console.log(`  ✅ SPF Record: ${spf}`);
                
                if (spf.includes(this.serverIP)) {
                    console.log(`  ✅ Server IP (${this.serverIP}) included in SPF`);
                } else {
                    console.log(`  ⚠️  Server IP (${this.serverIP}) NOT in SPF record`);
                }
            } else {
                console.log('  ❌ No SPF record found');
            }
        } catch (error) {
            console.log('  ❌ SPF check failed:', error.message);
        }
        
        // Check DMARC
        try {
            const dmarcRecords = await dns.resolveTxt(`_dmarc.${this.domain}`);
            const dmarcRecord = dmarcRecords[0]?.join('');
            console.log(`  ✅ DMARC Record: ${dmarcRecord}`);
        } catch (error) {
            console.log('  ❌ DMARC record not found');
        }
        
        // Check reverse DNS
        try {
            const hostnames = await dns.reverse(this.serverIP);
            if (hostnames.includes(this.hostname)) {
                console.log(`  ✅ Reverse DNS: ${this.serverIP} → ${hostnames[0]}`);
            } else {
                console.log(`  ⚠️  Reverse DNS: ${this.serverIP} → ${hostnames[0]} (expected: ${this.hostname})`);
            }
        } catch (error) {
            console.log('  ❌ Reverse DNS check failed:', error.message);
        }
        
        console.log('');
    }

    async checkMailServer() {
        console.log('📨 Mail Server Check:');
        
        return new Promise((resolve) => {
            // Check which mail server is running
            exec('which sendmail && ls -la /usr/sbin/sendmail', (error, stdout, stderr) => {
                if (stdout) {
                    console.log('  ✅ Sendmail binary:', stdout.trim());
                }
                
                // Check mail service status
                exec('systemctl status exim* postfix* sendmail* 2>/dev/null', (error, stdout, stderr) => {
                    if (stdout.includes('active (running)')) {
                        console.log('  ✅ Mail service is running');
                    } else if (stdout.includes('inactive') || stdout.includes('dead')) {
                        console.log('  ⚠️  Mail service is not running');
                    } else {
                        console.log('  ❓ Could not determine mail service status');
                    }
                    
                    // Check mail queue
                    exec('mailq 2>/dev/null || exim -bp 2>/dev/null', (error, stdout, stderr) => {
                        if (stdout) {
                            const queueCount = (stdout.match(/^\s*\d+/gm) || []).length;
                            console.log(`  📬 Mail queue: ${queueCount} messages`);
                        }
                        
                        console.log('');
                        resolve();
                    });
                });
            });
        });
    }

    async checkEmailService() {
        console.log('🔧 Application Email Service Check:');
        
        try {
            const emailService = require('./emailService.js');
            console.log(`  ✅ Email service loaded and ready: ${emailService.isReady()}`);
            
            // Test email generation
            const testOTP = '123456';
            const htmlContent = emailService.generateOTPEmailHTML(testOTP, 'Hello Test', null);
            const hasOTP = htmlContent.includes(testOTP);
            console.log(`  ✅ OTP email generation: ${hasOTP ? 'Working' : 'Failed'}`);
            
        } catch (error) {
            console.log('  ❌ Email service error:', error.message);
        }
        
        console.log('');
    }

    provideRecommendations() {
        console.log('💡 Recommendations:\n');
        
        console.log('🎯 IMMEDIATE ACTIONS:');
        console.log('1. Add missing DMARC record:');
        console.log('   Host: _dmarc');
        console.log('   Type: TXT');
        console.log('   Value: v=DMARC1; p=none; rua=mailto:dmarc@portwoodglobalsolutions.com\n');
        
        console.log('2. Start/configure mail server:');
        console.log('   sudo systemctl start exim4');
        console.log('   sudo systemctl enable exim4\n');
        
        console.log('🚀 PRODUCTION RECOMMENDATIONS:');
        console.log('1. Use SendGrid for better deliverability:');
        console.log('   npm install @sendgrid/mail');
        console.log('   Add SENDGRID_API_KEY to .env\n');
        
        console.log('2. Configure DKIM with your hosting provider\n');
        
        console.log('3. Test email deliverability:');
        console.log('   Send test to mail-tester.com');
        console.log('   Check spam score and fix issues\n');
        
        console.log('🔧 IMMEDIATE TESTING:');
        console.log('1. Test current configuration:');
        console.log('   node test-otp-email.js\n');
        
        console.log('2. Monitor email logs:');
        console.log('   tail -f /var/log/exim4/mainlog');
        console.log('   # or');
        console.log('   tail -f /var/log/mail.log\n');
    }
}

// Run the checker
const checker = new EmailConfigChecker();
checker.checkAll().catch(console.error);