#!/bin/bash

# Quick Start Script for Client Request MCP Server
# This script helps you get up and running quickly with HTTPS

set -e

echo "🚀 TaxRise Client Request MCP Server - Quick Start"
echo "=================================================="

# Check if we're in the right directory
if [ ! -f "client-request-mcp.js" ]; then
    echo "❌ Please run this script from the mcp-toolbox directory"
    echo "   cd /Users/samabdullah/Main/Dustin/mcp-toolbox"
    exit 1
fi

echo "✅ Found MCP server files"

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js 18+ required. Current version: $(node --version)"
    exit 1
fi
echo "✅ Node.js version: $(node --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Check for environment file
if [ ! -f ".env" ]; then
    echo "⚙️  Creating .env file..."
    cat > .env << EOF
# Salesforce Configuration
SF_INSTANCE_URL=https://taxrise--dustin.sandbox.my.salesforce.com
SF_ACCESS_TOKEN=your_salesforce_access_token_here

# Server Configuration  
PORT=3003
NODE_ENV=development
EOF
    echo "📝 Please edit .env with your Salesforce credentials"
    echo "   Required: SF_INSTANCE_URL and SF_ACCESS_TOKEN"
    
    # Open .env in default editor if available
    if command -v code &> /dev/null; then
        echo "🔧 Opening .env in VS Code..."
        code .env
    elif command -v nano &> /dev/null; then
        echo "🔧 Opening .env in nano..."
        nano .env
    else
        echo "🔧 Please edit .env manually with your credentials"
    fi
    
    echo ""
    read -p "Press Enter after you've updated your credentials in .env..."
else
    echo "✅ Found existing .env file"
fi

# Check ngrok installation
echo "🌐 Checking ngrok installation..."
if ! command -v ngrok &> /dev/null; then
    echo "⚠️  ngrok not found. Installing via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install ngrok/ngrok/ngrok
        echo "✅ ngrok installed"
        echo "📝 Please get your auth token from: https://dashboard.ngrok.com/get-started/your-authtoken"
        read -p "Enter your ngrok auth token: " NGROK_TOKEN
        ngrok config add-authtoken "$NGROK_TOKEN"
    else
        echo "❌ Homebrew not found. Please install ngrok manually:"
        echo "   Visit: https://ngrok.com/download"
        exit 1
    fi
else
    echo "✅ ngrok is installed"
fi

# Test server startup
echo "🧪 Testing server startup..."
timeout 10s npm start &
SERVER_PID=$!
sleep 5

if curl -s http://localhost:3003/health > /dev/null; then
    echo "✅ Server started successfully"
    kill $SERVER_PID 2>/dev/null || true
else
    echo "❌ Server failed to start. Check your credentials in .env"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

echo ""
echo "🎉 Setup Complete! Choose your next step:"
echo ""
echo "Option 1: Development with ngrok (HTTPS tunnel)"
echo "  1. Start server: npm start"
echo "  2. Start ngrok:  ./ngrok-setup.sh"
echo "  3. Use the HTTPS URL in Retell"
echo ""
echo "Option 2: Production deployment to Render"
echo "  1. Follow the DEPLOYMENT_GUIDE.md"
echo "  2. Push code to GitHub"
echo "  3. Deploy on Render with automatic HTTPS"
echo ""
echo "📚 Documentation:"
echo "  - DEPLOYMENT_GUIDE.md - Complete deployment instructions"  
echo "  - RETELL_INTEGRATION_GUIDE.md - Retell agent setup"
echo "  - CLIENT_REQUEST_MCP_README.md - Technical documentation"
echo ""
echo "🧪 Test your setup:"
echo "  - Health check: curl http://localhost:3003/health"
echo "  - Full test: node test-client-request-mcp.js"
echo ""

# Ask user what they want to do
echo "What would you like to do now?"
echo "1) Start development server and ngrok"
echo "2) Run tests"
echo "3) View documentation"
echo "4) Exit"
read -p "Choose (1-4): " choice

case $choice in
    1)
        echo "🚀 Starting development environment..."
        echo "Starting server in background..."
        npm start &
        SERVER_PID=$!
        sleep 3
        echo "Starting ngrok tunnel..."
        ./ngrok-setup.sh
        ;;
    2)
        echo "🧪 Running tests..."
        npm test
        ;;
    3)
        echo "📚 Opening documentation..."
        if command -v code &> /dev/null; then
            code DEPLOYMENT_GUIDE.md RETELL_INTEGRATION_GUIDE.md
        else
            echo "Documentation files:"
            echo "  - DEPLOYMENT_GUIDE.md"
            echo "  - RETELL_INTEGRATION_GUIDE.md"
            echo "  - CLIENT_REQUEST_MCP_README.md"
        fi
        ;;
    4)
        echo "👋 Happy coding!"
        ;;
    *)
        echo "Invalid choice. Run the script again to choose an option."
        ;;
esac

