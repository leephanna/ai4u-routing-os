import { useEffect, useRef } from "react";
import { buildWheelSegments, SEGMENT_COLORS, type WheelSegment } from "../../../shared/gameTypes";

const SEGMENTS = buildWheelSegments();
const SEGMENT_COUNT = SEGMENTS.length;
const ANGLE_PER_SEGMENT = (2 * Math.PI) / SEGMENT_COUNT;

interface WheelPreviewProps {
  size?: number;
  /** radians/second — set to 0 for static */
  speed?: number;
}

function adjustBrightness(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `rgb(${clamp(r + amount)},${clamp(g + amount)},${clamp(b + amount)})`;
}

export default function WheelPreview({ size = 280, speed = 0.4 }: WheelPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotRef = useRef(0);
  const rafRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = (rot: number) => {
      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 4;

      ctx.clearRect(0, 0, size, size);

      // Outer glow
      const glow = ctx.createRadialGradient(cx, cy, radius - 8, cx, cy, radius + 6);
      glow.addColorStop(0, "rgba(139,92,246,0.5)");
      glow.addColorStop(1, "rgba(139,92,246,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 6, 0, 2 * Math.PI);
      ctx.fillStyle = glow;
      ctx.fill();

      // Segments
      SEGMENTS.forEach((seg: WheelSegment, i: number) => {
        const start = rot + i * ANGLE_PER_SEGMENT;
        const end = start + ANGLE_PER_SEGMENT;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, start, end);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? seg.color : adjustBrightness(seg.color, -20);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 1.2;
        ctx.stroke();

        // Label
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(start + ANGLE_PER_SEGMENT / 2);
        ctx.scale(-1, -1);
        ctx.rotate(Math.PI);
        ctx.textAlign = "left";
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = `bold ${size < 200 ? 6 : 7}px 'Orbitron', sans-serif`;
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 3;
        ctx.fillText(seg.label.toUpperCase(), -(radius - 10), 3, radius * 0.55);
        ctx.restore();
      });

      // Center hub
      const hub = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24);
      hub.addColorStop(0, "#1e1b4b");
      hub.addColorStop(0.6, "#312e81");
      hub.addColorStop(1, "#4c1d95");
      ctx.beginPath();
      ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
      ctx.fillStyle = hub;
      ctx.fill();
      ctx.strokeStyle = "rgba(139,92,246,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "bold 8px 'Orbitron', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("AI4U", cx, cy);

      // Pointer
      ctx.beginPath();
      ctx.moveTo(cx - 10, 5);
      ctx.lineTo(cx + 10, 5);
      ctx.lineTo(cx, 22);
      ctx.closePath();
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(139,92,246,0.9)";
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    const loop = (time: number) => {
      const dt = lastTimeRef.current ? (time - lastTimeRef.current) / 1000 : 0;
      lastTimeRef.current = time;
      rotRef.current += speed * dt;
      draw(rotRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [size, speed]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className="rounded-full"
      style={{
        filter: "drop-shadow(0 0 24px rgba(139,92,246,0.7)) drop-shadow(0 0 8px rgba(6,182,212,0.3))",
      }}
    />
  );
}
