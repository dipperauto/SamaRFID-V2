"use client";

import React from "react";
import { Loader2 } from "lucide-react";

type Props = {
  message?: string;
};

const LoadingOverlay: React.FC<Props> = ({ message = "Processando imagem..." }) => {
  return (
    <div className="absolute inset-0 z-20 bg-white/70 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-6 w-6 animate-spin text-slate-700" />
        <div className="text-sm text-slate-700">{message}</div>
      </div>
    </div>
  );
};

export default LoadingOverlay;