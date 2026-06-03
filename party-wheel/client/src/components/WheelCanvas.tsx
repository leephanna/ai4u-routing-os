import { useEffect, useRef, useCallback } from "react";
import { buildWheelSegments, SEGMENT_COLORS, type WheelSegment } from "../../../shared/gameTypes";

interface WheelCanvasProps {
  rotation: number; // current rotation in radians
  isSpinning: boolean;
  size?: number;
  onSegmentLand?: (segmentIndex: number) => void;
}

const SEGMENTS = buildWheelSegments();
const SEGMENT_COUNT = SEGMENTS.length;
const ANGLE_PER_SEGMENT = (2 * Math.PI) / SEGMENT_COUNT;

export default function WheelCanvas({
  rotation,
  isSpinning,
  size = 320,
  onSegmentLand,
}: WheelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastSegmentRef = useRef<number>(-1);

  const drawWheel = useCallback((ctx: CanvasRenderingContext2D, rot: number) => {
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2 - 4;

    ctx.clearRect(0, 0, size, size);

    // Section 2c: Premium outer chrome ring with multi-layer glow
    // Outermost soft halo
    const haloGrad = ctx.createRadialGradient(cx, cy, radius - 4, cx, cy, radius + 18);
    haloGrad.addColorStop(0, "rgba(139,92,246,0.55)");
    haloGrad.addColorStop(0.5, "rgba(109,40,217,0.25)");
    haloGrad.addColorStop(1, "rgba(139,92,246,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 18, 0, 2 * Math.PI);
    ctx.fillStyle = haloGrad;
    ctx.fill();

    // Chrome ring (metallic gradient stroke)
    const chromeGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    chromeGrad.addColorStop(0, "rgba(255,255,255,0.9)");
    chromeGrad.addColorStop(0.25, "rgba(200,180,255,0.7)");
    chromeGrad.addColorStop(0.5, "rgba(139,92,246,0.95)");
    chromeGrad.addColorStop(0.75, "rgba(200,180,255,0.7)");
    chromeGrad.addColorStop(1, "rgba(255,255,255,0.9)");
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 5, 0, 2 * Math.PI);
    ctx.strokeStyle = chromeGrad;
    ctx.lineWidth = 5;
    ctx.stroke();

    // Inner chrome ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 1, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw segments
    SEGMENTS.forEach((seg: WheelSegment, i: number) => {
      const startAngle = rot + i * ANGLE_PER_SEGMENT;
      const endAngle = startAngle + ANGLE_PER_SEGMENT;

      // Segment fill
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();

      // Alternating shade for visual separation
      const baseColor = seg.color;
      const isEven = i % 2 === 0;
      ctx.fillStyle = isEven ? baseColor : adjustBrightness(baseColor, -25);
      ctx.fill();

      // Segment border
      ctx.strokeStyle = "rgba(0,0,0,0.4)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Bug 1: Segment label — isLeftHalf flip ensures all 360° labels are readable
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + ANGLE_PER_SEGMENT / 2);

      const textRadius = radius * 0.58;
      const labelMaxWidth = radius * 0.38;

      // Determine if this segment's midpoint is in the left half of the wheel
      const midAngle = startAngle + ANGLE_PER_SEGMENT / 2;
      const normalizedMid = ((midAngle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const isLeftHalf = normalizedMid > Math.PI / 2 && normalizedMid < 3 * Math.PI / 2;

      const label = seg.label.toUpperCase();
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.font = `bold ${size < 280 ? 7 : 8}px 'Orbitron', sans-serif`;
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 4;

      if (isLeftHalf) {
        // Flip 180° so text isn't upside-down on the left half
        ctx.rotate(Math.PI);
        ctx.textAlign = "right";
        ctx.fillText(label, -textRadius + labelMaxWidth, 3, labelMaxWidth);
      } else {
        ctx.textAlign = "left";
        ctx.fillText(label, textRadius - labelMaxWidth, 3, labelMaxWidth);
      }
      ctx.restore();
    });

    // Section 2c: Jewel hub — concentric rings with gem-like radial gradient
    const hubR = Math.max(28, size * 0.09);
    // Outer hub glow
    const hubHalo = ctx.createRadialGradient(cx, cy, hubR * 0.5, cx, cy, hubR * 1.6);
    hubHalo.addColorStop(0, "rgba(139,92,246,0.5)");
    hubHalo.addColorStop(1, "rgba(139,92,246,0)");
    ctx.beginPath();
    ctx.arc(cx, cy, hubR * 1.6, 0, 2 * Math.PI);
    ctx.fillStyle = hubHalo;
    ctx.fill();
    // Hub body
    const hubGradient = ctx.createRadialGradient(cx - hubR * 0.3, cy - hubR * 0.3, 0, cx, cy, hubR);
    hubGradient.addColorStop(0, "#a78bfa");
    hubGradient.addColorStop(0.3, "#7c3aed");
    hubGradient.addColorStop(0.7, "#4c1d95");
    hubGradient.addColorStop(1, "#1e1b4b");
    ctx.beginPath();
    ctx.arc(cx, cy, hubR, 0, 2 * Math.PI);
    ctx.fillStyle = hubGradient;
    ctx.fill();
    // Outer chrome ring
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    // Inner ring accent
    ctx.beginPath();
    ctx.arc(cx, cy, hubR * 0.72, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(196,181,253,0.5)";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Hub logo text
    ctx.fillStyle = "rgba(255,255,255,0.95)";
    ctx.font = `bold ${Math.max(8, Math.round(size * 0.028))}px 'Orbitron', sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(139,92,246,0.8)";
    ctx.shadowBlur = 6;
    ctx.fillText("AI4U", cx, cy);
    ctx.shadowBlur = 0;

    // Pointer (top center)
    const pointerX = cx;
    const pointerY = 6;
    ctx.beginPath();
    ctx.moveTo(pointerX - 12, pointerY);
    ctx.lineTo(pointerX + 12, pointerY);
    ctx.lineTo(pointerX, pointerY + 22);
    ctx.closePath();
    ctx.fillStyle = "#ffffff";
    ctx.shadowColor = "rgba(139,92,246,0.8)";
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.strokeStyle = "rgba(139,92,246,0.9)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawWheel(ctx, rotation);

    // Check which segment is at the top (pointer position = 270 degrees = -PI/2)
    const pointerAngle = -Math.PI / 2;
    const normalizedRot = ((rotation % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const adjustedAngle = ((pointerAngle - normalizedRot) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    const segmentIndex = Math.floor(adjustedAngle / ANGLE_PER_SEGMENT) % SEGMENT_COUNT;

    if (!isSpinning && segmentIndex !== lastSegmentRef.current) {
      lastSegmentRef.current = segmentIndex;
      onSegmentLand?.(segmentIndex);
    }
  }, [rotation, isSpinning, drawWheel, onSegmentLand]);

  return (
    <div className="relative inline-block">
      {/* Section 2c: Outer spinning glow ring */}
      <div
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{
          background: "transparent",
          boxShadow: isSpinning
            ? "0 0 40px 12px rgba(139,92,246,0.55), 0 0 80px 24px rgba(109,40,217,0.3), 0 0 120px 40px rgba(139,92,246,0.1)"
            : "0 0 20px 6px rgba(139,92,246,0.3), 0 0 40px 12px rgba(109,40,217,0.15)",
          transition: "box-shadow 0.4s ease",
          borderRadius: "50%",
        }}
      />
      <canvas
        ref={canvasRef}
        width={size}
        height={size}
        className="rounded-full relative z-10"
        style={{
          filter: isSpinning
            ? "drop-shadow(0 0 24px rgba(139,92,246,0.7)) brightness(1.08)"
            : "drop-shadow(0 0 10px rgba(139,92,246,0.4))",
          transition: "filter 0.4s ease",
        }}
      />
    </div>
  );
}

function adjustBrightness(hex: string, amount: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  return `rgb(${clamp(r + amount)},${clamp(g + amount)},${clamp(b + amount)})`;
}
