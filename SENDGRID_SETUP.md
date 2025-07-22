# SendGrid Setup Instructions

## 1. Create SendGrid Account
1. Go to https://sendgrid.com/
2. Sign up for a free account (100 emails/day)
3. Verify your email address

## 2. Create API Key
1. Go to Settings → API Keys
2. Click "Create API Key"
3. Choose "Restricted Access"
4. Give it permissions:
   - Mail Send: Full Access
   - Template Engine: Read Access (optional)
5. Copy the API key (you won't see it again!)

## 3. Verify Sender Identity
1. Go to Settings → Sender Authentication
2. Choose "Single Sender Verification"
3. Add: noreply@portwoodglobalsolutions.com
4. Fill in your company details
5. Verify via email

## 4. Configure Application
Add to your .env file:
```
SENDGRID_API_KEY=SG.your-actual-api-key-here
EMAIL_FROM_ADDRESS=noreply@portwoodglobalsolutions.com
EMAIL_FROM_NAME=Portwood Global Solutions
```

## 5. Update Email Service
The application will automatically use SendGrid when the API key is configured.

## Benefits
- ✅ No spam issues
- ✅ Automatic SPF/DKIM setup
- ✅ Delivery analytics
- ✅ Bounce handling
- ✅ 99%+ delivery rate
