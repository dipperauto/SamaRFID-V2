import csv
import os
from typing import List, Dict, Optional
from storage_clients import get_all_clients
from storage_services import get_all_services

ASSIGN_CSV_PATH = os.path.join(os.path.dirname(__file__), "client_services.csv")
CSV_FIELDS = ["id", "client_id", "client_name", "service_id", "service_name", "payment_type", "installments_months", "down_payment", "base_price", "discount_percent", "discount_value", "discount_type", "total_value", "status", "notes", "start_due_date"]

STATUS_VALUES = ["ativo", "pausado", "cancelado", "aguardo"]

def _ensure_csv():
  os.makedirs(os.path.dirname(ASSIGN_CSV_PATH), exist_ok=True)
  if not os.path.isfile(ASSIGN_CSV_PATH):
    with open(ASSIGN_CSV_PATH, "w", newline="", encoding="utf-8") as f:
      writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
      writer.writeheader()
    return
  # MIGRAÇÃO
  with open(ASSIGN_CSV_PATH, "r", newline="", encoding="utf-8") as f:
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
    with open(ASSIGN_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
      writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
      writer.writeheader()
      for row in rows:
        writer.writerow({
          "id": row.get("id", ""),
          "client_id": row.get("client_id", ""),
          "client_name": row.get("client_name", ""),
          "service_id": row.get("service_id", ""),
          "service_name": row.get("service_name", ""),
          "payment_type": row.get("payment_type", "avista"),
          "installments_months": row.get("installments_months", "0"),
          "down_payment": row.get("down_payment", "0"),
          "base_price": row.get("base_price", "0"),
          "discount_percent": row.get("discount_percent", "0"),
          "discount_value": row.get("discount_value", "0"),
          "discount_type": row.get("discount_type", "percent"),
          "total_value": row.get("total_value", "0"),
          "status": row.get("status", "ativo"),
          "notes": row.get("notes", ""),
          "start_due_date": row.get("start_due_date", ""),
        })

def _next_id() -> int:
  _ensure_csv()
  max_id = 0
  with open(ASSIGN_CSV_PATH, "r", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
      try:
        rid = int(row.get("id", "0") or 0)
        if rid > max_id:
          max_id = rid
      except Exception:
        pass
  return max_id + 1

def list_assignments() -> List[Dict]:
  _ensure_csv()
  out: List[Dict] = []
  with open(ASSIGN_CSV_PATH, "r", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
      out.append({
        "id": int(row.get("id", "0") or 0),
        "client_id": int(row.get("client_id", "0") or 0),
        "client_name": row.get("client_name", ""),
        "service_id": int(row.get("service_id", "0") or 0),
        "service_name": row.get("service_name", ""),
        "payment_type": row.get("payment_type", "avista"),
        "installments_months": int(row.get("installments_months", "0") or 0),
        "down_payment": float(row.get("down_payment", "0") or 0),
        "base_price": float(row.get("base_price", "0") or 0),
        "discount_percent": float(row.get("discount_percent", "0") or 0),
        "discount_value": float(row.get("discount_value", "0") or 0),
        "discount_type": row.get("discount_type", "percent"),
        "total_value": float(row.get("total_value", "0") or 0),
        "status": row.get("status", "ativo"),
        "notes": row.get("notes", "") or "",
        "start_due_date": row.get("start_due_date", "") or "",
      })
  return out

def add_assignment(client_id: int, service_id: int, discount_percent: float = 0.0, notes: str = "", discount_type: str = "percent", discount_value: float = 0.0, start_due_date: str = "") -> Dict:
  _ensure_csv()
  clients = get_all_clients()
  services = get_all_services()
  client = next((c for c in clients if int(c.get("id", 0)) == int(client_id)), None)
  service = next((s for s in services if int(s.get("id", 0)) == int(service_id)), None)
  if not client or not service:
    raise ValueError("Cliente ou serviço inválido.")
  base_price = float(service["price_brl"] or 0)
  dpct = max(0.0, float(discount_percent or 0))
  dval = max(0.0, float(discount_value or 0))
  dtyp = discount_type if discount_type in ("percent", "value") else "percent"
  total = base_price
  if dtyp == "percent":
    total = base_price * (1.0 - dpct / 100.0)
  else:
    total = max(0.0, base_price - dval)
  aid = _next_id()
  with open(ASSIGN_CSV_PATH, "a", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
    writer.writerow({
      "id": str(aid),
      "client_id": str(client_id),
      "client_name": client.get("full_name", ""),
      "service_id": str(service_id),
      "service_name": service.get("name", ""),
      "payment_type": service.get("payment_type", "avista"),
      "installments_months": str(service.get("installments_months", 0) or 0),
      "down_payment": str(service.get("down_payment", 0.0) or 0.0),
      "base_price": str(base_price),
      "discount_percent": str(dpct),
      "discount_value": str(dval),
      "discount_type": dtyp,
      "total_value": str(total),
      "status": "ativo",
      "notes": notes or "",
      "start_due_date": start_due_date or "",
    })
  return {
    "id": aid,
    "client_id": int(client_id),
    "client_name": client.get("full_name", ""),
    "service_id": int(service_id),
    "service_name": service.get("name", ""),
    "payment_type": service.get("payment_type", "avista"),
    "installments_months": int(service.get("installments_months", 0) or 0),
    "down_payment": float(service.get("down_payment", 0.0) or 0.0),
    "base_price": base_price,
    "discount_percent": dpct,
    "discount_value": dval,
    "discount_type": dtyp,
    "total_value": total,
    "status": "ativo",
    "notes": notes or "",
    "start_due_date": start_due_date or "",
  }

def update_assignment(assignment_id: int, status: Optional[str] = None, discount_percent: Optional[float] = None, notes: Optional[str] = None, discount_type: Optional[str] = None, discount_value: Optional[float] = None, start_due_date: Optional[str] = None) -> Optional[Dict]:
  _ensure_csv()
  updated = None
  rows = []
  with open(ASSIGN_CSV_PATH, "r", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
      if int(row.get("id", "0") or 0) == int(assignment_id):
        new_status = status if status is not None else row.get("status", "ativo")
        if new_status not in STATUS_VALUES:
          new_status = row.get("status", "ativo")
        new_discount_type = discount_type if discount_type is not None else row.get("discount_type", "percent")
        if new_discount_type not in ("percent", "value"):
          new_discount_type = row.get("discount_type", "percent")
        new_discount_percent = discount_percent if discount_percent is not None else float(row.get("discount_percent", "0") or 0)
        new_discount_value = discount_value if discount_value is not None else float(row.get("discount_value", "0") or 0)
        base_price = float(row.get("base_price", "0") or 0)
        # total
        if new_discount_type == "percent":
          total = base_price * (1.0 - float(new_discount_percent) / 100.0)
        else:
          total = max(0.0, base_price - float(new_discount_value))
        new_row = {
          "id": row.get("id"),
          "client_id": row.get("client_id"),
          "client_name": row.get("client_name"),
          "service_id": row.get("service_id"),
          "service_name": row.get("service_name"),
          "payment_type": row.get("payment_type", "avista"),
          "installments_months": row.get("installments_months", "0"),
          "down_payment": row.get("down_payment", "0"),
          "base_price": str(base_price),
          "discount_percent": str(new_discount_percent or 0),
          "discount_value": str(new_discount_value or 0),
          "discount_type": new_discount_type,
          "total_value": str(total),
          "status": new_status,
          "notes": (notes if notes is not None else row.get("notes", "")) or "",
          "start_due_date": (start_due_date if start_due_date is not None else row.get("start_due_date", "")) or "",
        }
        rows.append(new_row)
        updated = {
          "id": int(new_row["id"]),
          "client_id": int(new_row["client_id"]),
          "client_name": new_row["client_name"],
          "service_id": int(new_row["service_id"]),
          "service_name": new_row["service_name"],
          "payment_type": new_row["payment_type"],
          "installments_months": int(new_row["installments_months"]),
          "down_payment": float(new_row["down_payment"]),
          "base_price": float(new_row["base_price"]),
          "discount_percent": float(new_row["discount_percent"]),
          "discount_value": float(new_row["discount_value"]),
          "discount_type": new_row["discount_type"],
          "total_value": float(new_row["total_value"]),
          "status": new_row["status"],
          "notes": new_row["notes"],
          "start_due_date": new_row["start_due_date"],
        }
      else:
        rows.append(row)
  if updated is None:
    return None
  with open(ASSIGN_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
    writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
    writer.writeheader()
    for row in rows:
      writer.writerow(row)
  return updated

def delete_assignment(assignment_id: int) -> bool:
  _ensure_csv()
  rows = []
  removed = False
  with open(ASSIGN_CSV_PATH, "r", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
      if int(row.get("id", "0") or 0) == int(assignment_id):
        removed = True
        continue
      rows.append(row)
  if not removed:
    return False
  with open(ASSIGN_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
    writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
    writer.writeheader()
    for row in rows:
      writer.writerow(row)
  return True