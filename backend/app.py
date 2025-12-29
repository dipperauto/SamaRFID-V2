import os
from fastapi import FastAPI, HTTPException, status, Header, Response, Request, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional, List, Tuple, Dict, Any
from hashlib import sha256
import hmac
import secrets
from datetime import datetime, timedelta, timezone
import re
from fastapi import Form

from models import LoginRequest, LoginResponse, AddUserRequest, AddUserResponse, HashPasswordResponse, User, ListUsersResponse, UpdateUserRequest
from storage import get_user, add_user, get_all_users, update_user, delete_user
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
    delete_client,
)
from models import KanbanBoard, KanbanList, KanbanCard, CreateListRequest, UpdateListRequest, CreateCardRequest, UpdateCardRequest
from storage_kanban import get_board, create_list, update_list, delete_list, create_card, update_card, delete_card
from models import PublicUser, UsersSearchResponse, Event, AddEventRequest, ListEventsResponse, UpdateEventRequest, DeleteEventResponse
from storage_image_editor import save_original, process_image, get_metadata, get_histogram_and_sharpness
from storage_image_editor import get_pose_landmarks
# ADD: LUTs
from models import LUTPreset, ListLUTsResponse, AddLUTRequest, AddLUTResponse, DeleteLUTResponse
from storage_luts import get_luts_for_user, add_lut, get_lut_by_id, delete_lut
# NOVO: galeria por evento
from storage_events import get_event_by_id
from storage_gallery import list_gallery_for_event, add_images_to_event, apply_lut_for_event_images, delete_event_images, set_event_images_discarded
from storage_finance import record_purchase, get_finance_summary, list_finance_purchases
# ADDED: storage_hierarchy
from storage_hierarchy import list_all as hierarchy_list_all, add_root as hierarchy_add_root, add_child as hierarchy_add_child, update_node as hierarchy_update_node, delete_node as hierarchy_delete_node
# ADDED
from storage_hierarchy import add_category as hierarchy_add_category, remove_category as hierarchy_remove_category
# ADDED: assets & logs
from storage_assets import list_assets as assets_list, add_asset as assets_add, update_asset as assets_update, delete_asset as assets_delete
from storage_assets import list_categories as assets_list_categories, add_category as assets_add_category, remove_category as assets_remove_category
// ADDED: import para buscar todos os ativos
from storage_assets import get_all_assets_flat
from storage_logs import append_log, list_logs as logs_list
from models import Asset, AssetListResponse, AddAssetRequest, UpdateAssetRequest, CategoryListResponse, LogListResponse, LogItem

# ADD: importar funções de eventos usadas abaixo
from storage_events import get_events_for_user, add_event, update_event, delete_event, get_event_by_id

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

# Helper para normalizar qualquer caminho salvo (media/, backend/media/ ou static/) para uma URL sob /static
def _to_static_url(rel_path: str) -> str:
    if not rel_path:
        return ""
    p = str(rel_path).replace("\\", "/").lstrip("/")
    if p.startswith("backend/"):
        p = p[len("backend/"):]
    if p.startswith("static/"):
        return p
    if p.startswith("media/"):
        p = p[len("media/"):]
    return f"static/{p}"

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

# Middleware para aceitar prefixo /api em todas as rotas existentes
@app.middleware("http")
async def api_prefix_rewrite(request: Request, call_next):
    """
    Permite acessar todas as rotas atuais com o prefixo /api.
    Ex.: /api/health -> /health, /api/static/... -> /static/...
    """
    path = request.scope.get("path") or ""
    if path == "/api":
        request.scope["path"] = "/"
    elif path.startswith("/api/"):
        request.scope["path"] = path[4:]
    response = await call_next(request)
    return response

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    # HSTS (navegadores ignoram em HTTP, efetivo em HTTPS)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Proteções básicas
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # CORS fallback: reflete Origin válido (localhost com porta ou FRONTEND_URL)
    origin = request.headers.get("origin", "")
    frontend_url = os.environ.get("FRONTEND_URL", "").strip()
    origin_regex = os.environ.get("FRONTEND_ORIGIN_REGEX", r"http://localhost:\d+$")
    try:
        if origin and (
            (frontend_url and origin == frontend_url) or
            (re.fullmatch(origin_regex, origin) is not None)
        ):
            # Se CORSMiddleware não adicionou, garantimos aqui
            response.headers.setdefault("Access-Control-Allow-Origin", origin)
            response.headers.setdefault("Access-Control-Allow-Credentials", "true")
            # Ajuda caches/proxies a variar por origin
            response.headers.setdefault("Vary", "Origin")
    except Exception:
        # silencioso: não bloquear resposta por erro de regex
        pass

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
      return ["home", "teste", "clients", "admin:add-user", "users", "kanban", "events", "parametros", "services", "expenses", "control"]
    return ["home", "teste", "clients", "kanban", "events", "parametros", "services", "expenses", "control"]

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

# helper: requer membro do evento (owner ou fotógrafo)
def _require_event_member(request: Request, event_id: int) -> dict:
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    ev = get_event_by_id(event_id)
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evento não encontrado.")
    username = data["username"]
    if username != ev["owner_username"] and username not in (ev.get("photographers") or []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito aos participantes do evento.")
    return {"username": username, "event": ev}

def _require_page_access(request: Request, page_key: str) -> dict:
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    user = get_user(data["username"])
    pages = (user or {}).get("allowed_pages") or default_allowed_pages((user or {}).get("role"))
    if page_key not in pages:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso restrito.")
    return {"username": data["username"]}

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
                cpf=(u.get("cpf") or None),
                birth_date=(u.get("birth_date") or None),
                rg=(u.get("rg") or None),
                admission_date=(u.get("admission_date") or None),
                sector=(u.get("sector") or None),
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
        cpf=payload.cpf,
        birth_date=payload.birth_date,
        rg=payload.rg,
        admission_date=payload.admission_date,
        sector=payload.sector,
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
            payload.cpf,
            payload.birth_date,
            payload.rg,
            payload.admission_date,
            payload.sector,
        )
        return AddUserResponse(success=True, message="Usuário cadastrado com sucesso.", profile_photo_path=photo_path)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))

@app.delete("/users/{username}")
def users_delete(username: str, request: Request):
    _require_admin(request)
    ok = delete_user(username)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    return {"success": True, "message": "Usuário excluído com sucesso."}

# NOVO: alias via POST para ambientes que bloqueiam DELETE em proxies
@app.post("/users/delete")
def users_delete_post(request: Request, payload: dict = Body(...)):
    _require_admin(request)
    username = str(payload.get("username") or "").strip()
    if not username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="username é obrigatório.")
    ok = delete_user(username)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    return {"success": True, "message": "Usuário excluído com sucesso."}

# Alias extra; cuidado com conflito /users/{username} capturando 'actions' — mantemos, mas corrigimos assinatura
@app.post("/users/actions/delete")
def users_delete_action(request: Request, payload: dict = Body(...)):
    _require_admin(request)
    username = str(payload.get("username") or "").strip()
    if not username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="username é obrigatório.")
    ok = delete_user(username)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    return {"success": True, "message": "Usuário excluído com sucesso."}

# NOVO: endpoint sem conflito de rota
@app.post("/admin/users/delete")
def admin_users_delete(request: Request, payload: dict = Body(...)):
    _require_admin(request)
    username = str(payload.get("username") or "").strip()
    if not username:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="username é obrigatório.")
    ok = delete_user(username)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")
    return {"success": True, "message": "Usuário excluído com sucesso."}

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
            payload.cpf,
            payload.birth_date,
            payload.rg,
            payload.admission_date,
            payload.sector,
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

# NOVO (reposicionado): exclusão via POST com body
@app.post("/clients/delete")
def clients_delete_post(request: Request, payload: Dict[str, Any] = Body(...)):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    try:
        client_id = int(payload.get("client_id") or 0)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="client_id inválido.")
    if client_id <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="client_id obrigatório.")
    ok = delete_client(client_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado.")
    return {"success": True, "message": "Cliente excluído com sucesso."}

# NOVO (reposicionado): exclusão via POST com path param
@app.post("/clients/{client_id}/delete")
def clients_delete_id_post(client_id: int, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    ok = delete_client(client_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado.")
    return {"success": True, "message": "Cliente excluído com sucesso."}

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
        payload.email,
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
        email=created.get("email") or None,
    )
    return AddClientResponse(success=True, message="Cliente cadastrado com sucesso!", client=client)

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
        payload.email,
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
        email=updated.get("email") or None,
    )
    return AddClientResponse(success=True, message="Cliente atualizado com sucesso!", client=client)

@app.delete("/clients/{client_id}")
def clients_delete(client_id: int, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    ok = delete_client(client_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente não encontrado.")
    return {"success": True, "message": "Cliente excluído com sucesso."}

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
        if not ql and len(users) >= 50:
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

# ADD: detalhes de um evento (apenas membros do evento)
@app.get("/events/{event_id}", response_model=Event)
def event_detail(event_id: int, request: Request):
    member = _require_event_member(request, event_id)
    ev = member["event"]
    return Event(**ev)

@app.post("/events", response_model=Event)
def events_create(payload: AddEventRequest, request: Request):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    owner = data["username"]
    # sanitiza fotógrafos: max 5, únicos, existem e são fotógrafos/usuários
    from storage import get_user
    sanitized: List[str] = []
    for uname in (payload.photographers or []):
        if uname in sanitized:
            continue
        u = get_user(uname)
        if not u:
            continue
        role = (u.get("role", "") or "").lower()
        if role in ("fotografo", "fotógrafo", "usuario", "usuário"):
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

# Atualizar evento (apenas proprietário)
@app.put("/events/{event_id}", response_model=Event)
def events_update(event_id: int, payload: UpdateEventRequest, request: Request):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    username = data["username"]
    existing = get_event_by_id(event_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evento não encontrado.")
    if existing["owner_username"] != username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas o proprietário pode editar o evento.")
    # sanitiza fotógrafos se enviado
    sanitized = None
    if payload.photographers is not None:
        from storage import get_user
        sanitized = []
        for uname in (payload.photographers or []):
            if uname in sanitized:
                continue
            u = get_user(uname)
            if not u:
                continue
            role = (u.get("role", "") or "").lower()
            if role in ("fotografo", "fotógrafo", "usuario", "usuário"):
                sanitized.append(uname)
            if len(sanitized) >= 5:
                break
    updated = update_event(
        event_id,
        name=payload.name,
        description=payload.description,
        start_date=payload.start_date,
        end_date=payload.end_date,
        photographers=sanitized,
        photo_base64=payload.photo_base64,
    )
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evento não encontrado para atualização.")
    return Event(**updated)

# Excluir evento (apenas proprietário)
@app.delete("/events/{event_id}", response_model=DeleteEventResponse)
def events_delete(event_id: int, request: Request):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    username = data["username"]
    existing = get_event_by_id(event_id)
    if not existing:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evento não encontrado.")
    if existing["owner_username"] != username:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Apenas o proprietário pode excluir o evento.")
    ok = delete_event(event_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evento não encontrado.")
    return DeleteEventResponse(success=True, message="Evento excluído com sucesso.")

# ----- Galeria por Evento (apenas membros) -----

@app.get("/events/{event_id}/gallery")
def events_gallery_list(event_id: int, request: Request):
    _require_event_member(request, event_id)
    return list_gallery_for_event(event_id)

@app.post("/events/{event_id}/gallery/upload")
async def events_gallery_upload(event_id: int, request: Request, files: List[UploadFile] = File(...), sharpness_threshold: Optional[float] = Form(None), price_brl: Optional[float] = Form(None)):
    member = _require_event_member(request, event_id)
    contents: List[Tuple[str, bytes]] = []
    for f in files:
        data = await f.read()
        contents.append((f.filename, data))
    # repassa threshold (se none, storage usará padrão)
    created = add_images_to_event(event_id, member["username"], contents, sharpness_threshold, price_brl)
    # retorna apenas ids e contagem
    return {"count": len(created), "image_ids": [c["id"] for c in created]}

@app.post("/events/{event_id}/gallery/apply-lut")
def events_gallery_apply_lut(event_id: int, payload: dict, request: Request):
    _require_event_member(request, event_id)
    image_ids = list(payload.get("image_ids") or [])
    lut_id = payload.get("lut_id")
    params: dict = {}
    if lut_id is not None:
        preset = get_lut_by_id(int(lut_id))
        if not preset:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LUT não encontrado.")
        params = dict(preset.get("params") or {})
    processed = apply_lut_for_event_images(event_id, image_ids, params, lut_id if lut_id is not None else None)
    return {"processed": processed}

@app.post("/events/{event_id}/gallery/change-lut")
def events_gallery_change_lut(event_id: int, payload: dict, request: Request):
    # alias do apply-lut para ações em massa
    return events_gallery_apply_lut(event_id, payload, request)

@app.delete("/events/{event_id}/gallery")
def events_gallery_delete(event_id: int, payload: dict, request: Request):
    _require_event_member(request, event_id)
    image_ids = list(payload.get("image_ids") or [])
    deleted = delete_event_images(event_id, image_ids)
    return {"deleted": deleted}

# NOVO: marcar/ reverter descarte em massa
@app.post("/events/{event_id}/gallery/mark-discarded")
def events_gallery_mark_discarded(event_id: int, payload: dict, request: Request):
    _require_event_member(request, event_id)
    image_ids = list(payload.get("image_ids") or [])
    discarded = bool(payload.get("discarded", False))
    updated = set_event_images_discarded(event_id, image_ids, discarded)
    return {"updated": updated, "discarded": discarded}

# ----- Endpoints Públicos (sem autenticação) -----
@app.get("/public/events/{event_id}")
def public_event_info(event_id: int):
    ev = get_event_by_id(event_id)
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evento não encontrado.")
    # monta URLs públicas
    photo_url = _to_static_url(ev.get("photo_path") or "")
    # fotógrafos enriquecidos
    photographers_info = []
    for uname in (ev.get("photographers") or []):
        u = get_user(uname) or {}
        prof_rel = u.get("profile_photo_path") or ""
        prof_url = _to_static_url(prof_rel) if prof_rel else ""
        photographers_info.append({
            "username": uname,
            "full_name": u.get("full_name") or uname,
            "profile_photo_url": prof_url,
        })
    # INCLUIR OWNER também como fotógrafo para exibição pública
    owner_uname = ev.get("owner_username") or ""
    if owner_uname and not any(p.get("username") == owner_uname for p in photographers_info):
        ou = get_user(owner_uname) or {}
        o_prof_rel = ou.get("profile_photo_path") or ""
        o_prof_url = _to_static_url(o_prof_rel) if o_prof_rel else ""
        photographers_info.append({
            "username": owner_uname,
            "full_name": ou.get("full_name") or owner_uname,
            "profile_photo_url": o_prof_url,
        })
    return {
        "id": ev["id"],
        "name": ev["name"],
        "description": ev["description"],
        "photo_url": photo_url,
        "photographers": photographers_info,
        "owner_username": owner_uname,
    }

from fastapi import UploadFile, File
from storage_gallery import face_search_in_event

@app.post("/public/events/{event_id}/face-search")
async def public_event_face_search(event_id: int, file: UploadFile = File(...)):
    ev = get_event_by_id(event_id)
    if not ev:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Evento não encontrado.")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Imagem inválida.")
    matches = face_search_in_event(event_id, data)
    return {"count": len(matches), "matches": matches}

@app.post("/public/purchase")
def public_purchase(payload: dict):
    """
    Mock de compra: aprova sempre, grava um registro leve e retorna sucesso.
    payload: { event_id: int, items: [ids], buyer: { name, email, cpf }, total_brl: number }
    """
    try:
        event_id = int(payload.get("event_id"))
    except Exception:
        raise HTTPException(status_code=400, detail="event_id inválido.")
    items = list(payload.get("items") or [])
    buyer = dict(payload.get("buyer") or {})
    total_brl = payload.get("total_brl")
    # log simples
    base_dir = os.path.join(os.path.dirname(__file__), "media", "events", str(event_id), "purchases")
    os.makedirs(base_dir, exist_ok=True)
    fname = datetime.now(timezone.utc).strftime("purchase_%Y%m%d%H%M%S.json")
    path = os.path.join(base_dir, fname)
    try:
        import json
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"items": items, "buyer": buyer, "total_brl": total_brl}, f, ensure_ascii=False, indent=2)
    except Exception:
        pass
    # NOVO: creditar saldo ao dono do evento
    ev = get_event_by_id(event_id)
    owner = (ev or {}).get("owner_username") or ""
    if owner:
        try:
            record_purchase(event_id, owner, items, buyer, float(total_brl or 0))
        except Exception:
            # silencioso
            pass
    return {"success": True, "message": "Pagamento aprovado. As fotos serão enviadas para seu e-mail."}


# ----- Editor de Imagem (autenticado) -----
@app.post("/image-editor/upload")
async def image_editor_upload(request: Request, file: UploadFile = File(...)):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    content = await file.read()
    saved = save_original(content, file.filename)
    return saved

@app.post("/image-editor/process")
def image_editor_process(payload: dict, request: Request):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    image_id = str(payload.get("image_id") or "")
    if not image_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="image_id obrigatório.")
    params = dict(payload.get("params") or {})
    out = process_image(image_id, params)
    return out

@app.get("/image-editor/meta/{image_id}")
def image_editor_meta(image_id: str, request: Request):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    return get_metadata(image_id)

@app.get("/image-editor/histogram/{image_id}")
def image_editor_histogram(image_id: str, request: Request):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    return get_histogram_and_sharpness(image_id)

@app.get("/image-editor/pose/{image_id}")
def image_editor_pose(image_id: str, request: Request):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    return get_pose_landmarks(image_id)

# ----- LUTs (presets por usuário, autenticado) -----

@app.get("/luts", response_model=ListLUTsResponse)
def luts_list(request: Request):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    presets_raw = get_luts_for_user(data["username"])
    presets = [LUTPreset(**p) for p in presets_raw]
    return ListLUTsResponse(count=len(presets), presets=presets)

@app.post("/luts", response_model=AddLUTResponse)
def luts_add(payload: AddLUTRequest, request: Request):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    if not (payload.name or "").strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nome do LUT é obrigatório.")
    created = add_lut(
        data["username"],
        payload.name,
        payload.description,
        payload.params,
        payload.thumb_source_url,
    )
    return AddLUTResponse(success=True, message="LUT salvo com sucesso.", preset=LUTPreset(**created))

@app.delete("/luts/{lut_id}", response_model=DeleteLUTResponse)
def luts_delete(lut_id: int, request: Request):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    ok = delete_lut(lut_id, data["username"])
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LUT não encontrado.")
    return DeleteLUTResponse(success=True, message="LUT removido com sucesso.")

# ----- Finance (autenticado) -----
@app.get("/finance/summary")
def finance_summary(request: Request, start: Optional[str] = None, end: Optional[str] = None):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    # sumário do usuário logado (fotógrafo / owner)
    summary = get_finance_summary(data["username"], start, end)
    return summary

@app.get("/finance/purchases")
def finance_purchases(request: Request, start: Optional[str] = None, end: Optional[str] = None):
    token = request.cookies.get("session")
    data = _verify_session_token(token or "")
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    lst = list_finance_purchases(data["username"], start, end)
    return {"count": len(lst), "purchases": lst}

# === Serviços (catálogo) ===
from typing import Dict, Any
from storage_services import get_all_services, add_service, update_service, delete_service

@app.get("/services")
def services_list(request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    return {"services": get_all_services()}

@app.post("/services")
def services_add(payload: Dict[str, Any], request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    name = str(payload.get("name") or "").strip()
    description = str(payload.get("description") or "").strip()
    price_brl = float(payload.get("price_brl") or 0)
    payment_type = str(payload.get("payment_type") or "avista")
    installments_months = int(payload.get("installments_months") or 0)
    down_payment = float(payload.get("down_payment") or 0)
    if not name or price_brl <= 0:
        raise HTTPException(status_code=400, detail="Nome e valor do serviço são obrigatórios.")
    created = add_service(name, price_brl, payment_type, installments_months, down_payment, description)
    return {"service": created}

@app.put("/services/{service_id}")
def services_update(service_id: int, payload: Dict[str, Any], request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    updated = update_service(service_id,
                             name=str(payload.get("name") or "") or None,
                             price_brl=(payload.get("price_brl") if payload.get("price_brl") is not None else None),
                             payment_type=str(payload.get("payment_type") or "") or None,
                             installments_months=(payload.get("installments_months") if payload.get("installments_months") is not None else None),
                             down_payment=(payload.get("down_payment") if payload.get("down_payment") is not None else None),
                             description=str(payload.get("description") or "") or None)
    if not updated:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")
    return {"service": updated}

@app.delete("/services/{service_id}")
def services_delete(service_id: int, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    ok = delete_service(service_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Serviço não encontrado.")
    return {"success": True}

# === Gastos (despesas) ===
from storage_expenses import get_all_expenses, add_expense, update_expense, delete_expense
from storage_expenses import list_expense_files, save_expense_file, delete_expense_file

@app.get("/expenses")
def expenses_list(request: Request, start: Optional[str] = None, end: Optional[str] = None, status: Optional[str] = None, sort: Optional[str] = None):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    items = get_all_expenses()

    # filtros por data/status
    def _parse_date(s: Optional[str]) -> Optional[datetime]:
        if not s:
            return None
        try:
            if len(s) == 10:
                return datetime.fromisoformat(s + "T00:00:00+00:00")
            return datetime.fromisoformat(s)
        except Exception:
            return None
    sdt = _parse_date(start)
    edt = _parse_date(end)
    out = []
    for it in items:
        try:
            ts = datetime.fromisoformat(it.get("created_at") or "")
        except Exception:
            ts = None
        if sdt and ts and ts < sdt:
            continue
        if edt and ts and ts > edt:
            continue
        if status and status in ("ativo", "inativo") and (it.get("status") != status):
            continue
        out.append(it)

    # ordenação
    if sort == "date_asc":
        out.sort(key=lambda x: x.get("created_at") or "")
    elif sort == "date_desc":
        out.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    elif sort == "price_asc":
        out.sort(key=lambda x: float(x.get("price_brl") or 0))
    elif sort == "price_desc":
        out.sort(key=lambda x: float(x.get("price_brl") or 0), reverse=True)

    return {"count": len(out), "expenses": out}

@app.post("/expenses")
def expenses_add(payload: Dict[str, Any], request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    name = str(payload.get("name") or "").strip()
    description = str(payload.get("description") or "").strip()
    price_brl = float(payload.get("price_brl") or 0)
    payment_type = str(payload.get("payment_type") or "avista")
    installments_months = int(payload.get("installments_months") or 0)
    down_payment = float(payload.get("down_payment") or 0)
    status = str(payload.get("status") or "ativo")
    due_date = str(payload.get("due_date") or "").strip()
    if not name or price_brl <= 0:
        raise HTTPException(status_code=400, detail="Nome e valor do gasto são obrigatórios.")
    created = add_expense(name, description, price_brl, payment_type, installments_months, down_payment, status if status in ("ativo", "inativo") else "ativo", due_date)
    return {"expense": created}

@app.put("/expenses/{expense_id}")
def expenses_update(expense_id: int, payload: Dict[str, Any], request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    updated = update_expense(
        expense_id,
        name=(payload.get("name") if payload.get("name") is not None else None),
        description=(payload.get("description") if payload.get("description") is not None else None),
        price_brl=(payload.get("price_brl") if payload.get("price_brl") is not None else None),
        payment_type=(payload.get("payment_type") if payload.get("payment_type") is not None else None),
        installments_months=(payload.get("installments_months") if payload.get("installments_months") is not None else None),
        down_payment=(payload.get("down_payment") if payload.get("down_payment") is not None else None),
        status=(payload.get("status") if payload.get("status") is not None else None),
        due_date=(payload.get("due_date") if payload.get("due_date") is not None else None),
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Gasto não encontrado.")
    return {"expense": updated}

# === Vínculos Cliente-Serviço ===
from storage_client_services import list_assignments, add_assignment, update_assignment, delete_assignment

@app.get("/client-services")
def client_services_list(request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    return {"assignments": list_assignments()}

@app.post("/client-services")
def client_services_add(payload: Dict[str, Any], request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    client_id = int(payload.get("client_id") or 0)
    service_id = int(payload.get("service_id") or 0)
    discount_percent = float(payload.get("discount_percent") or 0)
    notes = str(payload.get("notes") or "")[:500]
    discount_type = str(payload.get("discount_type") or "percent")
    discount_value = float(payload.get("discount_value") or 0)
    start_due_date = str(payload.get("start_due_date") or "").strip()
    created = add_assignment(client_id, service_id, discount_percent, notes, discount_type, discount_value, start_due_date)
    return {"assignment": created}

@app.put("/client-services/{assignment_id}")
def client_services_update(assignment_id: int, payload: Dict[str, Any], request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    updated = update_assignment(assignment_id,
                                status=payload.get("status"),
                                discount_percent=(payload.get("discount_percent") if payload.get("discount_percent") is not None else None),
                                notes=(payload.get("notes") if payload.get("notes") is not None else None),
                                discount_type=(payload.get("discount_type") if payload.get("discount_type") is not None else None),
                                discount_value=(payload.get("discount_value") if payload.get("discount_value") is not None else None),
                                start_due_date=(payload.get("start_due_date") if payload.get("start_due_date") is not None else None))
    if not updated:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado.")
    return {"assignment": updated}

# === Controle financeiro ===
from storage_control import list_month_items, record_payment, month_summary

@app.get("/control")
def control_list(request: Request, month: Optional[str] = None, view: Optional[str] = "expenses"):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    m = month or datetime.utcnow().strftime("%Y-%m")
    v = view if view in ("expenses", "services") else "expenses"
    items = list_month_items(m, v)
    return {"month": m, "view": v, "count": len(items), "items": items}

@app.post("/control/pay")
def control_pay(payload: Dict[str, Any], request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    tp = str(payload.get("type") or "")
    ref_id = int(payload.get("ref_id") or 0)
    due_date = str(payload.get("due_date") or "")
    amount = float(payload.get("amount") or 0)
    if not tp or ref_id <= 0 or not due_date or amount <= 0:
        raise HTTPException(status_code=400, detail="Campos obrigatórios: type, ref_id, due_date, amount.")
    res = record_payment(tp, ref_id, due_date, amount)
    return res

@app.get("/control/summary")
def control_summary(request: Request, month: Optional[str] = None):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    m = month or datetime.utcnow().strftime("%Y-%m")
    return month_summary(m)

# === Hierarquia de localidades (autenticado) ===
@app.get("/hierarchy")
def hierarchy_list(request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    return hierarchy_list_all()

# ADDED: categorias (add/remove)
@app.post("/hierarchy/categories")
def hierarchy_category_add(request: Request, payload: Dict[str, Any] = Body(...)):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome da categoria é obrigatório.")
    cats = hierarchy_add_category(name)
    return {"categories": cats}

@app.delete("/hierarchy/categories")
def hierarchy_category_delete(request: Request, payload: Dict[str, Any] = Body(...)):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome da categoria é obrigatório.")
    cats = hierarchy_remove_category(name)
    return {"categories": cats}

@app.post("/hierarchy/root")
def hierarchy_add_root_endpoint(payload: Dict[str, Any], request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome é obrigatório.")
    responsibles = list(payload.get("responsibles") or [])
    if not responsibles:
        raise HTTPException(status_code=400, detail="Informe pelo menos um responsável.")
    node = hierarchy_add_root(
        name=name,
        description=str(payload.get("description") or ""),
        color=str(payload.get("color") or ""),
        category=str(payload.get("category") or ""),
        responsibles=responsibles,
    )
    return {"node": node}

@app.post("/hierarchy/{parent_id}/child")
def hierarchy_add_child_endpoint(parent_id: str, payload: Dict[str, Any], request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome é obrigatório.")
    responsibles = list(payload.get("responsibles") or [])
    if not responsibles:
        raise HTTPException(status_code=400, detail="Informe pelo menos um responsável.")
    node = hierarchy_add_child(
        parent_id=parent_id,
        name=name,
        description=str(payload.get("description") or ""),
        color=str(payload.get("color") or ""),
        category=str(payload.get("category") or ""),
        responsibles=responsibles,
    )
    if not node:
        raise HTTPException(status_code=404, detail="Pai não encontrado.")
    return {"node": node}

@app.put("/hierarchy/{node_id}")
def hierarchy_update_endpoint(node_id: str, payload: Dict[str, Any], request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    node = hierarchy_update_node(
        node_id=node_id,
        name=payload.get("name"),
        description=payload.get("description"),
        color=payload.get("color"),
        category=payload.get("category"),
        responsibles=payload.get("responsibles"),
    )
    if not node:
        raise HTTPException(status_code=404, detail="Nó não encontrado.")
    return {"node": node}

@app.delete("/hierarchy/{node_id}")
def hierarchy_delete_endpoint(node_id: str, request: Request):
    token = request.cookies.get("session")
    if not token or not _verify_session_token(token):
        raise HTTPException(status_code=401, detail="Não autenticado.")
    ok = hierarchy_delete_node(node_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Nó não encontrado.")
    return {"success": True}

# === Ativos por unidade (protegido por acesso às Unidades) ===
@app.get("/units/{unit_id}/assets", response_model=AssetListResponse)
def unit_assets_list(unit_id: str, request: Request, q: Optional[str] = None, sort: Optional[str] = "name_asc"):
    _require_page_access(request, "hierarchy")
    if unit_id == "all":
        items = get_all_assets_flat()
    else:
        items = assets_list(unit_id)
    term = (q or "").strip().lower()
    if term:
        items = [it for it in items if term in (it.get("name","")+ " " + it.get("description","")+ " " + it.get("item_code","")).lower()]
    if sort == "name_asc":
        items.sort(key=lambda x: x.get("name","").lower())
    elif sort == "name_desc":
        items.sort(key=lambda x: x.get("name","").lower(), reverse=True)
    elif sort == "created_desc":
        items.sort(key=lambda x: x.get("created_at",""), reverse=True)
    elif sort == "created_asc":
        items.sort(key=lambda x: x.get("created_at",""))
    assets = [Asset(**it) for it in items]
    return AssetListResponse(count=len(assets), assets=assets)

@app.post("/units/{unit_id}/assets", response_model=Asset)
def unit_assets_add(unit_id: str, payload: AddAssetRequest, request: Request):
    user = _require_page_access(request, "hierarchy")
    created = assets_add(unit_id, payload.dict(), user["username"])
    try:
        details = f"Novo ativo: {created.get('name')}"
        if created.get("quantity") is not None:
            details += f" (Qtd: {created.get('quantity')} {created.get('unit') or ''})"
        append_log(user["username"], "asset:create", unit_id, int(created.get("id") or 0), details)
    except Exception:
        pass
    return Asset(**created)

@app.put("/assets/{asset_id}", response_model=Asset)
def unit_assets_update(asset_id: int, payload: UpdateAssetRequest, request: Request):
    user = _require_page_access(request, "hierarchy")
    updated = assets_update(asset_id, payload.dict())
    if not updated:
        raise HTTPException(status_code=404, detail="Ativo não encontrado.")
    try:
        details = f"Atualizado: {updated.get('name')}"
        if updated.get("quantity") is not None:
            details += f" (Qtd: {updated.get('quantity')} {updated.get('unit') or ''})"
        append_log(user["username"], "asset:update", updated.get("unit_id"), int(updated.get("id") or 0), details)
    except Exception:
        pass
    return Asset(**updated)

@app.delete("/assets/{asset_id}")
def unit_assets_delete(asset_id: int, request: Request):
    user = _require_page_access(request, "hierarchy")
    all_assets = get_all_assets_flat()
    asset_to_delete = next((a for a in all_assets if a.get("id") == asset_id), None)
    
    ok = assets_delete(asset_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Ativo não encontrado.")
    
    if asset_to_delete:
        try:
            details = f"Excluído: {asset_to_delete.get('name')}"
            if asset_to_delete.get("quantity") is not None:
                details += f" (Qtd: {asset_to_delete.get('quantity')} {asset_to_delete.get('unit') or ''})"
            append_log(user["username"], "asset:delete", asset_to_delete.get("unit_id"), asset_id, details)
        except Exception:
            pass
    return {"success": True}

# Categorias de ativos (separadas das de Unidades)
@app.get("/asset-categories", response_model=CategoryListResponse)
def asset_categories_list(request: Request):
    _require_page_access(request, "hierarchy")
    return CategoryListResponse(categories=assets_list_categories())

@app.post("/asset-categories", response_model=CategoryListResponse)
def asset_categories_add(payload: Dict[str, Any], request: Request):
    _require_page_access(request, "hierarchy")
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome da categoria é obrigatório.")
    cats = assets_add_category(name)
    return CategoryListResponse(categories=cats)

@app.delete("/asset-categories", response_model=CategoryListResponse)
def asset_categories_delete(payload: Dict[str, Any], request: Request):
    _require_page_access(request, "hierarchy")
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome da categoria é obrigatório.")
    cats = assets_remove_category(name)
    return CategoryListResponse(categories=cats)

# Logs (protegido por acesso às Unidades)
@app.get("/logs", response_model=LogListResponse)
def list_logs_endpoint(request: Request, start: Optional[str] = None, end: Optional[str] = None, user: Optional[str] = None, action: Optional[str] = None, q: Optional[str] = None):
    _require_page_access(request, "hierarchy")
    rows = logs_list(start, end, user, action, q)
    items = [LogItem(**r) for r in rows]
    return LogListResponse(count=len(items), logs=items)