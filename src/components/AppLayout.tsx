"use client";

import React from "react";
import ResponsiveSidebar from "./ResponsiveSidebar";
import { Outlet } from "react-router-dom";
import { Navigate, useLocation } from "react-router-dom";
import { isLoggedIn } from "@/utils/auth";

const AppLayout: React.FC = () => {
  const location = useLocation();
  const logged = isLoggedIn();

  if (!logged) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
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