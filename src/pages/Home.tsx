"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Home: React.FC = () => {
  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center p-4"
    >
      {/* FULLSCREEN GRADIENT BACKDROP */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(900px 500px at 0% 0%, rgba(37, 99, 235, 0.28), transparent 60%),
            radial-gradient(800px 450px at 100% 100%, rgba(255, 255, 255, 0.65), transparent 55%),
            radial-gradient(700px 400px at 100% 0%, rgba(147, 197, 253, 0.35), transparent 55%),
            radial-gradient(700px 400px at 0% 100%, rgba(255, 255, 255, 0.55), transparent 55%)
          `,
          backgroundColor: "#eef5ff",
        }}
      />
      {/* Decorative blobs over backdrop */}
      <div className="pointer-events-none fixed -top-28 -left-28 h-[650px] w-[650px] rounded-full bg-blue-400/35 blur-3xl" />
      <div className="pointer-events-none fixed -bottom-24 -right-24 h-[520px] w-[520px] rounded-full bg-white/50 blur-3xl" />

      <div className="relative z-10 w-full max-w-3xl">
        <Card className="rounded-3xl border border-white/25 bg-black/40 shadow-2xl ring-1 ring-white/20 backdrop-blur-2xl backdrop-saturate-150 backdrop-brightness-75">
          <CardHeader>
            <CardTitle className="text-white">Bem-vindo ao App</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-white/90">
              Esta é a página inicial do seu aplicativo. Use o menu para navegar entre as áreas,
              como testes e administração de usuários. O layout é responsivo: no computador,
              há uma barra lateral retrátil; no celular, o menu abre em tela cheia.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-white/80 text-sm">Status:</span>
              <Badge variant="outline" className="bg-white/10 text-white">Online</Badge>
              <Badge className="bg-white/20 text-white hover:bg-white/25">v1.0</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;