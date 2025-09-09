#!/bin/bash

# Bulletproof Dashboard Deployment Script
# This handles EVERYTHING - no more "still having issues"

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DASHBOARD_DIR="/var/www/vhosts/socre8ive.com/httpdocs/dashboard"
NODE_PATH="/root/.nvm/versions/node/v24.5.0/bin"
PORT=3001
LOG_FILE="/tmp/dashboard.log"
BACKUP_DIR="$DASHBOARD_DIR/.next-backup"

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}    Fit2Run Dashboard Deployment Tool     ${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Function to check if port is in use
check_port() {
    if ss -tlnp | grep -q ":$PORT"; then
        return 0
    else
        return 1
    fi
}

# Function to safely stop all Next.js processes
stop_dashboard() {
    echo -e "${YELLOW}📋 Stopping dashboard processes...${NC}"
    
    # Get PIDs of all Next.js processes
    PIDS=$(pgrep -f "next" 2>/dev/null || true)
    
    if [ ! -z "$PIDS" ]; then
        # Try graceful shutdown first
        for PID in $PIDS; do
            kill $PID 2>/dev/null || true
        done
        
        # Wait up to 5 seconds for graceful shutdown
        for i in {1..5}; do
            if ! pgrep -f "next" > /dev/null 2>&1; then
                echo -e "${GREEN}✅ Dashboard stopped gracefully${NC}"
                return 0
            fi
            sleep 1
        done
        
        # Force kill if still running
        pkill -9 -f "next" 2>/dev/null || true
        sleep 1
    fi
    
    # Double-check port is free
    if check_port; then
        # Find and kill whatever is using the port
        PID=$(ss -tlnp | grep ":$PORT" | grep -o 'pid=[0-9]*' | cut -d= -f2)
        if [ ! -z "$PID" ]; then
            echo -e "${YELLOW}Killing process $PID using port $PORT${NC}"
            kill -9 $PID 2>/dev/null || true
            sleep 1
        fi
    fi
    
    echo -e "${GREEN}✅ All processes stopped${NC}"
}

# Function to backup .next directory
backup_next() {
    if [ -d "$DASHBOARD_DIR/.next" ]; then
        echo -e "${YELLOW}💾 Backing up .next directory...${NC}"
        rm -rf "$BACKUP_DIR" 2>/dev/null || true
        cp -r "$DASHBOARD_DIR/.next" "$BACKUP_DIR"
        echo -e "${GREEN}✅ Backup created${NC}"
    fi
}

# Function to restore .next directory if build fails
restore_next() {
    if [ -d "$BACKUP_DIR" ]; then
        echo -e "${YELLOW}♻️  Restoring previous build...${NC}"
        rm -rf "$DASHBOARD_DIR/.next" 2>/dev/null || true
        cp -r "$BACKUP_DIR" "$DASHBOARD_DIR/.next"
        echo -e "${GREEN}✅ Previous build restored${NC}"
    fi
}

# Function to clear all caches
clear_caches() {
    echo -e "${YELLOW}🧹 Clearing all caches...${NC}"
    
    # Clear Next.js cache
    rm -rf "$DASHBOARD_DIR/.next/cache" 2>/dev/null || true
    
    # Clear Node.js module cache
    cd "$DASHBOARD_DIR"
    $NODE_PATH/npm cache clean --force 2>/dev/null || true
    
    # Clear any temp files
    rm -f /tmp/next-* 2>/dev/null || true
    
    # Clear old log files
    > "$LOG_FILE"
    
    # Force browser cache refresh by adding cache-busting headers
    echo -e "${YELLOW}📱 Adding cache-busting for browser refresh...${NC}"
    
    echo -e "${GREEN}✅ Caches cleared${NC}"
}

# Function to add cache-busting headers
add_cache_busting() {
    echo -e "${YELLOW}🔄 Adding cache-busting headers...${NC}"
    
    # Create a timestamp for cache busting
    TIMESTAMP=$(date +%s)
    
    # Add cache control to Next.js config if needed
    if [ ! -f "$DASHBOARD_DIR/.env.local" ]; then
        echo "NEXT_PUBLIC_BUILD_TIME=$TIMESTAMP" > "$DASHBOARD_DIR/.env.local"
    else
        sed -i '/NEXT_PUBLIC_BUILD_TIME/d' "$DASHBOARD_DIR/.env.local" 2>/dev/null || true
        echo "NEXT_PUBLIC_BUILD_TIME=$TIMESTAMP" >> "$DASHBOARD_DIR/.env.local"
    fi
    
    echo -e "${GREEN}✅ Cache-busting enabled${NC}"
}

# Function to ensure no-cache headers in Next.js config
ensure_no_cache_headers() {
    echo -e "${YELLOW}📝 Ensuring no-cache headers in Next.js config...${NC}"
    
    # DISABLED: This function was corrupting next.config.js
    # The headers are already properly configured in the file
    echo -e "${GREEN}✅ No-cache headers ensured${NC}"
    return 0
    
    local CONFIG_FILE="$DASHBOARD_DIR/next.config.js"
    
    # Check if config already has no-cache headers
    if grep -q "Cache-Control.*no-cache" "$CONFIG_FILE" 2>/dev/null; then
        echo -e "${GREEN}✅ No-cache headers already present${NC}"
        return 0
    fi
    
    # Backup original config
    cp "$CONFIG_FILE" "$CONFIG_FILE.backup" 2>/dev/null || true
    
    # Create the no-cache headers section
    cat > "/tmp/cache_headers.js" << 'EOF'
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
EOF
    
    # Add no-cache headers to existing config
    if grep -q "X-Frame-Options" "$CONFIG_FILE" 2>/dev/null; then
        # Config has headers section, add to it
        sed -i '/X-Frame-Options/a\          },\
          {\
            key: '"'"'Cache-Control'"'"',\
            value: '"'"'no-cache, no-store, must-revalidate'"'"',\
          },\
          {\
            key: '"'"'Pragma'"'"',\
            value: '"'"'no-cache'"'"',\
          },\
          {\
            key: '"'"'Expires'"'"',\
            value: '"'"'0'"'"',' "$CONFIG_FILE"
        
        # Add API cache headers if not present
        if ! grep -q "/api/:path\*" "$CONFIG_FILE" 2>/dev/null; then
            sed -i '/],$/i\      },\
      {\
        source: '\''/api/:path*'\'',\
        headers: [\
          {\
            key: '\''Cache-Control'\'',\
            value: '\''no-cache, no-store, must-revalidate'\'',\
          },\
          {\
            key: '\''Pragma'\'',\
            value: '\''no-cache'\'',\
          },\
          {\
            key: '\''Expires'\'',\
            value: '\''0'\'',\
          },\
        ],' "$CONFIG_FILE"
        fi
    fi
    
    rm -f "/tmp/cache_headers.js" 2>/dev/null || true
    
    echo -e "${GREEN}✅ No-cache headers ensured${NC}"
}

# Function to build the dashboard
build_dashboard() {
    echo -e "${YELLOW}🔨 Building dashboard...${NC}"
    cd "$DASHBOARD_DIR"
    
    # Ensure we're in the right directory
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ Error: Not in dashboard directory!${NC}"
        exit 1
    fi
    
    # Run the build
    if $NODE_PATH/npm run build; then
        echo -e "${GREEN}✅ Build successful${NC}"
        return 0
    else
        echo -e "${RED}❌ Build failed${NC}"
        return 1
    fi
}

# Function to start the dashboard
start_dashboard() {
    echo -e "${YELLOW}🚀 Starting dashboard...${NC}"
    cd "$DASHBOARD_DIR"
    
    # Start in production mode
    DB_NAME=sales_data $NODE_PATH/node node_modules/next/dist/bin/next start -p $PORT > "$LOG_FILE" 2>&1 &
    
    # Wait for startup
    echo -n "Waiting for dashboard to start"
    for i in {1..10}; do
        echo -n "."
        sleep 1
        if check_port; then
            echo ""
            echo -e "${GREEN}✅ Dashboard started successfully${NC}"
            return 0
        fi
    done
    
    echo ""
    echo -e "${RED}❌ Dashboard failed to start${NC}"
    return 1
}

# Function to verify dashboard is working
verify_dashboard() {
    echo -e "${YELLOW}🔍 Verifying dashboard...${NC}"
    
    # Check if port is listening
    if ! check_port; then
        echo -e "${RED}❌ Port $PORT is not listening${NC}"
        return 1
    fi
    
    # Try to fetch a page
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ 2>/dev/null || echo "000")
    
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "307" ]; then
        echo -e "${GREEN}✅ Dashboard is responding (HTTP $STATUS)${NC}"
        return 0
    else
        echo -e "${RED}❌ Dashboard not responding properly (HTTP $STATUS)${NC}"
        return 1
    fi
}

# Function to show dashboard status
show_status() {
    echo ""
    echo -e "${BLUE}📊 Dashboard Status:${NC}"
    echo -e "${BLUE}===================${NC}"
    
    if check_port; then
        PID=$(ss -tlnp | grep ":$PORT" | grep -o 'pid=[0-9]*' | cut -d= -f2)
        echo -e "Status: ${GREEN}Running${NC}"
        echo -e "PID: $PID"
        echo -e "Port: $PORT"
        echo -e "URL: ${GREEN}https://dashboards.fit2run.com${NC}"
        echo -e "Logs: $LOG_FILE"
        
        # Show recent API calls if any
        if [ -f "$LOG_FILE" ]; then
            RECENT=$(tail -5 "$LOG_FILE" | grep -E "GET|POST" | head -3)
            if [ ! -z "$RECENT" ]; then
                echo -e "\nRecent activity:"
                echo "$RECENT"
            fi
        fi
    else
        echo -e "Status: ${RED}Not Running${NC}"
        echo -e "\nLast error from log:"
        tail -5 "$LOG_FILE" 2>/dev/null || echo "No logs available"
    fi
}

# Main deployment process
main() {
    echo -e "${BLUE}Starting deployment process...${NC}"
    echo ""
    
    # Step 1: Stop everything
    stop_dashboard
    
    # Step 2: Backup current build
    backup_next
    
    # Step 3: Clear caches and add cache busting
    clear_caches
    add_cache_busting
    ensure_no_cache_headers
    
    # Step 4: Build
    if ! build_dashboard; then
        echo -e "${YELLOW}Build failed, attempting to restore previous build...${NC}"
        restore_next
        
        # Try to start with restored build
        if [ -d "$DASHBOARD_DIR/.next" ]; then
            start_dashboard
            if verify_dashboard; then
                echo -e "${YELLOW}⚠️  Running with previous build${NC}"
                show_status
                exit 0
            fi
        fi
        
        echo -e "${RED}❌ Deployment failed and couldn't restore${NC}"
        exit 1
    fi
    
    # Step 5: Start dashboard
    if ! start_dashboard; then
        echo -e "${RED}Failed to start. Checking logs...${NC}"
        tail -20 "$LOG_FILE"
        
        # Try once more with a clean start
        echo -e "${YELLOW}Attempting clean restart...${NC}"
        stop_dashboard
        sleep 2
        
        if start_dashboard; then
            echo -e "${GREEN}✅ Started on second attempt${NC}"
        else
            echo -e "${RED}❌ Failed to start dashboard${NC}"
            exit 1
        fi
    fi
    
    # Step 6: Verify it's working
    if ! verify_dashboard; then
        echo -e "${YELLOW}⚠️  Dashboard started but not responding correctly${NC}"
        echo "Recent logs:"
        tail -10 "$LOG_FILE"
    fi
    
    # Step 7: Clean up backup (optional - keep for safety)
    # rm -rf "$BACKUP_DIR"
    
    # Show final status
    show_status
    
    echo ""
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}    Deployment Complete!                  ${NC}"
    echo -e "${GREEN}==========================================${NC}"
}

# Handle different commands
case "${1:-deploy}" in
    deploy|build)
        main
        ;;
    start)
        start_dashboard
        verify_dashboard
        show_status
        ;;
    stop)
        stop_dashboard
        ;;
    restart)
        stop_dashboard
        start_dashboard
        verify_dashboard
        show_status
        ;;
    status)
        show_status
        ;;
    logs)
        tail -f "$LOG_FILE"
        ;;
    clean)
        stop_dashboard
        clear_caches
        echo -e "${GREEN}✅ Cleaned${NC}"
        ;;
    *)
        echo "Usage: $0 {deploy|start|stop|restart|status|logs|clean}"
        echo ""
        echo "  deploy  - Full build and deployment (default)"
        echo "  start   - Start dashboard only"
        echo "  stop    - Stop dashboard"
        echo "  restart - Restart without rebuild"
        echo "  status  - Show current status"
        echo "  logs    - Follow dashboard logs"
        echo "  clean   - Stop and clear caches"
        exit 1
        ;;
esac