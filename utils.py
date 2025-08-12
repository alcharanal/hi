from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import random
import string
import os
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db, User

load_dotenv()

SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this-in-production")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Anonymous name generation
ADJECTIVES = [
    "Silent", "Mysterious", "Chatty", "Friendly", "Cool", "Smart", "Quick", "Clever",
    "Bright", "Swift", "Bold", "Calm", "Wild", "Free", "Happy", "Lucky", "Magic",
    "Sunny", "Gentle", "Brave", "Noble", "Wise", "Kind", "Pure", "Strong"
]

ANIMALS = [
    "Cat", "Dog", "Wolf", "Fox", "Bear", "Lion", "Tiger", "Eagle", "Hawk", "Owl",
    "Rabbit", "Deer", "Dolphin", "Whale", "Shark", "Turtle", "Dragon", "Phoenix",
    "Panda", "Koala", "Penguin", "Seal", "Otter", "Falcon", "Raven", "Swan"
]

def generate_anonymous_name():
    """Generate a fun anonymous name like 'ChattyCat123'"""
    adjective = random.choice(ADJECTIVES)
    animal = random.choice(ANIMALS)
    number = random.randint(100, 999)
    return f"{adjective}{animal}{number}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return username
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
):
    """Get the current authenticated user"""
    username = verify_token(credentials.credentials)
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

def format_response(success: bool, message: str, data: dict = None):
    """Format API response consistently"""
    response = {
        "success": success,
        "message": message
    }
    if data:
        response["data"] = data
    return response

def generate_unique_anonymous_name(db: Session):
    """Generate a unique anonymous name that doesn't exist in database"""
    while True:
        name = generate_anonymous_name()
        existing_user = db.query(User).filter(User.anonymous_name == name).first()
        if not existing_user:
            return name
