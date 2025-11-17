"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Home: React.FC = () => {
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center p-4"
    >
      {/* REMOVIDO: backdrop e blobs locais, usamos AnimatedBackground global */}
      {/* <div className="fixed inset-0 -z-10" style={{ backgroundImage: ..., backgroundColor: ... }} /> */}
      {/* <div className="pointer-events-none fixed -top-28 -left-28 ..."/> */}
      {/* <div className="pointer-events-none fixed -bottom-24 -right-24 ..."/> */}

      <div className="relative z-10 w-full max-w-3xl">
        <Card className="rounded-3xl border border-white/25 bg-black/40 shadow-2xl ring-1 ring-white/20 backdrop-blur-2xl backdrop-saturate-150 backdrop-brightness-75">
          <CardHeader>
            <CardTitle className="text-white">Bem-vindo ao Dipper Portal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-white/90">
                Este é um aplicativo onde você pode gerenciar dados e automações com facilidade e segurança.
              </p>
              <p className="text-white/90">
                Agradecemos sua preferência ao usar Dipper Portal.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-white/80 text-sm">Status:</span>
              <Badge variant="outline" className="bg-white/10 text-white">Online</Badge>
              <Badge className="bg-white/20 text-white hover:bg-white/25">v1.0</Badge>
            </div>

            <div className="mt-6 text-xs text-white/70">
              developed by Dipper Automation 2025
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;