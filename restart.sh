#!/bin/bash

echo "Killing all Next.js processes..."
pkill -f "next.*3001"

echo "Waiting for processes to terminate..."
sleep 3

echo "Checking if port 3001 is free..."
lsof -ti :3001 | xargs -r kill -9

echo "Cleaning Next.js cache..."
rm -rf .next

echo "Starting dashboard in development mode..."
DB_NAME=sales_data /root/.nvm/versions/node/v24.5.0/bin/npm run dev -- -p 3001 > /tmp/dashboard.log 2>&1 &

echo "Dashboard restart initiated. Checking logs in 5 seconds..."
sleep 5

echo "Latest log entries:"
tail -20 /tmp/dashboard.log