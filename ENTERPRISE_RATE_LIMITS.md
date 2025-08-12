# Enterprise Rate Limiting Configuration

## Overview
Updated PilotForms rate limiting to support enterprise-level traffic with thousands of requests per hour while maintaining security.

## Rate Limiting Tiers

### 1. Express.js Application Level

#### General API Endpoints (`/api/*`)
- **Limit**: 5,000 requests per 15 minutes per IP
- **Hourly Rate**: ~20,000 requests/hour
- **Burst**: 50 requests (handled by Nginx)
- **Headers**: Returns `RateLimit-*` headers for monitoring

#### Authentication Endpoints (`/api/send-otp`, `/api/verify-otp`)
- **Limit**: 1,000 requests per 15 minutes per IP  
- **Hourly Rate**: ~4,000 requests/hour
- **Burst**: 10 requests (handled by Nginx)
- **Purpose**: Prevent abuse while allowing legitimate enterprise auth flows

### 2. OTP-Specific Rate Limiting

#### Per Email/Contact Rate Limiting
- **Limit**: 1 OTP request per 10 seconds per email
- **Previous**: 30 seconds (too restrictive for enterprise)
- **Purpose**: Prevent spam while allowing quick retries for legitimate users

### 3. Nginx Level Rate Limiting

#### API Endpoints
- **General API**: 100 requests/second with burst=50
- **Form Endpoints**: 50 requests/second with burst=20  
- **Auth Endpoints**: 20 requests/second with burst=10

#### Configuration Details
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=forms:10m rate=50r/s; 
limit_req_zone $binary_remote_addr zone=auth:10m rate=20r/s;
```

## Enterprise Traffic Support

### Capacity
- **Peak Sustained**: 20,000 requests/hour per IP
- **Peak Burst**: Up to 360,000 requests/hour (100 req/sec)
- **Authentication**: 4,000 auth requests/hour per IP
- **Forms**: 180,000 form requests/hour per IP

### Multiple IP Support
- Limits are per-IP, so enterprise networks with multiple IPs get multiplicative capacity
- Load balancers and CDNs distribute load across multiple source IPs

## Monitoring & Management

### Rate Limit Status Endpoint
```
GET /api/rate-limit-status
```

Returns current rate limiting configuration and active blocks:
```json
{
  "timestamp": "2025-08-10T22:00:00.000Z",
  "rateLimits": {
    "general": {
      "windowMs": 900000,
      "maxRequests": 5000,
      "description": "5000 requests per 15 minutes per IP"
    },
    "authentication": {
      "windowMs": 900000,
      "maxRequests": 1000,
      "description": "1000 auth requests per 15 minutes per IP"
    },
    "otp": {
      "windowMs": 10000,
      "maxRequests": 1,
      "description": "1 OTP request per 10 seconds per email",
      "activeBlocks": 0
    }
  },
  "activeOtpBlocks": []
}
```

### Clear Rate Limits (Emergency)
```
POST /api/clear-otp-limits
```

Clears OTP rate limit blocks for troubleshooting.

## Error Responses

### Express.js Rate Limit Exceeded (429)
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests from this IP. Please try again later.",
  "retryAfter": 900
}
```

### OTP Rate Limit Exceeded (429)
```json
{
  "error": "OTP already sent recently",
  "message": "Please wait 5 seconds before requesting a new OTP",
  "remainingTime": 5,
  "rateLimitType": "OTP_RATE_LIMIT"
}
```

### Nginx Rate Limit Exceeded (503)
```html
<html>
<head><title>503 Service Temporarily Unavailable</title></head>
<body>Service Temporarily Unavailable</body>
</html>
```

## Security Features

### IP Trust Chain
- Nginx extracts real IP from `X-Forwarded-For`
- Express.js trusts first proxy (nginx)
- Rate limits applied to actual client IP, not proxy IP

### Attack Prevention
- Distributed rate limiting across multiple layers
- Different limits for different endpoint types
- Burst protection at Nginx level
- Application-level OTP abuse prevention

## Troubleshooting

### High Volume Periods
1. Monitor `/api/rate-limit-status` for active blocks
2. Check nginx error logs: `tail -f /var/log/nginx/error.log`
3. Check application logs: `pm2 logs pilotforms`
4. Temporarily clear OTP limits if needed: `POST /api/clear-otp-limits`

### Rate Limit Headers
Monitor these response headers:
- `RateLimit-Limit`: Maximum requests allowed
- `RateLimit-Remaining`: Requests remaining in current window
- `RateLimit-Reset`: When the rate limit window resets

## Configuration Files Updated

1. `/root/SFB/server.js` - Express.js rate limiting
2. `/etc/nginx/sites-available/pilotforms.com` - Nginx rate limiting
3. Added monitoring endpoint and OTP management

---

**Implementation Date**: August 10, 2025  
**Enterprise Capacity**: 20,000+ requests/hour per IP  
**Security Level**: High (multi-layer protection maintained)