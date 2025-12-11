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
            linear-gradient(0deg, rgba(255,255,255,0.60), rgba(255,255,255,0.60)),
            linear-gradient(135deg, #bfdcff 0%, #a7c8ff 100%),
            radial-gradient(700px 450px at 15% 10%, rgba(147, 197, 253, 0.16), transparent 60%),
            radial-gradient(800px 500px at 85% 90%, rgba(191, 219, 254, 0.14), transparent 60%)
          `,
          backgroundColor: "#eef7ff",
        }}
      />

      {/* Blobs decorativos com animação lenta e bem suave */}
      <div className="pointer-events-none fixed -top-28 -left-28 h-[650px] w-[650px] rounded-full bg-[#93c5fd]/16 blur-3xl bg-orb-anim [animation-duration:90s]" />
      <div className="pointer-events-none fixed -bottom-24 -right-24 h-[520px] w-[520px] rounded-full bg-[#bfdbfe]/14 blur-3xl bg-orb-anim [animation-duration:100s]" />
      <div className="pointer-events-none fixed top-1/3 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[#60a5fa]/12 blur-3xl bg-orb-anim [animation-duration:110s]" />
    </>
  );
};

export default AnimatedBackground;