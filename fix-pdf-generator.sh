#!/bin/bash
# Script to switch from Puppeteer to html-pdf-node on cPanel
# Run this on your cPanel server via SSH

echo "=========================================="
echo "Inventra PDF Generator Fix"
echo "=========================================="
echo ""
echo "This script will:"
echo "1. Backup current pdfGenerator.js"
echo "2. Uninstall puppeteer"
echo "3. Install html-pdf-node"
echo "4. Replace pdfGenerator.js with alternative version"
echo ""
read -p "Continue? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo "Aborted."
    exit 1
fi

# Navigate to backend directory
cd ~/repositories/Inventra/backend

echo ""
echo "Step 1: Creating backup..."
cp utils/pdfGenerator.js utils/pdfGenerator.js.puppeteer.backup
echo "✅ Backup created: utils/pdfGenerator.js.puppeteer.backup"

echo ""
echo "Step 2: Uninstalling puppeteer..."
npm uninstall puppeteer
echo "✅ Puppeteer uninstalled"

echo ""
echo "Step 3: Installing html-pdf-node..."
npm install html-pdf-node --save
echo "✅ html-pdf-node installed"

echo ""
echo "Step 4: Replacing pdfGenerator.js..."
# Check if alternative file exists
if [ -f "utils/pdfGenerator.alternative.js" ]; then
    cp utils/pdfGenerator.alternative.js utils/pdfGenerator.js
    echo "✅ pdfGenerator.js replaced with alternative version"
else
    echo "❌ Error: pdfGenerator.alternative.js not found!"
    echo "Please download the alternative file from the repository first."
    exit 1
fi

echo ""
echo "Step 5: Restarting Node.js application..."
# Try different restart methods
if command -v pm2 &> /dev/null; then
    pm2 restart all
    echo "✅ App restarted via PM2"
elif [ -f "tmp/restart.txt" ]; then
    touch tmp/restart.txt
    echo "✅ App restarted via Passenger"
else
    echo "⚠️  Please restart your Node.js app manually from cPanel"
fi

echo ""
echo "=========================================="
echo "✅ Installation Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Test PM report generation in the web app"
echo "2. If it works, you're done!"
echo "3. If not, check logs: pm2 logs or tail -f logs/combined.log"
echo ""
echo "To rollback if needed:"
echo "  cp utils/pdfGenerator.js.puppeteer.backup utils/pdfGenerator.js"
echo "  npm install puppeteer"
echo ""
