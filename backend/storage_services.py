import csv
import os
from typing import List, Dict, Optional

SERVICES_CSV_PATH = os.path.join(os.path.dirname(__file__), "services.csv")

CSV_FIELDS = ["id", "name", "description", "price_brl", "payment_type", "installments_months", "down_payment"]

def _ensure_csv():
  os.makedirs(os.path.dirname(SERVICES_CSV_PATH), exist_ok=True)
  if not os.path.isfile(SERVICES_CSV_PATH):
    with open(SERVICES_CSV_PATH, "w", newline="", encoding="utf-8") as f:
      writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
      writer.writeheader()
    return
  # MIGRAÇÃO DE CAMPOS
  with open(SERVICES_CSV_PATH, "r", newline="", encoding="utf-8") as f:
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
    with open(SERVICES_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
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
        })

def _next_id() -> int:
  _ensure_csv()
  max_id = 0
  with open(SERVICES_CSV_PATH, "r", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
      try:
        rid = int(row.get("id", "0") or 0)
        if rid > max_id:
          max_id = rid
      except Exception:
        pass
  return max_id + 1

def get_all_services() -> List[Dict]:
  _ensure_csv()
  out: List[Dict] = []
  with open(SERVICES_CSV_PATH, "r", newline="", encoding="utf-8") as f:
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
      })
  return out

def add_service(name: str, price_brl: float, payment_type: str, installments_months: int, down_payment: float, description: str = "") -> Dict:
  _ensure_csv()
  sid = _next_id()
  with open(SERVICES_CSV_PATH, "a", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
    writer.writerow({
      "id": str(sid),
      "name": name,
      "description": description or "",
      "price_brl": str(price_brl or 0),
      "payment_type": payment_type,
      "installments_months": str(installments_months or 0),
      "down_payment": str(down_payment or 0),
    })
  return {
    "id": sid,
    "name": name,
    "description": description or "",
    "price_brl": float(price_brl or 0),
    "payment_type": payment_type,
    "installments_months": int(installments_months or 0),
    "down_payment": float(down_payment or 0),
  }

def update_service(service_id: int, name: Optional[str] = None, price_brl: Optional[float] = None,
                   payment_type: Optional[str] = None, installments_months: Optional[int] = None,
                   down_payment: Optional[float] = None, description: Optional[str] = None) -> Optional[Dict]:
  _ensure_csv()
  updated = None
  rows = []
  with open(SERVICES_CSV_PATH, "r", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
      if int(row.get("id", "0") or 0) == int(service_id):
        new_row = {
          "id": row.get("id"),
          "name": name if name is not None else row.get("name", ""),
          "description": description if description is not None else row.get("description", "") or "",
          "price_brl": str(price_brl if price_brl is not None else float(row.get("price_brl", "0") or 0)),
          "payment_type": payment_type if payment_type is not None else row.get("payment_type", "avista"),
          "installments_months": str(installments_months if installments_months is not None else int(row.get("installments_months", "0") or 0)),
          "down_payment": str(down_payment if down_payment is not None else float(row.get("down_payment", "0") or 0)),
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
        }
      else:
        rows.append(row)
  if updated is None:
    return None
  with open(SERVICES_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
    writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
    writer.writeheader()
    for row in rows:
      writer.writerow(row)
  return updated

def delete_service(service_id: int) -> bool:
  _ensure_csv()
  rows = []
  removed = False
  with open(SERVICES_CSV_PATH, "r", newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
      if int(row.get("id", "0") or 0) == int(service_id):
        removed = True
        continue
      rows.append(row)
  if not removed:
    return False
  with open(SERVICES_CSV_PATH, "w", newline="", encoding="utf-8") as fw:
    writer = csv.DictWriter(fw, fieldnames=CSV_FIELDS)
    writer.writeheader()
    for row in rows:
      writer.writerow(row)
  return True