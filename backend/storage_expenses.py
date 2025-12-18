import csv
import os
import base64
from typing import List, Dict, Optional, Tuple
from datetime import datetime

EXPENSES_CSV_PATH = os.path.join(os.path.dirname(__file__), "expenses.csv")

MEDIA_ROOT = os.path.join(os.path.dirname(__file__), "media")
MEDIA_EXPENSES_FILES_DIR = os.path.join(MEDIA_ROOT, "expenses_files")  # anexos por gasto

CSV_FIELDS = [
    "id",
    "name",
    "description",
    "price_brl",
    "payment_type",          # avista | parcelado | recorrente
    "installments_months",   # para parcelado
    "down_payment",          # para parcelado
    "status",                # ativo | inativo
    "created_at",            # ISO timestamp
]

STATUS_VALUES = {"ativo", "inativo"}

def _ensure_csv():
    os.makedirs(os.path.dirname(EXPENSES_CSV_PATH), exist_ok=True)
    if not os.path.exists(EXPENSES_CSV_PATH):
        with open(EXPENSES_CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
            writer.writeheader()
        return
    with open(EXPENSES_CSV_PATH, "r", newline="", encoding="utf-8") as f:
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
        with open(EXPENSES_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
            writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
            writer.writeheader()
            for row in rows:
                writer.writerow({
                    "id": row.get("id", ""),
                    "name": row.get("name", ""),
                    "description": row.get("description", ""),
                    "price_brl": row.get("price_brl", "0"),
                    "payment_type": row.get("payment_type", "avista"),
                    "installments_months": row.get("installments_months", "0"),
                    "down_payment": row.get("down_payment", "0"),
                    "status": row.get("status", "ativo"),
                    "created_at": row.get("created_at", ""),
                })

def _next_id() -> int:
    _ensure_csv()
    max_id = 0
    with open(EXPENSES_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                rid = int(row.get("id", "0") or 0)
                if rid > max_id:
                    max_id = rid
            except Exception:
                pass
    return max_id + 1

def get_all_expenses() -> List[Dict]:
    _ensure_csv()
    out: List[Dict] = []
    with open(EXPENSES_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            out.append({
                "id": int(row.get("id", "0") or 0),
                "name": row.get("name", ""),
                "description": row.get("description", "") or "",
                "price_brl": float(row.get("price_brl", "0") or 0),
                "payment_type": row.get("payment_type", "avista"),
                "installments_months": int(row.get("installments_months", "0") or 0),
                "down_payment": float(row.get("down_payment", "0") or 0),
                "status": row.get("status", "ativo"),
                "created_at": row.get("created_at", "") or "",
            })
    return out

def add_expense(name: str, description: str, price_brl: float, payment_type: str, installments_months: int, down_payment: float, status: str = "ativo") -> Dict:
    _ensure_csv()
    eid = _next_id()
    created_at = datetime.utcnow().isoformat()
    if payment_type not in ("avista", "parcelado", "recorrente"):
        payment_type = "avista"
    if status not in STATUS_VALUES:
        status = "ativo"
    with open(EXPENSES_CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writerow({
            "id": str(eid),
            "name": name,
            "description": description or "",
            "price_brl": str(price_brl or 0),
            "payment_type": payment_type,
            "installments_months": str(installments_months or 0),
            "down_payment": str(down_payment or 0),
            "status": status,
            "created_at": created_at,
        })
    return {
        "id": eid,
        "name": name,
        "description": description or "",
        "price_brl": float(price_brl or 0),
        "payment_type": payment_type,
        "installments_months": int(installments_months or 0),
        "down_payment": float(down_payment or 0),
        "status": status,
        "created_at": created_at,
    }

def update_expense(expense_id: int, name: Optional[str] = None, description: Optional[str] = None, price_brl: Optional[float] = None, payment_type: Optional[str] = None, installments_months: Optional[int] = None, down_payment: Optional[float] = None, status: Optional[str] = None) -> Optional[Dict]:
    _ensure_csv()
    updated = None
    rows = []
    with open(EXPENSES_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if int(row.get("id", "0") or 0) == int(expense_id):
                new_row = {
                    "id": row.get("id"),
                    "name": name if name is not None else row.get("name", ""),
                    "description": description if description is not None else row.get("description", "") or "",
                    "price_brl": str(price_brl if price_brl is not None else float(row.get("price_brl", "0") or 0)),
                    "payment_type": (payment_type if payment_type is not None else row.get("payment_type", "avista")),
                    "installments_months": str(installments_months if installments_months is not None else int(row.get("installments_months", "0") or 0)),
                    "down_payment": str(down_payment if down_payment is not None else float(row.get("down_payment", "0") or 0)),
                    "status": (status if status is not None and status in STATUS_VALUES else row.get("status", "ativo")),
                    "created_at": row.get("created_at", ""),
                }
                rows.append(new_row)
                updated = {
                    "id": int(new_row["id"]),
                    "name": new_row["name"],
                    "description": new_row["description"],
                    "price_brl": float(new_row["price_brl"]),
                    "payment_type": new_row["payment_type"],
                    "installments_months": int(new_row["installments_months"]),
                    "down_payment": float(new_row["down_payment"]),
                    "status": new_row["status"],
                    "created_at": new_row["created_at"],
                }
            else:
                rows.append(row)
    if updated is None:
        return None
    with open(EXPENSES_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
        writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return updated

def delete_expense(expense_id: int) -> bool:
    _ensure_csv()
    rows = []
    removed = False
    with open(EXPENSES_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if int(row.get("id", "0") or 0) == int(expense_id):
                removed = True
                continue
            rows.append(row)
    if not removed:
        return False
    with open(EXPENSES_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
        writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    try:
        # remover anexos do gasto
        base_dir = os.path.join(MEDIA_EXPENSES_FILES_DIR, str(expense_id))
        if os.path.isdir(base_dir):
            import shutil
            shutil.rmtree(base_dir, ignore_errors=True)
    except Exception:
        pass
    return True

# ---------- Anexos por gasto ----------
def _expense_files_dir(expense_id: int) -> str:
    path = os.path.join(MEDIA_EXPENSES_FILES_DIR, str(expense_id))
    os.makedirs(path, exist_ok=True)
    return path

def list_expense_files(expense_id: int) -> List[Dict[str, str]]:
    base_dir = _expense_files_dir(expense_id)
    files = []
    for name in os.listdir(base_dir):
        file_path = os.path.join(base_dir, name)
        if not os.path.isfile(file_path):
            continue
        size = os.path.getsize(file_path)
        rel_path_from_media = os.path.relpath(file_path, MEDIA_ROOT)
        files.append({
            "name": name,
            "url": f"static/{rel_path_from_media.replace(os.sep, '/')}",
            "size_bytes": str(size),
        })
    return files

def save_expense_file(expense_id: int, filename: str, content: bytes) -> Tuple[str, int, str]:
    base_dir = _expense_files_dir(expense_id)
    safe_name = "".join(ch if ch.isalnum() or ch in ("-", "_", ".", " ") else "_" for ch in filename).strip().replace(" ", "_")
    full_path = os.path.join(base_dir, safe_name)
    with open(full_path, "wb") as f:
        f.write(content)
    rel_path_from_media = os.path.relpath(full_path, MEDIA_ROOT)
    return safe_name, os.path.getsize(full_path), f"static/{rel_path_from_media.replace(os.sep, '/')}"

def delete_expense_file(expense_id: int, filename: str) -> bool:
    base_dir = _expense_files_dir(expense_id)
    safe_name = "".join(ch if ch.isalnum() or ch in ("-", "_", ".", " ") else "_" for ch in filename).strip().replace(" ", "_")
    full_path = os.path.join(base_dir, safe_name)
    if os.path.isfile(full_path):
        os.remove(full_path)
        return True
    return False