import React from 'react';

function EnvDebug() {
  const allEnvVars = Object.keys(process.env)
    .filter(key => key.startsWith('REACT_APP_'))
    .reduce((obj, key) => {
      obj[key] = process.env[key];
      return obj;
    }, {});

  return (
    <div style={{ 
      padding: '20px', 
      backgroundColor: '#1a1a1a', 
      color: '#fff',
      fontFamily: 'monospace',
      minHeight: '100vh'
    }}>
      <h1>🔍 Environment Variables Debug</h1>
      
      <div style={{ 
        backgroundColor: '#2a2a2a', 
        padding: '20px', 
        borderRadius: '10px',
        marginBottom: '20px'
      }}>
        <h2 style={{ color: '#4ade80' }}>REACT_APP_* Variables:</h2>
        <pre style={{ 
          backgroundColor: '#333', 
          padding: '15px', 
          borderRadius: '5px',
          overflow: 'auto',
          border: '1px solid #555'
        }}>
          {JSON.stringify(allEnvVars, null, 2)}
        </pre>
      </div>
      
      <div style={{ 
        backgroundColor: '#2a2a2a', 
        padding: '20px', 
        borderRadius: '10px',
        marginBottom: '20px'
      }}>
        <h2 style={{ color: '#fbbf24' }}>WebSocket URL Being Used:</h2>
        <pre style={{ 
          backgroundColor: '#333', 
          padding: '15px', 
          borderRadius: '5px',
          border: '1px solid #555',
          fontSize: '16px',
          fontWeight: 'bold'
        }}>
          {process.env.REACT_APP_WS_URL || 'ws://localhost:3001 (default fallback)'}
        </pre>
      </div>

      <div style={{ 
        backgroundColor: '#2a2a2a', 
        padding: '20px', 
        borderRadius: '10px',
        marginBottom: '20px'
      }}>
        <h2 style={{ color: '#3b82f6' }}>All process.env keys (first 50):</h2>
        <pre style={{ 
          backgroundColor: '#333', 
          padding: '15px', 
          borderRadius: '5px',
          maxHeight: '300px',
          overflow: 'auto',
          border: '1px solid #555'
        }}>
          {Object.keys(process.env).sort().slice(0, 50).join('\n')}
        </pre>
      </div>

      <div style={{ 
        backgroundColor: '#2a2a2a', 
        padding: '20px', 
        borderRadius: '10px'
      }}>
        <h2 style={{ color: '#ef4444' }}>Current Location Info:</h2>
        <pre style={{ 
          backgroundColor: '#333', 
          padding: '15px', 
          borderRadius: '5px',
          border: '1px solid #555'
        }}>
          {JSON.stringify({
            hostname: window.location.hostname,
            protocol: window.location.protocol,
            href: window.location.href,
            search: window.location.search
          }, null, 2)}
        </pre>
      </div>
    </div>
  );
}

export default EnvDebug;