from pydantic import BaseModel, EmailStr, validator
from datetime import datetime
from typing import Optional, List
from enum import Enum

class ChatStatus(str, Enum):
    active = "active"
    ended = "ended"
    expired = "expired"

# User schemas
class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters long')
        return v

    @validator('username')
    def validate_username(cls, v):
        if len(v) < 3:
            raise ValueError('Username must be at least 3 characters long')
        if not v.isalnum():
            raise ValueError('Username must contain only letters and numbers')
        return v

class UserLogin(BaseModel):
    username: str
    password: str

class User(UserBase):
    id: int
    anonymous_name: str
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True

class UserInDB(User):
    password_hash: str

# Chat schemas
class ChatBase(BaseModel):
    status: ChatStatus = ChatStatus.active

class ChatCreate(ChatBase):
    user2_id: int

class Chat(ChatBase):
    id: int
    user1_id: int
    user2_id: int
    created_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True

# Message schemas
class MessageBase(BaseModel):
    content: str

    @validator('content')
    def validate_content(cls, v):
        if not v.strip():
            raise ValueError('Message content cannot be empty')
        if len(v) > 1000:
            raise ValueError('Message content cannot exceed 1000 characters')
        return v

class MessageCreate(MessageBase):
    chat_id: int

class Message(MessageBase):
    id: int
    chat_id: int
    sender_id: int
    timestamp: datetime
    is_encrypted: bool

    class Config:
        from_attributes = True

# Response schemas
class TokenResponse(BaseModel):
    access_token: str
    token_type: str

class APIResponse(BaseModel):
    success: bool
    message: str
    data: Optional[dict] = None

class UserResponse(BaseModel):
    success: bool
    message: str
    user: Optional[User] = None

class ChatResponse(BaseModel):
    success: bool
    message: str
    chat: Optional[Chat] = None

class MessagesResponse(BaseModel):
    success: bool
    message: str
    messages: Optional[List[Message]] = None

class ChatsResponse(BaseModel):
    success: bool
    message: str
    chats: Optional[List[Chat]] = None
