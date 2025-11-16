import hashlib
import hmac
import secrets


def _pbkdf2_sha256(password: str, salt: bytes, iterations: int = 310_000) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)


def hash_password(password: str, iterations: int = 310_000) -> str:
    """
    Retorna um hash no formato: pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>
    """
    salt = secrets.token_bytes(16)
    dk = _pbkdf2_sha256(password, salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """
    Verifica senha utilizando comparação em tempo constante.
    """
    try:
        scheme, iters_str, salt_hex, hash_hex = stored.split("$", 3)
        if scheme != "pbkdf2_sha256":
            return False
        iterations = int(iters_str)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        candidate = _pbkdf2_sha256(password, salt, iterations)
        return hmac.compare_digest(candidate, expected)
    except Exception:
        return False