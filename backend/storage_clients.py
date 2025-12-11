import csv
import os
import base64
from typing import Optional, Dict, List, Tuple

CLIENTS_CSV_PATH = os.environ.get(
    "CLIENTS_CSV_PATH",
    os.path.join(os.path.dirname(__file__), "clients.csv"),
)

MEDIA_ROOT = os.path.join(os.path.dirname(__file__), "media")
MEDIA_CLIENTS_DIR = os.path.join(MEDIA_ROOT, "clients")  # fotos de perfil
MEDIA_CLIENTS_FILES_DIR = os.path.join(MEDIA_ROOT, "clients_files")  # anexos

CSV_FIELDS = [
    "id",
    "full_name",
    "doc",
    "address",
    "phone",
    "profile_photo_path",
    "pix_key",
    "bank_data",
    "municipal_registration",
    "state_registration",
    "corporate_name",  # Razão Social
    "trade_name",      # Nome Fantasia
    "notes",
    "email",           # ADDED
]


def _ensure_csv():
    os.makedirs(os.path.dirname(CLIENTS_CSV_PATH), exist_ok=True)
    if not os.path.exists(CLIENTS_CSV_PATH):
        with open(CLIENTS_CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
            writer.writeheader()
        return

    with open(CLIENTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        try:
            reader = csv.DictReader(f)
            existing_fields = reader.fieldnames or []
            missing = [c for c in CSV_FIELDS if c not in existing_fields]
            rows = list(reader) if missing else []
        except Exception:
            existing_fields = []
            missing = CSV_FIELDS
            rows = []

    if missing:
        with open(CLIENTS_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
            writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
            writer.writeheader()
            for row in rows:
                new_row = {
                    "id": row.get("id", ""),
                    "full_name": row.get("full_name", ""),
                    "doc": row.get("doc", ""),
                    "address": row.get("address", ""),
                    "phone": row.get("phone", ""),
                    "profile_photo_path": row.get("profile_photo_path", ""),
                    "pix_key": row.get("pix_key", ""),
                    "bank_data": row.get("bank_data", ""),
                    "municipal_registration": row.get("municipal_registration", ""),
                    "state_registration": row.get("state_registration", ""),
                    "corporate_name": row.get("corporate_name", ""),
                    "trade_name": row.get("trade_name", ""),
                    "notes": row.get("notes", ""),
                    "email": row.get("email", ""),
                }
                writer.writerow(new_row)


def _safe_filename(name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in ("-", "_", ".", " ") else "_" for ch in name).strip().replace(" ", "_")


def _next_id() -> int:
    _ensure_csv()
    max_id = 0
    with open(CLIENTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                rid = int(row.get("id", "0") or "0")
                if rid > max_id:
                    max_id = rid
            except Exception:
                continue
    return max_id + 1


def _save_profile_photo(basename_hint: str, photo_base64: Optional[str]) -> Optional[str]:
    if not photo_base64:
        return None
    os.makedirs(MEDIA_CLIENTS_DIR, exist_ok=True)
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
    safe = _safe_filename(basename_hint)
    file_path = os.path.join(MEDIA_CLIENTS_DIR, f"{safe}.{ext}")
    with open(file_path, "wb") as imgf:
        imgf.write(base64.b64decode(data_part))
    # retorna caminho acessível via /static
    rel_path_from_media = os.path.relpath(file_path, MEDIA_ROOT)
    return f"static/{rel_path_from_media.replace(os.sep, '/')}"


def get_all_clients() -> List[Dict[str, str]]:
    _ensure_csv()
    result: List[Dict[str, str]] = []
    with open(CLIENTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            result.append({
                "id": row.get("id", ""),
                "full_name": row.get("full_name", ""),
                "doc": row.get("doc", ""),
                "address": row.get("address", ""),
                "phone": row.get("phone", ""),
                "profile_photo_path": row.get("profile_photo_path", ""),
                "pix_key": row.get("pix_key", ""),
                "bank_data": row.get("bank_data", ""),
                "municipal_registration": row.get("municipal_registration", ""),
                "state_registration": row.get("state_registration", ""),
                "corporate_name": row.get("corporate_name", ""),
                "trade_name": row.get("trade_name", ""),
                "notes": row.get("notes", ""),
                "email": row.get("email", ""),
            })
    return result


def add_client(
    full_name: str,
    doc: str,
    address: str,
    phone: str,
    profile_photo_base64: Optional[str] = None,
    pix_key: Optional[str] = None,
    bank_data: Optional[str] = None,
    municipal_registration: Optional[str] = None,
    state_registration: Optional[str] = None,
    corporate_name: Optional[str] = None,
    trade_name: Optional[str] = None,
    notes: Optional[str] = None,
    email: Optional[str] = None,
) -> Dict[str, str]:
    _ensure_csv()
    client_id = _next_id()
    photo_path = _save_profile_photo(f"client_{client_id}", profile_photo_base64)
    with open(CLIENTS_CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writerow({
            "id": str(client_id),
            "full_name": full_name,
            "doc": doc,
            "address": address,
            "phone": phone,
            "profile_photo_path": photo_path or "",
            "pix_key": pix_key or "",
            "bank_data": bank_data or "",
            "municipal_registration": municipal_registration or "",
            "state_registration": state_registration or "",
            "corporate_name": corporate_name or "",
            "trade_name": trade_name or "",
            "notes": notes or "",
            "email": email or "",
        })
    return {
        "id": str(client_id),
        "full_name": full_name,
        "doc": doc,
        "address": address,
        "phone": phone,
        "profile_photo_path": photo_path or "",
        "pix_key": pix_key or "",
        "bank_data": bank_data or "",
        "municipal_registration": municipal_registration or "",
        "state_registration": state_registration or "",
        "corporate_name": corporate_name or "",
        "trade_name": trade_name or "",
        "notes": notes or "",
        "email": email or "",
    }


def update_client(
    client_id: int,
    full_name: Optional[str] = None,
    doc: Optional[str] = None,
    address: Optional[str] = None,
    phone: Optional[str] = None,
    profile_photo_base64: Optional[str] = None,
    pix_key: Optional[str] = None,
    bank_data: Optional[str] = None,
    municipal_registration: Optional[str] = None,
    state_registration: Optional[str] = None,
    corporate_name: Optional[str] = None,
    trade_name: Optional[str] = None,
    notes: Optional[str] = None,
    email: Optional[str] = None,
) -> Optional[Dict[str, str]]:
    _ensure_csv()
    updated = None
    rows = []
    with open(CLIENTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("id") == str(client_id):
                new_photo_path = row.get("profile_photo_path", "")
                if profile_photo_base64:
                    new_photo_path = _save_profile_photo(f"client_{client_id}", profile_photo_base64) or new_photo_path
                new_row = {
                    "id": str(client_id),
                    "full_name": full_name if full_name is not None else row.get("full_name", ""),
                    "doc": doc if doc is not None else row.get("doc", ""),
                    "address": address if address is not None else row.get("address", ""),
                    "phone": phone if phone is not None else row.get("phone", ""),
                    "profile_photo_path": new_photo_path or "",
                    "pix_key": pix_key if pix_key is not None else row.get("pix_key", ""),
                    "bank_data": bank_data if bank_data is not None else row.get("bank_data", ""),
                    "municipal_registration": municipal_registration if municipal_registration is not None else row.get("municipal_registration", ""),
                    "state_registration": state_registration if state_registration is not None else row.get("state_registration", ""),
                    "corporate_name": corporate_name if corporate_name is not None else row.get("corporate_name", ""),
                    "trade_name": trade_name if trade_name is not None else row.get("trade_name", ""),
                    "notes": notes if notes is not None else row.get("notes", ""),
                    "email": email if email is not None else row.get("email", ""),
                }
                rows.append(new_row)
                updated = new_row
            else:
                rows.append(row)
    if updated is None:
        return None
    with open(CLIENTS_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
        writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return updated


# ---------- Anexos por cliente (limite 50 MB por cliente) ----------

def _client_files_dir(client_id: int) -> str:
    path = os.path.join(MEDIA_CLIENTS_FILES_DIR, str(client_id))
    os.makedirs(path, exist_ok=True)
    return path


def list_client_files(client_id: int) -> List[Dict[str, str]]:
    base_dir = _client_files_dir(client_id)
    files = []
    for name in os.listdir(base_dir):
        file_path = os.path.join(base_dir, name)
        if not os.path.isfile(file_path):
            continue
        size = os.path.getsize(file_path)
        # caminho relativo para /static
        rel_path_from_media = os.path.relpath(file_path, MEDIA_ROOT)
        files.append({
            "name": name,
            "url": f"static/{rel_path_from_media.replace(os.sep, '/')}",
            "size_bytes": str(size),
        })
    return files


def total_client_files_size_bytes(client_id: int) -> int:
    base_dir = _client_files_dir(client_id)
    total = 0
    for name in os.listdir(base_dir):
        file_path = os.path.join(base_dir, name)
        if os.path.isfile(file_path):
            total += os.path.getsize(file_path)
    return total


def save_client_file(client_id: int, filename: str, content: bytes) -> Tuple[str, int, str]:
    """
    Salva um arquivo para o cliente e retorna (name, size_bytes, static_url).
    """
    base_dir = _client_files_dir(client_id)
    safe_name = _safe_filename(filename)
    full_path = os.path.join(base_dir, safe_name)
    with open(full_path, "wb") as f:
        f.write(content)
    rel_path_from_media = os.path.relpath(full_path, MEDIA_ROOT)
    return safe_name, os.path.getsize(full_path), f"static/{rel_path_from_media.replace(os.sep, '/')}"


def delete_client_file(client_id: int, filename: str) -> bool:
    base_dir = _client_files_dir(client_id)
    safe_name = _safe_filename(filename)
    full_path = os.path.join(base_dir, safe_name)
    if os.path.isfile(full_path):
        os.remove(full_path)
        return True
    return False


def delete_client(client_id: int) -> bool:
    """Remove cliente do CSV e apaga diretórios de mídia relacionados."""
    _ensure_csv()
    rows = []
    removed = False
    with open(CLIENTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("id") == str(client_id):
                removed = True
                continue
            rows.append(row)
    if not removed:
        return False
    with open(CLIENTS_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
        writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    try:
        # Apagar pasta de anexos e foto se existirem
        files_dir = os.path.join(MEDIA_CLIENTS_FILES_DIR, str(client_id))
        if os.path.isdir(files_dir):
            import shutil
            shutil.rmtree(files_dir, ignore_errors=True)
        # Não deletamos a imagem do perfil para manter cache estático simples
    except Exception:
        pass
    return True