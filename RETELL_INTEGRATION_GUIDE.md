# Retell AI Agent Integration Guide

This guide shows you how to integrate the Client Request MCP Server with your Retell AI agent to give clients the ability to view and respond to their requests.

## Quick Start

### 1. Deploy the MCP Server

```bash
# Navigate to the mcp-toolbox directory
cd /Users/samabdullah/Main/Dustin/mcp-toolbox

# Install dependencies using the client-request specific package.json
cp client-request-package.json package.json
npm install

# Configure environment (create .env file)
cat > .env << EOF
SF_INSTANCE_URL=https://taxrise--dustin.sandbox.my.salesforce.com
SF_ACCESS_TOKEN=00DO800000AQRYH!AQEAQFl49y8HDsJAkjSjiq7akPeWHHbMKLO8y3q1Qy9hu_uCkTz6rG0t4K7ZVhh06ETNng7v6Nv2AyzCA.5Ym__bvNF09F1V
PORT=3003
EOF

# Start the server
npm start
```

### 2. Test the Server

```bash
# Run the test script
node test-client-request-mcp.js
```

### 3. Deploy with HTTPS

**IMPORTANT**: Retell requires HTTPS endpoints. Choose your deployment method:

#### Option A: ngrok (Development/Testing)
```bash
# Start your MCP server
npm start

# In another terminal, start ngrok
./ngrok-setup.sh
# Get your HTTPS URL: https://abc123.ngrok-free.app
```

#### Option B: Render (Production)
Deploy to Render for automatic HTTPS. See `DEPLOYMENT_GUIDE.md` for complete instructions.

### 4. Configure Retell Agent

Use this configuration in your Retell agent setup:

#### Development Configuration (ngrok)
```json
{
  "agent_name": "TaxRise Client Request Assistant (Dev)",
  "voice_id": "your_preferred_voice_id",
  "response_engine": {
    "type": "retell-llm",
    "llm_id": "your_llm_id"
  },
  "general_prompt": "You are a helpful TaxRise client service representative. You can view and respond to client requests in our system. Always be professional, empathetic, and provide clear, actionable responses to client inquiries.",
  "begin_message": "Hello! I'm here to help you with your TaxRise requests. I can check on any pending requests you have and provide responses. How can I assist you today?",
  "tools": [
    {
      "type": "mcp",
      "server_url": "https://abc123.ngrok-free.app",
      "name": "client_requests",
      "description": "Access to client request management system"
    }
  ],
  "enable_backchannel": true,
  "interruption_threshold": 150,
  "ambient_sound": "office"
}
```

#### Production Configuration (Render)
```json
{
  "agent_name": "TaxRise Client Request Assistant",
  "voice_id": "your_preferred_voice_id",
  "response_engine": {
    "type": "retell-llm",
    "llm_id": "your_llm_id"
  },
  "general_prompt": "You are a helpful TaxRise client service representative. You can view and respond to client requests in our system. Always be professional, empathetic, and provide clear, actionable responses to client inquiries.",
  "begin_message": "Hello! I'm here to help you with your TaxRise requests. I can check on any pending requests you have and provide responses. How can I assist you today?",
  "tools": [
    {
      "type": "mcp",
      "server_url": "https://your-service-name.onrender.com",
      "name": "client_requests",
      "description": "Access to client request management system"
    }
  ],
  "enable_backchannel": true,
  "interruption_threshold": 150,
  "ambient_sound": "office",
  "webhook_url": "https://your-webhook-endpoint.com/retell-events" 
}
```

## Agent Conversation Flows

### Flow 1: Check Client Requests

**Agent**: "I can help you check on your requests. Could you please provide your name or phone number?"

**Client**: "This is John Smith"

**Agent Action**: 
```javascript
// Uses get_client_requests tool
{
  "name": "get_client_requests",
  "arguments": {
    "clientName": "John Smith",
    "onlyUnresponded": true,
    "limit": 10
  }
}
```

**Agent Response**: "I found 2 pending requests for you, John. You have an Information Request from March 15th asking about your 2023 tax filing status, and a Pay Stubs Request from March 10th. Would you like me to provide an update on either of these?"

### Flow 2: Respond to Client Request

**Client**: "Can you update my information request about the tax filing status?"

**Agent Action**:
```javascript
// Uses respond_to_client_request tool
{
  "name": "respond_to_client_request",
  "arguments": {
    "requestId": "a1234567890abcd",
    "response": "Your 2023 tax return has been completed and is currently pending your signature. We've sent the documents to your registered email address. Please review and sign them within 7 days to avoid any delays in filing.",
    "responseType": "information"
  }
}
```

**Agent Response**: "I've updated your request with the current status. Your 2023 tax return is ready for signature and has been sent to your email. Please check your inbox and sign the documents within 7 days."

### Flow 3: Search and Identify Client

**Agent**: "I need to verify your identity. Can you provide your phone number?"

**Client**: "555-123-4567"

**Agent Action**:
```javascript
{
  "name": "search_clients",
  "arguments": {
    "searchTerm": "555-123-4567",
    "limit": 5
  }
}
```

## Retell Agent Prompt Templates

### System Prompt
```
You are a TaxRise client service representative with access to our client request management system. Your role is to:

1. Help clients check the status of their requests
2. Provide updates and responses to pending requests
3. Maintain professional, empathetic communication
4. Ensure client identity verification before sharing sensitive information

IDENTITY VERIFICATION:
- Always verify client identity using name AND phone number
- Use the search_clients tool to confirm identity
- Never share information without proper verification

AVAILABLE TOOLS:
- get_client_requests: View client requests (filter by name, phone, type, status)
- get_client_request_details: Get full details of a specific request
- respond_to_client_request: Provide responses to client inquiries
- search_clients: Find clients by name or phone number

CONVERSATION FLOW:
1. Greet the client warmly
2. Verify their identity
3. Ask how you can help with their requests
4. Use appropriate tools to retrieve and update information
5. Provide clear, actionable responses
6. Offer additional assistance

BRAND VOICE (TaxRise):
- Friendly, smart, trustworthy
- Clear and jargon-free language
- Compassionate and understanding of tax difficulties
- Professional but warm
- "We rise by lifting others" - be helpful and supportive
```

### Example Responses

**Request Status Update**:
"I've checked on your request from [date]. Here's the current status: [status]. [Next steps or additional information]. Is there anything else you'd like to know about this request?"

**Multiple Requests**:
"I found [number] requests in your account. Let me go through them: [list requests with dates and types]. Which one would you like me to update first?"

**No Requests Found**:
"I don't see any pending requests in your account right now. If you need to submit a new request or have questions about your tax situation, I can help guide you through the process."

## Advanced Configuration

### Custom Request Handling

For specific request types, you can customize the agent's behavior:

```json
{
  "conditional_responses": {
    "Levy Release Request": {
      "urgency": "high",
      "response_template": "I understand this is urgent. For levy releases, I need to escalate this to our priority team. I've updated your request and you should hear back within 24 hours."
    },
    "Information Request": {
      "urgency": "normal", 
      "response_template": "I've provided the information you requested. Please review it carefully and let me know if you need any clarification."
    }
  }
}
```

### Error Handling

The agent should gracefully handle common errors:

```javascript
// Handle MCP server connection issues
if (error.includes('connection')) {
  return "I'm experiencing some technical difficulties accessing your request information. Let me try that again, or you can call our office directly at [phone number].";
}

// Handle client not found
if (error.includes('not found')) {
  return "I wasn't able to locate your account with that information. Could you please verify your name and phone number? You can also provide your client ID if you have it.";
}
```

## Deployment Checklist

- [ ] MCP server is running and accessible
- [ ] Salesforce credentials are configured
- [ ] Test script passes all checks
- [ ] Retell agent is configured with correct server URL
- [ ] Agent prompt includes identity verification steps
- [ ] Error handling is implemented
- [ ] Brand voice guidelines are followed

## Monitoring and Analytics

### Key Metrics to Track

1. **Request Resolution Rate**: Percentage of requests successfully responded to
2. **Response Time**: Average time from request to response
3. **Client Satisfaction**: Follow up surveys after request completion
4. **Tool Usage**: Which MCP tools are used most frequently
5. **Error Rates**: Frequency and types of errors

### Logging

The MCP server logs all interactions:
- Client request queries
- Response submissions
- Client searches
- Error conditions

Review logs regularly for optimization opportunities.

## Troubleshooting

### Common Issues

**1. Agent can't connect to MCP server**
- Check if server is running on correct port
- Verify firewall settings
- Test server health endpoint

**2. Client requests not found**
- Verify Salesforce connection
- Check user permissions on Client_Request__c object
- Confirm client exists in system

**3. Unable to update requests**
- Check field-level security on Client_Request__c
- Verify write permissions for integration user
- Test with Salesforce workbench

### Support Contacts

- Technical Issues: Development team
- Salesforce Access: System administrator
- Retell Configuration: AI team lead
