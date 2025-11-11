# 🀄 Filipino Mahjong - Online Multiplayer Game - Paul

A real-time multiplayer Filipino Mahjong game built with React (frontend) and Node.js with WebSockets (backend).

## Features

- **4-player multiplayer** with WebSocket real-time communication
- **Filipino Mahjong rules**:
  - Win with 4 melds + 1 pair
  - Pong, Chow, and Kong combinations
  - Chaos rules: any player can pong/kong any discard
  - Dragons, winds, and flowers are automatic redraws
  - No ponging on pairs
- **Room system** with unique 4-character codes
- **Beautiful UI** with Mahjong tile emojis
- **Turn-based gameplay** with visual indicators
- **Win detection** and game state management

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   cd filipino-mahj
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install frontend dependencies**
   ```bash
   cd ../frontend
   npm install
   ```

## Running the Game

### Option 1: Run backend and frontend separately

**Terminal 1 - Backend Server:**
```bash
cd backend
npm start
```
The WebSocket server will start on `ws://localhost:3001`

**Terminal 2 - Frontend Client:**
```bash
cd frontend
npm start
```
The React app will open at `http://localhost:3000`

### Option 2: Run both concurrently (if you install concurrently)

From the root directory:
```bash
npm install concurrently --save-dev
npm run dev
```

## How to Play

### Starting a Game

1. **Create a Room**:
   - Click "Create Room"
   - Enter your name
   - Share the 4-character room code with 3 friends

2. **Join a Room**:
   - Click "Join Room"
   - Enter the room code
   - Enter your name

3. **Wait for Players**: Game starts automatically when 4 players join

### Gameplay

**Your Turn:**
1. Click "Draw Tile" to draw from the wall
2. If you draw a dragon, wind, or flower, you automatically redraw
3. Select a tile from your hand
4. Click "Discard Selected" to discard it

**Claiming Tiles:**
- When another player discards, you may see claim options:
  - **Pong**: Claim if you have 2 matching tiles (forms set of 3)
  - **Kong**: Claim if you have 3 matching tiles (forms set of 4)
  - **Chow**: Claim if you're next player and can form a sequence (e.g., 3-4-5)
- Click "Claim" to take the tile, or "Pass" to skip

**Winning:**
- Form 4 melds (pong/chow/kong) + 1 pair (2 identical tiles)
- The game will automatically detect and announce the winner

## Game Rules

### Valid Melds
- **Pong**: 3 identical tiles (e.g., 🀇🀇🀇)
- **Chow**: 3 consecutive tiles of same suit (e.g., 🀇🀈🀉)
- **Kong**: 4 identical tiles (e.g., 🀇🀇🀇🀇)

### Special Rules
- **Auto-redraw tiles**: Dragons (🀄🀅🀆), Winds (🀀🀁🀂🀃), Flowers (🀢🀣🀤🀥)
- **Chaos rules**: Any player can claim pong/kong from any discard
- **Chow restriction**: Only the next player can claim chow
- **Pair rule**: Cannot pong on a pair (need 4 melds + 1 pair to win)

## Project Structure

```
filipino-mahj/
├── backend/
│   ├── package.json
│   ├── server.js          # WebSocket server
│   └── gameLogic.js       # Game rules and validation
├── frontend/
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── App.js         # Main app component
│       ├── components/
│       │   ├── Lobby.js           # Room creation/joining
│       │   ├── GameBoard.js       # Main game interface
│       │   ├── PlayerHand.js      # Player's tiles
│       │   ├── Tile.js            # Individual tile display
│       │   ├── OpponentDisplay.js # Other players' info
│       │   ├── DiscardPile.js     # Discarded tiles
│       │   └── ActionPanel.js     # Game action buttons
│       └── index.js
└── README.md
```

## Technology Stack

### Backend
- **Node.js** - Server runtime
- **ws** - WebSocket library
- **uuid** - Unique ID generation

### Frontend
- **React** - UI framework
- **WebSocket API** - Real-time communication
- **CSS3** - Styling and animations

## Troubleshooting

### Connection Issues
- Make sure the backend server is running on port 3001
- Check that no firewall is blocking WebSocket connections
- If using a different port, update `WS_URL` in `frontend/src/App.js`

### Game Not Starting
- Ensure all 4 players have joined the room
- Check the browser console for error messages
- Refresh the page if disconnected

### Tiles Not Displaying
- Make sure your browser supports emoji rendering
- Try a modern browser (Chrome, Firefox, Safari, Edge)

## 🚀 Deployment

Ready to deploy? Check out these guides:

- **[Quick Deploy (5 minutes)](DEPLOY_QUICKSTART.md)** - Easiest way using Railway + Vercel
- **[Full Deployment Guide](DEPLOYMENT.md)** - All deployment options and configurations

**Recommended Stack:**
- Backend: Railway or Render (free tier available)
- Frontend: Vercel or Netlify (free)
- Total Cost: $0-5/month

## Future Enhancements

- [ ] Add scoring system
- [ ] Implement game history and replay
- [ ] Add chat functionality
- [ ] Support for different Mahjong variants
- [ ] AI players for practice mode
- [ ] Sound effects and animations
- [ ] Mobile responsive design
- [ ] Player avatars and profiles

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

Enjoy playing Filipino Mahjong! 🀄🎮

