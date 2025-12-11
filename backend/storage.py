import csv
import os
import base64
from typing import Optional, Dict, List

from security import hash_password

USERS_CSV_PATH = os.environ.get(
    "USERS_CSV_PATH",
    os.path.join(os.path.dirname(__file__), "users.csv"),
)

MEDIA_USERS_DIR = os.path.join(os.path.dirname(__file__), "media", "users")
CSV_FIELDS = ["username", "password_hash", "role", "full_name", "profile_photo_path", "allowed_pages"]


def _ensure_csv():
    os.makedirs(os.path.dirname(USERS_CSV_PATH), exist_ok=True)
    # Se não existe, cria com os novos campos
    if not os.path.exists(USERS_CSV_PATH):
        with open(USERS_CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
            writer.writeheader()
        return

    # Se existe, verifica se tem todos os campos; se não, migra
    with open(USERS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        try:
            reader = csv.DictReader(f)
            existing_fields = reader.fieldnames or []
            missing = [c for c in CSV_FIELDS if c not in existing_fields]
            if missing:
                rows = list(reader)
        except Exception:
            existing_fields = []
            missing = CSV_FIELDS
            rows = []

    if missing:
        # Regrava com novo cabeçalho, preservando dados existentes
        with open(USERS_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
            writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
            writer.writeheader()
            for row in rows:
                new_row = {
                    "username": row.get("username", ""),
                    "password_hash": row.get("password_hash", ""),
                    "role": row.get("role", ""),
                    "full_name": row.get("full_name", ""),
                    "profile_photo_path": row.get("profile_photo_path", ""),
                    "allowed_pages": row.get("allowed_pages", ""),
                }
                writer.writerow(new_row)


def _safe_filename(name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in name)


def _save_profile_photo(username: str, photo_base64: Optional[str]) -> Optional[str]:
    if not photo_base64:
        return None
    os.makedirs(MEDIA_USERS_DIR, exist_ok=True)
    # data URL (ex.: data:image/png;base64,xxx)
    ext = "png"
    data_part = photo_base64
    if photo_base64.startswith("data:"):
        header, data_part = photo_base64.split(",", 1)
        try:
            mime = header.split(";")[0].split(":")[1]
            if mime == "image/jpeg":
                ext = "jpg"
            elif mime == "image/webp":
                ext = "webp"
            elif mime == "image/png":
                ext = "png"
        except Exception:
            ext = "png"
    safe = _safe_filename(username)
    file_path = os.path.join(MEDIA_USERS_DIR, f"{safe}.{ext}")
    with open(file_path, "wb") as imgf:
        imgf.write(base64.b64decode(data_part))
    # retorna caminho relativo ao backend
    rel_path = os.path.relpath(file_path, os.path.dirname(__file__))
    return rel_path


def _parse_pages(raw: str) -> List[str]:
    raw = (raw or "").strip()
    if not raw:
        return []
    return [p for p in raw.split(",") if p]


def _serialize_pages(pages: Optional[List[str]]) -> str:
    if not pages:
        return ""
    return ",".join(sorted(set(pages)))


def get_user(username: str) -> Optional[Dict[str, str]]:
    _ensure_csv()
    with open(USERS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("username") == username:
                return {
                    "username": row.get("username", ""),
                    "password_hash": row.get("password_hash", ""),
                    "role": row.get("role", ""),
                    "full_name": row.get("full_name", ""),
                    "profile_photo_path": row.get("profile_photo_path", ""),
                    "allowed_pages": _parse_pages(row.get("allowed_pages", "")),
                }
    return None


def get_all_users() -> List[Dict[str, str]]:
    _ensure_csv()
    out: List[Dict[str, str]] = []
    with open(USERS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            out.append({
                "username": row.get("username", ""),
                "password_hash": row.get("password_hash", ""),
                "role": row.get("role", ""),
                "full_name": row.get("full_name", ""),
                "profile_photo_path": row.get("profile_photo_path", ""),
                "allowed_pages": _parse_pages(row.get("allowed_pages", "")),
            })
    return out


def add_user(username: str, password: str, role: str, full_name: str, profile_photo_base64: Optional[str] = None, allowed_pages: Optional[List[str]] = None) -> Optional[str]:
    """
    Adiciona usuário com a senha HASHEADA (não armazenamos senha em texto puro).
    Salva opcionalmente uma foto de perfil em backend/media/users e grava o caminho relativo no CSV.
    Também salva as páginas permitidas (allowed_pages).
    """
    _ensure_csv()
    # Evita duplicatas
    existing = get_user(username)
    if existing:
        raise ValueError("Usuário já existe.")
    password_hash = hash_password(password)
    photo_path = _save_profile_photo(username, profile_photo_base64)
    with open(USERS_CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writerow({
            "username": username,
            "password_hash": password_hash,
            "role": role,
            "full_name": full_name,
            "profile_photo_path": photo_path or "",
            "allowed_pages": _serialize_pages(allowed_pages),
        })
    return photo_path


def update_user(username: str, full_name: Optional[str] = None, role: Optional[str] = None, password: Optional[str] = None, profile_photo_base64: Optional[str] = None, allowed_pages: Optional[List[str]] = None) -> Optional[Dict[str, str]]:
    """
    Atualiza dados do usuário. Retorna o registro atualizado ou None se não encontrado.
    """
    _ensure_csv()
    updated = None
    rows = []
    with open(USERS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("username") == username:
                if full_name is not None:
                    row["full_name"] = full_name
                if role is not None:
                    row["role"] = role
                if password is not None and password.strip():
                    row["password_hash"] = hash_password(password)
                if profile_photo_base64 is not None:
                    photo_path = _save_profile_photo(username, profile_photo_base64)
                    row["profile_photo_path"] = photo_path or ""
                if allowed_pages is not None:
                    row["allowed_pages"] = _serialize_pages(allowed_pages)
                updated = {
                    "username": row.get("username", ""),
                    "password_hash": row.get("password_hash", ""),
                    "role": row.get("role", ""),
                    "full_name": row.get("full_name", ""),
                    "profile_photo_path": row.get("profile_photo_path", ""),
                    "allowed_pages": _parse_pages(row.get("allowed_pages", "")),
                }
            rows.append(row)

    if updated is None:
        return None

    with open(USERS_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
        writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    return updated


def delete_user(username: str) -> bool:
    """
    Remove usuário do CSV. Não remove a foto de perfil para manter cache estático simples.
    Retorna True se removido; False se não encontrado.
    """
    _ensure_csv()
    rows = []
    removed = False
    with open(USERS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("username") == username:
                removed = True
                continue
            rows.append(row)
    if not removed:
        return False
    with open(USERS_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
        writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return True