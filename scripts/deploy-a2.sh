#!/bin/bash

# Tayenda A2 Hosting Deployment Script
# Run this script to deploy/update your application on A2 Hosting

echo "🚀 Starting Tayenda deployment..."

# Navigate to app directory
cd ~/tayenda.renai-labs.com || exit 1

# Pull latest changes (if using Git)
if [ -d ".git" ]; then
    echo "📥 Pulling latest changes..."
    git pull
fi

# Force npm usage (fixes pnpm issues on cPanel)
echo "⚙️  Configuring npm..."
echo "package-manager=npm" > .npmrc

# Clean install
echo "🧹 Cleaning old dependencies..."
rm -rf node_modules package-lock.json pnpm-lock.yaml

echo "📦 Installing dependencies with npm..."
npm install

# Install TypeScript and types (prevents auto-install issues)
echo "📝 Installing TypeScript..."
npm install -D typescript @types/node @types/react @types/react-dom

# Build the application
echo "🔨 Building application..."
NODE_ENV=production npm run build

# Database setup (only run on first deployment or schema changes)
read -p "🗄️  Setup/update database? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Setting up database..."
    npm run db:push
    
    read -p "Seed admin user? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        npm run db:seed
    fi
fi

# Restart Passenger
echo "🔄 Restarting application..."
mkdir -p tmp
touch tmp/restart.txt

echo ""
echo "✅ Deployment complete!"
echo "🌐 Visit your site: https://tayenda.renai-labs.com"
echo "📊 Login with: rflmwcom / 8-18Zfyd9;YYAe"
echo ""
echo "📝 To view logs: tail -f ~/tayenda.renai-labs.com/logs/*.log"
