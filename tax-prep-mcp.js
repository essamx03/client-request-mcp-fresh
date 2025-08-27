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
const emailTransporter = nodemailer.createTransport({
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
            },
            {
              name: 'describe_object_fields',
              description: 'Get field information for Salesforce objects to find correct API names',
              inputSchema: {
                type: 'object',
                properties: {
                  objectName: { type: 'string', description: 'Salesforce object API name (e.g., Document__c, TaxPrepInformation__c)' }
                },
                required: ['objectName']
              }
            },
            {
              name: 'create_tax_return_documents',
              description: 'Create Document__c records for tax returns (Federal and State) for specified years',
              inputSchema: {
                type: 'object',
                properties: {
                  caseId: { type: 'string', description: 'Case ID to create documents for (Case__c custom object ID)' },
                  years: { type: 'array', items: { type: 'string' }, description: 'Tax years to create (e.g., ["2020", "2021", "2022"])' },
                  includeState: { type: 'boolean', description: 'Whether to create state returns (default: true)' }
                },
                required: ['caseId', 'years']
              }
            },
            {
              name: 'list_case_custom_objects',
              description: 'List Case__c custom object records (not standard Case objects)',
              inputSchema: {
                type: 'object',
                properties: {
                  limit: { type: 'number', description: 'Maximum number of cases to return (default: 10)' }
                }
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
            
          case 'describe_object_fields':
            response.result = await handleDescribeObjectFields(args);
            break;
            
          case 'create_tax_return_documents':
            response.result = await handleCreateTaxReturnDocuments(args);
            break;
            
          case 'list_case_custom_objects':
            response.result = await handleListCaseCustomObjects(args);
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
  // For now, let's query Document__c directly since it holds the pending signature status
  let docWhereClause = "Prep_Status__c = 'Pending Signatures'";
  
  if (args.caseId) {
    docWhereClause += ` AND Case__c = '${args.caseId}'`;
  }

  // Query Document__c directly for pending signatures
  const docQuery = `
    SELECT Id, Name, Year__c, Agency__c, Prep_Status__c, Case__c
    FROM Document__c 
    WHERE ${docWhereClause}
    ORDER BY CreatedDate DESC
    LIMIT 50
  `;
  
  const docResult = await conn.query(docQuery);
  
  // Group documents by case
  const caseGroups = {};
  for (const doc of docResult.records || []) {
    const caseId = doc.Case__c;
    if (!caseGroups[caseId]) {
      caseGroups[caseId] = [];
    }
    caseGroups[caseId].push(doc);
  }
  
  // Get case details for each case with pending documents
  const cases = [];
  for (const [caseId, documents] of Object.entries(caseGroups)) {
    try {
      const caseQuery = `
        SELECT Id, Name, CaseType__c, OwnerId
        FROM Case__c 
        WHERE Id = '${caseId}'
      `;
      
      const caseResult = await conn.query(caseQuery);
      const caseRecord = caseResult.records?.[0];
      
      cases.push({
        caseId: caseId,
        caseName: caseRecord?.Name || 'Unknown',
        caseType: caseRecord?.CaseType__c || 'Unknown',
        pendingYears: documents.map(doc => doc.Year__c),
        pendingDocuments: documents.map(doc => ({ name: doc.Name, year: doc.Year__c, status: doc.Prep_Status__c })),
        totalPendingDocuments: documents.length
      });
    } catch (error) {
      console.log(`Error getting case ${caseId}:`, error.message);
    }
  }

  return {
    content: [{
      type: 'text',
      text: `Found ${cases.length} cases with pending signatures:\n${JSON.stringify(cases, null, 2)}`
    }]
  };
}

async function handleSendReturns(args) {
  // Get Case__c custom object info (no direct Contact relationship)
  const caseQuery = `
    SELECT Id, Name
    FROM Case__c WHERE Id = '${args.caseId}'
  `;
  
  const caseResult = await conn.query(caseQuery);
  if (!caseResult.records.length) {
    throw new Error('Case__c not found');
  }
  
  const caseRecord = caseResult.records[0];
  // For testing, we'll use a test email - in production you'd get this from Account/Contact relationship
  const clientEmail = 'sam@miadvg.com'; // Test email
  const clientName = caseRecord.Name || 'Test Client';
  
  // Get documents separately from Document__c table
  const docQuery = `
    SELECT Id, Name, Year__c, Agency__c, Prep_Status__c 
    FROM Document__c 
    WHERE Case__c = '${args.caseId}' AND Prep_Status__c = 'Pending Signatures'
  `;
  
  const docResult = await conn.query(docQuery);
  const unsignedReturns = docResult.records || [];
  
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
      text: `✅ Successfully sent tax returns to ${clientEmail} for years: ${years}. Total documents: ${unsignedReturns.length}`
    }]
  };
}

async function handleCreateMailRequest(args) {
  // Get Case__c custom object info
  const caseQuery = `
    SELECT Id, Name
    FROM Case__c WHERE Id = '${args.caseId}'
  `;
  
  const caseResult = await conn.query(caseQuery);
  if (!caseResult.records.length) {
    throw new Error('Case__c not found');
  }
  
  const caseRecord = caseResult.records[0];
  
  // Get documents separately from Document__c table
  const docQuery = `
    SELECT Id, Name, Year__c, Agency__c, Prep_Status__c 
    FROM Document__c 
    WHERE Case__c = '${args.caseId}' AND Prep_Status__c = 'Pending Signatures'
  `;
  
  const docResult = await conn.query(docQuery);
  const unsignedReturns = docResult.records || [];
  const years = unsignedReturns.map(r => r.Year__c).join(', ');
  
  // Create mail request (simulated for now)
  const mailRequest = {
    caseId: args.caseId,
    caseName: caseRecord.Name,
    documentsToMail: unsignedReturns.length,
    years: years,
    status: 'Requested',
    requestedDate: new Date().toISOString()
  };
  
  return {
    content: [{
      type: 'text',
      text: `📮 Created mail request for case ${args.caseId}. Will mail ${unsignedReturns.length} documents for years: ${years} to ${caseRecord.Name || 'Unknown Case'}`
    }]
  };
}

async function handleDescribeObjectFields(args) {
  const { objectName } = args;
  
  if (!objectName) {
    throw new Error('objectName is required');
  }
  
  try {
    // Use jsforce to describe the object
    const description = await conn.sobject(objectName).describe();
    
    // Extract relevant field information
    const fields = description.fields.map(field => ({
      name: field.name,
      label: field.label,
      type: field.type,
      required: !field.nillable,
      length: field.length,
      relationshipName: field.relationshipName,
      referenceTo: field.referenceTo
    }));
    
    // Filter to show most relevant fields (non-system fields)
    const relevantFields = fields.filter(field => 
      !field.name.includes('CreatedBy') && 
      !field.name.includes('LastModified') && 
      !field.name.includes('SystemModstamp') &&
      field.name !== 'Id'
    );
    
    return {
      content: [{
        type: 'text',
        text: `📋 Object: ${description.name} (${description.label})\n\n🔍 Key Fields:\n${JSON.stringify(relevantFields.slice(0, 15), null, 2)}\n\n📊 Total Fields: ${fields.length}`
      }]
    };
  } catch (error) {
    throw new Error(`Failed to describe object ${objectName}: ${error.message}`);
  }
}

async function handleCreateTaxReturnDocuments(args) {
  const { caseId, years, includeState = true } = args;
  
  if (!caseId || !years || !Array.isArray(years)) {
    throw new Error('caseId and years array are required');
  }
  
  // Verify Case__c custom object exists
  const caseQuery = `SELECT Id, Name FROM Case__c WHERE Id = '${caseId}'`;
  const caseResult = await conn.query(caseQuery);
  
  if (!caseResult.records.length) {
    throw new Error(`Case__c not found: ${caseId}`);
  }
  
  const caseName = caseResult.records[0].Name;
  const documentsToCreate = [];
  
  // Create document records for each year (without Name field - appears to be auto-generated)
  for (const year of years) {
    // Federal return
    documentsToCreate.push({
      Case__c: caseId,
      Year__c: year,
      Agency__c: 'IRS',
      Prep_Status__c: 'Pending Signatures'
    });
    
    // State return (if requested)
    if (includeState) {
      documentsToCreate.push({
        Case__c: caseId,
        Year__c: year,
        Agency__c: 'State',
        Prep_Status__c: 'Pending Signatures'
      });
    }
  }
  
  // Create all documents in Salesforce
  try {
    const createResults = await conn.sobject('Document__c').create(documentsToCreate);
    const createdDocs = Array.isArray(createResults) ? createResults : [createResults];
    const successCount = createdDocs.filter(result => result.success).length;
    const failureCount = createdDocs.filter(result => !result.success).length;
    
    const docList = documentsToCreate.map(doc => `- ${doc.Year__c} ${doc.Agency__c} Tax Return`).join('\n');
    
    if (failureCount > 0) {
      const errors = createdDocs.filter(result => !result.success).map(result => result.errors);
      console.log('Creation errors:', JSON.stringify(errors, null, 2));
    }
    
    return {
      content: [{
        type: 'text',
        text: `✅ Successfully created ${successCount} Document__c records for Case__c "${caseName}" (${caseId}):\n\n${docList}\n\n${failureCount > 0 ? `⚠️ ${failureCount} failed to create. Check server logs for details.` : 'All documents ready for signature testing!'}`
      }]
    };
  } catch (error) {
    throw new Error(`Failed to create documents: ${error.message}`);
  }
}

async function handleListCaseCustomObjects(args) {
  const limit = args.limit || 10;
  
  const query = `
    SELECT Id, Name, CaseType__c, OwnerId, CreatedDate
    FROM Case__c 
    ORDER BY CreatedDate DESC
    LIMIT ${limit}
  `;

  const result = await conn.query(query);
  
  const cases = result.records.map(record => ({
    caseId: record.Id,
    caseName: record.Name,
    caseType: record.CaseType__c,
    createdDate: record.CreatedDate
  }));

  return {
    content: [{
      type: 'text',
      text: `Found ${cases.length} Case__c custom object records:\n${JSON.stringify(cases, null, 2)}`
    }]
  };
}

app.listen(port, () => {
  console.log(`Tax Prep MCP Server running on port ${port}`);
  console.log('Available tools: get_pending_signature_cases, send_returns_to_client, create_mail_request, describe_object_fields, create_tax_return_documents, list_case_custom_objects');
});
