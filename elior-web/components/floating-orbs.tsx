"use client";

// Floating gradient orbs — biru-ungu, opacity 70%, layer di bawah bintang

const ORBS = [
  { color: "99,60,255",  size: 420, left: "8%",  top: "15%", dur: 14, delay: 0 },
  { color: "50,120,255", size: 360, left: "65%", top: "5%",  dur: 17, delay: -5 },
  { color: "160,50,255", size: 300, left: "45%", top: "55%", dur: 20, delay: -9 },
  { color: "70,160,240", size: 260, left: "82%", top: "65%", dur: 15, delay: -3 },
  { color: "120,80,255", size: 200, left: "20%", top: "70%", dur: 13, delay: -7 },
];

export function FloatingOrbs() {
  return (
    <>
      <style>{`
        @keyframes float-orb {
          0%   { transform: translate(0px, 0px) scale(1); }
          25%  { transform: translate(30px, -25px) scale(1.05); }
          50%  { transform: translate(-20px, 20px) scale(0.97); }
          75%  { transform: translate(25px, 15px) scale(1.03); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
      `}</style>
      {ORBS.map((orb, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: orb.left,
            top: orb.top,
            width: orb.size,
            height: orb.size,
            borderRadius: "50%",
            background: `radial-gradient(circle at 40% 40%, rgba(${orb.color},0.9), rgba(${orb.color},0) 70%)`,
            opacity: 0.7,
            filter: "blur(60px)",
            animation: `float-orb ${orb.dur}s ease-in-out infinite`,
            animationDelay: `${orb.delay}s`,
            pointerEvents: "none",
          }}
        />
      ))}
    </>
  );
}
