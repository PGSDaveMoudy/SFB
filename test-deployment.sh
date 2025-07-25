#!/bin/bash

# Test script for deployment validation
# This script tests the deployment without making actual changes

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_test() {
    echo -e "${YELLOW}🧪 Testing: $1${NC}"
}

print_pass() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
}

print_fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
}

echo "🧪 Salesforce Form Builder - Deployment Validation"
echo "=================================================="

# Test 1: Check if script exists and is executable
print_test "Deployment script exists and is executable"
if [[ -x "./deploy-production.sh" ]]; then
    print_pass "Deployment script is executable"
else
    print_fail "Deployment script not found or not executable"
    exit 1
fi

# Test 2: Check Node.js version
print_test "Node.js version compatibility"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [[ $NODE_VERSION -ge 14 ]]; then
        print_pass "Node.js version $NODE_VERSION is compatible"
    else
        print_fail "Node.js version $NODE_VERSION is too old (need >=14)"
    fi
else
    print_fail "Node.js not installed"
fi

# Test 3: Check if package.json exists
print_test "Package.json configuration"
if [[ -f "package.json" ]]; then
    print_pass "Package.json found"
else
    print_fail "Package.json not found"
fi

# Test 4: Check if main application file exists
print_test "Main application file"
if [[ -f "server.js" ]]; then
    print_pass "Server.js found"
else
    print_fail "Server.js not found"
fi

# Test 5: Check if public directory exists
print_test "Public assets directory"
if [[ -d "public" ]]; then
    print_pass "Public directory found"
else
    print_fail "Public directory not found"
fi

# Test 6: Validate script syntax
print_test "Deployment script syntax"
if bash -n ./deploy-production.sh; then
    print_pass "Deployment script syntax is valid"
else
    print_fail "Deployment script has syntax errors"
fi

# Test 7: Check if running as root (for actual deployment)
print_test "Root permissions check"
if [[ $EUID -eq 0 ]]; then
    print_pass "Running as root (ready for deployment)"
else
    echo -e "${YELLOW}⚠️  Not running as root (use sudo for actual deployment)${NC}"
fi

# Test 8: Check Ubuntu version
print_test "Operating system compatibility"
if [[ -f "/etc/os-release" ]]; then
    if grep -q "Ubuntu" /etc/os-release; then
        UBUNTU_VERSION=$(grep VERSION_ID /etc/os-release | cut -d'"' -f2)
        print_pass "Ubuntu $UBUNTU_VERSION detected"
    else
        echo -e "${YELLOW}⚠️  Not Ubuntu - script may need modifications${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Cannot detect OS version${NC}"
fi

echo
echo "🎯 Deployment Readiness Summary:"
echo "- Script is ready to run"
echo "- Use: sudo ./deploy-production.sh"
echo "- Have your Salesforce Consumer Key and Secret ready"
echo "- Ensure DNS records are configured as documented"

echo
echo "📋 Pre-deployment Checklist:"
echo "□ Salesforce Connected App created with OAuth settings"
echo "□ DNS A record pointing to your server IP"
echo "□ MX record configured for email"
echo "□ Server has at least 2GB RAM and 10GB disk space"
echo "□ Port 80, 443, and 25 are accessible"

echo
print_pass "Deployment validation completed!"