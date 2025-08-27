# 🔧 Render Deployment Troubleshooting Guide

## Common Render Deployment Failures & Fixes

### Issue 1: Build Command Failures
**Problem**: `npm install --production` excludes devDependencies but we need `node-fetch` for tests
**Fix**: Move `node-fetch` to dependencies in package.json ✅ FIXED

### Issue 2: Start Command Issues  
**Problem**: Using `npm start` can cause issues in production
**Fix**: Use direct `node client-request-mcp.js` command ✅ FIXED

### Issue 3: Environment Variables Not Set
**Problem**: Missing required Salesforce credentials causes startup failures
**Fix**: Set environment variables in Render dashboard

### Issue 4: Port Configuration
**Problem**: Render uses dynamic ports, not fixed port 3003
**Fix**: Use `process.env.PORT` (already handled in code)

### Issue 5: Health Check Path
**Problem**: Render can't verify service health
**Fix**: Ensure `/health` endpoint works and is configured ✅ FIXED

## Fixed Configuration Files

### ✅ render.yaml (Fixed)
- Removed problematic domain configurations
- Fixed build command to `npm install --production`
- Set direct start command `node client-request-mcp.js`
- Simplified environment variables

### ✅ package.json (Fixed)
- Moved `node-fetch` from devDependencies to dependencies
- Fixed repository URL to match actual GitHub repo
- Proper Node.js version specification

## Deployment Steps

1. **Fix Applied**: Configuration files updated
2. **Push Changes**: Commit and push fixes to GitHub
3. **Redeploy**: Trigger new deployment in Render
4. **Set Environment Variables**: Add required Salesforce credentials
5. **Verify**: Check logs and test endpoints

## Environment Variables to Set in Render Dashboard

Required environment variables:
```
NODE_ENV=production
SF_INSTANCE_URL=https://taxrise--dustin.sandbox.my.salesforce.com  
SF_ACCESS_TOKEN=your_salesforce_access_token_here
```

## Next Steps After Fixes
1. Commit and push the configuration fixes
2. Go to Render dashboard and redeploy
3. Set the environment variables
4. Monitor deployment logs
5. Test the health endpoint once deployed
