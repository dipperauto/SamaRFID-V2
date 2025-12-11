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
        <Card className="rounded-3xl border border-white/20 bg-[#0b1d3a]/50 shadow-2xl ring-1 ring-white/10 backdrop-blur-xl text-white">
          <CardHeader>
            <CardTitle className="text-white">
              Bem-vindo ao <span className="text-[#3b82f6] font-semibold">BLINK</span> FOTOS
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-white/90">
                O Blink Fotos é uma plataforma criada para fotógrafos compartilharem seus trabalhos com o público e clientes. 
                Em eventos — principalmente de grande escala — você pode publicar suas fotos para que usuários comprem e baixem em alta resolução, de forma prática e segura.
              </p>
              <p className="text-white/90">
                Obrigado por usar nosso sistema! Sua arte inspira, conecta pessoas e eterniza momentos — estamos aqui para apoiar seu trabalho.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-white/80 text-sm">Status:</span>
              <Badge variant="outline" className="bg-white/10 text-white hover:bg-white/15">Online</Badge>
              <Badge className="bg-[#3b82f6]/20 text-[#e6f0ff] hover:bg-[#2563eb]/25">v1.0</Badge>
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