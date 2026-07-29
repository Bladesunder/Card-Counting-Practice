import { useEffect, useRef } from "react";

export type Burst = {
  id: number;
  x: number;
  y: number;
  color: string;
  kind: "confetti" | "spark" | "ring";
};

interface Particle {
  x: number; y: number; vx: number; vy: number; life: number; max: number;
  color: string; size: number; rot: number; vr: number; shape: "sq" | "circ";
}

interface Props {
  bursts: Burst[];
}

export function ParticleLayer({ bursts }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const ringsRef = useRef<{x:number;y:number;t:number;max:number;color:string}[]>([]);
  const rafRef = useRef<number>(0);
  const seenRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const c = canvasRef.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      c.width = window.innerWidth * dpr;
      c.height = window.innerHeight * dpr;
      c.style.width = window.innerWidth + "px";
      c.style.height = window.innerHeight + "px";
      const ctx = c.getContext("2d");
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    for (const b of bursts) {
      if (seenRef.current.has(b.id)) continue;
      seenRef.current.add(b.id);
      if (b.kind === "ring") {
        ringsRef.current.push({ x: b.x, y: b.y, t: 0, max: 500, color: b.color });
        continue;
      }
      const count = b.kind === "confetti" ? 34 : 18;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
        const speed = (b.kind === "confetti" ? 3 : 5) + Math.random() * 4;
        particlesRef.current.push({
          x: b.x, y: b.y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (b.kind === "confetti" ? 2 : 0),
          life: 0,
          max: 700 + Math.random() * 500,
          color: b.color,
          size: 3 + Math.random() * (b.kind === "confetti" ? 5 : 3),
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.4,
          shape: b.kind === "confetti" ? "sq" : "circ",
        });
      }
    }
  }, [bursts]);

  useEffect(() => {
    const c = canvasRef.current!;
    const ctx = c.getContext("2d")!;
    let last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(48, t - last);
      last = t;
      ctx.clearRect(0, 0, c.width, c.height);
      // particles
      const alive: Particle[] = [];
      for (const p of particlesRef.current) {
        p.life += dt;
        if (p.life > p.max) continue;
        p.vy += 0.28; // gravity
        p.vx *= 0.995;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const a = 1 - p.life / p.max;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        if (p.shape === "sq") {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 1.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
        alive.push(p);
      }
      particlesRef.current = alive;

      // rings
      const rings: typeof ringsRef.current = [];
      for (const r of ringsRef.current) {
        r.t += dt;
        if (r.t > r.max) continue;
        const p = r.t / r.max;
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 20 + p * 140, 0, Math.PI * 2);
        ctx.stroke();
        rings.push(r);
      }
      ringsRef.current = rings;
      ctx.globalAlpha = 1;
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-40"
    />
  );
}
