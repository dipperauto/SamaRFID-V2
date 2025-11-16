"use client";

import React from "react";
import ResponsiveSidebar from "./ResponsiveSidebar";
import { Outlet } from "react-router-dom";

const AppLayout: React.FC = () => {
  return (
    <div className="min-h-screen w-full bg-slate-50">
      <ResponsiveSidebar />
      <main className="relative min-h-screen w-full lg:pl-16 xl:pl-64">
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