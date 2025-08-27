import express from 'express';

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

// Minimal logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${JSON.stringify(req.body)}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Single MCP endpoint handler
app.post('/', (req, res) => {
  const { method, id } = req.body;
  
  const response = {
    jsonrpc: '2.0',
    id: id || 0
  };

  switch (method) {
    case 'initialize':
      response.result = {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'simple-mcp-test', version: '1.0.0' }
      };
      break;
      
    case 'tools/list':
      response.result = {
        tools: [{
          name: 'say_hello',
          description: 'A simple test tool that says hello',
          inputSchema: {
            type: 'object',
            properties: { name: { type: 'string', description: 'Name to greet' } },
            required: ['name']
          }
        }]
      };
      break;
      
    case 'tools/call':
      const { name, arguments: args } = req.body.params || {};
      if (name === 'say_hello') {
        response.result = {
          content: [{ type: 'text', text: `Hello, ${args?.name || 'World'}!` }]
        };
      } else {
        response.error = { code: -32601, message: `Unknown tool: ${name}` };
      }
      break;
      
    default:
      response.error = { code: -32601, message: `Unknown method: ${method}` };
  }
  
  res.json(response);
});

app.listen(port, () => {
  console.log(`Minimal MCP Server running on port ${port}`);
});
