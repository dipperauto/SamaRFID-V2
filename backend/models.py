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
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)
    role: str = Field(min_length=1)


class AddUserResponse(BaseModel):
    success: bool
    message: str | None = None


class HashPasswordResponse(BaseModel):
    hash: str