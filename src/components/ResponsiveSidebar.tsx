"use client";

import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Home, TestTube, UserPlus, Menu, LogOut, Users } from "lucide-react";
import { toast } from "sonner";
import { PAGES } from "@/utils/pages";

const ResponsiveSidebar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = React.useState<boolean>(false);
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  const [allowedPages, setAllowedPages] = React.useState<string[] | null>(null);

  React.useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/me`, { method: "GET", credentials: "include" });
        if (!res.ok) {
          setAllowedPages([]);
          return;
        }
        const data = await res.json();
        setAllowedPages(data?.allowed_pages ?? []);
      } catch {
        setAllowedPages([]);
      }
    };
    run();
  }, [API_URL]);

  const onItemClick = (to: string) => {
    navigate(to);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    const res = await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    if (res.ok) {
      toast.success("Você saiu da sua conta.");
    } else {
      toast.error("Falha ao sair. Tente novamente.");
    }
    setMobileOpen(false);
    navigate("/login");
  };

  return (
    <>
      {/* Mobile top bar with menu button */}
      <div className="lg:hidden fixed top-3 left-3 z-50">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="shadow-md bg-black/50 text-white hover:bg-black/60 border border-white/25 ring-1 ring-white/20 backdrop-blur-2xl backdrop-saturate-150 backdrop-brightness-75"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-full sm:max-w-sm p-0 bg-black/50 border border-white/25 ring-1 ring-white/20 backdrop-blur-2xl backdrop-saturate-150 backdrop-brightness-75 text-white shadow-2xl"
          >
            <SheetHeader className="p-4">
              <SheetTitle className="text-white">Menu</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4 space-y-2">
              {(allowedPages ? PAGES.filter(p => allowedPages.includes(p.key)) : PAGES).map((item) => (
                <button
                  key={item.path}
                  onClick={() => onItemClick(item.path)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/10 text-white/90"
                >
                  {item.icon === "home" && <Home className="h-4 w-4" />}
                  {item.icon === "test" && <TestTube className="h-4 w-4" />}
                  {item.icon === "clients" && <Users className="h-4 w-4" />}
                  {item.icon === "adminAddUser" && <UserPlus className="h-4 w-4" />}
                  {item.icon === "users" && <Users className="h-4 w-4" />}
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/10 text-red-300"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">Sair</span>
              </button>
              <p className="mt-2 text-xs text-white">Dipper Automation 2025 ©</p>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex fixed top-0 left-0 h-screen bg-black/50 backdrop-blur-2xl backdrop-saturate-150 backdrop-brightness-75 border border-white/25 ring-1 ring-white/20 shadow-2xl transition-[width] duration-200 z-40 w-64`}
      >
        <div className="flex flex-col w-full h-full text-white">
          <div className="flex items-center justify-center px-4 py-4 border-b border-white/25">
            <img src="/logo.png" alt="Logo da empresa" className="h-12 w-auto" />
          </div>

          <nav className="flex-1 px-2 py-2 space-y-1">
            {(allowedPages ? PAGES.filter(p => allowedPages.includes(p.key)) : PAGES).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                    isActive ? "bg-white/10 text-white" : "text-white/85 hover:bg-white/10"
                  }`
                }
              >
                <span className="shrink-0">
                  {item.icon === "home" && <Home className="h-4 w-4" />}
                  {item.icon === "test" && <TestTube className="h-4 w-4" />}
                  {item.icon === "clients" && <Users className="h-4 w-4" />}
                  {item.icon === "adminAddUser" && <UserPlus className="h-4 w-4" />}
                  {item.icon === "users" && <Users className="h-4 w-4" />}
                </span>
                <span className="text-sm font-medium block">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="px-2 py-2 border-t border-white/25">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors text-red-300 hover:bg-white/10"
            >
              <span className="shrink-0">
                <LogOut className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium block">Sair</span>
            </button>
            <p className="mt-2 px-3 text-xs text-white">Dipper Automation 2025 ©</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default ResponsiveSidebar;