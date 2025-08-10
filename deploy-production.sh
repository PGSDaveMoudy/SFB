#!/bin/bash

# PilotForms - Production Deployment Script
# This script automates the complete deployment of SFB to production
# Created: July 2025
# Author: Claude (Anthropic AI)

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="pilotforms.com"
MAIL_DOMAIN="mail.pilotforms.com"
APP_PORT="8443"
EMAIL_FROM="noreply@pilotforms.com"

# Function to print colored output
print_step() {
    echo -e "${BLUE}🚀 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${PURPLE}ℹ️  $1${NC}"
}

# Function to check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root"
        exit 1
    fi
}

# Function to generate secure keys
generate_keys() {
    print_step "Generating secure encryption and session keys..."
    
    # Generate encryption key (64 hex characters = 32 bytes for AES-256)
    ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    # Generate session secret (64 hex characters)
    SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    
    print_success "Generated secure keys"
}

# Function to create environment file
create_env_file() {
    print_step "Creating production environment configuration..."
    
    # Prompt for Salesforce credentials if not provided
    if [[ -z "$SF_CLIENT_ID" ]]; then
        echo -e "${YELLOW}Enter your Salesforce Consumer Key:${NC}"
        read -r SF_CLIENT_ID
    fi
    
    if [[ -z "$SF_CLIENT_SECRET" ]]; then
        echo -e "${YELLOW}Enter your Salesforce Consumer Secret:${NC}"
        read -r SF_CLIENT_SECRET
    fi
    
    # Create .env file
    cat > .env << EOF
# Salesforce Configuration
SALESFORCE_LOGIN_URL=https://login.salesforce.com
SALESFORCE_CLIENT_ID=${SF_CLIENT_ID}
SALESFORCE_CLIENT_SECRET=${SF_CLIENT_SECRET}

# Server Configuration
PORT=${APP_PORT}
DOMAIN=${DOMAIN}

# Database Configuration (for form storage)
DB_TYPE=json
DB_PATH=./data/forms.json

# Session Secret
SESSION_SECRET=${SESSION_SECRET}

# Encryption Key (CRITICAL - MUST BE SET!)
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# File Upload Configuration
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads

# Auto-save Configuration
AUTOSAVE_INTERVAL=3000

# Email Configuration for OTP Sending
# Using local Postfix SMTP server
EMAIL_SERVICE=smtp
EMAIL_HOST=localhost
EMAIL_PORT=25
EMAIL_SECURE=false
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM_NAME=Portwood Global Solutions
EMAIL_FROM_ADDRESS=${EMAIL_FROM}
EOF

    print_success "Environment configuration created"
}

# Function to install system dependencies
install_dependencies() {
    print_step "Installing system dependencies..."
    
    # Update package list
    apt update
    
    # Install required packages
    apt install -y nginx certbot python3-certbot-nginx postfix mailutils opendkim opendkim-tools
    
    print_success "System dependencies installed"
}

# Function to install Node.js dependencies
install_node_dependencies() {
    print_step "Installing Node.js dependencies..."
    
    # Install application dependencies
    npm install
    
    # Install PM2 globally
    npm install -g pm2
    
    print_success "Node.js dependencies installed"
}

# Function to configure hostname
configure_hostname() {
    print_step "Configuring server hostname..."
    
    # Set hostname
    hostnamectl set-hostname "$MAIL_DOMAIN"
    echo "$MAIL_DOMAIN" > /etc/hostname
    
    # Update /etc/hosts
    sed -i "s/server1\.portwoodglobalsolutions\.com/${MAIL_DOMAIN} pilotforms.com ${DOMAIN}/g" /etc/hosts
    
    print_success "Hostname configured"
}

# Function to setup SSL certificates
setup_ssl() {
    print_step "Setting up SSL certificates with Let's Encrypt..."
    
    # Create temporary Nginx config for certificate generation
    cat > /etc/nginx/sites-available/temp-ssl.conf << EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} pilotforms.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF
    
    # Enable temporary config
    ln -sf /etc/nginx/sites-available/temp-ssl.conf /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Test and reload Nginx
    nginx -t && systemctl restart nginx
    
    # Generate SSL certificates
    certbot certonly --nginx -d pilotforms.com -d "$DOMAIN" --non-interactive --agree-tos --email "admin@pilotforms.com"
    
    print_success "SSL certificates generated"
}

# Function to configure Nginx
configure_nginx() {
    print_step "Configuring Nginx reverse proxy..."
    
    # Create main Nginx configuration
    cat > /etc/nginx/sites-available/pilotforms.com << 'EOF'
upstream sfb_backend {
    ip_hash;
    server 127.0.0.1:8443 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=forms:10m rate=50r/s;

# Caching configuration
proxy_cache_path /var/cache/nginx/sfb levels=1:2 keys_zone=sfb_cache:10m max_size=1g inactive=60m use_temp_path=off;

server {
    listen 80;
    listen [::]:80;
    server_name pilotforms.com www.pilotforms.com;

    # Redirect all HTTP to HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name pilotforms.com www.pilotforms.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/pilotforms.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pilotforms.com/privkey.pem;
    
    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Logging
    access_log /var/log/nginx/sfb_access.log combined;
    error_log /var/log/nginx/sfb_error.log warn;

    # Max upload size for form attachments
    client_max_body_size 100M;
    client_body_buffer_size 1m;
    
    # Timeouts for long-running operations
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
    send_timeout 300s;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;

    # Static files with caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|pdf|woff|woff2|ttf|svg)$ {
        proxy_pass http://sfb_backend;
        proxy_cache sfb_cache;
        proxy_cache_valid 200 7d;
        proxy_cache_bypass $http_cache_control;
        add_header X-Cache-Status $upstream_cache_status;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    # API endpoints with rate limiting
    location /api/ {
        limit_req zone=api burst=200 nodelay;
        limit_req_status 429;
        
        proxy_pass http://sfb_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Disable buffering for real-time features
        proxy_buffering off;
        proxy_request_buffering off;
    }

    # Public form endpoints with separate rate limiting
    location /forms/ {
        limit_req zone=forms burst=100 nodelay;
        
        proxy_pass http://sfb_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # OAuth callback
    location /oauth/callback {
        proxy_pass http://sfb_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_Set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support for real-time features
    location /ws {
        proxy_pass http://sfb_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }

    # Main application
    location / {
        proxy_pass http://sfb_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_Set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;
        
        # Enable keepalive
        proxy_set_header Connection "keep-alive";
        
        # Cache HTML for 5 minutes
        proxy_cache sfb_cache;
        proxy_cache_valid 200 5m;
        proxy_cache_bypass $http_cache_control;
        add_header X-Cache-Status $upstream_cache_status;
    }

    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://sfb_backend;
        proxy_set_header Host $host;
    }
}
EOF

    # Create cache directory
    mkdir -p /var/cache/nginx/sfb
    
    # Remove temporary config and enable main config
    rm -f /etc/nginx/sites-enabled/temp-ssl.conf
    ln -sf /etc/nginx/sites-available/pilotforms.com /etc/nginx/sites-enabled/
    
    # Test and reload Nginx
    nginx -t && systemctl reload nginx
    
    print_success "Nginx configured"
}

# Function to configure email system
configure_email() {
    print_step "Configuring email system with DKIM authentication..."
    
    # Configure Postfix
    cat > /etc/postfix/main.cf << EOF
# See /usr/share/postfix/main.cf.dist for a commented, more complete version

# Debian specific:  Specifying a file name will cause the first
# line of that file to be used as the name.  The Debian default
# is /etc/mailname.
#myorigin = /etc/mailname

smtpd_banner = \$myhostname ESMTP \$mail_name (Ubuntu)
biff = no

# appending .domain is the MUA's job.
append_dot_mydomain = no

# Uncomment the next line to generate "delayed mail" warnings
#delay_warning_time = 4h

readme_directory = no

# See http://www.postfix.org/COMPATIBILITY_README.html -- default to 3.6 on
# fresh installs.
compatibility_level = 3.6

# TLS parameters
smtpd_tls_cert_file=/etc/letsencrypt/live/pilotforms.com/fullchain.pem
smtpd_tls_key_file=/etc/letsencrypt/live/pilotforms.com/privkey.pem
smtpd_tls_security_level=may

smtp_tls_CApath=/etc/ssl/certs
smtp_tls_security_level=may
smtp_tls_session_cache_database = btree:\${data_directory}/smtp_scache

smtpd_relay_restrictions = permit_mynetworks permit_sasl_authenticated defer_unauth_destination
myhostname = ${MAIL_DOMAIN}
alias_maps = hash:/etc/aliases
alias_database = hash:/etc/aliases
myorigin = /etc/mailname
mydestination = \$myhostname, pilotforms.com, ${MAIL_DOMAIN}, localhost.pilotforms.com, localhost
relayhost = 
mynetworks = 127.0.0.0/8 [::ffff:127.0.0.0]/104 [::1]/128
mailbox_size_limit = 0
recipient_delimiter = +
inet_interfaces = all
inet_protocols = all

# DKIM signing
milter_protocol = 6
milter_default_action = accept
smtpd_milters = local:opendkim/opendkim.sock
non_smtpd_milters = local:opendkim/opendkim.sock
EOF

    # Update mailname
    echo "${MAIL_DOMAIN}" > /etc/mailname
    
    # Configure OpenDKIM
    mkdir -p /etc/opendkim/keys/pilotforms.com
    cd /etc/opendkim/keys/pilotforms.com
    opendkim-genkey -s default -d pilotforms.com
    chown opendkim:opendkim default.private
    
    # OpenDKIM configuration files
    cat > /etc/opendkim/TrustedHosts << EOF
127.0.0.1
localhost
192.168.1.0/24
*.pilotforms.com
EOF

    cat > /etc/opendkim/KeyTable << EOF
default._domainkey.pilotforms.com pilotforms.com:default:/etc/opendkim/keys/pilotforms.com/default.private
EOF

    cat > /etc/opendkim/SigningTable << EOF
*@pilotforms.com default._domainkey.pilotforms.com
EOF

    # Update OpenDKIM configuration
    sed -i 's|Socket.*local:/run/opendkim/opendkim.sock|Socket\t\t\tlocal:/var/spool/postfix/opendkim/opendkim.sock|' /etc/opendkim.conf
    sed -i 's|#Domain.*|KeyTable\t\t/etc/opendkim/KeyTable\nSigningTable\t\t/etc/opendkim/SigningTable\nExternalIgnoreList\t/etc/opendkim/TrustedHosts\nInternalHosts\t\t/etc/opendkim/TrustedHosts|' /etc/opendkim.conf
    
    # Create OpenDKIM socket directory
    mkdir -p /var/spool/postfix/opendkim
    chown opendkim:postfix /var/spool/postfix/opendkim
    adduser postfix opendkim
    
    # Restart email services
    systemctl restart opendkim
    systemctl restart postfix
    
    print_success "Email system configured"
    print_info "DKIM public key for DNS:"
    cat /etc/opendkim/keys/pilotforms.com/default.txt
}

# Function to setup PM2
setup_pm2() {
    print_step "Setting up PM2 process management..."
    
    # Create PM2 ecosystem file
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'sfb-prod',
    script: './server.js',
    instances: 1,  // Single instance for stability
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '2G',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_file: './logs/pm2-combined.log',
    time: true,
    env: {
      NODE_ENV: 'production',
      PORT: 8443
    },
    // Auto-restart configuration
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    // Error handling
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    // Performance optimizations
    listen_timeout: 10000,
    kill_timeout: 5000
  }]
};
EOF

    # Create logs directory
    mkdir -p logs
    
    # Start application with PM2
    pm2 start ecosystem.config.js
    
    # Save PM2 configuration
    pm2 save
    
    # Setup auto-start on system reboot
    pm2 startup
    
    print_success "PM2 configured and application started"
}

# Function to setup firewall
setup_firewall() {
    print_step "Configuring firewall..."
    
    # Allow SSH, HTTP, HTTPS, and SMTP
    ufw allow OpenSSH
    ufw allow 'Nginx Full'
    ufw allow 25   # SMTP
    ufw allow 587  # SMTP submission
    ufw --force enable
    
    print_success "Firewall configured"
}

# Function to test deployment
test_deployment() {
    print_step "Testing deployment..."
    
    # Test HTTPS connectivity
    if curl -I "https://${DOMAIN}" | grep -q "HTTP/2 200"; then
        print_success "HTTPS connection working"
    else
        print_error "HTTPS connection failed"
        return 1
    fi
    
    # Test email sending
    if echo "Test email from SFB deployment script" | mail -s "SFB Deployment Test" "admin@pilotforms.com" 2>/dev/null; then
        print_success "Email system working"
    else
        print_warning "Email test failed - check configuration"
    fi
    
    # Check PM2 status
    if pm2 status | grep -q "online"; then
        print_success "Application running via PM2"
    else
        print_error "PM2 application not running"
        return 1
    fi
    
    print_success "Deployment test completed"
}

# Function to display final information
display_final_info() {
    print_success "🎉 PilotForms deployed successfully!"
    echo
    print_info "🌐 Website: https://${DOMAIN}"
    print_info "📧 Email: ${EMAIL_FROM}"
    print_info "🏢 Org Manager: https://${DOMAIN}/org-manager.html"
    echo
    print_info "📝 Required DNS Records:"
    echo "   - MX: mail.pilotforms.com (Priority: 10)"
    echo "   - TXT (SPF): v=spf1 mx a ~all"
    echo "   - TXT (DKIM): Add the DKIM record shown above"
    echo
    print_info "🔧 Management Commands:"
    echo "   - Check status: pm2 status"
    echo "   - View logs: pm2 logs"
    echo "   - Restart app: pm2 restart sfb-prod"
    echo "   - Check email logs: tail -f /var/log/mail.log"
    echo
    print_info "🔐 OAuth Callback URL for Salesforce:"
    echo "   https://${DOMAIN}/oauth/callback"
}

# Main deployment function
main() {
    echo -e "${PURPLE}"
    echo "╔═══════════════════════════════════════════════╗"
    echo "║     PilotForms - Deployment     ║"
    echo "║              Production Script                ║"
    echo "╚═══════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    check_root
    
    print_step "Starting production deployment..."
    
    # Generate secure keys first
    generate_keys
    
    # Create environment configuration
    create_env_file
    
    # Install dependencies
    install_dependencies
    install_node_dependencies
    
    # Configure system
    configure_hostname
    
    # Setup SSL and Nginx
    setup_ssl
    configure_nginx
    
    # Configure email system
    configure_email
    
    # Setup application
    setup_pm2
    
    # Security
    setup_firewall
    
    # Test deployment
    test_deployment
    
    # Display final information
    display_final_info
    
    print_success "🚀 Deployment completed successfully!"
}

# Run main function
main "$@"