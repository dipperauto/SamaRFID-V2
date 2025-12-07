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
        <Card className="rounded-3xl border border-[#efeae3] bg-[#efeae3]/80 shadow-2xl ring-1 ring-[#efeae3]/60 backdrop-blur-xl text-slate-900">
          <CardHeader>
            <CardTitle className="text-slate-900">Blink Fotos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-slate-800">
                O Blink Fotos é uma plataforma criada para fotógrafos compartilharem seus trabalhos com o público e clientes. 
                Em eventos — principalmente de grande escala — você pode publicar suas fotos para que usuários comprem e baixem em alta resolução, de forma prática e segura.
              </p>
              <p className="text-slate-800">
                Obrigado por usar nosso sistema! Sua arte inspira, conecta pessoas e eterniza momentos — estamos aqui para apoiar seu trabalho.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-slate-700 text-sm">Status:</span>
              <Badge variant="outline" className="bg-black/5 text-slate-900 hover:bg-black/10">Online</Badge>
              <Badge className="bg-[#f26716]/15 text-[#f26716] hover:bg-[#f26716]/20">v1.0</Badge>
            </div>

            <div className="mt-6 text-xs text-slate-700">
              developed by Dipper Automation 2025
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Home;