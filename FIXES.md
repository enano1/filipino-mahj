# 🔧 Issue Fixes

## "Upgrade Required" WebSocket Connection Error

### Problem
The WebSocket server was experiencing repeated connect/disconnect cycles with "426 Upgrade Required" errors. Clients couldn't establish stable connections.

### Root Cause
The original code created a standalone WebSocket server directly on a port:
```javascript
const wss = new WebSocket.Server({ port: PORT });
```

This approach doesn't properly handle HTTP upgrade requests. When browsers connect to WebSocket servers, they first send an HTTP request with an "Upgrade: websocket" header. Without an HTTP server to handle this, the connection fails.

### Solution
Create an HTTP server first, then attach the WebSocket server to it:

```javascript
// Create HTTP server
const server = http.createServer((req, res) => {
  // Handle HTTP requests
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', rooms: rooms.size }));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Filipino Mahjong WebSocket Server\n');
  }
});

// Attach WebSocket server to HTTP server
const wss = new WebSocket.Server({ 
  server,
  path: '/'
});

// Start the HTTP server
server.listen(PORT, () => {
  console.log(`🀄 Filipino Mahjong server running on port ${PORT}`);
});
```

### Benefits
1. ✅ Proper HTTP-to-WebSocket upgrade handling
2. ✅ Ability to serve HTTP endpoints (like `/health` for monitoring)
3. ✅ Better compatibility with browsers and reverse proxies
4. ✅ Standard WebSocket server architecture

### Testing
You can verify the server is working correctly:

**HTTP Health Check:**
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","rooms":0}
```

**WebSocket Connection:**
Open the frontend at `http://localhost:3000` and you should see "🟢 Connected" in the header.

### Files Changed
- `backend/server.js` - Added HTTP server layer

---

## Status: ✅ FIXED

The WebSocket server now properly handles connections and should work reliably across all browsers and environments.

