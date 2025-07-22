# SSL Security Recommendations for A+ Rating

## Current Status
The domain portwoodglobalsolutions.com has a valid SSL certificate but is missing security configurations that prevent an A+ rating on SSL Labs.

## Required Security Headers and Configurations

### 1. **HTTP Security Headers**
Add these headers to your Nginx configuration or application middleware:

```nginx
# Strict Transport Security (HSTS)
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

# X-Frame-Options to prevent clickjacking
add_header X-Frame-Options "SAMEORIGIN" always;

# X-Content-Type-Options to prevent MIME sniffing
add_header X-Content-Type-Options "nosniff" always;

# Referrer Policy
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# Permissions Policy (formerly Feature Policy)
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

# Content Security Policy
add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.quilljs.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.quilljs.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.salesforce.com https://*.salesforce.com; frame-ancestors 'self';" always;
```

### 2. **SSL/TLS Configuration**
Update your Nginx SSL configuration:

```nginx
# Use only TLS 1.2 and 1.3
ssl_protocols TLSv1.2 TLSv1.3;

# Use secure cipher suites
ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';

# Prefer server cipher order
ssl_prefer_server_ciphers off;

# Enable OCSP stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /path/to/chain.pem;

# SSL session settings
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_session_tickets off;

# DH parameters (generate with: openssl dhparam -out dhparam.pem 4096)
ssl_dhparam /path/to/dhparam.pem;
```

### 3. **Complete Nginx Server Block Example**

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name www.portwoodglobalsolutions.com portwoodglobalsolutions.com;

    # SSL Certificate Configuration
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    # SSL Security Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    
    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;
    
    # Content Security Policy for Form Builder
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.quilljs.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.quilljs.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https://api.salesforce.com https://*.salesforce.com https://*.force.com wss://*.salesforce.com; frame-src 'self' https://*.salesforce.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self';" always;

    # Proxy to Node.js application
    location / {
        proxy_pass http://localhost:8443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name www.portwoodglobalsolutions.com portwoodglobalsolutions.com;
    return 301 https://$server_name$request_uri;
}

# Redirect non-www to www
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name portwoodglobalsolutions.com;
    return 301 https://www.$server_name$request_uri;
}
```

### 4. **Application-Level Security Headers (Express.js)**

If you prefer to set headers at the application level, add this middleware to your Express.js server:

```javascript
const helmet = require('helmet');

// Basic helmet configuration
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'", "https:"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.quilljs.com", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.quilljs.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "https://api.salesforce.com", "https://*.salesforce.com", "https://*.force.com", "wss://*.salesforce.com"],
            frameSrc: ["'self'", "https://*.salesforce.com"],
            frameAncestors: ["'self'"],
            baseUri: ["'self'"],
            formAction: ["'self'"]
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
}));

// Additional security headers
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});
```

### 5. **Additional Security Recommendations**

#### Generate DH Parameters
```bash
sudo openssl dhparam -out /etc/nginx/dhparam.pem 4096
```

#### Certificate Chain Order
Ensure your certificate chain is in the correct order:
1. Your domain certificate
2. Intermediate certificate(s)
3. Root certificate (optional)

#### DNS CAA Records
Add CAA records to your DNS to specify which Certificate Authorities can issue certificates:
```
portwoodglobalsolutions.com. IN CAA 0 issue "letsencrypt.org"
portwoodglobalsolutions.com. IN CAA 0 issuewild "letsencrypt.org"
```

### 6. **Testing Your Configuration**

After implementing these changes:

1. **Test with SSL Labs**: https://www.ssllabs.com/ssltest/analyze.html?d=portwoodglobalsolutions.com
2. **Test Security Headers**: https://securityheaders.com/?q=portwoodglobalsolutions.com
3. **Test HSTS Preload**: https://hstspreload.org/?domain=portwoodglobalsolutions.com

### 7. **Common Issues That Prevent A+ Rating**

- Missing HSTS header or insufficient max-age
- Supporting old TLS versions (1.0, 1.1)
- Weak cipher suites
- Missing OCSP stapling
- Incorrect certificate chain
- Missing security headers
- No HTTP to HTTPS redirect
- Supporting SSL 2.0 or 3.0

### 8. **Form Builder Specific Considerations**

The Content Security Policy above is tailored for the Salesforce Form Builder and allows:
- Quill.js rich text editor from CDN
- Google Fonts for typography
- Salesforce API connections
- Inline styles and scripts (required for dynamic form generation)
- Data URIs for images and fonts

## Implementation Steps

1. **Backup current configuration**
2. **Test changes in staging environment first**
3. **Implement SSL/TLS changes**
4. **Add security headers**
5. **Restart Nginx**: `sudo nginx -t && sudo systemctl reload nginx`
6. **Test with SSL Labs**
7. **Monitor for any issues**
8. **Submit to HSTS preload list** (after confirming everything works)

## Expected Results

After implementing these recommendations:
- SSL Labs Grade: **A+**
- Security Headers Grade: **A+**
- All modern browsers will show secure connection
- Protection against common web vulnerabilities
- Better SEO rankings due to improved security

## Important Notes

- The `unsafe-inline` and `unsafe-eval` in CSP are required for the form builder's dynamic functionality
- HSTS preload is permanent - ensure you're ready before submitting
- Test thoroughly before enabling HSTS with long max-age
- Monitor your application logs for any CSP violations