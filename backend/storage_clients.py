import csv
import os
import base64
from typing import Optional, Dict, List

CLIENTS_CSV_PATH = os.environ.get(
    "CLIENTS_CSV_PATH",
    os.path.join(os.path.dirname(__file__), "clients.csv"),
)

MEDIA_CLIENTS_DIR = os.path.join(os.path.dirname(__file__), "media", "clients")
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
    "notes",
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
                    "notes": row.get("notes", ""),
                }
                writer.writerow(new_row)


def _safe_filename(name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in name)


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
    rel_path_from_media = os.path.relpath(file_path, os.path.join(os.path.dirname(__file__), "media"))
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
                "notes": row.get("notes", ""),
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
    notes: Optional[str] = None,
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
            "notes": notes or "",
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
        "notes": notes or "",
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
    notes: Optional[str] = None,
) -> Optional[Dict[str, str]]:
    _ensure_csv()
    updated = None
    rows = []
    with open(CLIENTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("id") == str(client_id):
                # atualiza com novos valores (mantém antigos se não enviados)
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
                    "notes": notes if notes is not None else row.get("notes", ""),
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