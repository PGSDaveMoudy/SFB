#!/usr/bin/env node

// Simple SMTP Server Starter
// Starts the custom SMTP server with default configuration

const CustomSMTPServer = require('./smtpServer');

async function startSMTPServer() {
    console.log('🚀 Starting Portwood Global Solutions SMTP Server...');
    console.log('====================================================\n');
    
    // Default configuration
    const config = {
        port: 2525,
        hostname: '0.0.0.0', // Listen on all interfaces for domain access
        secure: false,
        allowInsecureAuth: true,
        authOptional: false,
        banner: 'Portwood Global Solutions SMTP Server Ready'
    };
    
    // Create and start server
    const server = new CustomSMTPServer(config);
    
    try {
        await server.start();
        
        console.log('✅ SMTP Server started successfully!');
        console.log(`📧 Server listening on all interfaces:${config.port}`);
        console.log(`🌐 Accessible via: portwoodglobalsolutions.com:${config.port}`);
        console.log('\n📋 Default Credentials:');
        console.log('   Username: admin');
        console.log('   Password: smtp-admin-2025');
        
        console.log('\n⚙️  Configuration for your app (.env):');
        console.log('   EMAIL_HOST=portwoodglobalsolutions.com');
        console.log('   EMAIL_PORT=2525');
        console.log('   EMAIL_SECURE=false');
        console.log('   EMAIL_USER=admin');
        console.log('   EMAIL_PASS=smtp-admin-2025');
        
        console.log('\n📊 Management:');
        console.log('   Run: node smtp-manager.js (for full management interface)');
        console.log('   Logs: tail -f smtp-server.log');
        console.log('   Storage: ./mail-storage/ directory');
        
        console.log('\n🛑 Press Ctrl+C to stop the server');
        
        // Keep the process running
        process.on('SIGINT', async () => {
            console.log('\n\n🛑 Shutting down SMTP server...');
            await server.stop();
            console.log('✅ Server stopped gracefully');
            process.exit(0);
        });
        
        process.on('SIGTERM', async () => {
            console.log('\n\n🛑 Received termination signal...');
            await server.stop();
            process.exit(0);
        });
        
    } catch (error) {
        console.error('❌ Failed to start SMTP server:', error.message);
        process.exit(1);
    }
}

startSMTPServer();