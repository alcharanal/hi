# 🚀 Anon-Connect - Quick Start

## ⚡ Run the Project in One Command

```bash
npm start
```

> **Note**: A `.env` file with safe defaults is automatically created for you!

## ✅ Verify It's Working

After running `npm start`, test with:
```bash
curl http://localhost:3002/health
```
Should return: `{"success":true,"message":"Anon-Connect API is running successfully!"}`

## 🔧 Environment Setup (Optional)

The app runs with safe defaults, but you can customize:

```bash
# Development (default)
npm run dev

# Production mode
npm run prod

# Run tests
npm test
```

That's it! The application will automatically:
- Install dependencies if needed
- Start the server on port 3002
- Set up the database with all tables
- Enable all features (AI, admin panel, chat system)

## 🌐 Access URLs

Once running, open these URLs in your browser:

- **Main App**: http://localhost:3002
- **Chat Interface**: http://localhost:3002/chat.html  
- **Admin Dashboard**: http://localhost:3002/admin.html
- **API Documentation**: http://localhost:3002/api/docs

## 🔐 Admin Access

- **Username**: admin123
- **Password**: admin321

## 📱 Features Available

✅ Anonymous chat with AI insights  
✅ Real-time messaging with WebSocket  
✅ Admin dashboard with user management  
✅ AI-powered sentiment analysis  
✅ Complete API documentation  
✅ Production-ready security  

## 🔧 Alternative Commands

If `npm start` doesn't work, try:

```bash
# Install dependencies first
npm install

# Then start the server
node server.js
```

## 🌟 First Time Setup

The application will automatically:
1. Create the SQLite database
2. Set up all required tables
3. Initialize the admin user
4. Start all services

No additional setup required! 🎉

## 🚨 Troubleshooting

If you can't see anything, try these steps in order:

### Step 1: Check the correct URL
- ✅ **CORRECT**: http://localhost:3002
- ❌ **WRONG**: http://localhost:3000 or http://localhost:8080

### Step 2: Wait for server startup
The server needs 10-15 seconds to fully initialize. Look for this message:
```
🚀 Anon-Connect server running on http://localhost:3002
📚 API Documentation: http://localhost:3002/api/docs
🔐 Admin credentials: admin123 / admin321
```

### Step 3: Clear browser cache
- Press `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Or open in incognito/private browsing mode

### Step 4: Check server status
Run this command to verify the server is working:
```bash
curl http://localhost:3002/health
```
You should see: `{"success":true,"message":"Anon-Connect API is running successfully!"}`

### Step 5: Try different browsers
- Chrome: http://localhost:3002
- Firefox: http://localhost:3002
- Safari: http://localhost:3002
- Edge: http://localhost:3002

### Step 6: Check if port is in use
```bash
netstat -tlnp | grep 3002
```

### Step 7: Restart the server
```bash
# Stop with Ctrl+C, then restart
npm start
```

## 🔍 Quick Health Check

Server is working if you can access:
- ✅ http://localhost:3002/health (API health)
- ✅ http://localhost:3002 (Landing page)
- ✅ http://localhost:3002/api/docs (API documentation)
