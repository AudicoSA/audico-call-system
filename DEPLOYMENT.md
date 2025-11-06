# Deployment Guide - Audico AI Call System

## Why Deploy to Production?

Your current setup requires:
- Your computer to be on 24/7
- Tunnel to be running constantly
- Manual restarts when tunnel disconnects

**Production deployment** means:
- Server runs 24/7 automatically
- Permanent URL (no more tunnel updates)
- Professional, reliable service

---

## Option 1: Heroku (Recommended for Quick Start)

**Cost**: ~$7/month (Eco Dyno)

**Steps:**

1. **Install Heroku CLI**
   ```bash
   # Download from: https://devcenter.heroku.com/articles/heroku-cli
   # Or via npm:
   npm install -g heroku
   ```

2. **Login to Heroku**
   ```bash
   heroku login
   ```

3. **Create Heroku App**
   ```bash
   cd "D:\OneDrive\Audico Call System"
   heroku create audico-call-system
   # You'll get URL like: https://audico-call-system-xxxxx.herokuapp.com
   ```

4. **Set Environment Variables**
   ```bash
   heroku config:set TWILIO_ACCOUNT_SID=your_account_sid
   heroku config:set TWILIO_AUTH_TOKEN=your_auth_token
   heroku config:set TWILIO_PHONE_NUMBER=your_phone_number
   heroku config:set OPENAI_API_KEY=your_openai_key
   heroku config:set ELEVENLABS_API_KEY=your_elevenlabs_key
   heroku config:set ELEVENLABS_VOICE_ID=your_voice_id
   heroku config:set ANTHROPIC_API_KEY=your_anthropic_key
   heroku config:set SUPABASE_URL=your_supabase_url
   heroku config:set SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
   heroku config:set ENABLE_CALL_RECORDING=true
   heroku config:set NODE_ENV=production
   ```

5. **Deploy**
   ```bash
   git add .
   git commit -m "Deploy to Heroku"
   git push heroku main
   ```

6. **Update Twilio Webhooks** (ONE TIME ONLY!)
   - Go to: https://console.twilio.com/us1/develop/phone-numbers/manage/incoming
   - Set "A Call Comes In": `https://audico-call-system-xxxxx.herokuapp.com/voice/incoming`
   - Set "Call Status Changes": `https://audico-call-system-xxxxx.herokuapp.com/voice/status`
   - Save Configuration

7. **Done!** Your system now runs 24/7.

**Pros:**
- ✅ Easy setup
- ✅ Automatic deployments
- ✅ Built-in monitoring
- ✅ Free SSL certificate

**Cons:**
- ❌ Monthly cost (~$7)
- ❌ Eco dynos sleep after 30 min inactivity (can upgrade to $25/mo for always-on)

---

## Option 2: Railway.app

**Cost**: ~$5/month (pay-as-you-go)

**Steps:**

1. Go to: https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Add environment variables in Railway dashboard
6. Railway gives you URL: `https://audico-call-system.up.railway.app`
7. Update Twilio webhooks with Railway URL

**Pros:**
- ✅ Cheaper than Heroku
- ✅ No sleep mode
- ✅ Simple interface

---

## Option 3: DigitalOcean App Platform

**Cost**: ~$5/month (Basic plan)

**Steps:**

1. Go to: https://cloud.digitalocean.com/apps
2. Create new app from GitHub
3. Set environment variables
4. Deploy
5. Get URL: `https://audico-call-system-xxxxx.ondigitalocean.app`
6. Update Twilio webhooks

**Pros:**
- ✅ Affordable
- ✅ Good performance
- ✅ Reliable infrastructure

---

## Option 4: AWS Lambda + API Gateway (Advanced)

**Cost**: Nearly free (AWS Free Tier covers most usage)

**Steps:** (Complex - requires AWS experience)
- Convert Express app to Lambda functions
- Set up API Gateway
- Configure CloudWatch for logging
- Use Lambda cold start optimizations

**Pros:**
- ✅ Cheapest option (almost free)
- ✅ Scales automatically

**Cons:**
- ❌ Complex setup
- ❌ Cold starts can affect first call response time

---

## Option 5: Self-Hosted VPS (Most Control)

**Cost**: $5-10/month (DigitalOcean Droplet, Linode, Vultr)

**Steps:**

1. **Rent VPS** (Ubuntu 22.04 recommended)
   - DigitalOcean: https://www.digitalocean.com/pricing/droplets
   - Linode: https://www.linode.com/pricing
   - Vultr: https://www.vultr.com/pricing

2. **SSH into server**
   ```bash
   ssh root@your_server_ip
   ```

3. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Install PM2 (Process Manager)**
   ```bash
   npm install -g pm2
   ```

5. **Clone repository**
   ```bash
   git clone https://github.com/your-username/audico-call-system.git
   cd audico-call-system
   npm install
   ```

6. **Create .env file**
   ```bash
   nano .env
   # Paste all your environment variables
   ```

7. **Start with PM2**
   ```bash
   pm2 start src/index.js --name audico-call-system
   pm2 save
   pm2 startup
   ```

8. **Set up Nginx (Reverse Proxy)**
   ```bash
   sudo apt install nginx
   sudo nano /etc/nginx/sites-available/audico
   ```

   Add:
   ```nginx
   server {
       listen 80;
       server_name your_domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   ```bash
   sudo ln -s /etc/nginx/sites-available/audico /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

9. **Install SSL Certificate (Free with Let's Encrypt)**
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your_domain.com
   ```

10. **Update Twilio webhooks**
    - Use: `https://your_domain.com/voice/incoming`

**Pros:**
- ✅ Full control
- ✅ Good performance
- ✅ Cost-effective

**Cons:**
- ❌ Requires server management
- ❌ You're responsible for security updates

---

## Comparison Table

| Platform | Monthly Cost | Ease of Setup | Always On | SSL Included |
|----------|-------------|---------------|-----------|--------------|
| **Heroku** | $7-25 | ⭐⭐⭐⭐⭐ | Yes (paid) | Yes |
| **Railway** | $5 | ⭐⭐⭐⭐⭐ | Yes | Yes |
| **DigitalOcean App** | $5 | ⭐⭐⭐⭐ | Yes | Yes |
| **AWS Lambda** | ~$0 | ⭐⭐ | N/A | Yes |
| **VPS Self-Hosted** | $5-10 | ⭐⭐⭐ | Yes | Yes (with setup) |

---

## Recommended Path

### **For Testing (Current Setup)**
Keep using:
- `npm start` (Terminal 1)
- Serveo tunnel (Terminal 2)
- Accept that you need to restart tunnel periodically

### **For Production (24/7 Service)**
I recommend **Railway.app** or **Heroku**:
- Deploy in < 10 minutes
- No server management
- Reliable 24/7 operation
- Automatic SSL
- Easy updates

---

## Quick Deploy to Railway (Fastest Option)

1. **Create `railway.json`** (already in your project)
2. **Push to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/your-username/audico-call-system.git
   git push -u origin main
   ```

3. **Go to Railway.app**
   - Sign up: https://railway.app
   - "New Project" → "Deploy from GitHub"
   - Select repository
   - Add environment variables
   - Deploy (takes 2-3 minutes)

4. **Get Railway URL**
   - Copy: `https://audico-call-system.up.railway.app`

5. **Update Twilio** (ONE TIME ONLY!)
   - Paste Railway URL in webhooks
   - Save

6. **Done!** Call your Twilio number → It works 24/7!

---

## Need Help Deploying?

Let me know which platform you'd like to use, and I can:
- Walk you through step-by-step
- Generate deployment configuration files
- Help troubleshoot any issues

**Bottom line**: For development, keep your current setup. For production (24/7), deploy to Railway/Heroku in < 10 minutes.

