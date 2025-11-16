export type AuthData = {
  loggedIn: boolean;
  role?: string;
};

const AUTH_KEY = "app.auth";

export function login(role?: string) {
  const data: AuthData = { loggedIn: true, role };
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}

export function isLoggedIn(): boolean {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw) as AuthData;
    return !!data.loggedIn;
  } catch {
    return false;
  }
}

export function getRole(): string | undefined {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return undefined;
    const data = JSON.parse(raw) as AuthData;
    return data.role;
  } catch {
    return undefined;
  }
}