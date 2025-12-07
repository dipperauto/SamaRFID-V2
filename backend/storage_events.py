import csv
import os
import base64
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
    file_path = os.path.join(MEDIA_EVENTS_DIR, f"event_{event_id}.{ext}")
    with open(file_path, "wb") as imgf:
        imgf.write(base64.b64decode(data_part))
    # retorna caminho relativo ao backend (servido via /static)
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