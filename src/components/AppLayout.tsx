"use client";

import React from "react";
import ResponsiveSidebar from "./ResponsiveSidebar";
import { Outlet } from "react-router-dom";
import { Navigate, useLocation } from "react-router-dom";
import { pathToKey, PAGES } from "@/utils/pages";

const AppLayout: React.FC = () => {
  const location = useLocation();
  const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
  const [checked, setChecked] = React.useState(false);
  const [authed, setAuthed] = React.useState(false);
  const [allowedPages, setAllowedPages] = React.useState<string[]>([]);

  React.useEffect(() => {
    const check = async () => {
      setChecked(false);
      const res = await fetch(`${API_URL}/auth/me`, { method: "GET", credentials: "include" });
      if (!res.ok) {
        setAuthed(false);
        setAllowedPages([]);
        setChecked(true);
        return;
      }
      const data = await res.json();
      setAuthed(true);
      setAllowedPages(data?.allowed_pages ?? []);
      setChecked(true);
    };
    check();
  }, [API_URL, location.pathname]);

  if (!checked) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-600">Verificando sessão…</div>
      </div>
    );
  }

  if (!authed) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  // Bloqueio por permissão de página
  const currentKey = pathToKey(location.pathname);
  if (currentKey && !allowedPages.includes(currentKey)) {
    const fallback = PAGES.find((p) => allowedPages.includes(p.key))?.path || "/home";
    return <Navigate to={fallback} replace />;
  }

  return (
    <div className="min-h-screen w-full bg-slate-50">
      <ResponsiveSidebar />
      <main className="relative min-h-screen w-full lg:pl-64">
        {/* Top spacing for mobile button area */}
        <div className="lg:hidden h-16" />
        <div className="p-4 md:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AppLayout;