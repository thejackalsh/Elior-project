"use client";

import { useEffect, useRef, useCallback } from "react";

interface Star {
  x: number;
  y: number;
  size: number;
  opacity: number;
  opacityDelta: number;
  pulse: boolean;
  color: string;
}

interface ShootingStar {
  x: number;
  y: number;
  length: number;
  speed: number;
  angle: number;
  opacity: number;
}

interface StarfieldBackgroundProps {
  starCount?: number;
  starColor?: string;
  goldColor?: string;
  goldPercent?: number;
  pulsePercent?: number;
  shootingStars?: boolean;
  shootingStarInterval?: number;
}

function drawSpikeStar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
  opacity: number
) {
  const spike = size * 4;
  const thin = size * 0.15;

  ctx.save();
  ctx.translate(x, y);

  // Horizontal spike
  const hGrad = ctx.createLinearGradient(-spike, 0, spike, 0);
  hGrad.addColorStop(0, `rgba(${color},0)`);
  hGrad.addColorStop(0.5, `rgba(${color},${opacity})`);
  hGrad.addColorStop(1, `rgba(${color},0)`);
  ctx.beginPath();
  ctx.moveTo(-spike, 0);
  ctx.lineTo(0, thin);
  ctx.lineTo(spike, 0);
  ctx.lineTo(0, -thin);
  ctx.closePath();
  ctx.fillStyle = hGrad;
  ctx.fill();

  // Vertical spike
  const vGrad = ctx.createLinearGradient(0, -spike, 0, spike);
  vGrad.addColorStop(0, `rgba(${color},0)`);
  vGrad.addColorStop(0.5, `rgba(${color},${opacity})`);
  vGrad.addColorStop(1, `rgba(${color},0)`);
  ctx.beginPath();
  ctx.moveTo(0, -spike);
  ctx.lineTo(thin, 0);
  ctx.lineTo(0, spike);
  ctx.lineTo(-thin, 0);
  ctx.closePath();
  ctx.fillStyle = vGrad;
  ctx.fill();

  // Center dot
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${color},${opacity})`;
  ctx.fill();

  ctx.restore();
}

export function StarfieldBackground({
  starCount = 80,
  starColor = "255,255,255",
  goldColor = "255,205,110",
  goldPercent = 0.3,
  pulsePercent = 0.3,
  shootingStars = true,
  shootingStarInterval = 3500,
}: StarfieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const shootingStarRef = useRef<ShootingStar | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastShootingRef = useRef<number>(0);

  const initStars = useCallback(
    (w: number, h: number) => {
      starsRef.current = Array.from({ length: starCount }, () => {
        const pulse = Math.random() < pulsePercent;
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          size: [1, 2, 3.5][Math.floor(Math.random() * 3)],
          opacity: 0.6 + Math.random() * 0.4,
          opacityDelta: pulse ? Math.random() * 0.008 + 0.002 : 0,
          pulse,
          color: Math.random() < goldPercent ? goldColor : starColor,
        };
      });
    },
    [starCount, pulsePercent, goldPercent, goldColor, starColor]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      initStars(canvas.width, canvas.height);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const draw = (ts: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      for (const star of starsRef.current) {
        if (star.pulse) {
          star.opacity += star.opacityDelta;
          if (star.opacity >= 1) { star.opacity = 1; star.opacityDelta *= -1; }
          if (star.opacity <= 0.4) { star.opacity = 0.4; star.opacityDelta *= -1; }
        }
        drawSpikeStar(ctx, star.x, star.y, star.size, star.color, star.opacity);
      }

      if (shootingStars) {
        if (!shootingStarRef.current && ts - lastShootingRef.current > shootingStarInterval) {
          const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.4;
          shootingStarRef.current = {
            x: Math.random() * w * 0.6,
            y: Math.random() * h * 0.4,
            length: 80 + Math.random() * 60,
            speed: 7 + Math.random() * 5,
            angle,
            opacity: 1,
          };
          lastShootingRef.current = ts;
        }

        const ss = shootingStarRef.current;
        if (ss) {
          ss.x += Math.cos(ss.angle) * ss.speed;
          ss.y += Math.sin(ss.angle) * ss.speed;
          ss.opacity -= 0.018;

          if (ss.opacity <= 0 || ss.x > w || ss.y > h) {
            shootingStarRef.current = null;
          } else {
            const tailX = ss.x - Math.cos(ss.angle) * ss.length;
            const tailY = ss.y - Math.sin(ss.angle) * ss.length;
            const grad = ctx.createLinearGradient(ss.x, ss.y, tailX, tailY);
            grad.addColorStop(0, `rgba(${starColor},${ss.opacity})`);
            grad.addColorStop(1, `rgba(${starColor},0)`);
            ctx.beginPath();
            ctx.moveTo(ss.x, ss.y);
            ctx.lineTo(tailX, tailY);
            ctx.strokeStyle = grad;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      ro.disconnect();
    };
  }, [initStars, starColor, shootingStars, shootingStarInterval]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ display: "block" }}
    />
  );
}
