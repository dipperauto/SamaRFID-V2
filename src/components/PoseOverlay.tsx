"use client";

import React from "react";

type Landmark = { name: string; x: number; y: number; visibility?: number };

type Props = {
  imageSrc: string;
  landmarks: Landmark[];
  selectedAnchor?: string | null;
  onSelectAnchor?: (name: string) => void;
};

const EDGES: [string, string][] = [
  ["left_shoulder", "right_shoulder"],
  ["left_shoulder", "left_elbow"],
  ["left_elbow", "left_wrist"],
  ["right_shoulder", "right_elbow"],
  ["right_elbow", "right_wrist"],
  ["left_hip", "right_hip"],
  ["left_hip", "left_knee"],
  ["left_knee", "left_ankle"],
  ["right_hip", "right_knee"],
  ["right_knee", "right_ankle"],
  ["nose", "left_eye"], ["nose", "right_eye"],
  ["left_eye", "left_ear"], ["right_eye", "right_ear"],
];

const PoseOverlay: React.FC<Props> = ({ imageSrc, landmarks, selectedAnchor = null, onSelectAnchor }) => {
  const containerRef = React.useRef<HTMLDivElement | null>(null);

  const lmMap = React.useMemo(() => {
    const m = new Map<string, Landmark>();
    landmarks.forEach((lm) => m.set(lm.name, lm));
    return m;
  }, [landmarks]);

  const getPointStyle = (lm: Landmark) => {
    const isSelected = lm.name === selectedAnchor;
    return `absolute -translate-x-1/2 -translate-y-1/2 rounded-full border ${
      isSelected ? "bg-blue-600 border-blue-700 w-3.5 h-3.5" : "bg-fuchsia-500/80 border-fuchsia-600 w-2.5 h-2.5"
    } cursor-pointer`;
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl bg-black/5 rounded-md overflow-hidden border">
      <img src={imageSrc} alt="Imagem" className="w-full h-auto block" />
      {/* Overlay de linhas */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {EDGES.map(([a, b], idx) => {
          const la = lmMap.get(a);
          const lb = lmMap.get(b);
          if (!la || !lb) return null;
          const xa = `${la.x * 100}%`;
          const ya = `${la.y * 100}%`;
          const xb = `${lb.x * 100}%`;
          const yb = `${lb.y * 100}%`;
          return <line key={idx} x1={xa} y1={ya} x2={xb} y2={yb} stroke="#22c55e" strokeWidth={2} strokeOpacity={0.7} />;
        })}
      </svg>
      {/* Overlay de pontos clicáveis */}
      {landmarks.map((lm) => (
        <div
          key={lm.name}
          style={{ left: `${lm.x * 100}%`, top: `${lm.y * 100}%` }}
          className={getPointStyle(lm)}
          onClick={() => onSelectAnchor && onSelectAnchor(lm.name)}
          title={lm.name}
        />
      ))}
      {/* legenda simples */}
      <div className="absolute bottom-2 left-2 rounded-md bg-white/80 px-2 py-1 text-xs text-slate-700">
        Clique em um ponto para escolher a âncora. Selecionado: {selectedAnchor || "—"}
      </div>
    </div>
  );
};

export default PoseOverlay;