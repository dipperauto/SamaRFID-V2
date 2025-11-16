import os
from fastapi import FastAPI, HTTPException, status, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional

from models import LoginRequest, LoginResponse, AddUserRequest, AddUserResponse, HashPasswordResponse
from storage import get_user, add_user
from security import verify_password, hash_password

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
        add_user(payload.username, payload.password, payload.role)
        return AddUserResponse(success=True, message="Usuário cadastrado com sucesso.")
    except ValueError as e:
        # Usuário já existe
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

    uvicorn.run("backend.app:app", host=host, port=port, reload=True)