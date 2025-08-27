import express from 'express';
import jsforce from 'jsforce';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3003;

// Production readiness checks
const isProduction = process.env.NODE_ENV === 'production';
console.log(`🚀 Starting Client Request MCP Server in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);

if (isProduction) {
  console.log('🔒 Production mode: Enhanced security and logging enabled');
}

app.use(express.json());

// CORS headers for Retell integration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Logging middleware (production-safe)
app.use((req, res, next) => {
  const logData = {
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    userAgent: req.headers['user-agent']
  };
  
  // In production, limit body logging for security
  if (!isProduction && req.body) {
    logData.bodyPreview = JSON.stringify(req.body).substring(0, 200) + '...';
  }
  
  console.log(`${logData.timestamp} - ${logData.method} ${logData.path}`, 
    isProduction ? '' : logData.bodyPreview || 'no body');
  next();
});

// Salesforce connection with validation
if (!process.env.SF_INSTANCE_URL || !process.env.SF_ACCESS_TOKEN) {
  console.error('❌ Missing required Salesforce environment variables:');
  console.error('   SF_INSTANCE_URL and SF_ACCESS_TOKEN must be set');
  if (!isProduction) {
    console.log('💡 For development, create a .env file with your credentials');
  }
  process.exit(1);
}

const conn = new jsforce.Connection({
  instanceUrl: process.env.SF_INSTANCE_URL,
  accessToken: process.env.SF_ACCESS_TOKEN
});

// Test Salesforce connection on startup
conn.query('SELECT Id FROM Client_Request__c LIMIT 1')
  .then(() => console.log('✅ Salesforce connection verified'))
  .catch(err => {
    console.error('❌ Salesforce connection failed:', err.message);
    if (isProduction) {
      process.exit(1); // Fail fast in production
    }
  });

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    server: 'client-request-mcp', 
    timestamp: new Date().toISOString() 
  });
});

// MCP endpoint handler
app.post('/', async (req, res) => {
  const { method, id, params } = req.body;
  
  const response = {
    jsonrpc: '2.0',
    id: id || 0
  };

  try {
    switch (method) {
      case 'initialize':
        response.result = {
          protocolVersion: '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { 
            name: 'client-request-mcp-server', 
            version: '1.0.0',
            description: 'MCP Server for managing client requests in Salesforce'
          }
        };
        break;
        
      case 'tools/list':
        response.result = {
          tools: [
            {
              name: 'get_client_requests',
              description: 'Retrieve client requests from Salesforce. Can filter by client name, phone, request status, or request type.',
              inputSchema: {
                type: 'object',
                properties: {
                  clientName: { 
                    type: 'string', 
                    description: 'Client name to filter by (searches Account names)' 
                  },
                  clientPhone: { 
                    type: 'string', 
                    description: 'Client phone number to filter by' 
                  },
                  requestType: { 
                    type: 'string', 
                    description: 'Type of request: Information Request, Field Update Request, Garnishment Removal Request, Levy Release Request, Pay Stubs Request' 
                  },
                  onlyUnresponded: { 
                    type: 'boolean', 
                    description: 'If true, only show requests that haven\'t been responded to yet (default: false)' 
                  },
                  limit: { 
                    type: 'number', 
                    description: 'Maximum number of requests to return (default: 20)' 
                  }
                }
              }
            },
            {
              name: 'get_client_request_details',
              description: 'Get full details of a specific client request by ID',
              inputSchema: {
                type: 'object',
                properties: {
                  requestId: { 
                    type: 'string', 
                    description: 'The Salesforce ID of the Client_Request__c record' 
                  }
                },
                required: ['requestId']
              }
            },
            {
              name: 'respond_to_client_request',
              description: 'Respond to a client request by providing an answer/response',
              inputSchema: {
                type: 'object',
                properties: {
                  requestId: { 
                    type: 'string', 
                    description: 'The Salesforce ID of the Client_Request__c record' 
                  },
                  response: { 
                    type: 'string', 
                    description: 'The response/answer to provide to the client' 
                  },
                  responseType: { 
                    type: 'string', 
                    description: 'Type of response: "information" for text responses, "structured" for JSON responses',
                    enum: ['information', 'structured']
                  }
                },
                required: ['requestId', 'response']
              }
            },
            {
              name: 'search_clients',
              description: 'Search for client accounts by name or phone number',
              inputSchema: {
                type: 'object',
                properties: {
                  searchTerm: { 
                    type: 'string', 
                    description: 'Name or phone number to search for' 
                  },
                  limit: { 
                    type: 'number', 
                    description: 'Maximum number of results to return (default: 10)' 
                  }
                },
                required: ['searchTerm']
              }
            }
          ]
        };
        break;
        
      case 'tools/call':
        const { name, arguments: args } = params;
        
        switch (name) {
          case 'get_client_requests':
            response.result = await handleGetClientRequests(args);
            break;
            
          case 'get_client_request_details':
            response.result = await handleGetClientRequestDetails(args);
            break;
            
          case 'respond_to_client_request':
            response.result = await handleRespondToClientRequest(args);
            break;
            
          case 'search_clients':
            response.result = await handleSearchClients(args);
            break;
            
          default:
            response.error = { code: -32601, message: `Unknown tool: ${name}` };
        }
        break;
        
      default:
        response.error = { code: -32601, message: `Unknown method: ${method}` };
    }
  } catch (error) {
    console.error('MCP Error:', error);
    response.error = { code: -32603, message: error.message };
  }
  
  res.json(response);
});

// Tool implementations
async function handleGetClientRequests(args) {
  console.log('🔍 Getting client requests with args:', JSON.stringify(args, null, 2));
  
  const {
    clientName,
    clientPhone,
    requestType,
    onlyUnresponded = false,
    limit = 20
  } = args;

  // Build WHERE clause
  let whereClause = 'WHERE 1=1';
  
  if (onlyUnresponded) {
    whereClause += ' AND (Responded__c = false OR Responded__c = null)';
  }
  
  if (requestType) {
    whereClause += ` AND Request_Type__c = '${requestType.replace(/'/g, "\\'")}'`;
  }

  // Build the main query
  let query = `
    SELECT Id, Name, Request_Type__c, Information_Request__c, Information_Response__c,
           Response__c, Responded__c, CreatedDate, LastModifiedDate,
           Client__c, Client__r.Name, Client__r.Phone, Client__r.PersonEmail,
           Reason_For_Request__c, Object_Api_Name__c
    FROM Client_Request__c 
    ${whereClause}
    ORDER BY CreatedDate DESC
    LIMIT ${limit}
  `;

  // If we need to filter by client name or phone, we need a subquery
  if (clientName || clientPhone) {
    let clientWhere = '';
    if (clientName) {
      clientWhere += `Name LIKE '%${clientName.replace(/'/g, "\\'")}%'`;
    }
    if (clientPhone) {
      if (clientWhere) clientWhere += ' OR ';
      clientWhere += `Phone LIKE '%${clientPhone.replace(/'/g, "\\'")}%'`;
    }
    
    query = `
      SELECT Id, Name, Request_Type__c, Information_Request__c, Information_Response__c,
             Response__c, Responded__c, CreatedDate, LastModifiedDate,
             Client__c, Client__r.Name, Client__r.Phone, Client__r.PersonEmail,
             Reason_For_Request__c, Object_Api_Name__c
      FROM Client_Request__c 
      ${whereClause} AND Client__c IN (
        SELECT Id FROM Account WHERE ${clientWhere}
      )
      ORDER BY CreatedDate DESC
      LIMIT ${limit}
    `;
  }

  console.log('🔍 Query:', query);
  
  const result = await conn.query(query);
  const requests = result.records || [];

  console.log(`🔍 Found ${requests.length} client requests`);

  // Format the results for display
  const formattedRequests = requests.map(request => {
    return {
      requestId: request.Id,
      requestName: request.Name || 'Unnamed Request',
      requestType: request.Request_Type__c,
      clientName: request.Client__r?.Name || 'Unknown Client',
      clientPhone: request.Client__r?.Phone,
      clientEmail: request.Client__r?.PersonEmail,
      informationRequest: request.Information_Request__c,
      reason: request.Reason_For_Request__c,
      responded: request.Responded__c,
      responseText: request.Information_Response__c,
      createdDate: request.CreatedDate,
      lastModified: request.LastModifiedDate
    };
  });

  return {
    content: [{
      type: 'text',
      text: `Found ${requests.length} client requests:\n\n${JSON.stringify(formattedRequests, null, 2)}`
    }]
  };
}

async function handleGetClientRequestDetails(args) {
  const { requestId } = args;
  
  console.log('🔍 Getting details for request:', requestId);
  
  const query = `
    SELECT Id, Name, Request_Type__c, Information_Request__c, Information_Response__c,
           Response__c, Responded__c, CreatedDate, LastModifiedDate,
           Client__c, Client__r.Name, Client__r.Phone, Client__r.PersonEmail,
           Reason_For_Request__c, Object_Api_Name__c, Related_Object_Id__c,
           Selected_Fields__c, Updated_Fields__c, Old_Field_Values__c,
           Failed_Fields_Update__c
    FROM Client_Request__c 
    WHERE Id = '${requestId}'
  `;
  
  const result = await conn.query(query);
  if (!result.records.length) {
    throw new Error('Client request not found');
  }
  
  const request = result.records[0];
  
  const requestDetails = {
    requestId: request.Id,
    requestName: request.Name || 'Unnamed Request',
    requestType: request.Request_Type__c,
    clientName: request.Client__r?.Name || 'Unknown Client',
    clientPhone: request.Client__r?.Phone,
    clientEmail: request.Client__r?.PersonEmail,
    informationRequest: request.Information_Request__c,
    informationResponse: request.Information_Response__c,
    structuredResponse: request.Response__c,
    reason: request.Reason_For_Request__c,
    responded: request.Responded__c,
    objectApiName: request.Object_Api_Name__c,
    relatedObjectId: request.Related_Object_Id__c,
    selectedFields: request.Selected_Fields__c,
    updatedFields: request.Updated_Fields__c,
    oldFieldValues: request.Old_Field_Values__c,
    failedFieldsUpdate: request.Failed_Fields_Update__c,
    createdDate: request.CreatedDate,
    lastModified: request.LastModifiedDate
  };
  
  return {
    content: [{
      type: 'text',
      text: `Client Request Details:\n\n${JSON.stringify(requestDetails, null, 2)}`
    }]
  };
}

async function handleRespondToClientRequest(args) {
  const { requestId, response: responseText, responseType = 'information' } = args;
  
  console.log('📝 Responding to request:', requestId, 'with response type:', responseType);
  
  // First, get the current request
  const currentRequest = await conn.query(`
    SELECT Id, Request_Type__c, Responded__c 
    FROM Client_Request__c 
    WHERE Id = '${requestId}'
  `);
  
  if (!currentRequest.records.length) {
    throw new Error('Client request not found');
  }
  
  const request = currentRequest.records[0];
  
  // Prepare the update
  const updateData = {
    Id: requestId,
    Responded__c: true
  };
  
  // Set the appropriate response field based on type
  if (responseType === 'information') {
    updateData.Information_Response__c = responseText;
  } else if (responseType === 'structured') {
    try {
      // Validate JSON if it's structured
      JSON.parse(responseText);
      updateData.Response__c = responseText;
    } catch (e) {
      throw new Error('Invalid JSON for structured response: ' + e.message);
    }
  }
  
  // Update the request
  await conn.sobject('Client_Request__c').update(updateData);
  
  console.log('✅ Successfully updated client request');
  
  return {
    content: [{
      type: 'text',
      text: `✅ Successfully responded to client request ${requestId}.\n\nResponse: ${responseText}\n\nThe request has been marked as responded and the client will be notified.`
    }]
  };
}

async function handleSearchClients(args) {
  const { searchTerm, limit = 10 } = args;
  
  console.log('🔍 Searching for clients with term:', searchTerm);
  
  const query = `
    SELECT Id, Name, Phone, PersonEmail, PersonMailingAddress
    FROM Account 
    WHERE (Name LIKE '%${searchTerm.replace(/'/g, "\\'")}%' 
           OR Phone LIKE '%${searchTerm.replace(/'/g, "\\'")}%')
    AND IsPersonAccount = true
    ORDER BY Name
    LIMIT ${limit}
  `;
  
  const result = await conn.query(query);
  const clients = result.records || [];
  
  const formattedClients = clients.map(client => ({
    clientId: client.Id,
    name: client.Name,
    phone: client.Phone,
    email: client.PersonEmail,
    address: client.PersonMailingAddress
  }));
  
  return {
    content: [{
      type: 'text',
      text: `Found ${clients.length} matching clients:\n\n${JSON.stringify(formattedClients, null, 2)}`
    }]
  };
}

app.listen(port, () => {
  console.log(`🚀 Client Request MCP Server running on port ${port}`);
  console.log('📋 Available tools:');
  console.log('  - get_client_requests: View pending and completed client requests');
  console.log('  - get_client_request_details: Get full details of a specific request');
  console.log('  - respond_to_client_request: Answer client requests');
  console.log('  - search_clients: Find clients by name or phone');
  console.log('🔗 Health check: http://localhost:' + port + '/health');
});
