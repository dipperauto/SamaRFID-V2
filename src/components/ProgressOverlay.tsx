"use client";

import React from "react";
import { Progress } from "@/components/ui/progress";
import { Loader2 } from "lucide-react";

type Props = {
  phase: "upload" | "processing";
  percent: number; // 0..100
  onCancel?: () => void;
};

const labels = {
  upload: "Enviando imagens...",
  processing: "Aplicando LUT nas imagens...",
};

const ProgressOverlay: React.FC<Props> = ({ phase, percent, onCancel }) => {
  return (
    <div className="fixed inset-0 z-50 bg-white/70 backdrop-blur-sm flex items-center justify-center">
      <div className="w-full max-w-md rounded-xl border bg-white p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          <Loader2 className="h-5 w-5 animate-spin text-slate-700" />
          <span className="text-slate-900 font-medium">{labels[phase]}</span>
        </div>
        <Progress value={percent} className="w-full" />
        <div className="mt-2 text-xs text-slate-600">{Math.round(percent)}%</div>
        {onCancel && (
          <div className="mt-4 text-right">
            <button
              className="text-xs px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50"
              onClick={onCancel}
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProgressOverlay;