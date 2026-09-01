"use client";

import { useEffect, useRef } from "react";

// Lightweight, dependency-free confetti burst. Renders a fixed, click-through
// full-screen canvas, fires one burst on mount, then stops after ~2.5s.
// Mount it conditionally (e.g. {done && <Confetti />}) to trigger.

const COLORS = ["#6366F1", "#22C55E", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899"];

interface Particle {
  x: number; y: number; vx: number; vy: number;
  size: number; color: string; rot: number; vrot: number; life: number;
}

export function Confetti({ durationMs = 2500 }: { durationMs?: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Respect users who prefer reduced motion — skip the animation entirely.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = window.innerWidth;
    const H = window.innerHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Two burst origins near the top for a wider spray.
    const origins = [{ x: W * 0.5, y: H * 0.28 }];
    const particles: Particle[] = [];
    const COUNT = 140;
    for (let i = 0; i < COUNT; i++) {
      const o = origins[i % origins.length];
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 7;
      particles.push({
        x: o.x,
        y: o.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4, // bias upward initially
        size: 5 + Math.random() * 6,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rot: Math.random() * Math.PI,
        vrot: (Math.random() - 0.5) * 0.3,
        life: 1,
      });
    }

    const gravity = 0.16;
    const start = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, W, H);
      for (const p of particles) {
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        p.life = Math.max(0, 1 - elapsed / durationMs);
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (elapsed < durationMs) {
        raf = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, W, H);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(raf);
  }, [durationMs]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  );
}
