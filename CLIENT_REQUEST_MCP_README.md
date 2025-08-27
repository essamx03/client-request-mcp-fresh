# Client Request MCP Server

This is a Model Context Protocol (MCP) server that enables Retell AI agents to view and respond to client requests stored in Salesforce `Client_Request__c` objects.

## Features

The MCP server provides the following capabilities to AI agents:

### 🔍 View Client Requests
- Get all client requests with flexible filtering options
- Filter by client name, phone number, request type, or response status
- View both pending and completed requests

### 📋 Request Details
- Get full details of any specific client request
- View all fields including request type, client information, and current status

### 📝 Respond to Requests
- Answer client requests with text responses
- Mark requests as responded
- Support both information responses and structured responses

### 👥 Search Clients
- Search for client accounts by name or phone number
- Quick lookup for client information

## Request Types Supported

The system handles these types of client requests:
- **Information Request**: General questions from clients
- **Field Update Request**: Requests to update client information
- **Garnishment Removal Request**: Requests for wage garnishment removal
- **Levy Release Request**: Requests for tax levy release
- **Pay Stubs Request**: Requests for pay stub documentation

## Installation & Setup

### 1. Install Dependencies
```bash
# In the mcp-toolbox directory
npm install express jsforce dotenv
```

### 2. Configure Environment
Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Edit `.env` with your Salesforce credentials:
```
SF_INSTANCE_URL=https://your-instance.salesforce.com
SF_ACCESS_TOKEN=your_access_token
PORT=3003
```

### 3. Start the Server
```bash
npm start
# or for development with auto-restart:
npm run dev
```

### 4. Health Check
Verify the server is running:
```
GET http://localhost:3003/health
```

## Retell AI Integration

### MCP Protocol Endpoints

The server implements the MCP protocol with these endpoints:

- `POST /` - Main MCP handler (initialize, tools/list, tools/call)
- `GET /health` - Health check endpoint

### Available Tools

1. **get_client_requests**
   - Retrieve client requests with filtering options
   - Parameters: `clientName`, `clientPhone`, `requestType`, `onlyUnresponded`, `limit`

2. **get_client_request_details**
   - Get full details of a specific request
   - Parameters: `requestId` (required)

3. **respond_to_client_request**
   - Respond to a client request
   - Parameters: `requestId` (required), `response` (required), `responseType`

4. **search_clients**
   - Search for clients by name or phone
   - Parameters: `searchTerm` (required), `limit`

### Example Retell Agent Configuration

```json
{
  "agent_name": "Client Request Assistant",
  "voice_id": "your_voice_id",
  "response_engine": {
    "type": "retell-llm",
    "llm_id": "your_llm_id"
  },
  "tools": [
    {
      "type": "mcp",
      "server_url": "http://localhost:3003/",
      "name": "client_requests"
    }
  ]
}
```

## Usage Examples

### View Unresponded Requests
```json
{
  "method": "tools/call",
  "params": {
    "name": "get_client_requests",
    "arguments": {
      "onlyUnresponded": true,
      "limit": 10
    }
  }
}
```

### Respond to a Request
```json
{
  "method": "tools/call",
  "params": {
    "name": "respond_to_client_request",
    "arguments": {
      "requestId": "a1234567890abcd",
      "response": "Thank you for your request. Your tax documents have been processed and will be mailed within 3-5 business days.",
      "responseType": "information"
    }
  }
}
```

### Search for a Client
```json
{
  "method": "tools/call",
  "params": {
    "name": "search_clients",
    "arguments": {
      "searchTerm": "John Smith",
      "limit": 5
    }
  }
}
```

## Data Structure

### Client Request Fields
- `Id`: Salesforce record ID
- `Name`: Request name/title
- `Request_Type__c`: Type of request (picklist)
- `Information_Request__c`: The client's question/request
- `Information_Response__c`: Response to information requests
- `Response__c`: Structured JSON responses
- `Responded__c`: Boolean indicating if responded
- `Client__c`: Link to client account
- `Reason_For_Request__c`: Reason for the request
- `CreatedDate`: When the request was created

## Security Notes

- The server uses Salesforce access tokens for authentication
- All CORS headers are configured for cross-origin requests
- Request/response logging is implemented for debugging
- Error handling provides detailed feedback for troubleshooting

## Troubleshooting

### Common Issues

1. **Connection Issues**
   - Verify Salesforce access token is valid
   - Check instance URL format
   - Ensure network connectivity

2. **No Requests Found**
   - Check Client_Request__c object permissions
   - Verify query filters are correct
   - Confirm data exists in Salesforce

3. **Response Failures**
   - Validate request ID format
   - Check user permissions for updates
   - Review field-level security settings

### Logs
Server logs all requests and errors to the console. Check the server output for debugging information.

## Development

### File Structure
```
mcp-toolbox/
├── client-request-mcp.js          # Main MCP server
├── client-request-package.json     # Package dependencies
├── .env.example                    # Environment template
└── CLIENT_REQUEST_MCP_README.md    # This documentation
```

### Extending Functionality
To add new tools, extend the `tools/list` response and add corresponding handlers in the `tools/call` switch statement.

