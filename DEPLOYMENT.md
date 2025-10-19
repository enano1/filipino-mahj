# 🚀 Deployment Guide

This guide covers multiple deployment options for your Filipino Mahjong game.

## Table of Contents
1. [Quick Deploy (Easiest)](#quick-deploy-easiest)
2. [Railway (Recommended)](#railway-recommended)
3. [Render (Free Tier)](#render-free-tier)
4. [Heroku](#heroku)
5. [VPS/Cloud (Advanced)](#vpscloud-advanced)
6. [Configuration](#configuration)

---

## Quick Deploy (Easiest)

### Option 1: Railway (Best for Beginners)

**Backend Deployment:**

1. Go to [Railway.app](https://railway.app) and sign up
2. Click "New Project" → "Deploy from GitHub repo"
3. Connect your GitHub repo (or create one and push this code)
4. Railway will auto-detect Node.js
5. Add these environment variables:
   - `PORT`: `3001` (or let Railway assign)
6. Deploy!

**Frontend Deployment:**

1. Go to [Vercel.com](https://vercel.com) and sign up
2. Click "New Project" → Import your repo
3. Set root directory to `frontend`
4. Add environment variable:
   - `REACT_APP_WS_URL`: `wss://your-backend-url.railway.app`
5. Deploy!

**Update Frontend URL:**
```javascript
// frontend/src/App.js
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
```

---

## Railway (Recommended)

### Why Railway?
- ✅ WebSocket support out of the box
- ✅ Free tier available
- ✅ Auto-deploy on git push
- ✅ Easy environment variables

### Step-by-Step:

**1. Prepare Your Code**

Create `railway.json` in project root:
```json
{
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "cd backend && node server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

**2. Deploy Backend**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project
railway init

# Deploy
railway up
```

**3. Get Your URL**
```bash
railway domain
# Example: filipino-mahjong-production.up.railway.app
```

**4. Deploy Frontend (Vercel)**
```bash
cd frontend
npm install -g vercel
vercel

# Set environment variable in Vercel dashboard:
# REACT_APP_WS_URL = wss://your-backend.railway.app
```

---

## Render (Free Tier)

### Backend (Web Service)

1. Go to [Render.com](https://render.com)
2. Create "New Web Service"
3. Connect GitHub repo
4. Settings:
   - **Name**: `filipino-mahjong-backend`
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free
5. Add Environment Variable:
   - `NODE_ENV`: `production`
6. Deploy!

### Frontend (Static Site)

1. Create "New Static Site"
2. Settings:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `build`
3. Add Environment Variable:
   - `REACT_APP_WS_URL`: `wss://filipino-mahjong-backend.onrender.com`
4. Deploy!

**Note**: Render's free tier may spin down after inactivity (cold starts).

---

## Heroku

### Backend

1. Install [Heroku CLI](https://devcenter.heroku.com/articles/heroku-cli)

2. Create app:
```bash
heroku create filipino-mahjong-backend
```

3. Create `Procfile` in backend directory:
```
web: node server.js
```

4. Update `backend/server.js` to use Heroku's PORT:
```javascript
const PORT = process.env.PORT || 3001;
```

5. Deploy:
```bash
cd backend
git init
git add .
git commit -m "Initial commit"
heroku git:remote -a filipino-mahjong-backend
git push heroku main
```

6. Scale up:
```bash
heroku ps:scale web=1
```

### Frontend

Deploy to Vercel or Netlify (see below).

---

## VPS/Cloud (Advanced)

### DigitalOcean, AWS EC2, Google Cloud, etc.

**1. SSH into your server:**
```bash
ssh user@your-server-ip
```

**2. Install Node.js:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**3. Clone and setup:**
```bash
git clone https://github.com/your-username/filipino-mahj.git
cd filipino-mahj/backend
npm install
```

**4. Use PM2 for process management:**
```bash
sudo npm install -g pm2

# Start backend
pm2 start server.js --name "mahjong-backend"

# Save PM2 config
pm2 save

# Setup auto-restart on reboot
pm2 startup
```

**5. Setup Nginx reverse proxy:**
```bash
sudo apt install nginx

# Create config
sudo nano /etc/nginx/sites-available/mahjong
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/mahjong /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**6. Setup SSL with Let's Encrypt:**
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

**7. Deploy Frontend:**
```bash
cd ../frontend
npm install
npm run build

# Copy to Nginx web root
sudo cp -r build/* /var/www/html/
```

---

## Configuration

### Environment Variables

**Backend (.env):**
```bash
PORT=3001
NODE_ENV=production
```

**Frontend (.env.production):**
```bash
REACT_APP_WS_URL=wss://your-backend-domain.com
```

### Update Frontend for Production

**frontend/src/App.js:**
```javascript
const WS_URL = process.env.REACT_APP_WS_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'wss://your-backend-domain.com' 
    : 'ws://localhost:3001');
```

### Enable CORS (if needed)

**backend/server.js** (before WebSocket setup):
```javascript
const server = http.createServer((req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // ... rest of your code
});
```

---

## Testing Your Deployment

**1. Check Backend Health:**
```bash
curl https://your-backend-domain.com/health
# Should return: {"status":"ok","rooms":0}
```

**2. Test WebSocket:**
Open browser console on frontend:
```javascript
const ws = new WebSocket('wss://your-backend-domain.com');
ws.onopen = () => console.log('Connected!');
ws.onerror = (e) => console.error('Error:', e);
```

**3. Play Test:**
- Open frontend in 4 browser tabs
- Create a room
- Join from other tabs
- Play a game!

---

## Recommended Setup (Best Practice)

**Backend**: Railway or Render
- Easy WebSocket support
- Auto-deploy from GitHub
- Free tier available

**Frontend**: Vercel or Netlify
- Free static hosting
- Auto-deploy from GitHub
- Global CDN
- Custom domain support

**Total Cost**: $0 (free tiers) to $10/month

---

## Troubleshooting

**WebSocket connection fails:**
- Make sure you're using `wss://` (not `ws://`) for HTTPS sites
- Check firewall allows WebSocket connections
- Verify backend health endpoint works

**Frontend can't connect to backend:**
- Check `REACT_APP_WS_URL` environment variable
- Look for CORS errors in browser console
- Ensure backend URL is correct

**Cold starts (Render/Heroku free tier):**
- First connection may take 30-60 seconds
- Consider upgrading to paid tier for better performance

**"Web Socket is closed before the connection is established":**
- Backend server might be down
- Wrong WebSocket URL
- Firewall blocking connection

---

## Quick Commands Reference

```bash
# Railway
railway login
railway init
railway up
railway logs

# Heroku
heroku login
heroku create app-name
git push heroku main
heroku logs --tail

# PM2 (VPS)
pm2 start server.js
pm2 logs
pm2 restart all
pm2 stop all

# Vercel
vercel login
vercel
vercel --prod
```

---

## Need Help?

- Check server logs for errors
- Test WebSocket connection manually
- Verify environment variables are set
- Make sure ports are open (3001 for local, 80/443 for production)

Good luck with your deployment! 🚀🀄

