# Anon-Connect: Anonymous Chat Platform

🚀 **Steps 1 & 2 Complete**: Foundation, Database & Enhanced Authentication

A Node.js Express-based anonymous chat platform with comprehensive authentication and security features.

## 🏗️ Architecture Overview

- **Backend**: Node.js with Express.js
- **Database**: SQLite with sqlite3 driver + Refresh token storage
- **Authentication**: Enhanced JWT-based with refresh tokens
- **Security**: Rate limiting, helmet security headers, input validation
- **Frontend**: Modern responsive HTML/CSS/JavaScript with dark theme
- **Anonymous Names**: Auto-generated fun names like "ChattyCat123"

## 📁 Project Structure

```
anon-connect/
├── server.js         # Enhanced Express app with security middleware
├── auth.js          # Authentication service with advanced features
├── package.json     # Dependencies including security packages
├── public/
│   ├── index.html   # Original simple interface
│   ├── auth.html    # Modern authentication interface
│   └── auth.js      # Enhanced frontend authentication
├── .env            # Environment configuration
├── anon_connect.db # SQLite database (auto-created)
└── README.md       # This file
```

## 🔐 Enhanced Authentication Features

### Step 2 New Features
- **🔑 JWT Refresh Tokens**: 1-hour access tokens + 7-day refresh tokens
- **🛡️ Password Strength Validation**: 8+ chars, mixed case, numbers, special chars
- **🚫 Rate Limiting**: Login attempt protection (5 attempts per 15 min)
- **🔒 Security Headers**: Helmet.js protection against common attacks
- **✅ Real-time Validation**: Live form validation with visual feedback
- **🌙 Dark Theme Support**: Toggle between light and dark modes
- **📱 Mobile Responsive**: Optimized for all device sizes
- **🔄 Auto Token Refresh**: Background token renewal for seamless experience

### Enhanced Security Measures
- **Input Sanitization**: XSS protection and input cleaning
- **SQL Injection Protection**: Parameterized queries
- **CORS Configuration**: Configurable origin restrictions
- **Trust Proxy Setup**: Proper rate limiting in cloud environments
- **Password Hashing**: Enhanced bcrypt with 12 salt rounds

## 🗄️ Database Schema (Enhanced)

### Users Table
- `id`: Primary key (auto-increment)
- `username`: Unique username (3-20 chars, alphanumeric + underscore)
- `email`: Unique email address (validated format)
- `password_hash`: bcryptjs hashed password (12 salt rounds)
- `anonymous_name`: Fun generated name (e.g., "SilentWolf456")
- `created_at`: Account creation timestamp
- `last_login`: Last login timestamp
- `is_active`: Account status (boolean)

### Refresh Tokens Table (New)
- `id`: Primary key (auto-increment)
- `user_id`: Foreign key to users table
- `token`: Unique refresh token string
- `expires_at`: Token expiration timestamp (7 days)
- `created_at`: Token creation timestamp
- `is_active`: Token status (boolean)

### Chats Table
- `id`: Primary key (auto-increment)
- `user1_id`: First user (chat initiator)
- `user2_id`: Second user (chat participant)
- `status`: active/ended/expired
- `created_at`: Chat creation time
- `expires_at`: Chat expiration time (24 hours default)

### Messages Table
- `id`: Primary key (auto-increment)
- `chat_id`: Associated chat
- `sender_id`: Message sender
- `content`: Message text
- `timestamp`: Message time
- `is_encrypted`: Encryption flag for future use

## 🌐 Frontend Interfaces

### 1. Modern Authentication Interface (`/auth.html`)
**New Enhanced Features:**
- **Beautiful UI**: Modern gradient design with glassmorphism effects
- **Dark/Light Theme**: Toggle with persistent preference
- **Real-time Validation**: Live feedback for username, email, password
- **Password Strength Meter**: Visual strength indicator with requirements
- **Responsive Design**: Mobile-first approach with fluid layouts
- **Form States**: Loading animations, success/error states
- **Accessibility**: ARIA labels and keyboard navigation

### 2. Original Simple Interface (`/index.html`)
- Basic authentication forms
- User dashboard
- API endpoint listing

## 🛠️ Enhanced API Endpoints

### Health & Status
- `GET /` - Welcome message and API info
- `GET /health` - Health check endpoint
- `GET /db/status` - Database connection status

### Authentication (Enhanced)
- `POST /auth/register` - User registration with validation
- `POST /auth/login` - Enhanced login with rate limiting
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout and revoke refresh token
- `POST /auth/logout-all` - Logout from all devices
- `GET /auth/me` - Get current user info (requires auth)

### Enhanced Registration Validation
```json
{
  "username": "johndoe",      // 3-20 chars, alphanumeric + underscore
  "email": "john@example.com", // Valid email format
  "password": "SecurePass123!" // 8+ chars, mixed case, numbers, special
}
```

### Enhanced Login Response
```json
{
  "success": true,
  "message": "Login successful",
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": "1h",
  "user": {
    "id": 1,
    "username": "johndoe",
    "email": "john@example.com",
    "anonymous_name": "SilentWolf456"
  }
}
```

## 🔒 Advanced Security Features

### Rate Limiting
- **Authentication Routes**: 10 requests per 15 minutes per IP
- **General Routes**: 100 requests per 15 minutes per IP
- **Login Attempts**: 5 failed attempts = 15-minute lockout
- **Progressive Lockout**: Longer lockouts for repeated violations

### Password Security
- **Minimum Requirements**: 8+ characters
- **Complexity**: Lowercase + uppercase + numbers + special characters
- **Hashing**: bcrypt with 12 salt rounds
- **Validation**: Real-time strength checking

### Input Validation & Sanitization
- **Username**: 3-20 chars, alphanumeric + underscore only
- **Email**: RFC-compliant email validation
- **XSS Protection**: Input sanitization and HTML entity encoding
- **Length Limits**: All inputs capped at reasonable maximums

### Security Headers (Helmet.js)
- Content Security Policy (CSP)
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security (HSTS)

## 🎯 Anonymous Name Generator (Enhanced)

**34 Adjectives**: Silent, Mysterious, Chatty, Friendly, Cool, Smart, Quick, Clever, Bright, Swift, Bold, Calm, Wild, Free, Happy, Lucky, Magic, Sunny, Gentle, Brave, Noble, Wise, Kind, Pure, Strong, Sleek, Fierce, Graceful, Mighty, Serene, Vibrant, Elegant, Daring, Radiant

**34 Animals**: Cat, Dog, Wolf, Fox, Bear, Lion, Tiger, Eagle, Hawk, Owl, Rabbit, Deer, Dolphin, Whale, Shark, Turtle, Dragon, Phoenix, Panda, Koala, Penguin, Seal, Otter, Falcon, Raven, Swan, Leopard, Cheetah, Jaguar, Lynx, Panther, Cobra, Viper, Mamba

**Examples**: `SilentWolf456`, `BraveEagle789`, `MysticDragon123`

## 🚀 Application Status

✅ **RUNNING**: Enhanced application accessible at:
- **Modern Auth Interface**: http://localhost:8080/auth.html ⭐ **Recommended**
- **Original Interface**: http://localhost:8080/index.html
- **API Health Check**: http://localhost:8080/health

## 🧪 Step 2 Features Implemented

✅ **Enhanced Authentication Service**
- JWT access tokens (1 hour) + refresh tokens (7 days)
- Advanced password validation with strength requirements
- Rate limiting with progressive lockout
- Anonymous name generation with uniqueness checking
- Token refresh and revocation system

✅ **Security Enhancements**
- Helmet.js security headers
- Express rate limiting middleware
- Input sanitization and validation
- Trust proxy configuration for cloud deployment
- CORS protection with configurable origins

✅ **Advanced API Routes**
- Token refresh endpoint for seamless UX
- Logout with token revocation
- Logout from all devices functionality
- Enhanced error responses with lockout information

✅ **Modern Frontend Interface**
- Responsive design with mobile optimization
- Dark/light theme toggle with persistence
- Real-time form validation with visual feedback
- Password strength meter with requirements display
- Loading states and error handling
- Automatic token refresh in background

✅ **Enhanced User Experience**
- Progressive form validation
- Visual password strength indicator
- Smooth animations and transitions
- Accessible design with ARIA labels
- Persistent login state across browser sessions

## 🔧 Configuration

### Environment Variables
```env
SECRET_KEY=your-super-secret-key-change-this-in-production
REFRESH_SECRET_KEY=your-refresh-secret-key-change-this-in-production
ACCESS_TOKEN_EXPIRE=1h
REFRESH_TOKEN_EXPIRE=7d
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
PORT=8080
```

### Security Settings
- **JWT Secrets**: Separate keys for access and refresh tokens
- **Token Expiry**: Configurable expiration times
- **Rate Limits**: Adjustable per-route rate limiting
- **CORS Origins**: Configurable allowed origins for production

## 🎉 Next Steps (Steps 3-5)

This completes **Steps 1 & 2: Foundation, Database & Enhanced Authentication**. Ready for:

- **Step 3**: Real-time chat functionality with WebSocket
- **Step 4**: Anonymous matching system and chat rooms
- **Step 5**: Message encryption and advanced features

The authentication system is now production-ready with comprehensive security measures! 🚀
