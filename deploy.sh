#!/bin/bash

echo "🚀 Deploying Inventra to cPanel..."

# Set environment to production
export NODE_ENV=production

# Navigate to application directory
cd /home/ivms2006/public_html/inventra.ivms2006.com/app

# Pull latest changes from Git
echo "📥 Pulling latest changes..."
git pull origin deploy

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd backend
npm install --production

# Build frontend
echo "🏗️  Building frontend..."
cd ../frontend
npm install
npm run build

# Copy environment file
echo "⚙️  Setting up environment..."
cd ..
cp .env.production backend/.env

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p backend/uploads
mkdir -p backend/logs

# Set permissions
echo "🔒 Setting permissions..."
chmod 755 backend/uploads
chmod 755 backend/logs

# Restart Node.js application via cPanel
echo "🔄 Restarting application..."
# The application will auto-restart via Passenger

echo "✅ Deployment complete!"
echo "🌐 Application available at: https://inventra.ivms2006.com"
