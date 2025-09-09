#!/bin/bash

# Deploy from devit.fit2run.com (dev) to dashboards.fit2run.com (prod)
# Usage: ./deploy-to-prod.sh

set -e

DEV_DIR="/var/www/vhosts/devit.fit2run.com/httpdocs"
PROD_DIR="/var/www/vhosts/socre8ive.com/httpdocs/dashboard"
BACKUP_DIR="/var/www/vhosts/socre8ive.com/httpdocs/dashboard-backup-$(date +%Y%m%d_%H%M%S)"

echo "🚀 Deploying from DEV to PROD"
echo "Dev:  $DEV_DIR"
echo "Prod: $PROD_DIR"

# Check if we're in dev directory
if [ "$PWD" != "$DEV_DIR" ]; then
    echo "❌ Please run this script from the dev directory: $DEV_DIR"
    exit 1
fi

# Check if dev environment is built
if [ ! -d ".next" ]; then
    echo "❌ No .next directory found. Please run 'npm run build' first."
    exit 1
fi

# Create backup of production
echo "📦 Creating backup of production..."
cp -r "$PROD_DIR" "$BACKUP_DIR"
echo "✅ Backup created: $BACKUP_DIR"

# Stop production dashboard
echo "🛑 Stopping production dashboard..."
pkill -f "next start -p 3001" || echo "No production process found"

# Deploy files (excluding logs and specific configs)
echo "📋 Deploying files..."
rsync -av --exclude='.env.local' --exclude='*.log' --exclude='dashboard-backup-*' \
    --exclude='deploy-to-prod.sh' --exclude='/tmp/' \
    "$DEV_DIR/" "$PROD_DIR/"

# Restart production dashboard
echo "🔄 Starting production dashboard..."
cd "$PROD_DIR"
DB_NAME=sales_data /root/.nvm/versions/node/v24.5.0/bin/node node_modules/next/dist/bin/next start -p 3001 > /tmp/dashboard.log 2>&1 &

# Wait and verify
echo "⏳ Waiting for production to start..."
sleep 5

if ss -tlnp | grep -q ":3001"; then
    echo "✅ Production dashboard started successfully on port 3001"
    echo "🌐 Available at: https://dashboards.fit2run.com"
    
    # Test the endpoint
    if curl -s -o /dev/null -w "%{http_code}" https://dashboards.fit2run.com | grep -q "307\|200"; then
        echo "✅ Production endpoint responding correctly"
    else
        echo "⚠️  Production endpoint may have issues - check manually"
    fi
else
    echo "❌ Production failed to start!"
    echo "🔧 Restoring from backup..."
    rm -rf "$PROD_DIR"
    mv "$BACKUP_DIR" "$PROD_DIR"
    cd "$PROD_DIR"
    DB_NAME=sales_data /root/.nvm/versions/node/v24.5.0/bin/node node_modules/next/dist/bin/next start -p 3001 > /tmp/dashboard.log 2>&1 &
    echo "🔄 Backup restored and started"
    exit 1
fi

echo ""
echo "🎉 Deployment complete!"
echo "📁 Backup kept at: $BACKUP_DIR"
echo "🗑️  Remove backup with: rm -rf $BACKUP_DIR"