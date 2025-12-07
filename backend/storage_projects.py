import csv
import os
import json
import base64
from typing import Optional, Dict, List, Tuple

PROJECTS_CSV_PATH = os.environ.get(
    "PROJECTS_CSV_PATH",
    os.path.join(os.path.dirname(__file__), "projects.csv"),
)

MEDIA_ROOT = os.path.join(os.path.dirname(__file__), "media")
MEDIA_PROJECTS_FILES_DIR = os.path.join(MEDIA_ROOT, "projects_files")  # anexos por projeto

CSV_FIELDS = [
    "id",
    "name",
    "description",
    "client_id",
    "client_name",
    "status",
    "discount_percent",
    "items_json",
    "total_value",
    "discounted_total_value",
]

STATUS_VALUES = {"Pendente", "Aprovado", "Executando", "Finalizado", "Cancelado"}


def _ensure_csv():
    os.makedirs(os.path.dirname(PROJECTS_CSV_PATH), exist_ok=True)
    if not os.path.exists(PROJECTS_CSV_PATH):
        with open(PROJECTS_CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
            writer.writeheader()
        return

    with open(PROJECTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
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
        with open(PROJECTS_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
            writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
            writer.writeheader()
            for row in rows:
                new_row = {
                    "id": row.get("id", ""),
                    "name": row.get("name", ""),
                    "description": row.get("description", ""),
                    "client_id": row.get("client_id", ""),
                    "client_name": row.get("client_name", ""),
                    "status": row.get("status", "Pendente"),
                    "discount_percent": row.get("discount_percent", "0"),
                    "items_json": row.get("items_json", "[]"),
                    "total_value": row.get("total_value", "0"),
                    "discounted_total_value": row.get("discounted_total_value", "0"),
                }
                writer.writerow(new_row)


def _safe_filename(name: str) -> str:
    return "".join(ch if ch.isalnum() or ch in ("-", "_", ".", " ") else "_" for ch in name).strip().replace(" ", "_")


def _next_id() -> int:
    _ensure_csv()
    max_id = 0
    with open(PROJECTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                rid = int(row.get("id", "0") or "0")
                if rid > max_id:
                    max_id = rid
            except Exception:
                continue
    return max_id + 1


# ---------- Cálculo de itens e totais ----------

def _calc_items_and_totals(items: List[Dict], discount_percent: float) -> Tuple[List[Dict], float, float]:
    dp = max(0.0, float(discount_percent))
    items_out: List[Dict] = []
    total = 0.0
    for it in items:
        desc = str(it.get("description", "")).strip()
        unit = float(it.get("unit_price", 0) or 0)
        qty = float(it.get("quantity", 0) or 0)
        subtotal = unit * qty
        total += subtotal
        discounted = subtotal * (1.0 - dp / 100.0)
        items_out.append({
            "description": desc,
            "unit_price": unit,
            "quantity": qty,
            "total": round(subtotal, 2),
            "discounted_total": round(discounted, 2),
        })
    discounted_total = total * (1.0 - dp / 100.0)
    return items_out, round(total, 2), round(discounted_total, 2)


# ---------- CRUD Projetos ----------

def get_all_projects() -> List[Dict]:
    _ensure_csv()
    result: List[Dict] = []
    with open(PROJECTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                items = json.loads(row.get("items_json", "[]"))
            except Exception:
                items = []
            result.append({
                "id": int(row.get("id", "0") or "0"),
                "name": row.get("name", ""),
                "description": row.get("description", ""),
                "client_id": int(row.get("client_id", "0") or "0"),
                "client_name": row.get("client_name", ""),
                "status": row.get("status", "Pendente"),
                "discount_percent": float(row.get("discount_percent", "0") or 0),
                "items": items,
                "total_value": float(row.get("total_value", "0") or 0),
                "discounted_total_value": float(row.get("discounted_total_value", "0") or 0),
            })
    return result


def add_project(
    name: str,
    description: str,
    client_id: int,
    client_name: str,
    status: str,
    discount_percent: float,
    items: List[Dict],
) -> Dict:
    _ensure_csv()
    if status not in STATUS_VALUES:
        status = "Pendente"
    project_id = _next_id()
    calc_items, total, discounted_total = _calc_items_and_totals(items or [], discount_percent or 0)
    with open(PROJECTS_CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writerow({
            "id": str(project_id),
            "name": name,
            "description": description,
            "client_id": str(client_id),
            "client_name": client_name,
            "status": status,
            "discount_percent": str(discount_percent or 0),
            "items_json": json.dumps(calc_items, ensure_ascii=False),
            "total_value": str(total),
            "discounted_total_value": str(discounted_total),
        })
    return {
        "id": project_id,
        "name": name,
        "description": description,
        "client_id": client_id,
        "client_name": client_name,
        "status": status,
        "discount_percent": float(discount_percent or 0),
        "items": calc_items,
        "total_value": total,
        "discounted_total_value": discounted_total,
    }


def update_project(
    project_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    client_id: Optional[int] = None,
    client_name: Optional[str] = None,
    status: Optional[str] = None,
    discount_percent: Optional[float] = None,
    items: Optional[List[Dict]] = None,
) -> Optional[Dict]:
    _ensure_csv()
    updated = None
    rows = []
    with open(PROJECTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("id") == str(project_id):
                new_name = name if name is not None else row.get("name", "")
                new_desc = description if description is not None else row.get("description", "")
                new_client_id = client_id if client_id is not None else int(row.get("client_id", "0") or 0)
                new_client_name = client_name if client_name is not None else row.get("client_name", "")
                new_status = status if status is not None else row.get("status", "Pendente")
                new_discount = discount_percent if discount_percent is not None else float(row.get("discount_percent", "0") or 0)
                # itens
                try:
                    prev_items = json.loads(row.get("items_json", "[]"))
                except Exception:
                    prev_items = []
                new_items = items if items is not None else prev_items
                calc_items, total, discounted_total = _calc_items_and_totals(new_items or [], new_discount or 0)
                new_row = {
                    "id": str(project_id),
                    "name": new_name,
                    "description": new_desc,
                    "client_id": str(new_client_id),
                    "client_name": new_client_name,
                    "status": new_status if new_status in STATUS_VALUES else "Pendente",
                    "discount_percent": str(new_discount or 0),
                    "items_json": json.dumps(calc_items, ensure_ascii=False),
                    "total_value": str(total),
                    "discounted_total_value": str(discounted_total),
                }
                rows.append(new_row)
                updated = {
                    "id": project_id,
                    "name": new_name,
                    "description": new_desc,
                    "client_id": new_client_id,
                    "client_name": new_client_name,
                    "status": new_row["status"],
                    "discount_percent": float(new_discount or 0),
                    "items": calc_items,
                    "total_value": total,
                    "discounted_total_value": discounted_total,
                }
            else:
                rows.append(row)
    if updated is None:
        return None
    with open(PROJECTS_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
        writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow(row)
    return updated


def delete_project(project_id: int) -> bool:
    _ensure_csv()
    before = 0
    rows = []
    removed = False
    with open(PROJECTS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            before += 1
            if row.get("id") == str(project_id):
                removed = True
                continue
            rows.append(row)
    if removed:
        with open(PROJECTS_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
            writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
    return removed


# ---------- Anexos por projeto (limite 50 MB por projeto) ----------

def _project_files_dir(project_id: int) -> str:
    path = os.path.join(MEDIA_PROJECTS_FILES_DIR, str(project_id))
    os.makedirs(path, exist_ok=True)
    return path


def list_project_files(project_id: int) -> List[Dict[str, str]]:
    base_dir = _project_files_dir(project_id)
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


def total_project_files_size_bytes(project_id: int) -> int:
    base_dir = _project_files_dir(project_id)
    total = 0
    for name in os.listdir(base_dir):
        file_path = os.path.join(base_dir, name)
        if os.path.isfile(file_path):
            total += os.path.getsize(file_path)
    return total


def save_project_file(project_id: int, filename: str, content: bytes) -> Tuple[str, int, str]:
    base_dir = _project_files_dir(project_id)
    safe_name = _safe_filename(filename)
    full_path = os.path.join(base_dir, safe_name)
    with open(full_path, "wb") as f:
        f.write(content)
    rel_path_from_media = os.path.relpath(full_path, MEDIA_ROOT)
    return safe_name, os.path.getsize(full_path), f"static/{rel_path_from_media.replace(os.sep, '/')}"


def delete_project_file(project_id: int, filename: str) -> bool:
    base_dir = _project_files_dir(project_id)
    safe_name = _safe_filename(filename)
    full_path = os.path.join(base_dir, safe_name)
    if os.path.isfile(full_path):
        os.remove(full_path)
        return True
    return False