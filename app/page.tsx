"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, Loader2, RefreshCw, Sparkles, Upload, Volume2, X, AlertCircle } from "lucide-react";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const DEFAULT_PROMPT = "Identify the main subject of this image and describe it in detail.";

type SpeechLang = "en-US" | "hi-IN";

interface AnalysisResult {
  englishName: string;
  hindiName: string;
  english: string;
  hindi: string;
}

/* ------------------------------------------------------------------ */
/* 3D starfield: stars fly toward the viewer and drift with the mouse */
/* ------------------------------------------------------------------ */

function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const STAR_COUNT = 700;
    const SPEED = 0.006;

    type Star = { x: number; y: number; z: number };
    const randomStar = (z = Math.random()): Star => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: z * 0.98 + 0.02,
    });
    const stars: Star[] = Array.from({ length: STAR_COUNT }, () => randomStar());

    let width = 0;
    let height = 0;
    let target = { x: 0, y: 0 };
    let offset = { x: 0, y: 0 };
    let frameId = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const onPointerMove = (event: PointerEvent) => {
      target = {
        x: (event.clientX / width) * 2 - 1,
        y: (event.clientY / height) * 2 - 1,
      };
    };

    const draw = () => {
      offset = { x: offset.x + (target.x - offset.x) * 0.04, y: offset.y + (target.y - offset.y) * 0.04 };

      ctx.clearRect(0, 0, width, height);
      const cx = width / 2;
      const cy = height / 2;
      const focal = Math.min(width, height) * 0.6;

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.z -= SPEED;
        if (star.z <= 0.02) {
          stars[i] = randomStar(1);
          continue;
        }

        const depth = 1 - star.z; // 0 = far away, 1 = right in front of the camera
        const px = cx + (star.x / star.z) * focal + offset.x * 45 * depth;
        const py = cy + (star.y / star.z) * focal + offset.y * 45 * depth;
        if (px < -10 || px > width + 10 || py < -10 || py > height + 10) continue;

        const radius = 0.4 + depth * 1.8;
        const alpha = 0.25 + depth * 0.75;
        ctx.beginPath();
        ctx.fillStyle = i % 9 === 0 ? `rgba(196, 181, 253, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      frameId = requestAnimationFrame(draw);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove);
    frameId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-0" aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Home() {
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [speakingLang, setSpeakingLang] = useState<SpeechLang | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ---------- camera ---------- */

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }, []);

  const startCamera = async () => {
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access is not supported in this browser.");
      return;
    }

    try {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      setCameraOpen(true);
    } catch (err) {
      const denied = err instanceof DOMException && err.name === "NotAllowedError";
      setCameraError(
        denied
          ? "Camera permission was denied. Allow camera access in your browser settings, or upload an image instead."
          : "Could not open a camera on this device.",
      );
    }
  };

  // Attach the stream once the overlay's <video> element exists.
  useEffect(() => {
    if (cameraOpen && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [cameraOpen]);

  // Release the camera and stop any speech when the page unmounts.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Close the camera overlay with Escape.
  useEffect(() => {
    if (!cameraOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && stopCamera();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cameraOpen, stopCamera]);

  const captureSnapshot = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

    setImageDataUrl(canvas.toDataURL("image/jpeg", 0.92));
    setResult(null);
    setError(null);
    stopCamera();
  };

  /* ---------- upload ---------- */

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("Image is too large. The limit is 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setResult(null);
      setError(null);
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file);
  };

  /* ---------- identify ---------- */

  const identify = async () => {
    if (!imageDataUrl) return;

    setLoading(true);
    setError(null);
    setResult(null);
    window.speechSynthesis?.cancel();
    setSpeakingLang(null);

    try {
      const response = await fetch("/api/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: imageDataUrl, prompt: prompt.trim() || DEFAULT_PROMPT }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Request failed.");
      setResult({
        englishName: data.englishName ?? "",
        hindiName: data.hindiName ?? "",
        english: data.english ?? "",
        hindi: data.hindi ?? "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- speech ---------- */

  const speak = (text: string, lang: SpeechLang) => {
    if (!("speechSynthesis" in window)) {
      setError("Text-to-speech is not supported in this browser.");
      return;
    }
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(lang.toLowerCase()));
    if (voice) utterance.voice = voice;

    utterance.onend = () => setSpeakingLang(null);
    utterance.onerror = () => setSpeakingLang(null);

    setSpeakingLang(lang);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis?.cancel();
    setSpeakingLang(null);
  };

  const reset = () => {
    stopSpeaking();
    setImageDataUrl(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /* ---------- render ---------- */

  return (
    <main className="relative min-h-screen overflow-hidden bg-slate-950 bg-[radial-gradient(ellipse_at_top,_#312e81_0%,_#1e1b4b_35%,_#020617_75%)] text-slate-100">
      <Starfield />

      <div className="pointer-events-none absolute -left-32 top-1/4 h-96 w-96 rounded-full bg-fuchsia-600/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-1/4 h-96 w-96 rounded-full bg-indigo-500/25 blur-3xl" />

      <div className="relative z-10 flex min-h-screen flex-col">
      <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <section className="w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-indigo-900/40 backdrop-blur-xl sm:p-8">
          <header className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-600/40">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <h1 className="bg-gradient-to-r from-violet-300 via-fuchsia-200 to-indigo-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
              ShabdaMantra
            </h1>
            <p className="mt-1 text-sm text-slate-300/80">Show me something. I&apos;ll name it in English and हिन्दी.</p>
          </header>

          {/* Image preview / empty state */}
          <div className="relative mb-4 flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-dashed border-white/15 bg-slate-900/50">
            {imageDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageDataUrl} alt="Selected for analysis" className="h-full w-full object-contain" />
            ) : (
              <p className="px-6 text-center text-sm text-slate-400">
                No image yet. Upload a photo or capture one with your camera.
              </p>
            )}
          </div>

          {/* Capture / upload controls */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <Upload className="h-4 w-4" /> Upload image
            </button>
            <button
              type="button"
              onClick={startCamera}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              <Camera className="h-4 w-4" /> Use camera
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </div>

          {cameraError && <Notice tone="error">{cameraError}</Notice>}

          {/* Optional custom prompt */}
          <label className="mt-5 block">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
              Question (optional)
            </span>
            <input
              type="text"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              maxLength={500}
              placeholder={DEFAULT_PROMPT}
              className="w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm placeholder:text-slate-500 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
            />
          </label>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={identify}
              disabled={!imageDataUrl || loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 font-semibold text-white shadow-lg shadow-violet-700/30 transition hover:from-violet-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Analyzing…" : "Identify"}
            </button>
            {imageDataUrl && !loading && (
              <button
                type="button"
                onClick={reset}
                className="flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm text-slate-300 transition hover:bg-white/10"
                aria-label="Clear image"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            )}
          </div>

          {error && (
            <div className="mt-5">
              <Notice tone="error">{error}</Notice>
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4">
              <ResultCard
                title="English"
                lang="en-US"
                name={result.englishName}
                text={result.english}
                buttonLabel="Pronounce name"
                speaking={speakingLang === "en-US"}
                onSpeak={() => speak(result.englishName, "en-US")}
                onStop={stopSpeaking}
              />
              <ResultCard
                title="हिन्दी"
                lang="hi-IN"
                name={result.hindiName}
                text={result.hindi || "Hindi translation was not returned for this image."}
                buttonLabel="नाम सुनें"
                speaking={speakingLang === "hi-IN"}
                onSpeak={() => speak(result.hindiName, "hi-IN")}
                onStop={stopSpeaking}
              />
            </div>
          )}
        </section>
      </div>

      <footer className="border-t border-white/10 bg-slate-950/40 px-4 py-5 text-center text-xs text-slate-400 backdrop-blur-sm">
        <p>
          Designed by <span className="font-medium text-violet-300">Dr. T. Venkateswara Rao</span>
        </p>
        <p className="mt-1 text-slate-500">ShabdaMantra · Vision identification in English &amp; Hindi</p>
      </footer>
      </div>

      {/* Live camera overlay */}
      {cameraOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Camera preview"
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-black shadow-2xl">
            <video ref={videoRef} playsInline muted className="aspect-video w-full object-cover" />
            <button
              type="button"
              onClick={stopCamera}
              aria-label="Close camera"
              className="absolute right-3 top-3 rounded-full bg-black/50 p-2 text-white transition hover:bg-black/70"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <button
            type="button"
            onClick={captureSnapshot}
            className="mt-6 flex items-center gap-2 rounded-full bg-white px-8 py-3 font-semibold text-slate-900 shadow-lg transition hover:scale-105"
          >
            <Camera className="h-5 w-5" /> Capture
          </button>
        </div>
      )}
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */

function Notice({ tone, children }: { tone: "error"; children: ReactNode }) {
  return (
    <div
      role="alert"
      className="mt-4 flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

function ResultCard({
  title,
  lang,
  name,
  text,
  buttonLabel,
  speaking,
  onSpeak,
  onStop,
}: {
  title: string;
  lang: SpeechLang;
  name: string;
  text: string;
  buttonLabel: string;
  speaking: boolean;
  onSpeak: () => void;
  onStop: () => void;
}) {
  return (
    <article lang={lang === "en-US" ? "en" : "hi"} className="rounded-2xl border border-white/10 bg-slate-900/60 p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-violet-300">{title}</h2>
        <button
          type="button"
          onClick={speaking ? onStop : onSpeak}
          disabled={!name}
          className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Volume2 className={`h-3.5 w-3.5 ${speaking ? "animate-pulse text-fuchsia-300" : ""}`} />
          {speaking ? "Stop" : buttonLabel}
        </button>
      </div>
      {name && <p className="mb-1 text-2xl font-semibold text-white">{name}</p>}
      <p className="leading-relaxed text-slate-200">{text}</p>
    </article>
  );
}
