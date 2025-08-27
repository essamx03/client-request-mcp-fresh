# 🚀 Client Request MCP Server Deployment Guide

This guide covers deploying your Client Request MCP Server with HTTPS using **ngrok** (for development/testing) and **Render** (for production hosting).

## 📋 Prerequisites

- Node.js 18+ installed
- Salesforce credentials (instance URL and access token)
- ngrok account (free or paid)
- Render account (free tier available)

## 🛠️ Option 1: ngrok (Quick Setup for Development)

Perfect for development, testing, and temporary deployments.

### Step 1: Install ngrok

```bash
# Install via Homebrew (macOS)
brew install ngrok/ngrok/ngrok

# Or download from: https://ngrok.com/download
```

### Step 2: Authenticate ngrok

```bash
# Get your auth token from: https://dashboard.ngrok.com/get-started/your-authtoken
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

### Step 3: Start Your MCP Server

```bash
cd /Users/samabdullah/Main/Dustin/mcp-toolbox

# Install dependencies
npm install

# Create environment file
cat > .env << EOF
SF_INSTANCE_URL=https://taxrise--dustin.sandbox.my.salesforce.com
SF_ACCESS_TOKEN=your_salesforce_access_token_here
PORT=3003
NODE_ENV=development
EOF

# Start the server
npm start
```

### Step 4: Start ngrok Tunnel

```bash
# Option A: Use the provided script
./ngrok-setup.sh

# Option B: Manual command
ngrok http 3003
```

### Step 5: Get Your HTTPS URL

ngrok will display URLs like:
```
Forwarding    https://abc123.ngrok-free.app -> http://localhost:3003
```

**Use the HTTPS URL in your Retell agent configuration!**

### ngrok Pro Features (Optional)

```bash
# Custom subdomain (requires paid plan)
export NGROK_SUBDOMAIN=taxrise-mcp
./ngrok-setup.sh

# This gives you: https://taxrise-mcp.ngrok-free.app
```

## 🌐 Option 2: Render (Production Hosting)

Perfect for production deployments with automatic HTTPS and scaling.

### Step 1: Prepare Your Repository

```bash
# Initialize git repository (if not already done)
cd /Users/samabdullah/Main/Dustin/mcp-toolbox
git init
git add .
git commit -m "Initial commit: Client Request MCP Server"

# Push to GitHub (replace with your repo URL)
git remote add origin https://github.com/yourusername/client-request-mcp.git
git push -u origin main
```

### Step 2: Deploy to Render

1. **Sign up at [render.com](https://render.com)**

2. **Create New Web Service**
   - Connect your GitHub repository
   - Choose the mcp-toolbox directory as root directory

3. **Configure Build Settings**
   ```yaml
   Build Command: npm install
   Start Command: npm start
   ```

4. **Set Environment Variables**
   ```
   NODE_ENV=production
   SF_INSTANCE_URL=https://taxrise--dustin.sandbox.my.salesforce.com
   SF_ACCESS_TOKEN=your_salesforce_access_token_here
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (usually 2-3 minutes)
   - Get your HTTPS URL: `https://your-service-name.onrender.com`

### Step 3: Verify Deployment

Test your deployment:

```bash
# Check health endpoint
curl https://your-service-name.onrender.com/health

# Test MCP functionality
curl -X POST https://your-service-name.onrender.com/ \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-06-18",
      "capabilities": {}
    }
  }'
```

### Step 4: Automatic Deployments

Render will automatically redeploy when you push to your main branch:

```bash
# Make changes to your code
git add .
git commit -m "Update MCP server"
git push origin main
# Render will automatically redeploy
```

## 🔧 Environment Configuration

### Development (.env)
```env
NODE_ENV=development
SF_INSTANCE_URL=https://taxrise--dustin.sandbox.my.salesforce.com
SF_ACCESS_TOKEN=your_dev_access_token
PORT=3003
```

### Production (Render Environment Variables)
```env
NODE_ENV=production
SF_INSTANCE_URL=https://taxrise.my.salesforce.com
SF_ACCESS_TOKEN=your_prod_access_token
PORT=10000
```

## 📞 Retell Agent Configuration

### For ngrok (Development)
```json
{
  "agent_name": "TaxRise Client Request Assistant (Dev)",
  "tools": [
    {
      "type": "mcp",
      "server_url": "https://abc123.ngrok-free.app",
      "name": "client_requests"
    }
  ]
}
```

### For Render (Production)
```json
{
  "agent_name": "TaxRise Client Request Assistant",
  "tools": [
    {
      "type": "mcp",
      "server_url": "https://your-service-name.onrender.com",
      "name": "client_requests"
    }
  ]
}
```

## 🚨 Security Considerations

### Production Security Checklist

- [ ] Use production Salesforce credentials
- [ ] Enable HTTPS-only connections
- [ ] Set secure environment variables
- [ ] Monitor server logs for suspicious activity
- [ ] Implement rate limiting if needed
- [ ] Use strong access tokens with minimal permissions

### Environment Variable Security

**NEVER** commit sensitive data to git:

```bash
# Add .env to .gitignore
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Add .env to gitignore"
```

## 📊 Monitoring & Health Checks

### Health Check Endpoint

Both deployments provide a health check at `/health`:

```bash
curl https://your-domain.com/health
```

Response:
```json
{
  "status": "ok",
  "server": "client-request-mcp",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### Logs Monitoring

**ngrok**: Check your terminal where the server is running
**Render**: View logs in the Render dashboard under "Logs" tab

### Uptime Monitoring

For production, consider using:
- [UptimeRobot](https://uptimerobot.com/) - Free monitoring
- [Pingdom](https://pingdom.com/) - Advanced monitoring
- Render's built-in health checks

## 🔄 Scaling & Performance

### Render Scaling Options

- **Starter Plan**: Free tier, may sleep after 15 minutes of inactivity
- **Professional Plan**: $7/month, always-on, faster scaling
- **Team/Organization Plans**: Advanced features and support

### Performance Tips

1. **Enable Render's Always-On** for production
2. **Use connection pooling** for Salesforce API calls
3. **Implement caching** for frequently accessed data
4. **Monitor response times** and optimize slow queries

## 🐛 Troubleshooting

### Common Issues

**1. ngrok Connection Issues**
```bash
# Check if server is running
curl http://localhost:3003/health

# Restart ngrok with verbose logging
ngrok http 3003 --log stdout
```

**2. Render Build Failures**
```bash
# Check build logs in Render dashboard
# Common fixes:
# - Verify package.json is correct
# - Check Node.js version compatibility
# - Ensure all dependencies are listed
```

**3. Salesforce Authentication**
```bash
# Test connection manually
node -e "
const jsforce = require('jsforce');
const conn = new jsforce.Connection({
  instanceUrl: 'YOUR_INSTANCE_URL',
  accessToken: 'YOUR_ACCESS_TOKEN'
});
conn.query('SELECT Id FROM Client_Request__c LIMIT 1')
  .then(r => console.log('✅ Success:', r.totalSize))
  .catch(e => console.error('❌ Error:', e.message));
"
```

**4. CORS Issues**
- Ensure your server includes proper CORS headers
- Check that Retell is connecting to the correct HTTPS URL
- Verify no mixed HTTP/HTTPS content warnings

### Getting Help

1. **Check server logs** for error messages
2. **Test endpoints manually** with curl or Postman
3. **Verify environment variables** are set correctly
4. **Check Salesforce permissions** for the integration user

## 📈 Next Steps

After successful deployment:

1. **Configure Retell Agent** with your HTTPS endpoint
2. **Test end-to-end functionality** with real client data
3. **Set up monitoring** for production environments
4. **Document your specific deployment** for team members
5. **Plan backup and disaster recovery** procedures

## 🎯 Quick Commands Reference

```bash
# Local development
npm start
./ngrok-setup.sh

# Test deployment
npm test
curl https://your-domain.com/health

# Check logs (local)
tail -f server.log

# Update production (Render)
git push origin main
```

Your Client Request MCP Server is now ready for production use with HTTPS! 🚀

