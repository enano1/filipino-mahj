# 🎮 Quick Start Guide

## Getting Started in 3 Easy Steps

### Step 1: Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 2: Start the Backend Server

Open a terminal and run:

```bash
cd backend
npm start
```

You should see: `🀄 Filipino Mahjong server running on port 3001`

### Step 3: Start the Frontend

Open a **new terminal** and run:

```bash
cd frontend
npm start
```

Your browser will automatically open to `http://localhost:3000`

## Playing Your First Game

### Single Computer (Testing)

1. Open `http://localhost:3000` in **4 different browser tabs**
2. In tab 1: Click "Create Room", enter a name
3. Copy the 4-character room code
4. In tabs 2-4: Click "Join Room", paste the room code, enter different names
5. Game starts automatically when all 4 players join!

### Multiple Computers (Real Multiplayer)

1. **Host player**: 
   - Start both backend and frontend servers
   - Click "Create Room"
   - Share your room code AND your local IP address

2. **Other players**:
   - Update `WS_URL` in `frontend/src/App.js` to point to host's IP:
     ```javascript
     const WS_URL = 'ws://[HOST_IP]:3001';  // e.g., ws://192.168.1.5:3001
     ```
   - Start frontend: `npm start`
   - Click "Join Room" and enter the room code

## Game Controls

### On Your Turn
1. **Draw**: Click "🎴 Draw Tile" button
2. **Discard**: Click a tile in your hand to select it, then click "🗑️ Discard Selected"

### When Others Discard
- If you can claim (Pong/Kong/Chow), you'll see a yellow "⚡ Claim Available!" panel
- Click "✅ Claim" to take the tile, or "⏭️ Pass" to skip

### Winning
- Form 4 melds + 1 pair
- The game automatically detects and announces the winner!

## Troubleshooting

**"Upgrade Required" or connection issues?**
- This is fixed! The server now properly handles HTTP-to-WebSocket upgrades
- Make sure you restart the backend server after any updates
- Verify the server shows: `🀄 Filipino Mahjong server running on port 3001`

**Can't connect?**
- Make sure the backend server is running (port 3001)
- Check browser console for errors
- Verify WebSocket URL is correct
- Test the server: open `http://localhost:3001/health` (should show `{"status":"ok","rooms":0}`)

**Game not starting?**
- Need exactly 4 players to start
- All players must be in the same room

**Disconnected?**
- The app will automatically try to reconnect
- You may need to rejoin the room

## Tips

- 🎯 Green "Your Turn" indicator shows when it's your turn
- 🀫 Dragons, winds, and flowers auto-redraw
- 💡 Yellow glowing tile in discard pile = latest discard
- 🎨 Selected tile lifts up in your hand

Enjoy the game! 🀄

