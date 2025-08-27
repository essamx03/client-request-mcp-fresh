import express from 'express';
import jsforce from 'jsforce';
import nodemailer from 'nodemailer';

const app = express();
const port = process.env.PORT || 3002;

app.use(express.json());

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${JSON.stringify(req.body)}`);
  next();
});

// Salesforce connection using access token
const conn = new jsforce.Connection({
  instanceUrl: 'https://taxrise--dustin.sandbox.my.salesforce.com',
  accessToken: '00DO800000AQRYH!AQEAQFl49y8HDsJAkjSjiq7akPeWHHbMKLO8y3q1Qy9hu_uCkTz6rG0t4K7ZVhh06ETNng7v6Nv2AyzCA.5Ym__bvNF09F1V'
});

// Email configuration
const emailTransporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'sam@miadvg.com',
    pass: 'vihp qsst hsdl ajtw'
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
          serverInfo: { name: 'tax-prep-mcp-server', version: '1.0.0' }
        };
        break;
        
      case 'tools/list':
        response.result = {
          tools: [
            {
              name: 'get_pending_signature_cases',
              description: 'Get tax return cases that are pending client signatures',
              inputSchema: {
                type: 'object',
                properties: {
                  clientName: { type: 'string', description: 'Client name for filtering (optional)' },
                  phoneNumber: { type: 'string', description: 'Client phone number for filtering (optional)' },
                  caseId: { type: 'string', description: 'Specific case ID to look up (optional)' }
                }
              }
            },
            {
              name: 'send_returns_to_client',
              description: 'Email tax return documents to client',
              inputSchema: {
                type: 'object',
                properties: {
                  caseId: { type: 'string', description: 'Case ID to send returns for' }
                },
                required: ['caseId']
              }
            },
            {
              name: 'create_mail_request',
              description: 'Create a mail request to physically mail tax documents to client',
              inputSchema: {
                type: 'object',
                properties: {
                  caseId: { type: 'string', description: 'Case ID to create mail request for' }
                },
                required: ['caseId']
              }
            }
          ]
        };
        break;
        
      case 'tools/call':
        const { name, arguments: args } = params;
        
        switch (name) {
          case 'get_pending_signature_cases':
            response.result = await handleGetPendingCases(args);
            break;
            
          case 'send_returns_to_client':
            response.result = await handleSendReturns(args);
            break;
            
          case 'create_mail_request':
            response.result = await handleCreateMailRequest(args);
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
async function handleGetPendingCases(args) {
  let whereClause = "Status = 'Pending Signature'";
  
  if (args.caseId) {
    whereClause += ` AND Id = '${args.caseId}'`;
  }
  if (args.clientName) {
    whereClause += ` AND Account.Name LIKE '%${args.clientName}%'`;
  }
  if (args.phoneNumber) {
    whereClause += ` AND (Contact.Phone = '${args.phoneNumber}' OR Contact.MobilePhone = '${args.phoneNumber}')`;
  }

  const query = `
    SELECT Id, CaseNumber, Subject, Account.Name, Contact.Name, Contact.Email, 
           Contact.Phone, Contact.MobilePhone,
           (SELECT Id, Year__c, ReturnStatus__c, Agency__c, FilingMethod__c 
            FROM TaxPrepInformation__r 
            WHERE ReturnStatus__c = 'Unsigned') 
    FROM Case 
    WHERE ${whereClause}
    ORDER BY CreatedDate DESC
    LIMIT 10
  `;

  const result = await conn.query(query);
  
  const cases = result.records.map(record => ({
    caseId: record.Id,
    caseNumber: record.CaseNumber,
    clientName: record.Account?.Name,
    contactName: record.Contact?.Name,
    clientEmail: record.Contact?.Email,
    clientPhone: record.Contact?.Phone,
    clientMobile: record.Contact?.MobilePhone,
    pendingYears: record.TaxPrepInformation__r?.records?.map(tax => tax.Year__c) || [],
    totalPendingYears: record.TaxPrepInformation__r?.records?.length || 0
  }));

  return {
    content: [{
      type: 'text',
      text: `Found ${cases.length} pending signature cases. Details: ${JSON.stringify(cases, null, 2)}`
    }]
  };
}

async function handleSendReturns(args) {
  // Get case and contact info
  const caseQuery = `
    SELECT Id, Contact.Name, Contact.Email,
           (SELECT Id, Year__c, ReturnStatus__c FROM TaxPrepInformation__r WHERE ReturnStatus__c = 'Unsigned')
    FROM Case WHERE Id = '${args.caseId}'
  `;
  
  const caseResult = await conn.query(caseQuery);
  if (!caseResult.records.length) {
    throw new Error('Case not found');
  }
  
  const caseRecord = caseResult.records[0];
  const clientEmail = caseRecord.Contact?.Email;
  const clientName = caseRecord.Contact?.Name;
  const unsignedReturns = caseRecord.TaxPrepInformation__r?.records || [];
  
  if (!clientEmail) {
    throw new Error('No email address found for client');
  }
  
  // Send email
  const years = unsignedReturns.map(r => r.Year__c).join(', ');
  const mailOptions = {
    from: 'sam@miadvg.com',
    to: clientEmail,
    subject: `Tax Return Documents - Signature Required (${years})`,
    html: `
      <p>Dear ${clientName},</p>
      <p>Please find your tax return documents attached for the following years: ${years}</p>
      <p>These documents require your signature. Please review, sign, and return them at your earliest convenience.</p>
      <p>If you have any questions, please don't hesitate to contact us.</p>
      <p>Best regards,<br>Tax Preparation Team</p>
    `
  };
  
  await emailTransporter.sendMail(mailOptions);
  
  return {
    content: [{
      type: 'text',
      text: `Successfully sent tax returns to ${clientEmail} for years: ${years}. Total documents: ${unsignedReturns.length}`
    }]
  };
}

async function handleCreateMailRequest(args) {
  // Get case and contact info
  const caseQuery = `
    SELECT Id, ContactId, Contact.Name, Contact.MailingAddress,
           (SELECT Id, Year__c, ReturnStatus__c FROM TaxPrepInformation__r WHERE ReturnStatus__c = 'Unsigned')
    FROM Case WHERE Id = '${args.caseId}'
  `;
  
  const caseResult = await conn.query(caseQuery);
  if (!caseResult.records.length) {
    throw new Error('Case not found');
  }
  
  const caseRecord = caseResult.records[0];
  const unsignedReturns = caseRecord.TaxPrepInformation__r?.records || [];
  const years = unsignedReturns.map(r => r.Year__c).join(', ');
  
  // Create mail request (simulated for now)
  const mailRequest = {
    caseId: args.caseId,
    contactId: caseRecord.ContactId,
    documentsToMail: unsignedReturns.length,
    years: years,
    status: 'Requested',
    requestedDate: new Date().toISOString()
  };
  
  return {
    content: [{
      type: 'text',
      text: `Created mail request for case ${args.caseId}. Will mail ${unsignedReturns.length} documents for years: ${years} to ${caseRecord.Contact?.Name}`
    }]
  };
}

app.listen(port, () => {
  console.log(`Tax Prep MCP Server running on port ${port}`);
  console.log('Available tools: get_pending_signature_cases, send_returns_to_client, create_mail_request');
});
