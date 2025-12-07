"use client";

import React from "react";
import { useLocation } from "react-router-dom";
import { useIsFetching } from "@tanstack/react-query";
import { Eye } from "lucide-react";

const PageTransitionOverlay: React.FC = () => {
  const location = useLocation();
  const isFetching = useIsFetching();
  const [isTransitioning, setIsTransitioning] = React.useState(false);
  const prevPathRef = React.useRef<string>(location.pathname + location.search);

  React.useEffect(() => {
    const prev = prevPathRef.current;
    const curr = location.pathname + location.search;

    if (prev !== curr) {
      prevPathRef.current = curr;
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 700); // duração da transição
      return () => clearTimeout(timer);
    }
  }, [location.pathname, location.search]);

  const showOverlay = isTransitioning || isFetching > 0;

  if (!showOverlay) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-white/70 backdrop-blur-sm flex items-center justify-center"
        aria-live="polite"
        aria-busy="true"
        role="progressbar"
      >
        <div className="flex flex-col items-center gap-3">
          <div className="h-14 w-14 rounded-full bg-white shadow-sm flex items-center justify-center ring-1 ring-black/5">
            <Eye className="h-7 w-7 text-black/80 blink" />
          </div>
          <div className="text-sm text-black/70">Carregando...</div>
        </div>
      </div>

      <style>
        {`
          @keyframes blink {
            0%, 38% { transform: scaleY(1); }
            40% { transform: scaleY(0.1); }
            42% { transform: scaleY(1); }
            80% { transform: scaleY(1); }
            82% { transform: scaleY(0.1); }
            84%, 100% { transform: scaleY(1); }
          }
          .blink {
            animation: blink 1.6s ease-in-out infinite;
            transform-origin: center;
          }
        `}
      </style>
    </>
  );
};

export default PageTransitionOverlay;