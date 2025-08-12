# Anon-Connect: Anonymous Chat Platform

🚀 **Step 1 Complete**: Foundation & Database Setup (Node.js Implementation)

A Node.js Express-based anonymous chat platform that allows users to connect and chat anonymously with fun generated usernames.

## 🏗️ Architecture Overview

- **Backend**: Node.js with Express.js
- **Database**: SQLite with sqlite3 driver
- **Authentication**: JWT-based with bcryptjs password hashing
- **Frontend**: HTML/CSS/JavaScript interface
- **Anonymous Names**: Auto-generated fun names like "ChattyCat123"

## 📁 Project Structure

```
anon-connect/
├── server.js         # Express application & API routes
├── package.json      # Node.js dependencies and scripts
├── public/
│   └── index.html    # Frontend interface
├── .env             # Environment configuration
├── anon_connect.db  # SQLite database (auto-created)
└── README.md        # This file
```

## 🗄️ Database Schema

### Users Table
- `id`: Primary key (auto-increment)
- `username`: Unique username
- `email`: Unique email address
- `password_hash`: bcryptjs hashed password
- `anonymous_name`: Fun generated name (e.g., "SilentWolf456")
- `created_at`: Account creation timestamp
- `is_active`: Account status (boolean)

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

## 🔧 Installation & Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
The `.env` file contains:
```env
SECRET_KEY=your-super-secret-key-change-this-in-production
PORT=3000
```

### 3. Start the Server
```bash
npm run dev
# or
npm start
```

The server will start on `http://localhost:3000`

## 🌐 Frontend Interface

The application includes a complete web interface at `http://localhost:3000` featuring:

- **User Registration** - Create new account with username, email, password
- **User Login** - Authenticate existing users
- **Dashboard** - View user profile with anonymous name
- **API Explorer** - List of available endpoints

### Key Features:
- 🎨 Modern, responsive design with gradient backgrounds
- 🔐 Secure authentication with JWT tokens
- 📱 Mobile-friendly interface
- ⚡ Real-time form validation
- 🎭 Anonymous name display
- 💾 Persistent login with localStorage

## 🛠️ API Endpoints

### Health & Status
- `GET /` - Welcome message and API info
- `GET /health` - Health check endpoint
- `GET /db/status` - Database connection status

### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user (returns JWT token)
- `GET /auth/me` - Get current user info (requires auth)

### Example API Usage

#### Register User
```bash
curl -X POST "http://localhost:3000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "secretpassword123"
  }'
```

#### Login User
```bash
curl -X POST "http://localhost:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "secretpassword123"
  }'
```

#### Get User Info (with token)
```bash
curl -X GET "http://localhost:3000/auth/me" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔒 Security Features

- **Password Hashing**: bcryptjs with salt rounds
- **JWT Authentication**: Secure token-based auth (30 min expiry)
- **Input Validation**: Server-side validation for all inputs
- **CORS Protection**: Configurable CORS middleware
- **Anonymous Names**: Privacy-focused username generation
- **SQL Injection Protection**: Parameterized queries with sqlite3

## 🎯 Anonymous Name Generator

The system generates fun, unique anonymous names using:
- **25 Adjectives**: Silent, Mysterious, Chatty, Friendly, Cool, Smart, Quick, Clever, Bright, Swift, Bold, Calm, Wild, Free, Happy, Lucky, Magic, Sunny, Gentle, Brave, Noble, Wise, Kind, Pure, Strong
- **26 Animals**: Cat, Dog, Wolf, Fox, Bear, Lion, Tiger, Eagle, Hawk, Owl, Rabbit, Deer, Dolphin, Whale, Shark, Turtle, Dragon, Phoenix, Panda, Koala, Penguin, Seal, Otter, Falcon, Raven, Swan
- **3-digit Numbers**: Random numbers from 100-999

Examples: `ChattyCat123`, `SilentWolf456`, `FriendlyDolphin789`

## 🧪 Features Implemented

✅ **Core Infrastructure**
- Express.js server with proper middleware
- SQLite database with auto-table creation
- JWT-based authentication system
- Password hashing with bcryptjs
- CORS protection and error handling

✅ **Database Design**
- User management with anonymous names
- Chat room structure with expiration
- Message storage with encryption flags
- Proper foreign key relationships

✅ **API Endpoints**
- User registration and login
- Health checks and status monitoring
- Current user information retrieval
- Database connection testing

✅ **Frontend Interface**
- Complete HTML/CSS/JavaScript interface
- User registration and login forms
- Dashboard with user information
- Responsive design for mobile devices
- JWT token management with localStorage

✅ **Security & Validation**
- Input validation for all API requests
- Secure password storage
- JWT token generation and verification
- Anonymous name uniqueness checking
- SQL injection protection

## 🚀 Application Status

✅ **RUNNING**: The application is now fully functional and accessible at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:3000/health

## 🔧 Configuration

### Database
- **Type**: SQLite (`anon_connect.db`)
- **Auto-creation**: Tables created automatically on startup
- **Location**: Root directory of project

### Security
- **JWT Secret**: Change `SECRET_KEY` in .env for production
- **Token Expiry**: 30 minutes (configurable in server.js)
- **Password Requirements**: Minimum 6 characters
- **CORS**: Currently allows all origins (configure for production)

### Server
- **Port**: 3000 (configurable via PORT environment variable)
- **Static Files**: Served from `public/` directory
- **Logging**: Console logging for requests and errors

## 🎉 Next Steps (Steps 2-5)

This completes **Step 1: Project Foundation & Database Setup**. The application is now ready for:

- **Step 2**: Real-time chat functionality with WebSocket
- **Step 3**: Anonymous matching system
- **Step 4**: Chat room management and message encryption
- **Step 5**: Enhanced frontend and deployment features

The foundation is solid and the application is running successfully! 🚀
