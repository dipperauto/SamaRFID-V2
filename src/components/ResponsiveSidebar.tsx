"use client";

import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Home, TestTube, UserPlus, Menu, LogOut, Users, CalendarDays, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { PAGES } from "@/utils/pages";

const ResponsiveSidebar: React.FC = () => {
  const [mobileOpen, setMobileOpen] = React.useState<boolean>(false);
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  const [allowedPages, setAllowedPages] = React.useState<string[] | null>(null);
  const [userInfo, setUserInfo] = React.useState<{ username?: string; full_name?: string; role?: string; photoUrl?: string } | null>(null);

  const displayRole = React.useMemo(() => {
    const r = (userInfo?.role || "").toLowerCase();
    if (r === "usuario" || r === "usuário" || r === "fotografo" || r === "fotógrafo") return "fotógrafo";
    return userInfo?.role || "";
  }, [userInfo?.role]);

  React.useEffect(() => {
    const run = async () => {
      try {
        const res = await fetch(`${API_URL}/api/auth/me`, { method: "GET", credentials: "include" });
        if (!res.ok) {
          setAllowedPages([]);
          setUserInfo(null);
          return;
        }
        const data = await res.json();
        setAllowedPages(data?.allowed_pages ?? []);
        const pathRaw = data?.profile_photo_path as string | undefined;
        const normalized = pathRaw ? pathRaw.replace(/\\/g, "/") : undefined;
        let webPath: string | undefined = undefined;
        if (normalized) {
          const p = normalized.replace(/^\/+/, "");
          if (p.startsWith("static/")) {
            webPath = p; // já está em static/
          } else if (p.startsWith("media/")) {
            webPath = p.replace(/^media\//, "static/"); // media -> static
          } else if (p.startsWith("users/")) {
            webPath = `static/${p}`; // prefixa static/
          } else {
            webPath = `static/${p}`; // caminho genérico vai para static/
          }
        }
        const photoUrl = webPath ? `${API_URL}/${webPath}` : undefined;
        setUserInfo({
          username: data?.username,
          full_name: data?.full_name,
          role: data?.role,
          photoUrl,
        });
      } catch {
        setAllowedPages([]);
        setUserInfo(null);
      }
    };
    run();
  }, [API_URL]);

  const onItemClick = (to: string) => {
    navigate(to);
    setMobileOpen(false);
  };

  const handleLogout = async () => {
    const res = await fetch(`${API_URL}/api/auth/logout`, {
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
              className="shadow-md bg-[#efeae3]/80 text-slate-900 hover:bg-[#efeae3]/70 border border-[#efeae3] ring-1 ring-[#efeae3]/60 backdrop-blur-xl"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-full sm:max-w-sm p-0 bg-[#efeae3]/80 border border-[#efeae3] ring-1 ring-[#efeae3]/60 backdrop-blur-xl text-slate-900 shadow-2xl"
          >
            <SheetHeader className="p-4">
              <SheetTitle className="text-slate-900">Menu</SheetTitle>
            </SheetHeader>
            {/* User section (mobile) */}
            {userInfo && (
              <div className="px-4 pb-3">
                <div className="flex items-center gap-3 rounded-xl border border-[#efeae3] ring-1 ring-[#efeae3]/60 bg-[#efeae3]/80 backdrop-blur-xl p-3 shadow">
                  {userInfo.photoUrl ? (
                    <img src={userInfo.photoUrl} alt={userInfo.full_name || userInfo.username || "Usuário"} className="h-10 w-10 rounded-full object-cover border border-[#efeae3]" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-black/5 border border-[#efeae3] flex items-center justify-center text-slate-700">👤</div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      Olá{" "}
                      <span className="text-[#2563eb] font-semibold">
                        {(userInfo.full_name || userInfo.username || "").split(/[ \.@_]/)[0] || "fotógrafo"}
                      </span>
                    </div>
                    {userInfo.role && (
                      <div className="text-[11px] text-slate-700 truncate">{displayRole}</div>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="px-4 pb-4 space-y-2">
              {(allowedPages ? PAGES.filter(p => allowedPages.includes(p.key)) : PAGES).map((item) => (
                <button
                  key={item.path}
                  onClick={() => onItemClick(item.path)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-black/5 text-slate-800"
                >
                  {item.icon === "home" && <Home className="h-4 w-4" />}
                  {item.icon === "test" && <TestTube className="h-4 w-4" />}
                  {item.icon === "clients" && <Users className="h-4 w-4" />}
                  {item.icon === "adminAddUser" && <UserPlus className="h-4 w-4" />}
                  {item.icon === "users" && <Users className="h-4 w-4" />}
                  {item.icon === "events" && <CalendarDays className="h-4 w-4" />}
                  {item.icon === "photo" && <ImageIcon className="h-4 w-4" />}
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-black/5 text-red-600"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-sm font-medium">Sair</span>
              </button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex fixed top-0 left-0 h-screen bg-[#efeae3]/80 backdrop-blur-xl border border-[#efeae3] ring-1 ring-[#efeae3]/60 shadow-2xl transition-[width] duration-200 z-40 w-64`}
      >
        <div className="flex flex-col w-full h-full text-slate-900">
          <div className="flex items-center justify-center px-4 py-4 border-b border-[#efeae3]">
            <img src="/login.png" alt="Blink Fotos" className="h-12 w-auto" />
          </div>
          {/* User section (desktop) */}
          {userInfo && (
            <div className="px-3 pb-3">
              <div className="flex items-center gap-3 rounded-xl border border-[#efeae3] ring-1 ring-[#efeae3]/60 bg-[#efeae3]/80 backdrop-blur-xl p-3 shadow">
                {userInfo.photoUrl ? (
                  <img src={userInfo.photoUrl} alt={userInfo.full_name || userInfo.username || "Usuário"} className="h-10 w-10 rounded-full object-cover border border-[#efeae3]" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-black/5 border border-[#efeae3] flex items-center justify-center text-slate-700">👤</div>
                )}
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    Olá{" "}
                    <span className="text-[#2563eb] font-semibold">
                      {(userInfo.full_name || userInfo.username || "").split(/[ \.@_]/)[0] || "fotógrafo"}
                    </span>
                  </div>
                  {userInfo.role && (
                    <div className="text-[11px] text-slate-700 truncate">{displayRole}</div>
                  )}
                </div>
              </div>
            </div>
          )}

          <nav className="flex-1 px-2 py-2 space-y-1">
            {(allowedPages ? PAGES.filter(p => allowedPages.includes(p.key)) : PAGES).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                    isActive ? "bg-black/10 text-slate-900" : "text-slate-800 hover:bg-black/5"
                  }`
                }
              >
                <span className="shrink-0">
                  {item.icon === "home" && <Home className="h-4 w-4" />}
                  {item.icon === "test" && <TestTube className="h-4 w-4" />}
                  {item.icon === "clients" && <Users className="h-4 w-4" />}
                  {item.icon === "adminAddUser" && <UserPlus className="h-4 w-4" />}
                  {item.icon === "users" && <Users className="h-4 w-4" />}
                  {item.icon === "events" && <CalendarDays className="h-4 w-4" />}
                  {item.icon === "photo" && <ImageIcon className="h-4 w-4" />}
                </span>
                <span className="text-sm font-medium block">{item.label}</span>
              </NavLink>
            ))}
          </nav>

          <p className="px-3 pb-2 text-xs text-slate-700">Dipper Automation 2025 ©</p>

          <div className="px-2 py-2 border-t border-[#efeae3]">
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 transition-colors text-red-600 hover:bg-black/5"
            >
              <span className="shrink-0">
                <LogOut className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium block">Sair</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default ResponsiveSidebar;