# Anon-Connect: Anonymous Chat Platform

🚀 **Step 1 Complete**: Foundation & Database Setup

A Python FastAPI-based anonymous chat platform that allows users to connect and chat anonymously with fun generated usernames.

## 🏗️ Architecture Overview

- **Backend**: FastAPI with SQLAlchemy ORM
- **Database**: SQLite (development) - easily configurable for PostgreSQL/MySQL
- **Authentication**: JWT-based with bcrypt password hashing
- **Anonymous Names**: Auto-generated fun names like "ChattyCat123"

## 📁 Project Structure

```
anon-connect/
├── main.py           # FastAPI application & routes
├── database.py       # SQLAlchemy models & database setup
├── models.py         # Pydantic schemas for API validation
├── utils.py          # Utilities (auth, anonymous names, etc.)
├── requirements.txt  # Python dependencies
├── .env             # Environment configuration
├── test_setup.py    # Application validation script
└── README.md        # This file
```

## 🗄️ Database Models

### User Model
- `id`: Primary key
- `username`: Unique username
- `email`: Unique email address
- `password_hash`: Bcrypt hashed password
- `anonymous_name`: Fun generated name (e.g., "SilentWolf456")
- `created_at`: Account creation timestamp
- `is_active`: Account status

### Chat Model
- `id`: Primary key
- `user1_id`: First user (chat initiator)
- `user2_id`: Second user (chat participant)
- `status`: active/ended/expired
- `created_at`: Chat creation time
- `expires_at`: Chat expiration time (24 hours default)

### Message Model
- `id`: Primary key
- `chat_id`: Associated chat
- `sender_id`: Message sender
- `content`: Message text
- `timestamp`: Message time
- `is_encrypted`: Encryption flag for future use

## 🔧 Installation & Setup

### 1. Install Dependencies
```bash
pip install -r requirements.txt
```

### 2. Environment Configuration
The `.env` file is already created with default values:
```env
DATABASE_URL=sqlite:///./anon_connect.db
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
DEBUG=True
```

### 3. Start the Server
```bash
uvicorn main:app --reload
```

The server will start on `http://localhost:8000`

### 4. Validate Setup
```bash
python test_setup.py
```

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
curl -X POST "http://localhost:8000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "email": "john@example.com",
    "password": "secretpassword123"
  }'
```

#### Login User
```bash
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "johndoe",
    "password": "secretpassword123"
  }'
```

## 🔒 Security Features

- **Password Hashing**: Bcrypt with salt
- **JWT Authentication**: Secure token-based auth
- **Input Validation**: Pydantic schema validation
- **CORS Protection**: Configurable CORS middleware
- **Anonymous Names**: Privacy-focused username generation

## 🎯 Anonymous Name Generator

The system generates fun, unique anonymous names using:
- **Adjectives**: Silent, Mysterious, Chatty, Friendly, Cool, etc.
- **Animals**: Cat, Dog, Wolf, Fox, Bear, Lion, Tiger, etc.
- **Numbers**: Random 3-digit numbers

Examples: `ChattyCat123`, `SilentWolf456`, `FriendlyDolphin789`

## 🧪 Features Implemented

✅ **Core Infrastructure**
- FastAPI application with proper middleware
- SQLAlchemy database models and relationships
- Pydantic schemas for request/response validation
- JWT-based authentication system
- Password hashing with bcrypt

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

✅ **Security & Validation**
- Input validation for all API requests
- Secure password storage
- JWT token generation and verification
- Anonymous name uniqueness checking

## 🚀 Next Steps (Steps 2-5)

This completes **Step 1: Project Foundation & Database Setup**. The application is now ready for:

- **Step 2**: Real-time chat functionality with WebSocket
- **Step 3**: Anonymous matching system
- **Step 4**: Chat room management and message encryption
- **Step 5**: Frontend interface and deployment

## 🔧 Configuration

### Database
- Default: SQLite (`sqlite:///./anon_connect.db`)
- Production: Easily configurable to PostgreSQL/MySQL via `DATABASE_URL`

### Security
- JWT Secret: Change `SECRET_KEY` in production
- Token Expiry: Configurable via `ACCESS_TOKEN_EXPIRE_MINUTES`
- Password Requirements: Minimum 6 characters (customizable)

## 📝 Development Notes

- All database tables are auto-created on startup
- Comprehensive error handling with proper HTTP status codes
- Logging configured for development and production
- Async/await patterns used throughout
- CRUD operations abstracted for reusability

The foundation is solid and ready for the next development steps!
