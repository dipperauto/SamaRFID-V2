export type AppPage = {
  key: string;
  label: string;
  path: string;
  icon?: "home" | "users" | "events" | "photo" | "location" | "check";
};

export const PAGES: AppPage[] = [
  { key: "home", label: "Home", path: "/home", icon: "home" },
  { key: "users", label: "Usuários", path: "/users", icon: "users" },
  { key: "hierarchy", label: "Unidades", path: "/hierarchy", icon: "location" },
  { key: "verifications", label: "Verificação", path: "/verifications", icon: "check" },
  { key: "log", label: "Log", path: "/log", icon: "photo" },
];

export function pathToKey(pathname: string): string | null {
  const item = PAGES.find((p) => p.path === pathname);
  return item?.key ?? null;
}