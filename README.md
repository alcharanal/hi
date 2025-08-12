# Anon-Connect: Anonymous Chat Platform

🚀 **Steps 1, 2 & 3 Complete**: Foundation, Authentication & Real-Time WebSocket Chat

A complete Node.js Express-based anonymous chat platform with real-time messaging, advanced authentication, and comprehensive security features.

## 🏗️ Architecture Overview

- **Backend**: Node.js with Express.js + Socket.io WebSocket
- **Database**: SQLite with comprehensive chat/message storage
- **Authentication**: Enhanced JWT-based with refresh tokens
- **Real-time**: Socket.io WebSocket for instant messaging
- **Security**: Rate limiting, encryption, profanity filtering
- **Frontend**: Modern responsive chat interface with dark theme
- **Anonymous Names**: Auto-generated fun names like "ChattyCat123"

## 📁 Project Structure

```
anon-connect/
├── server.js           # Enhanced Express + Socket.io server
├── auth.js            # Authentication service with advanced features
├── chat.js            # WebSocket chat system with ConnectionManager
├── package.json       # Dependencies including Socket.io, bad-words
├── public/
│   ├── index.html     # Original interface (redirects to chat)
│   ├── auth.html      # Modern authentication interface
│   ├── auth.js        # Enhanced frontend authentication
│   ├── chat.html      # Real-time chat interface ⭐ **NEW**
│   ├── chat-client.js # WebSocket client and UI management ⭐ **NEW**
│   └── test.html      # Server test page
├── .env              # Environment configuration
├── anon_connect.db   # SQLite database with messages
└── README.md         # This file
```

## 🚀 **NEW Step 3 Features: Real-Time WebSocket Chat**

### ⚡ **Real-Time Messaging System**
- **Socket.io WebSocket**: Instant bidirectional communication
- **Auto-Matching**: Users automatically matched in waiting queue
- **24-Hour Expiry**: Chat rooms expire after 24 hours
- **Message Persistence**: All messages saved to database
- **Typing Indicators**: Live typing status with timeout
- **User Presence**: Online/offline/typing status tracking

### 🛡️ **Advanced Security & Filtering**
- **Message Encryption**: Basic XOR encryption for message storage
- **Profanity Filter**: Automatic bad word filtering
- **Message Validation**: 500 character limit, content sanitization
- **Rate Limiting**: WebSocket connection and message rate limiting
- **Authentication**: JWT token verification for WebSocket connections

### 🎨 **Modern Chat Interface (`/chat.html`)**
**Professional Design Features:**
- **Real-time Chat Bubbles**: Sent (blue) vs Received (gray) styling
- **Typing Indicators**: Animated dots when partner is typing
- **Message Timestamps**: Real-time timestamp formatting
- **Status Indicators**: Online/offline/typing status with colors
- **Dark/Light Theme**: Persistent theme toggle
- **Mobile Responsive**: Touch-optimized for all device sizes
- **Smooth Animations**: Message slide-in and typing animations

### 🔄 **WebSocket Features**
- **Auto-Reconnection**: Automatic reconnection on connection loss
- **Heartbeat/Keepalive**: Ping/pong mechanism for connection health
- **Queue Management**: Waiting queue with position tracking
- **Room Management**: Create, join, leave chat rooms
- **Error Handling**: Comprehensive error recovery
- **Browser Notifications**: Desktop notifications for new messages

### 🎯 **User Matching System**
- **Random Matching**: Simple random pairing for MVP
- **Waiting Queue**: Position tracking and estimated wait times
- **Auto-Queue**: Users automatically join queue after partner leaves
- **Partner Information**: Anonymous name and status display
- **Room Statistics**: Live stats of connected users and active rooms

## 🗄️ Enhanced Database Schema

### Users Table
- `id`: Primary key (auto-increment)
- `username`: Unique username (3-20 chars, validated)
- `email`: Unique email address (RFC compliant)
- `password_hash`: bcryptjs hashed password (12 salt rounds)
- `anonymous_name`: Fun generated name (e.g., "SilentWolf456")
- `created_at`: Account creation timestamp
- `last_login`: Last login timestamp ⭐ **NEW**
- `is_active`: Account status (boolean)

### Refresh Tokens Table
- `id`: Primary key (auto-increment)
- `user_id`: Foreign key to users table
- `token`: Unique refresh token string
- `expires_at`: Token expiration (7 days)
- `created_at`: Token creation timestamp
- `is_active`: Token status (boolean)

### Chats Table (Enhanced)
- `id`: Primary key (string, room_timestamp_random)
- `user1_id`: First user (chat initiator)
- `user2_id`: Second user (chat participant)
- `status`: active/ended/expired ⭐ **ENHANCED**
- `created_at`: Chat creation time
- `expires_at`: Chat expiration time (24 hours)

### Messages Table (Enhanced)
- `id`: Primary key (auto-increment)
- `chat_id`: Associated chat (string reference) ⭐ **ENHANCED**
- `sender_id`: Message sender
- `content`: Encrypted message text ⭐ **ENHANCED**
- `timestamp`: Message time
- `is_encrypted`: Encryption flag (true for all new messages) ⭐ **ENHANCED**

## 🌐 **Chat Interface Flow**

### 1. **Authentication Flow**
1. User logs in via `/auth.html`
2. Redirected to `/chat.html` with JWT token
3. WebSocket connection established with token verification
4. User automatically joins waiting queue

### 2. **Matching Flow**
1. User enters waiting queue
2. System matches users in pairs (random for MVP)
3. Chat room created with 24-hour expiration
4. Both users join room and can start messaging

### 3. **Chat Flow**
1. Real-time message exchange
2. Typing indicators when typing
3. Message encryption and profanity filtering
4. Message persistence to database
5. Partner status tracking (online/offline)

### 4. **Session End Flow**
1. User can leave room manually
2. Room expires after 24 hours
3. Partner disconnect triggers notifications
4. User automatically re-enters queue

## 🛠️ **Complete API Endpoints**

### Authentication (Enhanced from Step 2)
- `POST /auth/register` - User registration with validation
- `POST /auth/login` - Enhanced login with rate limiting
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout and revoke refresh token
- `POST /auth/logout-all` - Logout from all devices
- `GET /auth/me` - Get current user info

### Chat System (New in Step 3)
- `GET /chat/stats` - Chat system statistics
- `WebSocket /` - Real-time chat connection

### Health & Utilities
- `GET /` - Root (redirects to chat after login)
- `GET /health` - Health check endpoint
- `GET /db/status` - Database connection status
- `GET /test.html` - Server functionality test

## 🔌 **WebSocket Events**

### Client → Server
- `sendMessage` - Send message to current room
- `typingStart` - Start typing indicator
- `typingStop` - Stop typing indicator
- `joinQueue` - Join waiting queue for matching
- `leaveQueue` - Leave waiting queue
- `leaveRoom` - Leave current chat room
- `ping` - Heartbeat/keepalive

### Server → Client
- `roomJoined` - Successfully joined a chat room
- `partnerJoined` - Chat partner connected
- `partnerLeft` - Chat partner disconnected
- `roomLeft` - Left current room
- `roomExpired` - Room expired after 24 hours
- `newMessage` - New message received
- `messageConfirmed` - Message successfully sent
- `messageError` - Message failed to send
- `typingStart` - Partner started typing
- `typingStop` - Partner stopped typing
- `userStatusChange` - Partner status changed
- `queueJoined` - Joined waiting queue
- `queueLeft` - Left waiting queue
- `pong` - Heartbeat response

## 🎯 **Advanced Chat Features**

### Message System
- **Real-time Delivery**: Instant message transmission
- **Message Encryption**: XOR encryption with base64 encoding
- **Profanity Filtering**: Automatic bad word replacement
- **Message Validation**: Length limits, content sanitization
- **Message Status**: Delivered/Failed indicators
- **Chat History**: Previous messages loaded on room join

### User Experience
- **Typing Indicators**: Animated typing dots with user name
- **Status Indicators**: Color-coded online/offline/typing status
- **Sound Notifications**: Audio alerts for new messages
- **Browser Notifications**: Desktop notifications when tab inactive
- **Auto-scroll**: Messages automatically scroll to bottom
- **Mobile Touch**: Optimized touch interface for mobile devices

### Connection Management
- **Auto-reconnect**: Automatic reconnection on network issues
- **Connection Status**: Visual connection status indicators
- **Error Recovery**: Graceful handling of connection errors
- **Session Recovery**: Rejoin existing rooms on reconnect
- **Heartbeat**: Regular ping/pong to maintain connection

## 🔒 **Security Enhancements (Step 3)**

### WebSocket Security
- **JWT Authentication**: Token verification for WebSocket connections
- **Message Rate Limiting**: Prevent message flooding
- **Connection Rate Limiting**: Limit simultaneous connections per user
- **Input Sanitization**: XSS and injection protection for messages
- **Message Encryption**: Basic encryption for message storage

### Chat Security
- **Anonymous Identity**: No real names exposed in chat
- **Session Expiry**: Automatic chat room cleanup after 24 hours
- **Content Filtering**: Profanity filter with customizable word list
- **Message Length Limits**: Prevent oversized message attacks
- **Room Isolation**: Users can only access their assigned chat room

## 🚀 **Application Status**

✅ **FULLY FUNCTIONAL**: Complete real-time chat system ready at:
- **Main Chat Interface**: `/chat.html` ⭐ **Primary Interface**
- **Authentication**: `/auth.html` (Enhanced with redirection)
- **API Health**: `/health`
- **Live Stats**: `/chat/stats`

## 🧪 **Step 3 Features Implemented**

✅ **WebSocket Infrastructure**
- Socket.io server with JWT authentication middleware
- Connection lifecycle management (connect/disconnect/reconnect)
- Real-time bidirectional communication
- Heartbeat/keepalive mechanism for connection health
- Auto-reconnection with exponential backoff

✅ **Chat System Core**
- ConnectionManager class for WebSocket management
- User matching algorithm (random pairing for MVP)
- Chat room creation with unique IDs and expiration
- Message routing and broadcasting to room participants
- User presence tracking (online/offline/typing)

✅ **Real-Time Messaging**
- Instant message delivery with Socket.io
- Message persistence to SQLite database
- Chat history loading on room join
- Message encryption (XOR) and profanity filtering
- Typing indicators with automatic timeout
- Message status tracking (sent/delivered/failed)

✅ **Modern Chat Interface**
- Professional chat bubble design (sent vs received)
- Real-time typing indicators with animated dots
- Partner information display with status indicators
- Dark/light theme toggle with persistence
- Mobile-responsive touch interface
- Smooth animations for messages and UI transitions

✅ **Advanced Features**
- Waiting queue system with position tracking
- Auto-matching when 2+ users in queue
- Browser notifications for new messages
- Sound notifications using Web Audio API
- Connection status indicators and error handling
- Chat room statistics and monitoring

✅ **Security & Validation**
- Message content validation and sanitization
- Profanity filtering with bad-words library
- XOR encryption for message storage
- Rate limiting for connections and messages
- JWT token verification for WebSocket auth
- Input length limits and XSS protection

## 🔧 **Configuration**

### Environment Variables
```env
SECRET_KEY=your-super-secret-key-change-this-in-production
REFRESH_SECRET_KEY=your-refresh-secret-key-change-this-in-production
ACCESS_TOKEN_EXPIRE=1h
REFRESH_TOKEN_EXPIRE=7d
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
PORT=8080
```

### WebSocket Settings
- **Transports**: WebSocket + Polling fallback
- **Reconnection**: Automatic with 5 max attempts
- **Heartbeat**: Ping/pong every 25 seconds
- **Room Expiry**: 24 hours (configurable)
- **Message Limit**: 500 characters per message

## 🎉 **Next Steps (Steps 4-5)**

This completes **Steps 1, 2 & 3: Foundation, Authentication & Real-Time Chat**. Ready for:

- **Step 4**: Advanced matching algorithms and chat room management
- **Step 5**: Enhanced encryption, file sharing, and deployment features

## 🎯 **How to Test the Chat System**

1. **Register/Login**: Visit `/auth.html` to create account
2. **Auto-redirect**: After login, automatically goes to `/chat.html`
3. **Open Second Tab**: Open another incognito tab for second user
4. **Create Second Account**: Register another user in incognito tab
5. **Auto-matching**: Both users will be automatically matched
6. **Start Chatting**: Send messages, test typing indicators
7. **Test Features**: Try leaving/rejoining, check mobile responsiveness

The real-time chat system is now fully functional with professional UI and comprehensive features! 🚀💬
