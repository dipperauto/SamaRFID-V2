import os
from fastapi import FastAPI, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from hashlib import sha256

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

@app.get("/health")
def health():
    return {"status": "ok", "adminConfigured": bool(ADMIN_TOKEN)}

@app.get("/auth/token-check")
def token_check():
    masked = sha256(ADMIN_TOKEN.encode()).hexdigest()[:8] if ADMIN_TOKEN else None
    return {"adminConfigured": bool(ADMIN_TOKEN), "tokenPreview": masked}

@app.post("/auth/login", response_model=LoginResponse)
def auth_login(payload: LoginRequest):
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
    return LoginResponse(success=True, role=user["role"])


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