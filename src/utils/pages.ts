export type AppPage = {
  key: string;  // permission key
  label: string;
  path: string;
  icon?: "home" | "test" | "clients" | "adminAddUser" | "users";
};

export const PAGES: AppPage[] = [
  { key: "home", label: "Home", path: "/home", icon: "home" },
  { key: "teste", label: "Teste", path: "/teste", icon: "test" },
  { key: "clients", label: "Clientes", path: "/clients", icon: "clients" },
  { key: "admin:add-user", label: "Adicionar Usuário", path: "/admin/add-user", icon: "adminAddUser" },
  { key: "users", label: "Usuários", path: "/users", icon: "users" },
  { key: "kanban", label: "Kanban", path: "/kanban", icon: "clients" },
];

export function pathToKey(pathname: string): string | null {
  const item = PAGES.find((p) => p.path === pathname);
  return item?.key ?? null;
}