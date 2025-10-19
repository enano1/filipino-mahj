# 🚀 Deploy in 5 Minutes

## Easiest: Railway + Vercel (Recommended)

### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USERNAME/filipino-mahjong.git
git push -u origin main
```

### Step 2: Deploy Backend (Railway)
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway auto-detects and deploys!
5. Click your service → "Settings" → "Generate Domain"
6. Copy your URL: `https://filipino-mahjong-production.up.railway.app`

### Step 3: Deploy Frontend (Vercel)
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project" → Import your GitHub repo
3. **Important**: Set "Root Directory" to `frontend`
4. Add Environment Variable:
   - Name: `REACT_APP_WS_URL`
   - Value: `wss://filipino-mahjong-production.up.railway.app` (use your Railway URL)
5. Click "Deploy"

### Step 4: Play!
Open your Vercel URL (e.g., `filipino-mahjong.vercel.app`) and start playing!

---

## Alternative: All-in-One Render

### One-Click Deploy
1. Push code to GitHub
2. Go to [render.com](https://render.com)
3. Click "New" → "Blueprint"
4. Connect your repo
5. Render will read `render.yaml` and deploy both frontend and backend!

---

## Local Testing Before Deploy

```bash
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm start
```

---

## Environment Variables

**For Backend** (Railway/Render):
- `PORT`: Auto-assigned (or use 3001)
- `NODE_ENV`: production

**For Frontend** (Vercel):
- `REACT_APP_WS_URL`: Your backend WebSocket URL (wss://...)

---

## Costs

- **Railway**: Free tier (500 hours/month) or $5/month
- **Vercel**: Free for personal projects
- **Render**: Free tier available (may sleep after inactivity)

**Total**: $0 - $5/month

---

## Troubleshooting

**"Can't connect to server"**
- Check backend is deployed and running
- Verify `REACT_APP_WS_URL` is set correctly (must use `wss://` not `ws://`)
- Check browser console for errors

**"Web Socket is closed"**
- Backend might be sleeping (Render free tier) - wait 30 seconds
- Wrong WebSocket URL format
- CORS issues (should be handled automatically)

---

## Need More Help?

See full deployment guide: [DEPLOYMENT.md](DEPLOYMENT.md)

