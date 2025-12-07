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
            linear-gradient(135deg, #f0bea1 0%, #f4ad84 100%),
            radial-gradient(700px 450px at 15% 10%, rgba(244, 173, 132, 0.18), transparent 60%),
            radial-gradient(800px 500px at 85% 90%, rgba(240, 190, 161, 0.16), transparent 60%)
          `,
          backgroundColor: "#fff6f0",
        }}
      />

      {/* Blobs decorativos com animação lenta e bem suave */}
      <div className="pointer-events-none fixed -top-28 -left-28 h-[650px] w-[650px] rounded-full bg-[#f4ad84]/20 blur-3xl bg-orb-anim [animation-duration:80s]" />
      <div className="pointer-events-none fixed -bottom-24 -right-24 h-[520px] w-[520px] rounded-full bg-[#f0bea1]/18 blur-3xl bg-orb-anim [animation-duration:90s]" />
      <div className="pointer-events-none fixed top-1/3 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#f4ad84]/12 blur-3xl bg-orb-anim [animation-duration:100s]" />
    </>
  );
};

export default AnimatedBackground;