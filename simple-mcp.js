import express from 'express';

const app = express();
const port = process.env.PORT || 3002;

app.use(express.json());

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
    headers: req.headers,
    body: req.body
  });
  next();
});

// Add CORS headers for Retell
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'simple-mcp-test',
    timestamp: new Date().toISOString()
  });
});

// MCP Initialize endpoint
app.post('/initialize', (req, res) => {
  res.json({
    protocolVersion: "2024-11-05",
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: "simple-mcp-test",
      version: "1.0.0"
    }
  });
});

// MCP Tools List endpoint
app.post('/tools/list', (req, res) => {
  res.json({
    tools: [
      {
        name: "say_hello",
        description: "A simple test tool that says hello with a name",
        inputSchema: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "The name to greet"
            }
          },
          required: ["name"]
        }
      }
    ]
  });
});

// MCP Tools Call endpoint
app.post('/tools/call', (req, res) => {
  const { name, arguments: args } = req.body;
  
  console.log('Tool called:', name, 'with args:', args);
  
  if (name === 'say_hello') {
    const personName = args.name || 'World';
    res.json({
      content: [
        {
          type: "text",
          text: `Hello, ${personName}! This is a test from the MCP server.`
        }
      ]
    });
  } else {
    res.status(400).json({
      error: `Unknown tool: ${name}`
    });
  }
});

app.listen(port, () => {
  console.log(`Simple MCP Server running on http://localhost:${port}`);
  console.log('MCP Endpoints:');
  console.log('  POST /initialize');
  console.log('  POST /tools/list');
  console.log('  POST /tools/call');
  console.log('  GET  /health');
});
