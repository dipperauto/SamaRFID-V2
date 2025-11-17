import os
from fastapi import FastAPI, HTTPException, status, Header, Response, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional
from hashlib import sha256
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from models import LoginRequest, LoginResponse, AddUserRequest, AddUserResponse, HashPasswordResponse
from storage import get_user, add_user
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


def _make_session_token(username: str, role: Optional[str]) -> str:
    exp = int((datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL)).timestamp())
    nonce = secrets.token_hex(8)
    payload = f"{username}|{role or ''}|{exp}|{nonce}"
    sig = hmac.new(SESSION_SECRET.encode(), payload.encode(), sha256).hexdigest()
    return f"v1|{payload}|{sig}"

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
        from storage import get_user
        user = get_user(username)
        if not user:
            return None
        return {"username": username, "role": role or user.get("role") or ""}
    except Exception:
        return None

@app.get("/health")
def health():
    return {"status": "ok", "adminConfigured": bool(ADMIN_TOKEN)}

@app.get("/auth/token-check")
def token_check():
    masked = sha256(ADMIN_TOKEN.encode()).hexdigest()[:8] if ADMIN_TOKEN else None
    return {"adminConfigured": bool(ADMIN_TOKEN), "tokenPreview": masked}

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
    return LoginResponse(success=True, role=user["role"])

@app.get("/auth/me", response_model=LoginResponse)
def auth_me(request: Request):
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Não autenticado.")
    data = _verify_session_token(token)
    if not data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sessão inválida ou expirada.")
    return LoginResponse(success=True, role=data.get("role"))

@app.post("/auth/logout")
def auth_logout(response: Response, request: Request):
    response.delete_cookie(key="session", domain=COOKIE_DOMAIN, path="/")
    return {"success": True}

@app.post("/users/register", response_model=AddUserResponse)
def users_register(payload: AddUserRequest, x_admin_token: Optional[str] = Header(None, alias="x-admin-token")):
    token = (x_admin_token or "").strip()
    if not ADMIN_TOKEN or token != ADMIN_TOKEN:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token de administrador inválido.")
    try:
        photo_path = add_user(
            payload.username,
            payload.password,
            payload.role,
            payload.full_name,
            payload.profile_photo_base64,
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