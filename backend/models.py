from typing import Optional, List
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


class Client(BaseModel):
    id: int
    full_name: str
    doc: str
    address: str
    phone: str
    profile_photo_path: Optional[str] = None
    pix_key: Optional[str] = None
    bank_data: Optional[str] = None
    municipal_registration: Optional[str] = None
    state_registration: Optional[str] = None
    notes: Optional[str] = None


class AddClientRequest(BaseModel):
    full_name: str = Field(min_length=1)
    doc: str = Field(min_length=1)  # CPF/CNPJ
    address: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    profile_photo_base64: Optional[str] = None  # data URL
    pix_key: Optional[str] = None
    bank_data: Optional[str] = None
    municipal_registration: Optional[str] = None
    state_registration: Optional[str] = None
    notes: Optional[str] = None  # até 50 linhas (validado no front)


class UpdateClientRequest(BaseModel):
    full_name: Optional[str] = None
    doc: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    profile_photo_base64: Optional[str] = None
    pix_key: Optional[str] = None
    bank_data: Optional[str] = None
    municipal_registration: Optional[str] = None
    state_registration: Optional[str] = None
    notes: Optional[str] = None


class AddClientResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    client: Optional[Client] = None


class ListClientsResponse(BaseModel):
    count: int
    clients: List[Client]