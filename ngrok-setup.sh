#!/bin/bash

# ngrok Setup Script for Client Request MCP Server
# This creates an HTTPS tunnel to your local MCP server

echo "🚀 Setting up ngrok for Client Request MCP Server..."

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed. Please install it first:"
    echo "   Visit: https://ngrok.com/download"
    echo "   Or use brew: brew install ngrok/ngrok/ngrok"
    exit 1
fi

# Check if MCP server is running
echo "🔍 Checking if MCP server is running on port 3003..."
if ! curl -s http://localhost:3003/health > /dev/null; then
    echo "❌ MCP server is not running on port 3003"
    echo "   Start it first with: npm start"
    exit 1
fi

echo "✅ MCP server is running"

# Start ngrok tunnel
echo "🌐 Starting ngrok tunnel for port 3003..."
echo "📝 This will create an HTTPS URL for your MCP server"
echo ""
echo "⚠️  IMPORTANT: Keep this terminal open while using the server"
echo "⚠️  Copy the HTTPS URL and use it in your Retell agent configuration"
echo ""
echo "Starting tunnel in 3 seconds..."
sleep 3

# Start ngrok with custom subdomain if available
if [ -n "$NGROK_SUBDOMAIN" ]; then
    echo "🔗 Using custom subdomain: $NGROK_SUBDOMAIN"
    ngrok http --subdomain=$NGROK_SUBDOMAIN 3003
else
    echo "🔗 Using random subdomain (upgrade ngrok for custom subdomains)"
    ngrok http 3003
fi

