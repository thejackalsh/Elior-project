"use client";

import { useState, useCallback } from "react";
import { analyzeImage, type AnalyzeResponse } from "@/lib/api";

export type AnalyzeState = "idle" | "loading" | "success" | "error";

export function useAnalyze() {
  const [state, setState] = useState<AnalyzeState>("idle");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async (base64Image: string) => {
    setState("loading");
    setError(null);
    setResult(null);
    try {
      const data = await analyzeImage(base64Image);
      setResult(data);
      setState("success");
      return data;
    } catch (err) {
      let msg = "Analisis gagal";
      if (err instanceof Error) {
        if (err.message.toLowerCase().includes("failed to fetch") || err.message.toLowerCase().includes("networkerror") || err.message.toLowerCase().includes("network")) {
          msg = "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
        } else {
          msg = err.message;
        }
      }
      setError(msg);
      setState("error");
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setResult(null);
    setError(null);
  }, []);

  return { analyze, state, result, error, reset };
}
