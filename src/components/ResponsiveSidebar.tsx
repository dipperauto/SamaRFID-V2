"use client";

import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Home, TestTube, UserPlus, Menu, ChevronLeft, ChevronRight } from "lucide-react";

type NavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { to: "/home", label: "Home", icon: <Home className="h-4 w-4" /> },
  { to: "/teste", label: "Teste", icon: <TestTube className="h-4 w-4" /> },
  { to: "/admin/add-user", label: "Adicionar Usuário", icon: <UserPlus className="h-4 w-4" /> },
];

const ResponsiveSidebar: React.FC = () => {
  const [collapsed, setCollapsed] = React.useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = React.useState<boolean>(false);
  const navigate = useNavigate();

  const onItemClick = (to: string) => {
    navigate(to);
    setMobileOpen(false);
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
              {navItems.map((item) => (
                <button
                  key={item.to}
                  onClick={() => onItemClick(item.to)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-white/10 text-white/90"
                >
                  {item.icon}
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex fixed top-0 left-0 h-screen bg-black/50 backdrop-blur-2xl border-r border-white/25 ring-1 ring-white/20 shadow-2xl transition-[width] duration-200 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="flex flex-col w-full h-full text-white">
          <div className="flex items-center justify-between px-3 py-3 border-b border-white/25">
            <div className={`font-semibold ${collapsed ? "opacity-0 pointer-events-none" : ""}`}>
              Meu App
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed((c) => !c)}
              className="text-white hover:bg-white/10"
              aria-label={collapsed ? "Expandir" : "Recolher"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          <nav className="flex-1 px-2 py-2 space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-md px-3 py-2 transition-colors ${
                    isActive ? "bg-white/10 text-white" : "text-white/85 hover:bg-white/10"
                  }`
                }
              >
                <span className="shrink-0">{item.icon}</span>
                <span className={`text-sm font-medium ${collapsed ? "hidden" : "block"}`}>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Content offset on desktop */}
      <div className={`hidden lg:block ${collapsed ? "w-16" : "w-64"}`} />
    </>
  );
};

export default ResponsiveSidebar;