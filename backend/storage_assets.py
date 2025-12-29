import os
import csv
import base64
from typing import Dict, Any, List, Optional
from datetime import datetime

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "media", "assets")
ASSETS_CSV = os.path.join(ASSETS_DIR, "assets.csv")
CATS_JSON = os.path.join(ASSETS_DIR, "asset_categories.txt")

ASSET_FIELDS = [
    "id",
    "unit_id",
    "name",
    "description",
    "qr_code",
    "rfid_code",
    "item_code",
    "category",
    "notes",
    "photo_path",
    "quantity",
    "unit",
    "created_at",
    "updated_at",
    "created_by",
]

def _ensure_store():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    # criar arquivo se não existir
    if not os.path.isfile(ASSETS_CSV):
        with open(ASSETS_CSV, "w", newline="", encoding="utf-8") as f:
            csv.DictWriter(f, fieldnames=ASSET_FIELDS).writeheader()
    # MIGRAÇÃO: garantir cabeçalho com novos campos
    try:
        with open(ASSETS_CSV, "r", newline="", encoding="utf-8") as f:
            r = csv.DictReader(f)
            existing_fields = r.fieldnames or []
            missing = [c for c in ASSET_FIELDS if c not in existing_fields]
            rows = list(r) if missing else []
        if missing:
            with open(ASSETS_CSV, "w", newline="", encoding="utf-8") as fw:
                w = csv.DictWriter(fw, fieldnames=ASSET_FIELDS)
                w.writeheader()
                for row in rows:
                    new_row = {
                        "id": row.get("id", ""),
                        "unit_id": row.get("unit_id", ""),
                        "name": row.get("name", ""),
                        "description": row.get("description", ""),
                        "qr_code": row.get("qr_code", ""),
                        "rfid_code": row.get("rfid_code", ""),
                        "item_code": row.get("item_code", ""),
                        "category": row.get("category", ""),
                        "notes": row.get("notes", ""),
                        "photo_path": row.get("photo_path", ""),
                        "quantity": row.get("quantity", "") if "quantity" in existing_fields else "",
                        "unit": row.get("unit", "") if "unit" in existing_fields else "",
                        "created_at": row.get("created_at", ""),
                        "updated_at": row.get("updated_at", ""),
                        "created_by": row.get("created_by", ""),
                    }
                    w.writerow(new_row)
    except Exception:
        # fallback: se der erro de leitura, reescreve cabeçalho vazio
        with open(ASSETS_CSV, "w", newline="", encoding="utf-8") as f:
            csv.DictWriter(f, fieldnames=ASSET_FIELDS).writeheader()
    if not os.path.isfile(CATS_JSON):
        with open(CATS_JSON, "w", encoding="utf-8") as f:
            f.write("")

def _next_id() -> int:
    _ensure_store()
    max_id = 0
    with open(ASSETS_CSV, "r", newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            try:
                rid = int(row.get("id", "0") or 0)
                if rid > max_id:
                    max_id = rid
            except Exception:
                pass
    return max_id + 1

def _safe_filename(name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in ("-", "_", ".", " ") else "_" for ch in name).strip().replace(" ", "_")

def save_photo_base64(unit_id: str, photo_base64: Optional[str]) -> Optional[str]:
    if not photo_base64:
        return None
    try:
        os.makedirs(os.path.join(ASSETS_DIR, str(unit_id)), exist_ok=True)
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
        fname = _safe_filename(f"asset_{unit_id}_{_next_id()}") + f".{ext}"
        full_path = os.path.join(ASSETS_DIR, str(unit_id), fname)
        with open(full_path, "wb") as imgf:
            imgf.write(base64.b64decode(data_part))
        rel = os.path.relpath(full_path, os.path.dirname(__file__))
        return rel.replace(os.sep, "/")
    except Exception:
        return None

def list_assets(unit_id: str) -> List[Dict[str, Any]]:
    _ensure_store()
    out: List[Dict[str, Any]] = []
    with open(ASSETS_CSV, "r", newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            if str(row.get("unit_id") or "") == str(unit_id):
                qty_raw = row.get("quantity", "")
                try:
                    qty = float(qty_raw) if str(qty_raw).strip() != "" else None
                except Exception:
                    qty = None
                out.append({
                    "id": int(row.get("id", "0") or 0),
                    "unit_id": row.get("unit_id"),
                    "name": row.get("name", ""),
                    "description": row.get("description", ""),
                    "qr_code": row.get("qr_code", "") or "",
                    "rfid_code": row.get("rfid_code", "") or "",
                    "item_code": row.get("item_code", "") or "",
                    "category": row.get("category", "") or "",
                    "notes": row.get("notes", "") or "",
                    "photo_path": row.get("photo_path", "") or "",
                    "quantity": qty,
                    "unit": row.get("unit", "") or "",
                    "created_at": row.get("created_at", "") or "",
                    "updated_at": row.get("updated_at", "") or "",
                    "created_by": row.get("created_by", "") or "",
                })
    return out

def add_asset(unit_id: str, payload: Dict[str, Any], username: str) -> Dict[str, Any]:
    _ensure_store()
    aid = _next_id()
    now = datetime.utcnow().isoformat()
    photo_path = save_photo_base64(unit_id, payload.get("photo_base64"))
    # quantidade/unidade
    try:
        qty = float(payload.get("quantity")) if payload.get("quantity") is not None else None
    except Exception:
        qty = None
    unit = str(payload.get("unit") or "").strip()
    row = {
        "id": str(aid),
        "unit_id": str(unit_id),
        "name": str(payload.get("name") or "").strip(),
        "description": str(payload.get("description") or "").strip(),
        "qr_code": str(payload.get("qr_code") or "").strip(),
        "rfid_code": str(payload.get("rfid_code") or "").strip(),
        "item_code": str(payload.get("item_code") or "").strip(),
        "category": str(payload.get("category") or "").strip(),
        "notes": str(payload.get("notes") or "").strip(),
        "photo_path": photo_path or "",
        "quantity": "" if qty is None else str(qty),
        "unit": unit,
        "created_at": now,
        "updated_at": now,
        "created_by": username,
    }
    with open(ASSETS_CSV, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=ASSET_FIELDS)
        w.writerow(row)
    return {
        **row,
        "id": aid,
        "quantity": qty,
    }

def update_asset(asset_id: int, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    _ensure_store()
    updated = None
    rows = []
    now = datetime.utcnow().isoformat()
    with open(ASSETS_CSV, "r", newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            if int(row.get("id", "0") or 0) == int(asset_id):
                unit_id = row.get("unit_id", "")
                photo_path = row.get("photo_path", "") or ""
                if payload.get("photo_base64") is not None:
                    new_photo = save_photo_base64(unit_id, payload.get("photo_base64"))
                    if new_photo:
                        photo_path = new_photo
                # quantidade/unidade
                try:
                    qty = float(payload.get("quantity")) if payload.get("quantity") is not None else None
                except Exception:
                    qty = None
                new_unit = str(payload.get("unit")) if payload.get("unit") is not None else row.get("unit", "")
                new_row = {
                    "id": row.get("id"),
                    "unit_id": row.get("unit_id"),
                    "name": str(payload.get("name") if payload.get("name") is not None else row.get("name", "")).strip(),
                    "description": str(payload.get("description") if payload.get("description") is not None else row.get("description", "")).strip(),
                    "qr_code": str(payload.get("qr_code") if payload.get("qr_code") is not None else row.get("qr_code", "")).strip(),
                    "rfid_code": str(payload.get("rfid_code") if payload.get("rfid_code") is not None else row.get("rfid_code", "")).strip(),
                    "item_code": str(payload.get("item_code") if payload.get("item_code") is not None else row.get("item_code", "")).strip(),
                    "category": str(payload.get("category") if payload.get("category") is not None else row.get("category", "")).strip(),
                    "notes": str(payload.get("notes") if payload.get("notes") is not None else row.get("notes", "")).strip(),
                    "photo_path": photo_path,
                    "quantity": "" if qty is None else str(qty),
                    "unit": new_unit,
                    "created_at": row.get("created_at", ""),
                    "updated_at": now,
                    "created_by": row.get("created_by", ""),
                }
                rows.append(new_row)
                updated = {
                    **new_row,
                    "id": int(new_row["id"]),
                    "quantity": qty,
                }
            else:
                rows.append(row)
    if updated is None:
        return None
    with open(ASSETS_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=ASSET_FIELDS)
        w.writeheader()
        for row in rows:
            w.writerow(row)
    return updated

def delete_asset(asset_id: int) -> bool:
    _ensure_store()
    rows = []
    removed = False
    with open(ASSETS_CSV, "r", newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
            if int(row.get("id", "0") or 0) == int(asset_id):
                removed = True
                continue
            rows.append(row)
    if not removed:
        return False
    with open(ASSETS_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=ASSET_FIELDS)
        w.writeheader()
        for row in rows:
            w.writerow(row)
    return True

def list_categories() -> List[str]:
    _ensure_store()
    try:
        with open(CATS_JSON, "r", encoding="utf-8") as f:
            content = f.read()
        cats = [c.strip() for c in content.splitlines() if c.strip()]
        return cats
    except Exception:
        return []

def add_category(name: str) -> List[str]:
    nm = (name or "").strip()
    if not nm:
        return list_categories()
    cats = list_categories()
    if not any(c.lower() == nm.lower() for c in cats):
        cats.append(nm)
        with open(CATS_JSON, "w", encoding="utf-8") as f:
            f.write("\n".join(cats))
    return cats

def remove_category(name: str) -> List[str]:
    nm = (name or "").strip()
    cats = list_categories()
    new_cats = [c for c in cats if c.lower() != nm.lower()]
    with open(CATS_JSON, "w", encoding="utf-8") as f:
        f.write("\n".join(new_cats))
    return new_cats