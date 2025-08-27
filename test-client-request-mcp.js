#!/usr/bin/env node

/**
 * Test script for the Client Request MCP Server
 * Run this to verify your MCP server is working correctly
 */

import fetch from 'node-fetch';

const SERVER_URL = 'http://localhost:3003';

async function testMCPServer() {
  console.log('🧪 Testing Client Request MCP Server...\n');

  try {
    // Test 1: Health Check
    console.log('1. Testing health check...');
    const healthResponse = await fetch(`${SERVER_URL}/health`);
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.status);
    console.log('');

    // Test 2: Initialize
    console.log('2. Testing MCP initialize...');
    const initResponse = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      })
    });
    const initData = await initResponse.json();
    console.log('✅ Initialize successful:', initData.result?.serverInfo?.name);
    console.log('');

    // Test 3: List Tools
    console.log('3. Testing tools/list...');
    const toolsResponse = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list'
      })
    });
    const toolsData = await toolsResponse.json();
    console.log(`✅ Found ${toolsData.result?.tools?.length || 0} tools:`);
    toolsData.result?.tools?.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });
    console.log('');

    // Test 4: Get Client Requests
    console.log('4. Testing get_client_requests...');
    const requestsResponse = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'get_client_requests',
          arguments: {
            limit: 5,
            onlyUnresponded: false
          }
        }
      })
    });
    const requestsData = await requestsResponse.json();
    if (requestsData.error) {
      console.log('❌ Error getting client requests:', requestsData.error.message);
    } else {
      console.log('✅ Client requests retrieved successfully');
      console.log('   Response preview:', requestsData.result?.content?.[0]?.text?.substring(0, 100) + '...');
    }
    console.log('');

    // Test 5: Search Clients
    console.log('5. Testing search_clients...');
    const searchResponse = await fetch(SERVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'search_clients',
          arguments: {
            searchTerm: 'Smith',
            limit: 3
          }
        }
      })
    });
    const searchData = await searchResponse.json();
    if (searchData.error) {
      console.log('❌ Error searching clients:', searchData.error.message);
    } else {
      console.log('✅ Client search successful');
      console.log('   Response preview:', searchData.result?.content?.[0]?.text?.substring(0, 100) + '...');
    }

    console.log('\n🎉 MCP Server test completed!');
    console.log('\n📋 Next Steps:');
    console.log('1. Configure your Retell agent to use this MCP server');
    console.log('2. Set the server URL to:', SERVER_URL);
    console.log('3. Test the integration with real client requests');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure the server is running: npm start');
    console.log('2. Check your Salesforce credentials in .env');
    console.log('3. Verify the server URL:', SERVER_URL);
  }
}

// Check if we need to install node-fetch
try {
  await testMCPServer();
} catch (error) {
  if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('node-fetch')) {
    console.log('❌ node-fetch is required for testing');
    console.log('📦 Install it with: npm install node-fetch');
  } else {
    throw error;
  }
}

