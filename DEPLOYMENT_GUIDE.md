# 🚀 Deploy PolyMesh to Vercel & Render

Complete guide to deploy your PolyMesh AI agent to production.

---

## 📋 Overview

- **Vercel**: Frontend dashboard (React + Vite)
- **Render**: AI agent backend (Node.js + WebSocket)

---

## 🎨 Part 1: Deploy Frontend to Vercel

### Prerequisites:
- GitHub repository pushed ✅
- Vercel account (free): https://vercel.com/signup

### Step 1: Import Project

1. Go to **https://vercel.com/new**
2. Click **"Import Git Repository"**
3. Select **NeoCrafts-cpu/PolyMesh**
4. Click **"Import"**

### Step 2: Configure Build Settings

Vercel should auto-detect Vite, but verify:

```
Framework Preset: Vite
Build Command: cd frontend/neuromesh-ui && npm run build
Output Directory: frontend/neuromesh-ui/dist
Install Command: cd frontend/neuromesh-ui && npm install
Root Directory: ./
Node.js Version: 18.x
```

### Step 3: Environment Variables

Add these in Vercel dashboard under **Settings → Environment Variables**:

```env
VITE_WS_URL=wss://your-render-app.onrender.com
VITE_AGENT_EXECUTOR=0xe77B6844A0b6b534EC60914bDc58dAB74bF9c1E1
VITE_BRIDGE_EXTENSION=0xDeaf2F0B99BBbe9003055529A2bf7a73C33d127B
VITE_NETWORK=amoy
```

**Note:** We'll get the Render URL in Part 2.

### Step 4: Deploy

1. Click **"Deploy"**
2. Wait 2-3 minutes
3. You'll get a URL like: `https://poly-mesh-xxx.vercel.app`

### Step 5: Custom Domain (Optional)

1. Go to **Settings → Domains**
2. Add your custom domain
3. Update DNS records as instructed

---

## 🤖 Part 2: Deploy AI Agent to Render

### Prerequisites:
- GitHub repository pushed ✅
- Render account (free): https://render.com/register

### Step 1: Create Web Service

1. Go to **https://dashboard.render.com/**
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub account
4. Select **NeoCrafts-cpu/PolyMesh**

### Step 2: Configure Service

Fill in these settings:

```
Name: polymesh-agent
Region: Oregon (US West)
Branch: main
Root Directory: ./
Runtime: Node
Build Command: cd agents/eliza && npm install
Start Command: cd agents/eliza && npm start
Instance Type: Starter ($7/month) or Free
```

### Step 3: Environment Variables

Add these in Render dashboard:

**Required:**
```env
POLYMESH_RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002
AGENT_EXECUTOR_ADDRESS=0xe77B6844A0b6b534EC60914bDc58dAB74bF9c1E1
BRIDGE_EXTENSION_ADDRESS=0xDeaf2F0B99BBbe9003055529A2bf7a73C33d127B
WS_PORT=8080
NODE_ENV=production
```

**Secret (Important!):**
```env
AGENT_PRIVATE_KEY=9139b7740e4c509b1c1e66e00b15dfb2571e52f4d187593613f4ae561573ad26
```

⚠️ **Mark AGENT_PRIVATE_KEY as secret!**

**Optional:**
```env
PRICE_CHECK_INTERVAL=30000
MIN_PROFIT_PERCENT=0.5
MAX_GAS_PRICE=50000000000
DEV_MODE=false
DRY_RUN=false
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will start building (5-10 minutes)
3. Watch the logs for deployment progress
4. You'll get a URL like: `https://polymesh-agent.onrender.com`

### Step 5: Verify Deployment

Check health endpoint:
```
https://polymesh-agent.onrender.com/health
```

Should return:
```json
{
  "status": "ok",
  "timestamp": 1732627200000,
  "trades": 0
}
```

### Step 6: Update Frontend

Go back to **Vercel dashboard**:

1. Settings → Environment Variables
2. Update `VITE_WS_URL` to: `wss://polymesh-agent.onrender.com`
3. Click **"Redeploy"**

---

## 🔗 Connect Frontend & Backend

### Update Frontend WebSocket URL

Edit `frontend/neuromesh-ui/src/App.tsx`:

```typescript
// Change from:
const ws = new WebSocket('ws://localhost:8080');

// To:
const ws = new WebSocket(import.meta.env.VITE_WS_URL || 'ws://localhost:8080');
```

Then commit and push:

```powershell
git add frontend/neuromesh-ui/src/App.tsx
git commit -m "🔗 Connect to production backend"
git push
```

Vercel will auto-deploy!

---

## ✅ Verification Checklist

### Frontend (Vercel):
- [ ] Deploys successfully
- [ ] Dashboard loads
- [ ] Shows contract addresses
- [ ] No console errors

### Backend (Render):
- [ ] Service shows "Live"
- [ ] Health check responds
- [ ] Logs show "PolyMesh AI Agent Starting"
- [ ] WebSocket server running

### Integration:
- [ ] Dashboard connects to WebSocket
- [ ] Real-time updates working
- [ ] Trades display correctly
- [ ] Stats update live

---

## 📊 Monitor Your Deployment

### Vercel Analytics:
1. Go to **Vercel Dashboard → Analytics**
2. View visitors, performance, errors

### Render Logs:
1. Go to **Render Dashboard → Logs**
2. Monitor agent activity
3. Watch for trades and errors

### Set Up Alerts:
1. Render → Settings → Notifications
2. Add email for deployment failures
3. Add Slack/Discord webhook (optional)

---

## 💰 Cost Breakdown

### Free Tier:
- **Vercel**: Unlimited (Hobby plan)
- **Render**: Limited hours/month (Free plan)
- **Total**: $0/month

### Paid Tier (Recommended):
- **Vercel Pro**: $20/month (optional, for custom domains)
- **Render Starter**: $7/month (always-on agent)
- **Total**: $7-27/month

---

## 🔧 Troubleshooting

### Frontend Issues:

**Build fails:**
```powershell
# Test locally first
cd frontend/neuromesh-ui
npm install
npm run build
```

**WebSocket not connecting:**
- Check VITE_WS_URL is set correctly
- Use `wss://` (secure) not `ws://`
- Verify Render service is running

### Backend Issues:

**Service crashes:**
- Check Render logs
- Verify all environment variables are set
- Ensure AGENT_PRIVATE_KEY is correct

**Out of memory:**
- Upgrade to Starter plan ($7/month)
- Optimize code (reduce token list)

**Health check fails:**
- Check if port 8080 is exposed
- Verify health endpoint code

---

## 🚀 Post-Deployment

### 1. Test Everything:
```powershell
# Test frontend
curl https://poly-mesh-xxx.vercel.app

# Test backend health
curl https://polymesh-agent.onrender.com/health

# Test WebSocket (use browser console)
const ws = new WebSocket('wss://polymesh-agent.onrender.com');
ws.onopen = () => console.log('Connected!');
```

### 2. Update GitHub README:

Add live links:
```markdown
## 🌐 Live Demo

- **Dashboard**: https://poly-mesh-xxx.vercel.app
- **API Health**: https://polymesh-agent.onrender.com/health
```

### 3. Share Your Project:

- Post on Twitter/X with #PolygonBuildathon
- Share in Polygon Discord
- Add to your portfolio
- Submit to buildathon!

---

## 🔄 Future Updates

To update your deployment:

```powershell
# Make changes
git add .
git commit -m "🚀 Update: your changes"
git push

# Vercel & Render will auto-deploy!
```

---

## 📈 Scaling Tips

### For High Traffic:
1. **Vercel**: Upgrade to Pro ($20/month)
2. **Render**: Use Standard plan ($25/month)
3. **Database**: Add PostgreSQL for trade history
4. **Monitoring**: Use Datadog or New Relic

### For Multiple Chains:
1. Deploy separate Render services per chain
2. Use load balancer
3. Add caching layer (Redis)

---

## 🎉 You're Live!

Your PolyMesh AI agent is now:
- ✅ Running 24/7 on Render
- ✅ Beautiful dashboard on Vercel
- ✅ Real-time WebSocket updates
- ✅ Production-ready!

**Share your links:**
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-app.onrender.com`

---

## 📞 Support

**Vercel Docs**: https://vercel.com/docs  
**Render Docs**: https://render.com/docs  
**Issues**: Open a GitHub issue

---

**Ready to deploy?** Start with Part 1 (Vercel) above! 🚀
