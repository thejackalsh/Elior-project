"use client";

import { useRef, useState, useEffect } from "react";
import type { CameraState } from "./use-camera";

export type SmartCaptureStatus =
  | "idle"          // kamera tidak aktif / fitur off
  | "stabilizing"   // kamera diam, menghitung mundur
  | "locked-dark"   // terlalu gelap
  | "locked-moving" // kamera bergerak
  | "cooldown";     // baru saja capture, menunggu

function sampleFrame(video: HTMLVideoElement): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = 160;
  canvas.height = 90;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, 160, 90);
  return ctx.getImageData(0, 0, 160, 90);
}

function computeBrightness(data: Uint8ClampedArray): number {
  let sum = 0;
  const n = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    // Rec. 709 luma
    sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  }
  return sum / n;
}

function computeMotion(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let sum = 0;
  const n = a.length / 4;
  for (let i = 0; i < a.length; i += 4) {
    sum +=
      Math.abs(a[i] - b[i]) +
      Math.abs(a[i + 1] - b[i + 1]) +
      Math.abs(a[i + 2] - b[i + 2]);
  }
  return sum / (n * 3);
}

interface UseSmartCaptureOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  camState: CameraState;
  onCapture: () => void;
  enabled?: boolean;
  stabilizeMs?: number;   // diam berapa lama sebelum capture (ms)
  cooldownMs?: number;    // jeda setelah capture (ms)
  darkThreshold?: number; // 0-255 luma, bawah ini = gelap
  motionThreshold?: number; // 0-255 mean diff, atas ini = bergerak
  sampleInterval?: number;  // ms antar frame check
}

export function useSmartCapture({
  videoRef,
  camState,
  onCapture,
  enabled = true,
  stabilizeMs = 1500,
  cooldownMs = 5000,
  darkThreshold = 25,
  motionThreshold = 12,
  sampleInterval = 150,
}: UseSmartCaptureOptions) {
  const [status, setStatus] = useState<SmartCaptureStatus>("idle");
  const [progress, setProgress] = useState(0); // 0–1, progress stabilisasi

  const prevData = useRef<Uint8ClampedArray | null>(null);
  const stableStart = useRef<number | null>(null);
  const cooldownEnd = useRef<number | null>(null);
  const captureRef = useRef(onCapture);
  captureRef.current = onCapture;

  useEffect(() => {
    if (camState !== "active" || !enabled) {
      prevData.current = null;
      stableStart.current = null;
      setStatus("idle");
      setProgress(0);
      return;
    }

    const tid = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const now = Date.now();

      // Masih dalam cooldown
      if (cooldownEnd.current !== null) {
        if (now < cooldownEnd.current) {
          setStatus("cooldown");
          setProgress(0);
          return;
        }
        // Cooldown selesai — reset
        cooldownEnd.current = null;
        prevData.current = null;
        stableStart.current = null;
      }

      const frame = sampleFrame(video);
      if (!frame) return;

      const br = computeBrightness(frame.data);

      // Terlalu gelap
      if (br < darkThreshold) {
        prevData.current = null;
        stableStart.current = null;
        setStatus("locked-dark");
        setProgress(0);
        return;
      }

      const prev = prevData.current;
      prevData.current = frame.data.slice() as Uint8ClampedArray;

      if (!prev) return; // frame pertama, belum ada data pembanding

      const mv = computeMotion(prev, frame.data);

      // Kamera bergerak
      if (mv > motionThreshold) {
        stableStart.current = null;
        setStatus("locked-moving");
        setProgress(0);
        return;
      }

      // Kamera diam dan cukup terang — hitung stabilisasi
      if (!stableStart.current) stableStart.current = now;
      const elapsed = now - stableStart.current;
      const p = Math.min(elapsed / stabilizeMs, 1);
      setStatus("stabilizing");
      setProgress(p);

      if (elapsed >= stabilizeMs) {
        stableStart.current = null;
        cooldownEnd.current = now + cooldownMs;
        setStatus("cooldown");
        setProgress(0);
        captureRef.current();
      }
    }, sampleInterval);

    return () => clearInterval(tid);
  }, [camState, enabled, stabilizeMs, cooldownMs, darkThreshold, motionThreshold, sampleInterval, videoRef]);

  return { status, progress };
}
