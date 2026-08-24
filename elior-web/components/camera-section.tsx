"use client";

import { cn } from "@/lib/utils";
import { Scan, Volume2, VolumeX, Zap, ZapOff } from "lucide-react";
import type { CameraState } from "@/hooks/use-camera";
import type { SmartCaptureStatus } from "@/hooks/use-smart-capture";
import type { AnalyzeResponse } from "@/lib/api";

const CATEGORY_LABEL: Record<string, string> = {
  ocr: "Teks OCR",
  rupiah: "Uang Rupiah",
  object: "Deskripsi Objek",
};

const SMART_STATUS_LABEL: Record<SmartCaptureStatus, string | null> = {
  idle: null,
  stabilizing: "Menstabilkan...",
  "locked-dark": "Terlalu Gelap",
  "locked-moving": "Bergerak",
  cooldown: "Menunggu...",
};

interface CameraSectionProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  camState: CameraState;
  camMsg: { text: string; type: "error" | "info" } | null;
  isLoading: boolean;
  result: AnalyzeResponse | null;
  resultOpen: boolean;
  speaking: boolean;
  smartStatus: SmartCaptureStatus;
  smartProgress: number;
  autoCapture: boolean;
  onCapture: () => void;
  onResultClose: () => void;
  onStopTTS: () => void;
  onSpeak: (text: string) => void;
  onToggleAutoCapture: () => void;
}

export function CameraSection({
  videoRef,
  camState,
  camMsg,
  isLoading,
  result,
  resultOpen,
  speaking,
  smartStatus,
  smartProgress,
  autoCapture,
  onCapture,
  onResultClose,
  onStopTTS,
  onSpeak,
  onToggleAutoCapture,
}: CameraSectionProps) {
  const camActive = camState === "active";

  // Progress ring geometry — melingkari tombol Pindai
  const R = 42;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - smartProgress);

  const isLocked = smartStatus === "locked-dark" || smartStatus === "locked-moving";

  return (
    <div className="min-w-full">
      <div className="liquid-glass rounded-3xl overflow-hidden w-full aspect-video relative">

        {/* Video */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "w-full h-full object-cover transition-opacity duration-500",
            camActive ? "opacity-100" : "opacity-0",
          )}
          style={{ filter: "saturate(1.35)" }}
        />

        {/* Overlay tint saat locked */}
        {isLocked && camActive && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300"
            style={{
              background:
                smartStatus === "locked-dark"
                  ? "rgba(0,0,0,0.35)"
                  : "rgba(255,140,0,0.08)",
            }}
          />
        )}

        {/* Starting */}
        {camState === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-white/60 w-40">
              <span className="text-xs font-light">Memulai kamera...</span>
              <div className="w-full h-0.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-white/60 rounded-full animate-[progress_1.4s_ease-in-out_infinite]" />
              </div>
            </div>
          </div>
        )}

        {/* Offline */}
        {(camState === "error" || camState === "idle") && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <span className="text-white/60 text-xs font-light">Kamera tidak aktif</span>
          </div>
        )}

        {/* Inline toast */}
        {camMsg && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div
              className="liquid-glass rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap"
              style={
                camMsg.type === "error"
                  ? { color: "rgb(255,100,100)", textShadow: "0 0 10px rgba(255,80,80,0.9), 0 0 24px rgba(255,60,60,0.5)" }
                  : { color: "rgb(100,230,120)", textShadow: "0 0 10px rgba(80,220,100,0.9), 0 0 24px rgba(60,210,90,0.5)" }
              }
            >
              {camMsg.text}
            </div>
          </div>
        )}

        {/* Smart capture status badge — top-right */}
        {camActive && autoCapture && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
            {SMART_STATUS_LABEL[smartStatus] && (
              <div
                className="liquid-glass rounded-xl px-2.5 py-1 text-xs font-medium"
                style={{
                  color:
                    smartStatus === "locked-dark"
                      ? "rgb(180,180,255)"
                      : smartStatus === "locked-moving"
                      ? "rgb(255,170,80)"
                      : smartStatus === "stabilizing"
                      ? "rgb(100,230,120)"
                      : "rgba(255,255,255,0.45)",
                  textShadow:
                    smartStatus === "locked-dark"
                      ? "0 0 8px rgba(140,140,255,0.7)"
                      : smartStatus === "locked-moving"
                      ? "0 0 8px rgba(255,150,50,0.7)"
                      : smartStatus === "stabilizing"
                      ? "0 0 8px rgba(80,210,100,0.7)"
                      : "none",
                }}
              >
                {SMART_STATUS_LABEL[smartStatus]}
              </div>
            )}
          </div>
        )}

        {/* Toggle auto-capture — top-left */}
        {camActive && (
          <div className="absolute top-3 left-3 z-10">
            <button
              onClick={onToggleAutoCapture}
              aria-label={autoCapture ? "Matikan auto-capture" : "Aktifkan auto-capture"}
              className="liquid-glass rounded-xl p-1.5 flex items-center justify-center transition-opacity duration-200"
              style={{ opacity: autoCapture ? 1 : 0.45 }}
            >
              {autoCapture
                ? <Zap className="w-3.5 h-3.5 text-white" />
                : <ZapOff className="w-3.5 h-3.5 text-white" />
              }
            </button>
          </div>
        )}

        {/* Progress ring + tombol Pindai */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center">
          {/* SVG progress ring */}
          {autoCapture && camActive && (
            <svg
              className="absolute pointer-events-none"
              width={R * 2 + 16}
              height={R * 2 + 16}
              style={{ top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}
            >
              {/* Track */}
              <circle
                cx={R + 8}
                cy={R + 8}
                r={R}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="2"
              />
              {/* Fill */}
              {smartStatus === "stabilizing" && (
                <circle
                  cx={R + 8}
                  cy={R + 8}
                  r={R}
                  fill="none"
                  stroke="rgba(100,230,120,0.75)"
                  strokeWidth="2"
                  strokeDasharray={CIRC}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  transform={`rotate(-90 ${R + 8} ${R + 8})`}
                  style={{ transition: "stroke-dashoffset 140ms linear" }}
                />
              )}
            </svg>
          )}

          <button
            onClick={onCapture}
            disabled={!camActive || isLoading}
            aria-label="Analisis gambar"
            className={cn(
              "liquid-glass-strong rounded-3xl px-8 py-3",
              "text-white text-sm font-semibold transition-opacity duration-200",
              "disabled:opacity-40",
            )}
            style={{ textShadow: "0 0 10px rgba(255,255,255,0.7), 0 0 24px rgba(255,255,255,0.3)" }}
          >
            {isLoading ? "Memproses..." : "Pindai"}
          </button>
        </div>

        {/* Result panel */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 z-20 liquid-glass-strong rounded-t-3xl",
            "transition-transform duration-350 ease-out flex flex-col",
          )}
          style={{
            minHeight: "50%",
            maxHeight: "100%",
            transform: resultOpen ? "translateY(0)" : "translateY(100%)",
          }}
        >
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-white/20" />
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">
            {result && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-medium text-white/50 border border-white/20 rounded-lg px-2.5 py-0.5">
                    {CATEGORY_LABEL[result.category] ?? result.category}
                  </span>
                  {result.confidence != null && (
                    <span className="text-xs text-white/30 border border-white/10 rounded-lg px-2.5 py-0.5">
                      {(result.confidence * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <p className="text-white/85 text-sm font-light leading-relaxed">
                  {result.text}
                </p>
              </>
            )}
          </div>

          <div className="flex gap-3 px-5 py-4 shrink-0">
            <button
              onClick={speaking ? onStopTTS : () => result && onSpeak(result.text)}
              className="liquid-glass flex-1 rounded-3xl flex items-center justify-center gap-2 px-4 py-2.5 text-white text-xs font-medium"
              aria-label={speaking ? "Hentikan suara" : "Putar suara"}
            >
              {speaking
                ? <><VolumeX className="w-3.5 h-3.5" /> Hentikan</>
                : <><Volume2 className="w-3.5 h-3.5" /> Putar Suara</>
              }
            </button>
            <button
              onClick={() => { onResultClose(); onCapture(); }}
              className="liquid-glass-strong flex-1 rounded-3xl flex items-center justify-center gap-2 px-4 py-2.5 text-white text-xs font-semibold"
              style={{ textShadow: "0 0 8px rgba(255,255,255,0.5)" }}
            >
              <Scan className="w-3.5 h-3.5" />
              Pindai Lagi
            </button>
            <button
              onClick={onResultClose}
              className="liquid-glass rounded-3xl px-4 py-2.5 text-white/50 text-xs font-medium"
              aria-label="Tutup"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
