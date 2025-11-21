# 🚀 Deployment Guide - Carbon Calculator Phase 1

## Deploy to Streamlit Cloud + GitHub

This guide will help you deploy your Carbon Calculator online using Streamlit Cloud and GitHub.

---

## 📋 Prerequisites

1. **GitHub Account** - Sign up at https://github.com
2. **Streamlit Account** - Sign up at https://streamlit.io
3. **Git installed** - Download from https://git-scm.com

---

## 🎯 Step-by-Step Deployment

### Step 1: Prepare Your Repository

1. **Open Terminal/PowerShell** in the `Phase1_CarbonCalculator` folder

2. **Initialize Git repository:**

```bash
git init
git add .
git commit -m "Initial commit: Carbon Calculator Phase 1"
```

### Step 2: Create GitHub Repository

1. **Go to GitHub** - https://github.com/new

2. **Create new repository:**
   - Name: `carbon-calculator-phase1`
   - Description: "Professional GHG Protocol Carbon Emissions Calculator"
   - Visibility: Public or Private (your choice)
   - **DO NOT** initialize with README

3. **Push your code:**

```bash
git remote add origin https://github.com/YOUR_USERNAME/carbon-calculator-phase1.git
git branch -M main
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

### Step 3: Deploy to Streamlit Cloud

1. **Go to Streamlit Cloud** - https://share.streamlit.io

2. **Click "New app"**

3. **Fill in the deployment form:**
   - **Repository:** `YOUR_USERNAME/carbon-calculator-phase1`
   - **Branch:** `main`
   - **Main file path:** `app_integrated.py`

4. **Click "Deploy"**

5. **Wait 2-3 minutes** for deployment to complete

---

## 📁 Files Created for Deployment

### 1. `app_integrated.py` (Main Streamlit App)
This file serves both the frontend and backend API.

### 2. `requirements.txt` (Already exists in backend/)
Contains all Python dependencies.

### 3. `.streamlit/config.toml` (Optional)
For custom Streamlit configuration.

---

## 🌐 Accessing Your Deployed App

After deployment, you'll get a URL like:

```
https://YOUR_APP_NAME.streamlit.app
```

Share this URL with your team!

---

## 🔧 Configuration

### Custom Domain (Optional)

Streamlit Cloud doesn't support custom domains directly, but you can:

1. Use a URL shortener (bit.ly, tinyurl.com)
2. Use Cloudflare Workers for custom domain routing
3. Upgrade to Streamlit for Teams (paid)

### Environment Variables

If you need to add secrets:

1. Go to your app settings on Streamlit Cloud
2. Click "Secrets"
3. Add your secrets in TOML format:

```toml
[passwords]
admin = "your_password_here"

[api_keys]
your_key = "your_value_here"
```

---

## 🔄 Updating Your App

When you make changes:

```bash
git add .
git commit -m "Description of changes"
git push
```

Streamlit Cloud will automatically redeploy!

---

## 📊 Features When Deployed

✅ **Accessible anywhere** - No installation needed
✅ **Always online** - 24/7 availability
✅ **Automatic updates** - Push to GitHub = automatic deploy
✅ **Free hosting** - Streamlit Community Cloud is free
✅ **HTTPS enabled** - Secure by default
✅ **Password protection** - Built-in login system

---

## 🔐 Security Notes

### For Production:

1. **Change default passwords** in the code
2. **Use Streamlit secrets** for sensitive data
3. **Enable authentication** (built into Streamlit)
4. **Use environment variables** for API keys

### Example: Secure Passwords

Instead of hardcoded passwords, use Streamlit secrets:

```python
import streamlit as st

# In app_integrated.py
correct_email = st.secrets["auth"]["email"]
correct_password = st.secrets["auth"]["password"]
```

Then in Streamlit Cloud secrets:

```toml
[auth]
email = "admin@company.com"
password = "your_secure_password"
```

---

## 💾 Database Integration (Phase 2)

For persistent data storage, consider:

1. **Streamlit Connection** - Built-in database support
2. **Google Sheets** - Simple spreadsheet backend
3. **PostgreSQL** - Professional database
4. **Firebase** - Real-time cloud database

---

## 📱 Mobile Access

Your deployed app works on:
- ✅ Desktop browsers
- ✅ Mobile phones
- ✅ Tablets
- ✅ Any device with internet

---

## 🐛 Troubleshooting

### App won't deploy?

**Check:**
1. All files are committed to GitHub
2. `requirements.txt` is in the root or specified correctly
3. Python version compatibility (3.9-3.11 recommended)
4. No large files (>100MB)

### App is slow?

**Solutions:**
1. Optimize chart rendering
2. Use caching (`@st.cache_data`)
3. Reduce image sizes
4. Minimize API calls

### Login not working?

**Check:**
1. Cookies enabled in browser
2. Not in incognito mode
3. Password entered correctly

---

## 📈 Monitoring Your App

Streamlit Cloud provides:

- **Analytics** - View usage statistics
- **Logs** - Debug errors in real-time
- **Resource usage** - Monitor CPU/memory
- **Viewer count** - See concurrent users

Access via: https://share.streamlit.io/YOUR_USERNAME/YOUR_REPO

---

## 💰 Costs

### Free Tier (Streamlit Community Cloud):
- ✅ Unlimited public apps
- ✅ 1GB storage
- ✅ Shared resources
- ✅ Community support

### Paid Tier (Streamlit for Teams):
- ✅ Private apps
- ✅ More resources
- ✅ Custom authentication
- ✅ Priority support
- 💰 Starting at $250/month

For Phase 1, **free tier is sufficient**!

---

## 🔗 Useful Links

- **Streamlit Docs:** https://docs.streamlit.io
- **Streamlit Cloud:** https://streamlit.io/cloud
- **GitHub Docs:** https://docs.github.com
- **Streamlit Community:** https://discuss.streamlit.io

---

## ✅ Deployment Checklist

Before deploying:

- [ ] Test locally (`streamlit run app_integrated.py`)
- [ ] All files committed to Git
- [ ] requirements.txt is up to date
- [ ] Removed any sensitive data from code
- [ ] Tested on different browsers
- [ ] README.md is updated
- [ ] Login credentials changed from defaults

---

## 🎉 You're Ready to Deploy!

Follow the steps above, and your Carbon Calculator will be live on the internet in minutes!

**Questions?** Check the troubleshooting section or review the Streamlit documentation.

---

**🌱 Built for a sustainable future • Track • Calculate • Report • Reduce**

*Last updated: November 2025*

