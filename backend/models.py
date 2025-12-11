from typing import Optional, List
from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str = Field(min_length=1)
    password: str = Field(min_length=1)


class LoginResponse(BaseModel):
    success: bool
    role: Optional[str] = None
    allowed_pages: Optional[List[str]] = None
    message: Optional[str] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    profile_photo_path: Optional[str] = None


class AddUserRequest(BaseModel):
    username: str = Field(min_length=1)  # email
    password: str = Field(min_length=1)
    role: str = Field(min_length=1)
    full_name: str = Field(min_length=1)
    profile_photo_base64: Optional[str] = None  # data URL (ex.: data:image/png;base64,xxx)
    allowed_pages: Optional[List[str]] = None


class UpdateUserRequest(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    password: Optional[str] = None
    profile_photo_base64: Optional[str] = None
    allowed_pages: Optional[List[str]] = None


class AddUserResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    profile_photo_path: Optional[str] = None


class HashPasswordResponse(BaseModel):
    hash: str


class User(BaseModel):
    username: str
    full_name: str
    role: str
    profile_photo_path: Optional[str] = None
    allowed_pages: List[str] = []


class ListUsersResponse(BaseModel):
    count: int
    users: List[User]


class PublicUser(BaseModel):
    username: str
    full_name: str
    role: str
    profile_photo_path: Optional[str] = None


class UsersSearchResponse(BaseModel):
    users: List[PublicUser]


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
    corporate_name: Optional[str] = None  # Razão Social
    trade_name: Optional[str] = None      # Nome Fantasia
    notes: Optional[str] = None
    email: Optional[str] = None


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
    corporate_name: Optional[str] = None
    trade_name: Optional[str] = None
    notes: Optional[str] = None  # até 50 linhas (validado no front)
    email: Optional[str] = None


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
    corporate_name: Optional[str] = None
    trade_name: Optional[str] = None
    notes: Optional[str] = None
    email: Optional[str] = None


class AddClientResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    client: Optional[Client] = None


class ListClientsResponse(BaseModel):
    count: int
    clients: List[Client]


# ---------- Anexos ----------

class ClientFile(BaseModel):
    name: str
    url: str
    size_bytes: int


class ListClientFilesResponse(BaseModel):
    files: List[ClientFile]
    total_bytes: int
    limit_bytes: int


class UploadClientFileResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    file: Optional[ClientFile] = None


class DeleteClientFileResponse(BaseModel):
    success: bool
    message: Optional[str] = None

# ---------- Kanban ----------

class KanbanList(BaseModel):
    id: str
    title: str
    order: int

class KanbanCard(BaseModel):
    id: str
    listId: str
    title: str
    description: Optional[str] = None
    assignees: List[str] = []
    dueDate: Optional[str] = None
    color: Optional[str] = None
    position: int

class KanbanBoard(BaseModel):
    lists: List[KanbanList]
    cards: List[KanbanCard]

class CreateListRequest(BaseModel):
    title: str

class UpdateListRequest(BaseModel):
    title: Optional[str] = None
    order: Optional[int] = None

class CreateCardRequest(BaseModel):
    listId: str
    title: str
    description: Optional[str] = None
    assignees: Optional[List[str]] = None
    dueDate: Optional[str] = None
    color: Optional[str] = None

class UpdateCardRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignees: Optional[List[str]] = None
    dueDate: Optional[str] = None
    color: Optional[str] = None
    listId: Optional[str] = None
    position: Optional[int] = None


class Event(BaseModel):
    id: int
    name: str
    description: str
    start_date: str
    end_date: str
    owner_username: str
    photo_path: Optional[str] = None
    photographers: List[str]

class AddEventRequest(BaseModel):
    name: str = Field(min_length=1)
    description: str = Field(min_length=1)
    start_date: str = Field(min_length=1)  # ISO date (YYYY-MM-DD)
    end_date: str = Field(min_length=1)    # ISO date (YYYY-MM-DD)
    photographers: List[str] = []
    photo_base64: Optional[str] = None

class UpdateEventRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    photographers: Optional[List[str]] = None
    photo_base64: Optional[str] = None

class ListEventsResponse(BaseModel):
    count: int
    events: List[Event]

class DeleteEventResponse(BaseModel):
    success: bool
    message: Optional[str] = None

# ---------- LUTs (presets de parâmetros do editor) ----------

from typing import Any, Dict

class LUTPreset(BaseModel):
    id: int
    username: str
    name: str
    description: Optional[str] = None
    params: Dict[str, Any]
    thumb_url: Optional[str] = None
    created_at: str

class ListLUTsResponse(BaseModel):
    count: int
    presets: List[LUTPreset]

class AddLUTRequest(BaseModel):
    name: str = Field(min_length=1)
    description: Optional[str] = None
    params: Dict[str, Any]
    thumb_source_url: Optional[str] = None  # ex.: 'static/editor/.../preview_xxx.png'

class AddLUTResponse(BaseModel):
    success: bool
    message: Optional[str] = None
    preset: Optional[LUTPreset] = None

class DeleteLUTResponse(BaseModel):
    success: bool
    message: Optional[str] = None