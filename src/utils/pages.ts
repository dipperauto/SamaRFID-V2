export type AppPage = {
  key: string;  // permission key
  label: string;
  path: string;
  icon?: "home" | "users" | "events" | "photo";
};

export const PAGES: AppPage[] = [
  { key: "home", label: "Home", path: "/home", icon: "home" },
  { key: "users", label: "Usuários", path: "/users", icon: "users" },
  { key: "hierarchy", label: "Hierarquias", path: "/hierarchy", icon: "users" },
];

export function pathToKey(pathname: string): string | null {
  const item = PAGES.find((p) => p.path === pathname);
  return item?.key ?? null;
}