import React, { useEffect, useRef } from "react";

export const LiquidGlassSphere: React.FC<{ size?: number }> = ({ size = 20 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const width = size;
    const height = size;
    const N = 40; // Constellation density
    const R = size * 0.38;

    class Point3D {
      x: number;
      y: number;
      z: number;
      ox: number;
      oy: number;
      oz: number;
      
      constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        this.ox = x;
        this.oy = y;
        this.oz = z;
      }
      
      rotateX(angle: number) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const y = this.y * cos - this.z * sin;
        const z = this.y * sin + this.z * cos;
        this.y = y;
        this.z = z;
      }
      
      rotateY(angle: number) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const x = this.x * cos + this.z * sin;
        const z = -this.x * sin + this.z * cos;
        this.x = x;
        this.z = z;
      }
      
      project() {
        const f = size * 1.5;
        const scale = f / (f + this.z);
        return {
          x: this.x * scale + width / 2,
          y: this.y * scale + height / 2,
          scale,
        };
      }
    }

    const pts: Point3D[] = [];
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(1 - 2 * (i + 0.5) / N);
      const th = Math.PI * (1 + Math.sqrt(5)) * i;
      pts.push(
        new Point3D(
          R * Math.sin(phi) * Math.cos(th),
          R * Math.sin(phi) * Math.sin(th),
          R * Math.cos(phi)
        )
      );
    }

    type Spark = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      color: string;
    };
    let sparks: Spark[] = [];

    let rx = 0.015;
    let ry = 0.015;
    let drag = false;
    let px = 0;
    let py = 0;
    let mx = 0;
    let my = 0;
    let isHovered = false;
    let animationFrameId: number;

    const handleMouseDown = (e: MouseEvent) => {
      drag = true;
      px = e.clientX;
      py = e.clientY;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mx = e.clientX - rect.left;
      my = e.clientY - rect.top;

      if (!drag) return;
      ry = (e.clientX - px) * 0.015;
      rx = (e.clientY - py) * 0.015;
      px = e.clientX;
      py = e.clientY;

      if (sparks.length < 50) {
        const hue = (performance.now() / 20) % 360;
        sparks.push({
          x: mx,
          y: my,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5 - 0.5,
          life: 1.0,
          maxLife: 20 + Math.random() * 20,
          color: `hsla(${hue}, 100%, 75%, 0.8)`,
        });
      }
    };

    const handleMouseUp = () => {
      drag = false;
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    
    canvas.addEventListener("mouseenter", () => { isHovered = true; });
    canvas.addEventListener("mouseleave", () => { isHovered = false; drag = false; });

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      if (!drag) {
        rx *= 0.95;
        ry *= 0.95;
        const baseSpeed = isHovered ? 0.008 : 0.004;
        rx = rx * 0.8 + baseSpeed;
        ry = ry * 0.8 + baseSpeed;
      }

      pts.forEach((p) => {
        p.rotateX(rx);
        p.rotateY(ry);
      });

      const projected = pts.map((p) => ({
        proj: p.project(),
        z: p.z,
      }));

      ctx.lineWidth = 0.6;
      ctx.globalCompositeOperation = "screen";
      
      const time = performance.now();
      const hueBase = (time / 60) % 360;

      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const dx = projected[i].proj.x - projected[j].proj.x;
          const dy = projected[i].proj.y - projected[j].proj.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          const threshold = size * 0.35;
          if (dist < threshold) {
            const alpha = (1 - dist / threshold) * 0.25 * (projected[i].z + R) / (R * 2);
            ctx.strokeStyle = `hsla(${(hueBase + projected[i].z) % 360}, 90%, 65%, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(projected[i].proj.x, projected[i].proj.y);
            ctx.lineTo(projected[j].proj.x, projected[j].proj.y);
            ctx.stroke();
          }
        }
      }

      sparks = sparks.filter((s) => {
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 1 / s.maxLife;
        if (s.life <= 0) return false;

        ctx.fillStyle = s.color;
        ctx.globalAlpha = s.life;
        ctx.beginPath();
        ctx.arc(s.x, s.y, size * 0.03 * s.life, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
      ctx.globalAlpha = 1.0;

      projected.sort((a, b) => b.z - a.z);

      projected.forEach((node) => {
        const dotSize = Math.max(0.6, ((node.z + R) / R) * (size * 0.045));
        const nodeHue = (hueBase + node.z * 1.5) % 360;

        const radialGrad = ctx.createRadialGradient(
          node.proj.x,
          node.proj.y,
          0,
          node.proj.x,
          node.proj.y,
          dotSize * 2.2
        );
        radialGrad.addColorStop(0, `hsla(${nodeHue}, 100%, 75%, 0.85)`);
        radialGrad.addColorStop(0.3, `hsla(${(nodeHue + 40) % 360}, 100%, 60%, 0.25)`);
        radialGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = radialGrad;
        ctx.beginPath();
        ctx.arc(node.proj.x, node.proj.y, dotSize * 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `hsla(${nodeHue}, 100%, 90%, 0.95)`;
        ctx.beginPath();
        ctx.arc(node.proj.x, node.proj.y, dotSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className="cursor-grab active:cursor-grabbing hover:scale-115 transition-transform duration-300"
      style={{ display: "block" }}
    />
  );
};
