// ... existing code ...
def get_all_assets_flat() -> List[Dict[str, Any]]:
    _ensure_store()
    out: List[Dict[str, Any]] = []
    with open(ASSETS_CSV, "r", newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        for row in r:
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
// ... existing code ...