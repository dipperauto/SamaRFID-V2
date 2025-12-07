"use client";

import React from "react";

const AnimatedBackground: React.FC = () => {
  return (
    <>
      {/* Degradê base em tela cheia */}
      <div
        className="fixed inset-0 -z-10"
        style={{
          backgroundImage: `
            radial-gradient(900px 500px at 0% 0%, rgba(247, 120, 33, 0.20), transparent 60%),
            radial-gradient(800px 450px at 100% 100%, rgba(255, 255, 255, 0.70), transparent 55%),
            radial-gradient(700px 400px at 100% 0%, rgba(239, 234, 227, 0.35), transparent 55%),
            radial-gradient(700px 400px at 0% 100%, rgba(255, 255, 255, 0.55), transparent 55%)
          `,
          backgroundColor: "#fff9f5",
        }}
      />

      {/* Blobs decorativos com animação MUITO lenta e suave */}
      <div className="pointer-events-none fixed -top-28 -left-28 h-[650px] w-[650px] rounded-full bg-[#f77821]/25 blur-3xl bg-orb-anim" />
      <div className="pointer-events-none fixed -bottom-24 -right-24 h-[520px] w-[520px] rounded-full bg-white/60 blur-3xl bg-orb-anim [animation-duration:70s]" />
      <div className="pointer-events-none fixed top-1/3 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#efeae3]/40 blur-3xl bg-orb-anim [animation-duration:90s]" />
    </>
  );
};

export default AnimatedBackground;