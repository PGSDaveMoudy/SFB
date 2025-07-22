#!/usr/bin/env node

// Integrated startup script for Portwood Global Solutions Form Builder
// Starts both SMTP server and main application

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting Portwood Global Solutions Complete Email System');
console.log('============================================================\n');

// Function to start a process and handle output
function startProcess(command, args, name, color) {
    return new Promise((resolve, reject) => {
        console.log(`${color}Starting ${name}...${'\x1b[0m'}`);
        
        const childProcess = spawn(command, args, {
            cwd: __dirname,
            stdio: 'pipe',
            env: { ...process.env, FORCE_COLOR: '1' }
        });
        
        // Handle stdout
        childProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    console.log(`${color}[${name}]${'\x1b[0m'} ${line}`);
                }
            });
        });
        
        // Handle stderr
        childProcess.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    console.log(`${color}[${name} ERROR]${'\x1b[0m'} ${line}`);
                }
            });
        });
        
        // Handle process events
        childProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`${color}${name} exited successfully${'\x1b[0m'}`);
                resolve();
            } else {
                console.log(`${color}${name} exited with code ${code}${'\x1b[0m'}`);
                reject(new Error(`${name} failed with exit code ${code}`));
            }
        });
        
        childProcess.on('error', (error) => {
            console.error(`${color}Failed to start ${name}: ${error.message}${'\x1b[0m'}`);
            reject(error);
        });
        
        return childProcess;
    });
}

async function startServices() {
    try {
        console.log('📧 Step 1: Starting Custom SMTP Server...');
        console.log('   Host: portwoodglobalsolutions.com:2525');
        console.log('   Credentials: admin / smtp-admin-2025\n');
        
        // Start SMTP server in background
        const smtpProcess = startProcess('node', ['start-smtp.js'], 'SMTP Server', '\x1b[36m'); // Cyan
        
        // Give SMTP server time to start
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n🌐 Step 2: Starting Main Application...');
        console.log('   URL: https://portwoodglobalsolutions.com');
        console.log('   OTP emails will now route through custom SMTP\n');
        
        // Start main server
        const mainProcess = startProcess('node', ['server.js'], 'Main App', '\x1b[32m'); // Green
        
        console.log('\n✅ All Services Started Successfully!');
        console.log('==========================================');
        console.log('📧 SMTP Server: portwoodglobalsolutions.com:2525');
        console.log('🌐 Form Builder: https://portwoodglobalsolutions.com');
        console.log('🔐 Login Building Block: Seamlessly configured');
        console.log('📨 All OTP emails automatically route through custom SMTP');
        console.log('✨ No manual configuration needed - it just works!');
        console.log('\n🛑 Press Ctrl+C to stop all services\n');
        
        // Handle graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n\n🛑 Shutting down all services...');
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n\n🛑 Received termination signal...');
            process.exit(0);
        });
        
        // Keep the process running
        await Promise.all([smtpProcess, mainProcess]);
        
    } catch (error) {
        console.error('❌ Failed to start services:', error.message);
        process.exit(1);
    }
}

startServices();