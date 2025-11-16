import csv
import os
from typing import Optional, Dict

from security import hash_password

USERS_CSV_PATH = os.environ.get(
    "USERS_CSV_PATH",
    os.path.join(os.path.dirname(__file__), "users.csv"),
)


def _ensure_csv():
    if not os.path.exists(USERS_CSV_PATH):
        os.makedirs(os.path.dirname(USERS_CSV_PATH), exist_ok=True)
        with open(USERS_CSV_PATH, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=["username", "password_hash", "role"])
            writer.writeheader()


def get_user(username: str) -> Optional[Dict[str, str]]:
    _ensure_csv()
    with open(USERS_CSV_PATH, "r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("username") == username:
                return {"username": row["username"], "password_hash": row["password_hash"], "role": row["role"]}
    return None


def add_user(username: str, password: str, role: str) -> None:
    """
    Adiciona usuário com a senha HASHEADA (não armazenamos senha em texto puro).
    """
    _ensure_csv()
    # Evita duplicatas
    existing = get_user(username)
    if existing:
        raise ValueError("Usuário já existe.")
    password_hash = hash_password(password)
    with open(USERS_CSV_PATH, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["username", "password_hash", "role"])
        writer.writerow({"username": username, "password_hash": password_hash, "role": role})