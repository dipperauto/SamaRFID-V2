export type AppPage = {
  key: string;  // permission key
  label: string;
  path: string;
  icon?: "home" | "users";
};

export const PAGES: AppPage[] = [
  { key: "home", label: "Home", path: "/home", icon: "home" },
  { key: "users", label: "Usuários", path: "/users", icon: "users" },
  { key: "events", path: "/events", label: "Eventos", icon: "users" },
  { key: "parametros", path: "/parametros", label: "Parâmetros", icon: "users" },
];

export function pathToKey(pathname: string): string | null {
  const item = PAGES.find((p) => p.path === pathname);
  return item?.key ?? null;
}