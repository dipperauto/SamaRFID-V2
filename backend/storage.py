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
CSV_FIELDS = ["username", "password_hash", "role", "full_name", "profile_photo_path", "allowed_pages", "cpf", "birth_date", "rg", "admission_date", "sector"]


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
                    # ADDED: default vazio em migração
                    "cpf": row.get("cpf", ""),
                    "birth_date": row.get("birth_date", ""),
                    "rg": row.get("rg", ""),
                    "admission_date": row.get("admission_date", ""),
                    "sector": row.get("sector", ""),
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
                    # ADDED: extras
                    "cpf": row.get("cpf", "") or "",
                    "birth_date": row.get("birth_date", "") or "",
                    "rg": row.get("rg", "") or "",
                    "admission_date": row.get("admission_date", "") or "",
                    "sector": row.get("sector", "") or "",
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
                # ADDED: extras
                "cpf": row.get("cpf", "") or "",
                "birth_date": row.get("birth_date", "") or "",
                "rg": row.get("rg", "") or "",
                "admission_date": row.get("admission_date", "") or "",
                "sector": row.get("sector", "") or "",
            })
    return out


def add_user(username: str, password: str, role: str, full_name: str, profile_photo_base64: Optional[str] = None, allowed_pages: Optional[List[str]] = None,
             cpf: Optional[str] = None, birth_date: Optional[str] = None, rg: Optional[str] = None, admission_date: Optional[str] = None, sector: Optional[str] = None) -> Optional[str]:
    """
    Adiciona usuário com a senha HASHEADA. Inclui campos opcionais (cpf, nascimento, rg, admissão, setor).
    """
    _ensure_csv()
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
            "cpf": (cpf or "").strip(),
            "birth_date": (birth_date or "").strip(),
            "rg": (rg or "").strip(),
            "admission_date": (admission_date or "").strip(),
            "sector": (sector or "").strip(),
        })
    return photo_path


def update_user(username: str, full_name: Optional[str] = None, role: Optional[str] = None, password: Optional[str] = None, profile_photo_base64: Optional[str] = None, allowed_pages: Optional[List[str]] = None,
                cpf: Optional[str] = None, birth_date: Optional[str] = None, rg: Optional[str] = None, admission_date: Optional[str] = None, sector: Optional[str] = None) -> Optional[Dict[str, str]]:
    """
    Atualiza dados do usuário, incluindo campos opcionais (cpf, nascimento, rg, admissão, setor).
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
                # ADDED: extras
                if cpf is not None:
                    row["cpf"] = cpf.strip()
                if birth_date is not None:
                    row["birth_date"] = birth_date.strip()
                if rg is not None:
                    row["rg"] = rg.strip()
                if admission_date is not None:
                    row["admission_date"] = admission_date.strip()
                if sector is not None:
                    row["sector"] = sector.strip()

                updated = {
                    "username": row.get("username", ""),
                    "password_hash": row.get("password_hash", ""),
                    "role": row.get("role", ""),
                    "full_name": row.get("full_name", ""),
                    "profile_photo_path": row.get("profile_photo_path", ""),
                    "allowed_pages": _parse_pages(row.get("allowed_pages", "")),
                    "cpf": row.get("cpf", "") or "",
                    "birth_date": row.get("birth_date", "") or "",
                    "rg": row.get("rg", "") or "",
                    "admission_date": row.get("admission_date", "") or "",
                    "sector": row.get("sector", "") or "",
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