#!/bin/bash

echo "🔧 Rebuilding and restarting Fit2Run Dashboard..."
echo "================================================"

# Kill existing processes
echo "1. Stopping existing dashboard processes..."
pkill -f "next" 2>/dev/null
sleep 2

# Build the application
echo "2. Building Next.js application..."
cd /var/www/vhosts/socre8ive.com/httpdocs/dashboard
/root/.nvm/versions/node/v24.5.0/bin/npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Start the dashboard
    echo "3. Starting dashboard in production mode..."
    DB_NAME=sales_data /root/.nvm/versions/node/v24.5.0/bin/node node_modules/next/dist/bin/next start -p 3001 > /tmp/dashboard.log 2>&1 &
    
    # Wait for startup
    sleep 3
    
    # Check if running
    if ss -tlnp | grep -q 3001; then
        echo "✅ Dashboard is running on port 3001"
        echo "🌐 Access at: https://dashboards.fit2run.com"
    else
        echo "❌ Failed to start dashboard"
        echo "Check logs at: /tmp/dashboard.log"
        tail -10 /tmp/dashboard.log
    fi
else
    echo "❌ Build failed! Check the errors above."
    exit 1
fi

echo "================================================"
echo "Complete!"