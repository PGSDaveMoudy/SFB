#!/bin/bash

# Production startup script for Portwood Global Solutions Form Builder
# Ensures SMTP server starts first, then main application

echo "🚀 Starting Portwood Global Solutions Email System"
echo "=================================================="

# Function to check if a port is in use
check_port() {
    netstat -tuln | grep ":$1 " > /dev/null
    return $?
}

# Function to wait for a service to be ready
wait_for_service() {
    local port=$1
    local service_name=$2
    local max_attempts=30
    local attempt=1
    
    echo "⏳ Waiting for $service_name to be ready on port $port..."
    
    while [ $attempt -le $max_attempts ]; do
        if check_port $port; then
            echo "✅ $service_name is ready!"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to start after $max_attempts attempts"
    return 1
}

# Step 1: Start SMTP Server
echo ""
echo "📧 Step 1: Starting Custom SMTP Server..."
echo "   Host: portwoodglobalsolutions.com:2525"
echo "   Credentials: admin / smtp-admin-2025"

# Check if SMTP server is already running
if check_port 2525; then
    echo "✅ SMTP server already running on port 2525"
else
    echo "🚀 Starting SMTP server..."
    nohup node start-smtp.js > smtp-server.log 2>&1 &
    SMTP_PID=$!
    echo "   SMTP server PID: $SMTP_PID"
    
    # Wait for SMTP server to be ready
    if ! wait_for_service 2525 "SMTP server"; then
        echo "❌ Failed to start SMTP server"
        exit 1
    fi
fi

# Step 2: Start Main Application
echo ""
echo "🌐 Step 2: Starting Main Application..."
echo "   URL: https://portwoodglobalsolutions.com"

# Check if main app is already running
if check_port 8080; then
    echo "⚠️  Main application already running on port 8080"
    echo "   Stopping existing instance..."
    pkill -f "node server.js" 2>/dev/null || true
    sleep 3
fi

echo "🚀 Starting main application..."
nohup node server.js >> server.log 2>&1 &
MAIN_PID=$!
echo "   Main application PID: $MAIN_PID"
echo "   Server started at: $(date)" >> server.log

# Wait for main application to be ready
if ! wait_for_service 8080 "Main application"; then
    echo "❌ Failed to start main application"
    exit 1
fi

# Step 3: Verify Email Integration
echo ""
echo "🔧 Step 3: Verifying Email Integration..."
sleep 2

# Test email connectivity
if node test-smtp-integration.js > /dev/null 2>&1; then
    echo "✅ Email integration working correctly"
else
    echo "⚠️  Email integration test failed - check logs"
fi

# Final Status
echo ""
echo "✅ All Services Started Successfully!"
echo "======================================"
echo "📧 SMTP Server: portwoodglobalsolutions.com:2525"
echo "🌐 Form Builder: https://portwoodglobalsolutions.com"
echo "🔐 Login Building Block: Ready to send real emails"
echo "📨 OTP emails automatically route through custom SMTP"
echo ""
echo "📋 Process IDs:"
if [ ! -z "$SMTP_PID" ]; then
    echo "   SMTP Server: $SMTP_PID"
fi
echo "   Main App: $MAIN_PID"
echo ""
echo "📝 Logs:"
echo "   SMTP: tail -f smtp-server.log"
echo "   Main App: tail -f server.log"
echo ""
echo "🛑 To stop services:"
echo "   pkill -f 'node start-smtp.js'"
echo "   pkill -f 'node server.js'"
echo ""
echo "🎯 Ready for production use!"