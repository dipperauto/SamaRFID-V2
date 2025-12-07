import os
from fastapi import FastAPI, HTTPException, status, Header, Response, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional, List
from hashlib import sha256
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from models import LoginRequest, LoginResponse, AddUserRequest, AddUserResponse, HashPasswordResponse, User, ListUsersResponse, UpdateUserRequest
from storage import get_user, add_user, get_all_users, update_user
from security import verify_password, hash_password
from models import (
    Client,
    AddClientRequest,
    UpdateClientRequest,
    AddClientResponse,
    ListClientsResponse,
    ClientFile,
    ListClientFilesResponse,
    UploadClientFileResponse,
    DeleteClientFileResponse,
)
from storage_clients import (
    get_all_clients,
    add_client,
    update_client,
    list_client_files,
    total_client_files_size_bytes,
    save_client_file,
    delete_client_file,
)
from models import KanbanBoard, KanbanList, KanbanCard, CreateListRequest, UpdateListRequest, CreateCardRequest, UpdateCardRequest
from storage_kanban import get_board, create_list, update_list, delete_list, create_card, update_card, delete_card
from models import PublicUser, UsersSearchResponse, Event, AddEventRequest, ListEventsResponse
from storage_events import add_event, get_events_for_user

# Simple .env loader (no extra dependency)
def load_env_file(path: str, override: bool = True):
    if not os.path.isfile(path):
        return
    try:
        with open(path, "r", encoding="utf-8") as f:
            for raw_line in f:
                line = raw_line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" not in line:
                    continue
                key, value = line.split("=", 1)
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key:
                    if override or key not in os.environ or not os.environ.get(key):
                        os.environ[key] = value
    except Exception:
        pass

def load_env_files(paths, override: bool = True):
    for p in paths:
        load_env_file(p, override=override)

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
load_env_files(
    [
      os.path.join(project_root, ".env"),
      os.path.join(os.path.dirname(__file__), ".env"),
      ".env",
    ],
    override=True,
)

app = FastAPI(title="Backend Dyad - Auth")

frontend_url = os.environ.get("FRONTEND_URL")
frontend_origin_regex = os.environ.get("FRONTEND_ORIGIN_REGEX", r"http://localhost:\d+$")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url] if frontend_url else [],
    allow_origin_regex=frontend_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount(
    "/static",
    StaticFiles(directory=os.path.join(os.path.dirname(__file__), "media")),
    name="static",
)

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "").strip()

SESSION_SECRET = os.environ.get("SESSION_SECRET", ADMIN_TOKEN or "dev-secret-change-me").strip()
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "").lower() in ("1", "true", "yes")
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "lax").lower()
COOKIE_DOMAIN = os.environ.get("COOKIE_DOMAIN", "").strip() or None
SESSION_TTL = int(os.environ.get("SESSION_TTL", "86400"))

LIMIT_BYTES = 50 * 1024 * 1024  # 50 MB por cliente

# Segurança adicional por headers (HSTS, etc.)
from fastapi.middleware.trustedhost import TrustedHostMiddleware
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["*"])

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    # HSTS (navegadores ignoram em HTTP, efetivo em HTTPS)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Proteções básicas
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

# ----- Helpers de sessão e permissões -----

def _make_session_token(username: str, role: Optional[str]) -> str:
    exp = int((datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL)).timestamp())
    payload_role = role or ""
    nonce = secrets.token_hex(8)
    payload = f"{username}|{payload_role}|{exp}|{nonce}"
    sig = hmac.new(SESSION_SECRET.encode(), payload.encode(), sha256).hexdigest()
    return f"v1|{username}|{payload_role}|{exp}|{nonce}|{sig}"

def _verify_session_token(token: str) -> Optional[dict]:
    try:
        parts = token.split("|")
        if len(parts) != 6 or parts[0] != "v1":
            return None
        _, username, role, exp_str, nonce, sig = parts
        payload = f"{username}|{role}|{exp_str}|{nonce}"
        expected_sig = hmac.new(SESSION_SECRET.encode(), payload.encode(), sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None
        exp = int(exp_str)
        if exp < int(datetime.now(timezone.utc).timestamp()):
            return None
        user = get_user(username)
        if not user:
            return None
        return {"username": username, "role": role or user.get("role") or ""}
    except Exception:
        return None

def default_allowed_pages(role: Optional[str]) -> List[str]:
    # keys: "home","teste","clients","admin:add-user","users","kanban","events"
    if role == "administrador":
      return ["home", "teste", "clients", "admin:add-user", "users", "kanban", "events"]
    return ["home", "teste", "clients", "kanban", "events"]

def _require_admin(request: Request):
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    data = _verify_session_token(token)
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida ou expirada.")
    if (data.get("role") or "").lower() != "administrador":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito a administradores.")
    return data


# ----- Health e Token -----

@app.get("/health")
def health():
    return {"status": "ok", "adminConfigured": bool(ADMIN_TOKEN)}

@app.get("/auth/token-check")
def token_check():
    masked = sha256(ADMIN_TOKEN.encode()).hexdigest()[:8] if ADMIN_TOKEN else None
    return {"adminConfigured": bool(ADMIN_TOKEN), "tokenPreview": masked}


# ----- Auth -----

@app.post("/auth/login", response_model=LoginResponse)
def auth_login(payload: LoginRequest, response: Response):
    user = get_user(payload.username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas.",
        )
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas.",
        )
    token = _make_session_token(user["username"], user.get("role"))
    response.set_cookie(
        key="session",
        value=token,
        max_age=SESSION_TTL,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        domain=COOKIE_DOMAIN,
        path="/",
    )
    allowed = user.get("allowed_pages") or default_allowed_pages(user.get("role"))
    return LoginResponse(success=True, role=user["role"], allowed_pages=allowed)

@app.get("/auth/me", response_model=LoginResponse)
def auth_me(request: Request):
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    data = _verify_session_token(token)
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida ou expirada.")
    user = get_user(data["username"])
    allowed = (user or {}).get("allowed_pages") or default_allowed_pages((user or {}).get("role"))
    # Include extra user info for UI
    return LoginResponse(
        success=True,
        role=data.get("role"),
        allowed_pages=allowed,
        username=data.get("username"),
        full_name=(user or {}).get("full_name"),
        profile_photo_path=(user or {}).get("profile_photo_path")
    )

@app.post("/auth/logout")
def auth_logout(response: Response, request: Request):
    response.delete_cookie(key="session", domain=COOKIE_DOMAIN, path="/")
    return {"success": True}


# ----- Usuários (admin via sessão) -----

@app.get("/users", response_model=ListUsersResponse)
def users_list(request: Request):
    _require_admin(request)
    raw = get_all_users()
    users: list[User] = []
    for u in raw:
        users.append(
            User(
                username=u.get("username", ""),
                full_name=u.get("full_name", ""),
                role=u.get("role", ""),
                profile_photo_path=u.get("profile_photo_path") or None,
                allowed_pages=u.get("allowed_pages") or [],
            )
        )
    return ListUsersResponse(count=len(users), users=users)

@app.put("/users/{username}", response_model=AddUserResponse)
def users_update(username: str, payload: UpdateUserRequest, request: Request):
    _require_admin(request)
    updated = update_user(
        username,
        full_name=payload.full_name,
        role=payload.role,
        password=payload.password,
        profile_photo_base64=payload.profile_photo_base64,
        allowed_pages=payload.allowed_pages,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    return AddUserResponse(success=True, message="Usuário atualizado com sucesso.", profile_photo_path=updated.get("profile_photo_path") or None)

@app.post("/users/register-session", response_model=AddUserResponse)
def users_register_session(payload: AddUserRequest, request: Request):
    admin = _require_admin(request)
    role = payload.role
    pages = payload.allowed_pages or default_allowed_pages(role)
    try:
        photo_path = add_user(
            payload.username,
            payload.password,
            role,
            payload.full_name,
            payload.profile_photo_base64,
            pages,
        )
        return AddUserResponse(success=True, message="Usuário cadastrado com sucesso.", profile_photo_path=photo_path)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))


# ----- Usuários (token legado) -----

@app.post("/users/register", response_model=AddUserResponse)
def users_register(payload: AddUserRequest, x_admin_token: Optional[str] = Header(None, alias="x-admin-token")):
    token = (x_admin_token or "").strip()
    if not ADMIN_TOKEN or token != ADMIN_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de administrador inválido.")
    role = payload.role
    pages = payload.allowed_pages or default_allowed_pages(role)
    try:
        photo_path = add_user(
            payload.username,
            payload.password,
            role,
            payload.full_name,
            payload.profile_photo_base64,
            pages,
        )
        return AddUserResponse(success=True, message="Usuário cadastrado com sucesso.", profile_photo_path=photo_path)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

@app.post("/auth/hash", response_model=HashPasswordResponse)
def auth_hash(payload: LoginRequest, x_admin_token: Optional[str] = Header(None, alias="x-admin-token")):
    token = (x_admin_token or "").strip()
    if not ADMIN_TOKEN or token != ADMIN_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de administrador inválido.")
    hashed = hash_password(payload.password)
    return HashPasswordResponse(hash=hashed)


# ----- Clientes (mantidos) -----

@app.get("/clients", response_model=ListClientsResponse)
def clients_list(request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    raw = get_all_clients()
    clients: list[Client] = []
    for row in raw:
        clients.append(
            Client(
                id=int(row.get("id") or "0"),
                full_name=row.get("full_name", ""),
                doc=row.get("doc", ""),
                address=row.get("address", ""),
                phone=row.get("phone", ""),
                profile_photo_path=row.get("profile_photo_path") or None,
                pix_key=row.get("pix_key") or None,
                bank_data=row.get("bank_data") or None,
                municipal_registration=row.get("municipal_registration") or None,
                state_registration=row.get("state_registration") or None,
                corporate_name=row.get("corporate_name") or None,
                trade_name=row.get("trade_name") or None,
                notes=row.get("notes") or None,
            )
        )
    return ListClientsResponse(count=len(clients), clients=clients)

@app.post("/clients/register", response_model=AddClientResponse)
def clients_register(payload: AddClientRequest, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    created = add_client(
        payload.full_name,
        payload.doc,
        payload.address,
        payload.phone,
        payload.profile_photo_base64,
        payload.pix_key,
        payload.bank_data,
        payload.municipal_registration,
        payload.state_registration,
        payload.corporate_name,
        payload.trade_name,
        payload.notes,
    )
    client = Client(
        id=int(created["id"]),
        full_name=created["full_name"],
        doc=created["doc"],
        address=created["address"],
        phone=created["phone"],
        profile_photo_path=created.get("profile_photo_path") or None,
        pix_key=created.get("pix_key") or None,
        bank_data=created.get("bank_data") or None,
        municipal_registration=created.get("municipal_registration") or None,
        state_registration=created.get("state_registration") or None,
        corporate_name=created.get("corporate_name") or None,
        trade_name=created.get("trade_name") or None,
        notes=created.get("notes") or None,
    )
    return AddClientResponse(success=True, message="Cliente cadastrado com sucesso.", client=client)

@app.put("/clients/{client_id}", response_model=AddClientResponse)
def clients_update(client_id: int, payload: UpdateClientRequest, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    updated = update_client(
        client_id,
        payload.full_name,
        payload.doc,
        payload.address,
        payload.phone,
        payload.profile_photo_base64,
        payload.pix_key,
        payload.bank_data,
        payload.municipal_registration,
        payload.state_registration,
        payload.corporate_name,
        payload.trade_name,
        payload.notes,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado.")
    client = Client(
        id=int(updated["id"]),
        full_name=updated["full_name"],
        doc=updated["doc"],
        address=updated["address"],
        phone=updated["phone"],
        profile_photo_path=updated.get("profile_photo_path") or None,
        pix_key=updated.get("pix_key") or None,
        bank_data=updated.get("bank_data") or None,
        municipal_registration=updated.get("municipal_registration") or None,
        state_registration=updated.get("state_registration") or None,
        corporate_name=updated.get("corporate_name") or None,
        trade_name=updated.get("trade_name") or None,
        notes=updated.get("notes") or None,
    )
    return AddClientResponse(success=True, message="Cliente atualizado com sucesso!", client=client)

# ---------- Anexos por cliente ----------

@app.get("/clients/{client_id}/files", response_model=ListClientFilesResponse)
def clients_files_list(client_id: int, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    files_raw = list_client_files(client_id)
    files = [
        ClientFile(name=f["name"], url=f["url"], size_bytes=int(f["size_bytes"]))
        for f in files_raw
    ]
    total = total_client_files_size_bytes(client_id)
    return ListClientFilesResponse(files=files, total_bytes=total, limit_bytes=LIMIT_BYTES)

@app.post("/clients/{client_id}/files", response_model=UploadClientFileResponse)
async def clients_file_upload(client_id: int, request: Request, file: UploadFile = File(...)):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    total = total_client_files_size_bytes(client_id)
    content = await file.read()
    new_size = len(content)
    if total + new_size > LIMIT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Limite de 50MB por cliente excedido."
        )
    name, size_bytes, url = save_client_file(client_id, file.filename, content)
    return UploadClientFileResponse(
        success=True,
        message="Arquivo anexado com sucesso.",
        file=ClientFile(name=name, url=url, size_bytes=size_bytes),
    )

@app.delete("/clients/{client_id}/files/{filename}", response_model=DeleteClientFileResponse)
def clients_file_delete(client_id: int, filename: str, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    ok = delete_client_file(client_id, filename)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Arquivo não encontrado.")
    return DeleteClientFileResponse(success=True, message="Arquivo removido com sucesso.")


# ----- Kanban (autenticado) -----

@app.get("/kanban", response_model=KanbanBoard)
def kanban_get(request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    board = get_board()
    # valida estrutura
    return KanbanBoard(
        lists=[KanbanList(**l) for l in board.get("lists", [])],
        cards=[KanbanCard(**c) for c in board.get("cards", [])],
    )

@app.post("/kanban/lists", response_model=KanbanList)
def kanban_create_list(payload: CreateListRequest, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    new_list = create_list(payload.title)
    return KanbanList(**new_list)

@app.put("/kanban/lists/{list_id}", response_model=KanbanList)
def kanban_update_list(list_id: str, payload: UpdateListRequest, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    updated = update_list(list_id, title=payload.title, order=payload.order)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista não encontrada.")
    return KanbanList(**updated)

@app.delete("/kanban/lists/{list_id}")
def kanban_delete_list(list_id: str, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    ok = delete_list(list_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lista não encontrada.")
    return {"success": True}

@app.post("/kanban/cards", response_model=KanbanCard)
def kanban_create_card(payload: CreateCardRequest, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    new_card = create_card(
        payload.listId,
        payload.title,
        payload.description,
        payload.assignees,
        payload.dueDate,
        payload.color,
    )
    return KanbanCard(**new_card)

@app.put("/kanban/cards/{card_id}", response_model=KanbanCard)
def kanban_update_card(card_id: str, payload: UpdateCardRequest, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    updated = update_card(
        card_id,
        title=payload.title,
        description=payload.description,
        assignees=payload.assignees,
        dueDate=payload.dueDate,
        color=payload.color,
        listId=payload.listId,
        position=payload.position,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card não encontrado.")
    return KanbanCard(**updated)

@app.delete("/kanban/cards/{card_id}")
def kanban_delete_card(card_id: str, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    ok = delete_card(card_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card não encontrado.")
    return {"success": True}

# ----- Busca pública de usuários (apenas autenticado, retorna dados mínimos) -----
@app.get("/users/search-public", response_model=UsersSearchResponse)
def users_search_public(request: Request, q: Optional[str] = None):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    raw = get_all_users()
    ql = (q or "").strip().lower()
    users: list[PublicUser] = []
    for u in raw:
        role = (u.get("role", "") or "").lower()
        # compat: considerar 'usuario' e 'usuário' também
        if role not in ("fotografo", "fotógrafo", "usuario", "usuário"):
            continue
        uname = u.get("username", "")
        fname = u.get("full_name", "")
        if ql and (ql not in uname.lower() and ql not in fname.lower()):
            continue
        users.append(
            PublicUser(
                username=uname,
                full_name=fname,
                role=u.get("role", ""),
                profile_photo_path=u.get("profile_photo_path") or None,
            )
        )
        if not ql and len(users) >= 20:
            break
    return UsersSearchResponse(users=users)

# ----- Eventos (apenas membros podem ver; criação pelo usuário da sessão) -----
@app.get("/events", response_model=ListEventsResponse)
def events_list(request: Request):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    username = data["username"]
    events = get_events_for_user(username)
    return ListEventsResponse(count=len(events), events=[Event(**e) for e in events])

@app.post("/events", response_model=Event)
def events_create(payload: AddEventRequest, request: Request):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    owner = data["username"]
    # sanitiza fotógrafos: max 5, únicos, existem e são fotógrafos
    from storage import get_user
    sanitized: List[str] = []
    for uname in (payload.photographers or []):
        if uname in sanitized:
            continue
        u = get_user(uname)
        if not u:
            continue
        role = (u.get("role", "") or "").lower()
        if role in ("fotografo", "fotógrafo"):
            sanitized.append(uname)
        if len(sanitized) >= 5:
            break
    created = add_event(
        payload.name,
        payload.description,
        payload.start_date,
        payload.end_date,
        owner,
        sanitized,
        payload.photo_base64,
    )
    return Event(**created)