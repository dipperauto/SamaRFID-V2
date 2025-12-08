import csv
import os
import shutil
import base64
import uuid
from typing import Optional, Dict, List, Tuple
from datetime import datetime

EVENTS_CSV_PATH = os.environ.get(
    "EVENTS_CSV_PATH",
    os.path.join(os.path.dirname(__file__), "events.csv"),
)

MEDIA_EVENTS_DIR = os.path.join(os.path.dirname(__file__), "media", "events")
CSV_FIELDS = [
    "id",
    "name",
    "description",
    "start_date",
    "end_date",
    "owner_username",
    "photo_path",
    "photographers_json",
    "created_at",
]

def _ensure_csv():
    os.makedirs(os.path.dirname(EVENTS_CSV_PATH), exist_ok=True)
    if not os.path.exists(EVENTS_CSV_PATH):
        with open(EVENTS_CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
            writer.writeheader()
        return
    # valida cabeçalho
    with open(EVENTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        try:
            reader = csv.DictReader(f)
            existing = reader.fieldnames or []
            missing = [c for c in CSV_FIELDS if c not in existing]
            rows = list(reader) if missing else []
        except Exception:
            existing = []
            missing = CSV_FIELDS
            rows = []
    if missing:
        with open(EVENTS_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
            writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
            writer.writeheader()
            for row in rows:
                new_row = {
                    "id": row.get("id", ""),
                    "name": row.get("name", ""),
                    "description": row.get("description", ""),
                    "start_date": row.get("start_date", ""),
                    "end_date": row.get("end_date", ""),
                    "owner_username": row.get("owner_username", ""),
                    "photo_path": row.get("photo_path", ""),
                    "photographers_json": row.get("photographers_json", "[]"),
                    "created_at": row.get("created_at", ""),
                }
                writer.writerow(new_row)

def _next_id() -> int:
    _ensure_csv()
    max_id = 0
    with open(EVENTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                rid = int(row.get("id", "0") or "0")
                if rid > max_id:
                    max_id = rid
            except Exception:
                continue
    return max_id + 1

def _safe_filename(name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in ("-", "_") else "_" for ch in name)

def _save_event_photo(event_id: int, photo_base64: Optional[str]) -> Optional[str]:
    if not photo_base64:
        return None
    os.makedirs(MEDIA_EVENTS_DIR, exist_ok=True)
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
    # gerar nome único para evitar conflito/uso de cache antigo
    unique = datetime.utcnow().strftime("%Y%m%d%H%M%S") + "_" + uuid.uuid4().hex[:8]
    file_path = os.path.join(MEDIA_EVENTS_DIR, f"event_{event_id}_{unique}.{ext}")
    with open(file_path, "wb") as imgf:
        imgf.write(base64.b64decode(data_part))
    rel_path = os.path.relpath(file_path, os.path.dirname(__file__))
    return rel_path

def add_event(
    name: str,
    description: str,
    start_date: str,
    end_date: str,
    owner_username: str,
    photographers: List[str],
    photo_base64: Optional[str] = None,
) -> Dict:
    _ensure_csv()
    event_id = _next_id()
    photo_path = _save_event_photo(event_id, photo_base64)
    created_at = datetime.utcnow().isoformat()
    import json as _json
    with open(EVENTS_CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writerow({
            "id": str(event_id),
            "name": name,
            "description": description,
            "start_date": start_date,
            "end_date": end_date,
            "owner_username": owner_username,
            "photo_path": photo_path or "",
            "photographers_json": _json.dumps(photographers, ensure_ascii=False),
            "created_at": created_at,
        })
    return {
        "id": event_id,
        "name": name,
        "description": description,
        "start_date": start_date,
        "end_date": end_date,
        "owner_username": owner_username,
        "photo_path": photo_path or None,
        "photographers": photographers,
    }

def get_events_for_user(username: str) -> List[Dict]:
    """
    Lista eventos onde o usuário é dono ou participante.
    """
    _ensure_csv()
    import json as _json
    out: List[Dict] = []
    with open(EVENTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                members = _json.loads(row.get("photographers_json", "[]"))
            except Exception:
                members = []
            owner = row.get("owner_username", "")
            if username == owner or username in members:
                out.append({
                    "id": int(row.get("id", "0") or "0"),
                    "name": row.get("name", ""),
                    "description": row.get("description", ""),
                    "start_date": row.get("start_date", ""),
                    "end_date": row.get("end_date", ""),
                    "owner_username": owner,
                    "photo_path": row.get("photo_path") or None,
                    "photographers": members,
                })
    return out

def get_event_by_id(event_id: int) -> Optional[Dict]:
    _ensure_csv()
    import json as _json
    with open(EVENTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                rid = int(row.get("id", "0") or "0")
            except Exception:
                continue
            if rid == event_id:
                try:
                    members = _json.loads(row.get("photographers_json", "[]"))
                except Exception:
                    members = []
                return {
                    "id": rid,
                    "name": row.get("name", ""),
                    "description": row.get("description", ""),
                    "start_date": row.get("start_date", ""),
                    "end_date": row.get("end_date", ""),
                    "owner_username": row.get("owner_username", ""),
                    "photo_path": row.get("photo_path") or None,
                    "photographers": members,
                }
    return None

def update_event(
    event_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    photographers: Optional[List[str]] = None,
    photo_base64: Optional[str] = None,
) -> Optional[Dict]:
    _ensure_csv()
    import json as _json
    updated_row = None
    rows = []
    with open(EVENTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)

    for row in rows:
        try:
            rid = int(row.get("id", "0") or "0")
        except Exception:
            rid = 0
        if rid == event_id:
            # merge updates
            row["name"] = name if name is not None else row.get("name", "")
            row["description"] = description if description is not None else row.get("description", "")
            row["start_date"] = start_date if start_date is not None else row.get("start_date", "")
            row["end_date"] = end_date if end_date is not None else row.get("end_date", "")
            if photographers is not None:
                row["photographers_json"] = _json.dumps(photographers, ensure_ascii=False)
            # photo update
            if photo_base64 is not None:
                # salva nova e substitui path
                new_path = _save_event_photo(event_id, photo_base64)
                row["photo_path"] = new_path or ""
            updated_row = row
            break

    if not updated_row:
        return None

    with open(EVENTS_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)

    # retorno normalizado
    try:
        members = _json.loads(updated_row.get("photographers_json", "[]"))
    except Exception:
        members = []
    return {
        "id": event_id,
        "name": updated_row.get("name", ""),
        "description": updated_row.get("description", ""),
        "start_date": updated_row.get("start_date", ""),
        "end_date": updated_row.get("end_date", ""),
        "owner_username": updated_row.get("owner_username", ""),
        "photo_path": updated_row.get("photo_path") or None,
        "photographers": members,
    }

def delete_event(event_id: int) -> bool:
    _ensure_csv()
    rows = []
    deleted = False
    photo_to_delete = None
    with open(EVENTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                rid = int(row.get("id", "0") or "0")
            except Exception:
                rid = 0
            if rid == event_id:
                deleted = True
                photo_to_delete = row.get("photo_path") or None
                continue
            rows.append(row)
    if not deleted:
        return False
    with open(EVENTS_CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    # remover arquivo da foto, se existir
    if photo_to_delete:
        abs_path = os.path.join(os.path.dirname(__file__), photo_to_delete)
        if os.path.exists(abs_path):
            os.remove(abs_path)
    # remover toda a pasta do evento (galeria, compras, etc.)
    try:
        ev_dir = os.path.join(MEDIA_EVENTS_DIR, str(event_id))
        if os.path.isdir(ev_dir):
            shutil.rmtree(ev_dir, ignore_errors=True)
    except Exception:
        pass
    return True