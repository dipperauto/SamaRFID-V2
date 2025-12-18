export type AppPage = {
  key: string;  // permission key
  label: string;
  path: string;
  icon?: "home" | "users" | "events" | "photo";
};

export const PAGES: AppPage[] = [
  { key: "home", label: "Home", path: "/home", icon: "home" },
  { key: "users", label: "Usuários", path: "/users", icon: "users" },
  { key: "clients", label: "Clientes", path: "/clients", icon: "users" },
  { key: "services", label: "Serviços", path: "/services", icon: "photo" },
  { key: "expenses", label: "Gastos", path: "/expenses", icon: "photo" },
  { key: "control", label: "Controle", path: "/control", icon: "photo" },
];

export function pathToKey(pathname: string): string | null {
  const item = PAGES.find((p) => p.path === pathname);
  return item?.key ?? null;
}