# 🚂 Railway Deployment Fix

## The Problem
Railway couldn't find the `ws` module because dependencies are in the `backend` directory, not the root.

## The Solution

I've added configuration files to fix this. Choose **ONE** of these methods:

---

## Method 1: Use Root Directory Setting (EASIEST) ✅

In Railway Dashboard:

1. Go to your service settings
2. Find **"Root Directory"**
3. Set it to: `backend`
4. Redeploy

That's it! Railway will now treat `backend` as the root and install dependencies correctly.

---

## Method 2: Use the Updated Configuration Files

The repo now has:
- `nixpacks.toml` - Tells Railway to install dependencies in backend directory
- Updated `package.json` - Root-level scripts for Railway to use

**Just push the changes and redeploy:**
```bash
git add .
git commit -m "Fix Railway deployment configuration"
git push
```

Railway will automatically pick up the new configuration.

---

## Method 3: Manual Railway CLI

If you prefer CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link to your project
railway link

# Set root directory
railway settings --rootDirectory backend

# Redeploy
railway up
```

---

## Verify It Works

After deployment, check:

```bash
# Test health endpoint
curl https://your-app.railway.app/health

# Should return:
{"status":"ok","rooms":0}
```

---

## Recommended: Method 1 (Root Directory)

This is the cleanest solution. In Railway dashboard:
1. Settings → Root Directory → `backend`
2. Redeploy

Done! 🎉

