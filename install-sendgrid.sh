#!/bin/bash
# SendGrid Installation and Configuration Script

echo "🚀 Installing SendGrid for Email Delivery"
echo "========================================"

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js first."
    exit 1
fi

# Install SendGrid package
echo "📦 Installing @sendgrid/mail package..."
npm install @sendgrid/mail

if [ $? -eq 0 ]; then
    echo "✅ SendGrid package installed successfully"
else
    echo "❌ Failed to install SendGrid package"
    exit 1
fi

# Create environment variable template
echo ""
echo "📝 Environment Configuration:"
echo "Add this to your .env file:"
echo ""
echo "# SendGrid Configuration"
echo "SENDGRID_API_KEY=your-sendgrid-api-key-here"
echo "EMAIL_FROM_ADDRESS=noreply@portwoodglobalsolutions.com"
echo "EMAIL_FROM_NAME=Portwood Global Solutions"
echo ""

# Create SendGrid setup instructions
cat > SENDGRID_SETUP.md << 'EOF'
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
EOF

echo "📋 Created SENDGRID_SETUP.md with detailed instructions"

# Test SendGrid integration
echo ""
echo "🧪 Testing SendGrid integration..."
node -e "
try {
    const sg = require('@sendgrid/mail');
    console.log('✅ SendGrid package loaded successfully');
    if (process.env.SENDGRID_API_KEY) {
        sg.setApiKey(process.env.SENDGRID_API_KEY);
        console.log('✅ SendGrid API key configured');
    } else {
        console.log('⚠️  SendGrid API key not found in environment');
        console.log('   Add SENDGRID_API_KEY to .env file');
    }
} catch (error) {
    console.log('❌ SendGrid test failed:', error.message);
}
"

echo ""
echo "🎉 SendGrid installation completed!"
echo ""
echo "Next steps:"
echo "1. Follow instructions in SENDGRID_SETUP.md"
echo "2. Add your SendGrid API key to .env"
echo "3. Test with: node test-sendgrid-email.js"