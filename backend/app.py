import os
from fastapi import FastAPI, HTTPException, status, Header, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from hashlib import sha256
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from models import LoginRequest, LoginResponse, AddUserRequest, AddUserResponse, HashPasswordResponse
from storage import get_user, add_user
from security import verify_password, hash_password

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
                # Agora: opcionalmente sobrescreve variáveis já existentes
                if key:
                    if override or key not in os.environ or not os.environ.get(key):
                        os.environ[key] = value
    except Exception:
        # Let errors bubble in normal flow; env loading is best-effort
        pass

def load_env_files(paths, override: bool = True):
    for p in paths:
        load_env_file(p, override=override)

# Load .env before reading variables
# UPDATED: tentar múltiplos caminhos e sobrescrever para garantir aplicação do ADMIN_TOKEN
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

# CORS: permite o frontend acessar este backend
frontend_url = os.environ.get("FRONTEND_URL")  # pode ser vazio
frontend_origin_regex = os.environ.get("FRONTEND_ORIGIN_REGEX", r"http://localhost:\d+$")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url] if frontend_url else [],
    allow_origin_regex=frontend_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "").strip()

# Configuração de cookie/sessão
SESSION_SECRET = os.environ.get("SESSION_SECRET", ADMIN_TOKEN or "dev-secret-change-me").strip()
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "").lower() in ("1", "true", "yes")
COOKIE_SAMESITE = os.environ.get("COOKIE_SAMESITE", "lax").lower()  # 'lax' por padrão; use 'none' + secure em domínios diferentes
COOKIE_DOMAIN = os.environ.get("COOKIE_DOMAIN", "").strip() or None
SESSION_TTL = int(os.environ.get("SESSION_TTL", "86400"))  # 24h por padrão

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
        # garante que usuário ainda existe
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
    # cria cookie de sessão HttpOnly
    token = _make_session_token(user["username"], user.get("role"))
    response.set_cookie(
        key="session",
        value=token,
        max_age=SESSION_TTL,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,  # 'lax' funciona bem em localhost; para domínios diferentes use 'none' + secure
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
    # Remove cookie de sessão
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


if __name__ == "__main__":
    # Execução local opcional
    host = os.environ.get("BACKEND_HOST", "0.0.0.0")
    port = int(os.environ.get("BACKEND_PORT", "8000"))
    import uvicorn

    uvicorn.run("app:app", host=host, port=port, reload=True)