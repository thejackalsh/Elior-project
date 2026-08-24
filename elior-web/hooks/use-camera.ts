"use client";

import { useRef, useState, useCallback, useEffect } from "react";

export type CameraState = "idle" | "starting" | "active" | "error";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<CameraState>("idle");
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    setState("starting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setState("active");
    } catch (err) {
      let msg = "Kamera tidak dapat diakses";
      if (err instanceof DOMException) {
        const map: Record<string, string> = {
          NotAllowedError:     "Izin kamera ditolak. Mohon izinkan akses kamera.",
          PermissionDeniedError: "Izin kamera ditolak. Mohon izinkan akses kamera.",
          NotFoundError:       "Kamera tidak ditemukan pada perangkat ini.",
          DevicesNotFoundError: "Kamera tidak ditemukan pada perangkat ini.",
          NotReadableError:    "Kamera sedang digunakan aplikasi lain.",
          TrackStartError:     "Kamera sedang digunakan aplikasi lain.",
          OverconstrainedError: "Kamera tidak mendukung resolusi yang diminta.",
          ConstraintNotSatisfiedError: "Kamera tidak mendukung resolusi yang diminta.",
          SecurityError:       "Akses kamera memerlukan koneksi aman (HTTPS).",
          AbortError:          "Akses kamera dibatalkan.",
          TypeError:           "Kamera tidak dapat diakses.",
        };
        msg = map[err.name] ?? `Kamera error: ${err.name}`;
      }
      setError(msg);
      setState("error");
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState("idle");
  }, []);

  const applyConstraints = useCallback(async (constraints: MediaTrackConstraints) => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    await track.applyConstraints(constraints);
  }, []);

  const getSettings = useCallback((): MediaTrackSettings | null => {
    return streamRef.current?.getVideoTracks()[0]?.getSettings() ?? null;
  }, []);

  const getCapabilities = useCallback((): MediaTrackCapabilities | null => {
    return streamRef.current?.getVideoTracks()[0]?.getCapabilities() ?? null;
  }, []);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || state !== "active") return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
  }, [state]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Auto-retry when permission is re-granted or device becomes available
  useEffect(() => {
    const stateRef = { current: state };
    stateRef.current = state;

    // Visibility change: user comes back to tab after granting permission
    const onVisibility = () => {
      if (!document.hidden && (stateRef.current === "error" || stateRef.current === "idle")) {
        startCamera();
      }
    };

    // Device change: camera plugged in / permission changed in some browsers
    const onDeviceChange = () => {
      if (stateRef.current === "error" || stateRef.current === "idle") {
        startCamera();
      }
    };

    document.addEventListener("visibilitychange", onVisibility);
    navigator.mediaDevices?.addEventListener("devicechange", onDeviceChange);

    // Permissions API watch (Chrome/Edge)
    let permStatus: PermissionStatus | null = null;
    navigator.permissions?.query({ name: "camera" as PermissionName }).then((ps) => {
      permStatus = ps;
      ps.addEventListener("change", () => {
        if (ps.state === "granted") startCamera();
      });
    }).catch(() => {});

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      navigator.mediaDevices?.removeEventListener("devicechange", onDeviceChange);
      permStatus?.removeEventListener("change", () => {});
    };
  }, [state, startCamera]);

  return { videoRef, state, error, startCamera, stopCamera, captureFrame, applyConstraints, getSettings, getCapabilities };
}
