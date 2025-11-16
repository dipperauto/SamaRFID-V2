from typing import Optional
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    success: bool
    role: Optional[str] = None
    message: Optional[str] = None


class AddUserRequest(BaseModel):
    username: str = Field(min_length=1)  # email
    password: str = Field(min_length=1)
    role: str = Field(min_length=1)
    full_name: str = Field(min_length=1)
    profile_photo_base64: Optional[str] = None  # data URL (ex.: data:image/png;base64,xxx)


class AddUserResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    profile_photo_path: Optional[str] = None


class HashPasswordResponse(BaseModel):
    hash: str