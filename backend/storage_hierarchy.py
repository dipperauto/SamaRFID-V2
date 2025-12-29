import os
import json
import uuid
import time
from typing import Dict, Any, List, Optional

STORE_DIR = os.path.join(os.path.dirname(__file__), "media", "hierarchy")
STORE_PATH = os.path.join(STORE_DIR, "hierarchy.json")


def _ensure_store() -> Dict[str, Any]:
    os.makedirs(STORE_DIR, exist_ok=True)
    if not os.path.isfile(STORE_PATH):
        data = {"nodes": [], "categories": []}
        with open(STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return data
    try:
        with open(STORE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        data = {"nodes": [], "categories": []}
    if not isinstance(data, dict):
        data = {"nodes": [], "categories": []}
    data.setdefault("nodes", [])
    data.setdefault("categories", [])
    return data


def _save_store(data: Dict[str, Any]) -> None:
    os.makedirs(STORE_DIR, exist_ok=True)
    with open(STORE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _gen_id() -> str:
    return f"loc_{int(time.time()*1000)}_{uuid.uuid4().hex[:8]}"


def list_all() -> Dict[str, Any]:
    """
    Retorna {"nodes": [...], "categories": [...]}
    """
    return _ensure_store()


def ensure_category(name: Optional[str]) -> None:
    if not name:
        return
    name = str(name).strip()
    if not name:
        return
    data = _ensure_store()
    cats: List[str] = data.get("categories") or []
    if not any(c.lower() == name.lower() for c in cats):
        cats.append(name)
        data["categories"] = cats
        _save_store(data)


def _index_nodes(nodes: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    idx = {}
    def visit(lst: List[Dict[str, Any]]):
        for n in lst:
            idx[str(n.get("id"))] = n
            ch = n.get("children") or []
            if ch:
                visit(ch)
    visit(nodes)
    return idx


def _delete_recursive(nodes: List[Dict[str, Any]], target_id: str) -> bool:
    """
    Remove target e sua subárvore. Retorna True se removeu.
    """
    removed = False
    kept: List[Dict[str, Any]] = []
    for n in nodes:
        nid = str(n.get("id"))
        if nid == target_id:
            removed = True
            continue
        ch = n.get("children") or []
        if ch:
            rem_child = _delete_recursive(ch, target_id)
            n["children"] = [c for c in ch if str(c.get("id")) != target_id]
            removed = removed or rem_child
        kept.append(n)
    nodes[:] = kept
    return removed


def add_root(
    name: str,
    description: Optional[str],
    color: Optional[str],
    category: Optional[str],
    responsibles: List[Dict[str, Any]],
) -> Dict[str, Any]:
    data = _ensure_store()
    ensure_category(category)
    node = {
        "id": _gen_id(),
        "name": name.strip(),
        "description": (description or "").strip() or None,
        "color": (color or "").strip() or None,
        "category": (category or "").strip() or None,
        "responsibles": [
            {"name": str(r.get("name") or "").strip(), "isPrimary": bool(r.get("isPrimary", False))}
            for r in (responsibles or [])
            if str(r.get("name") or "").strip()
        ],
        "children": [],
        "parentId": None,
    }
    data["nodes"].append(node)
    _save_store(data)
    return node


def add_child(
    parent_id: str,
    name: str,
    description: Optional[str],
    color: Optional[str],
    category: Optional[str],
    responsibles: List[Dict[str, Any]],
) -> Optional[Dict[str, Any]]:
    data = _ensure_store()
    ensure_category(category)
    idx = _index_nodes(data["nodes"])
    parent = idx.get(str(parent_id))
    if not parent:
        return None
    node = {
        "id": _gen_id(),
        "name": name.strip(),
        "description": (description or "").strip() or None,
        "color": (color or "").strip() or None,
        "category": (category or "").strip() or None,
        "responsibles": [
            {"name": str(r.get("name") or "").strip(), "isPrimary": bool(r.get("isPrimary", False))}
            for r in (responsibles or [])
            if str(r.get("name") or "").strip()
        ],
        "children": [],
        "parentId": str(parent_id),
    }
    parent.setdefault("children", []).append(node)
    _save_store(data)
    return node


def update_node(
    node_id: str,
    name: Optional[str] = None,
    description: Optional[str] = None,
    color: Optional[str] = None,
    category: Optional[str] = None,
    responsibles: Optional[List[Dict[str, Any]]] = None,
) -> Optional[Dict[str, Any]]:
    data = _ensure_store()
    idx = _index_nodes(data["nodes"])
    node = idx.get(str(node_id))
    if not node:
        return None
    if name is not None:
        node["name"] = str(name).strip()
    if description is not None:
        node["description"] = str(description).strip() or None
    if color is not None:
        node["color"] = str(color).strip() or None
    if category is not None:
        cat = str(category).strip() or None
        node["category"] = cat
        if cat:
            ensure_category(cat)
    if responsibles is not None:
        node["responsibles"] = [
            {"name": str(r.get("name") or "").strip(), "isPrimary": bool(r.get("isPrimary", False))}
            for r in (responsibles or [])
            if str(r.get("name") or "").strip()
        ]
    _save_store(data)
    return node


def delete_node(node_id: str) -> bool:
    data = _ensure_store()
    removed = _delete_recursive(data["nodes"], str(node_id))
    if removed:
        _save_store(data)
    return removed