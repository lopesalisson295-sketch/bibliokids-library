import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Camera, RefreshCw, Volume2, VolumeX, X,
  Zap, ZapOff, Loader2, ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// Native BarcodeDetector Web API type declaration (Chrome 83+, Android)
declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => {
      detect(
        source: HTMLVideoElement | HTMLCanvasElement | ImageBitmap | ImageData | Blob
      ): Promise<{ rawValue: string; format: string }[]>;
    };
  }
}

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
  isProcessing?: boolean;
}

type ScanState = "loading" | "scanning" | "permission_denied" | "camera_busy" | "not_found";

// Formats supported by the native BarcodeDetector API
const NATIVE_DETECTOR_FORMATS = [
  "ean_13", "ean_8", "qr_code", "code_128", "code_39", "upc_a", "upc_e", "data_matrix"
];

// Hidden div ID used by Html5Qrcode for its canvas fallback path
const FALLBACK_DIV_ID = "__bcs_fallback_root__";

export default function BarcodeScanner({
  onScanSuccess,
  onClose,
  isProcessing = false,
}: BarcodeScannerProps) {
  const [scanState, setScanState] = useState<ScanState>("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [activeCameraId, setActiveCameraId] = useState("");

  // DOM refs — video is always mounted in the DOM, only hidden when errored
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Internal state refs (stable across renders, no stale closure issues)
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeDetectorRef = useRef<InstanceType<NonNullable<Window["BarcodeDetector"]>> | null>(null);
  const fallbackScannerRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef(false);
  const mountedRef = useRef(true);

  // Mutable refs for props that can change without triggering re-initialization
  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const onScanSuccessRef = useRef(onScanSuccess);
  onScanSuccessRef.current = onScanSuccess;

  const { toast } = useToast();

  // --- Audio beep ---
  const playBeep = useCallback(() => {
    if (!soundEnabledRef.current) return;
    try {
      const ac = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = "sine";
      osc.frequency.value = 1100;
      gain.gain.setValueAtTime(0.1, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.2);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + 0.2);
    } catch {}
  }, []);

  // --- Barcode detected handler ---
  const handleDetected = useCallback((value: string) => {
    if (!value || !mountedRef.current || isProcessingRef.current || cooldownRef.current) return;
    cooldownRef.current = true;
    playBeep();
    navigator.vibrate?.(100);
    onScanSuccessRef.current(value);
    // Cooldown prevents double-reads for the same barcode
    setTimeout(() => { cooldownRef.current = false; }, 2500);
  }, [playBeep]);

  // --- Stop all scanning and camera tracks ---
  const stopAll = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // --- Path 1: Native BarcodeDetector scan loop (Chrome/Android) ---
  // Uses requestAnimationFrame for per-frame decoding — extremely fast and battery efficient
  const startNativeScanLoop = useCallback(() => {
    const video = videoRef.current;
    if (!video || !nativeDetectorRef.current) return;

    const loop = async () => {
      if (!mountedRef.current) return;
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        try {
          const results = await nativeDetectorRef.current!.detect(video);
          if (results.length > 0) handleDetected(results[0].rawValue);
        } catch {
          // detect() can throw on invalid frames — safe to ignore
        }
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
  }, [handleDetected]);

  // --- Path 2: Canvas interval fallback (iOS Safari, Firefox, older browsers) ---
  // Captures canvas frames every 300ms and uses Html5Qrcode.scanFile() to decode
  const startCanvasScanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    // Ensure the hidden root div for Html5Qrcode exists
    if (!document.getElementById(FALLBACK_DIV_ID)) {
      const div = document.createElement("div");
      div.id = FALLBACK_DIV_ID;
      div.style.cssText = "display:none!important;position:absolute;opacity:0;pointer-events:none;";
      document.body.appendChild(div);
    }

    if (!fallbackScannerRef.current) {
      fallbackScannerRef.current = new Html5Qrcode(FALLBACK_DIV_ID, { verbose: false } as any);
    }

    const scanner = fallbackScannerRef.current;

    intervalRef.current = setInterval(() => {
      if (!mountedRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(async (blob) => {
        if (!blob || !mountedRef.current) return;
        try {
          const file = new File([blob], "frame.jpg", { type: "image/jpeg" });
          const result = await scanner.scanFile(file, false);
          if (result) handleDetected(result);
        } catch {
          // No barcode in frame — normal, continue
        }
      }, "image/jpeg", 0.8);
    }, 300);
  }, [handleDetected]);

  // --- Main camera initialization ---
  // KEY INSIGHT: We own getUserMedia directly — no library wrapper.
  // This gives us full control over constraints, error types, and stream lifecycle.
  const startCamera = useCallback(async (cameraId?: string) => {
    stopAll();
    if (!mountedRef.current) return;

    setScanState("loading");
    setErrorMsg("");
    setHasTorch(false);
    setIsTorchOn(false);

    const constraints: MediaStreamConstraints = {
      video: cameraId
        ? { deviceId: { exact: cameraId } }
        : {
            facingMode: { ideal: "environment" }, // prefer back camera, gracefully degrades
          },
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Guard: component may have unmounted while awaiting
      if (!mountedRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;

      // Wait for video metadata to load before playing
      await new Promise<void>((resolve) => {
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) { resolve(); return; }
        video.onloadedmetadata = () => resolve();
        setTimeout(resolve, 5000); // safety timeout
      });

      await video.play().catch(() => {
        // play() can be rejected if already playing, that's fine
      });

      if (!mountedRef.current) { stopAll(); return; }

      setScanState("scanning");

      // Inspect track capabilities (torch, active device ID)
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const caps = track.getCapabilities() as any;
          setHasTorch(!!caps?.torch);
        } catch {}
        const settings = track.getSettings();
        const deviceId = settings.deviceId || "";
        setActiveCameraId(deviceId);
      }

      // Enumerate available cameras (labels are only populated after stream is active)
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (mountedRef.current) {
          const videoInputs = devices
            .filter(d => d.kind === "videoinput")
            .map(d => ({ id: d.deviceId, label: d.label || `Câmera ${d.deviceId.slice(0, 4)}` }));
          setCameras(videoInputs);
        }
      } catch {}

      // Choose scan path: native BarcodeDetector (fast) or canvas interval (compatible)
      if (window.BarcodeDetector) {
        try {
          nativeDetectorRef.current = new window.BarcodeDetector({ formats: NATIVE_DETECTOR_FORMATS });
          startNativeScanLoop();
        } catch {
          // BarcodeDetector constructor failed (unsupported formats?) — use canvas fallback
          nativeDetectorRef.current = null;
          startCanvasScanLoop();
        }
      } else {
        startCanvasScanLoop();
      }

    } catch (err: any) {
      if (!mountedRef.current) return;
      stopAll();

      const name: string = err?.name || "";
      console.error("BarcodeScanner camera error:", name, err?.message);

      if (name === "NotAllowedError" || name === "PermissionDeniedError" || name === "SecurityError") {
        setScanState("permission_denied");
        setErrorMsg(
          "Permissão de câmera negada. Toque nos três pontos do Chrome (⋮), vá em 'Configurações do site', encontre 'Câmera' e mude para 'Permitir'. Depois volte e tente novamente."
        );
      } else if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") {
        setScanState("camera_busy");
        setErrorMsg(
          "A câmera está sendo usada por outro aplicativo ou aba. Feche outros apps com câmera ativa e toque em 'Tentar Novamente'."
        );
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setScanState("not_found");
        setErrorMsg("Nenhuma câmera encontrada neste dispositivo.");
      } else {
        setScanState("camera_busy");
        setErrorMsg(
          `Não foi possível acessar a câmera. (${err?.message || name || "Erro desconhecido"})`
        );
      }
    }
  }, [stopAll, startNativeScanLoop, startCanvasScanLoop]);

  const handleCameraSwitch = useCallback((id: string) => {
    setActiveCameraId(id);
    startCamera(id);
  }, [startCamera]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !hasTorch) return;
    try {
      const next = !isTorchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setIsTorchOn(next);
    } catch {
      toast({
        title: "Erro na Lanterna",
        description: "Flash indisponível neste momento.",
        variant: "destructive",
      });
    }
  }, [hasTorch, isTorchOn, toast]);

  // Mount/unmount lifecycle
  useEffect(() => {
    mountedRef.current = true;
    startCamera();

    return () => {
      mountedRef.current = false;
      stopAll();
      // Clean up the hidden fallback div on unmount
      const div = document.getElementById(FALLBACK_DIV_ID);
      if (div) div.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isError = scanState !== "loading" && scanState !== "scanning";
  const isPermissionError = scanState === "permission_denied";

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto bg-slate-950 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800 animate-in fade-in zoom-in-95 duration-200">

      {/* ── Header ── */}
      <div className="flex items-center justify-between w-full p-4 border-b border-slate-900 bg-slate-950">
        <div className="flex items-center gap-2">
          <Camera
            className={`h-5 w-5 ${scanState === "scanning" ? "text-emerald-400 animate-pulse" : "text-slate-500"}`}
          />
          <span className="font-semibold text-sm text-slate-200">Leitor de Código de Barras & QR Code</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:bg-slate-900 text-slate-400 hover:text-white"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Camera Viewport ── */}
      {/* The <video> is ALWAYS in the DOM — hiding it via CSS (not unmounting) prevents 
          React from destroying the element during state transitions, which is what caused 
          the permission loss in the previous implementation. */}
      <div className="relative w-full aspect-video bg-slate-900 overflow-hidden">

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover transition-opacity duration-300 ${isError ? "opacity-0" : "opacity-100"}`}
        />

        {/* Hidden canvas for fallback frame decoding — must be in DOM but invisible */}
        <canvas ref={canvasRef} className="absolute -z-10 opacity-0 w-1 h-1 top-0 left-0 pointer-events-none" />

        {/* ── Loading overlay ── */}
        {scanState === "loading" && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 z-10">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
            <span className="text-xs text-slate-400 font-medium">Iniciando câmera traseira...</span>
          </div>
        )}

        {/* ── Error overlay ── */}
        {isError && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center z-10 animate-in fade-in duration-300">
            <div
              className={`p-3.5 rounded-full mb-3 ${
                isPermissionError
                  ? "bg-red-500/15 text-red-400"
                  : "bg-amber-500/15 text-amber-400"
              }`}
            >
              {isPermissionError ? (
                <ShieldAlert className="h-7 w-7" />
              ) : (
                <Camera className="h-7 w-7" />
              )}
            </div>

            <h3 className="font-semibold text-sm text-slate-100 mb-2">
              {isPermissionError ? "Permissão de Câmera Negada" : "Câmera Indisponível"}
            </h3>

            <p className="text-[11px] text-slate-400 mb-5 leading-relaxed">{errorMsg}</p>

            <div className="flex gap-2 w-full max-w-[240px]">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 border-slate-700 text-slate-300 hover:bg-slate-900 hover:text-white text-xs"
                onClick={onClose}
              >
                Fechar
              </Button>
              {/* Retry button: direct user click → getUserMedia runs in gesture context */}
              {!isPermissionError && (
                <Button
                  size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  onClick={() => startCamera(activeCameraId || undefined)}
                >
                  <RefreshCw className="h-3 w-3 mr-1.5" />
                  Tentar Novamente
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Scanning guide overlay ── */}
        {scanState === "scanning" && (
          <div className="absolute inset-0 pointer-events-none">
            {/* Center focus box */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[82%] max-w-[310px] h-[38%] max-h-[150px] border-2 border-emerald-400 rounded-xl bg-black/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
              {/* Corner accents */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />
              {/* Laser scan line */}
              <div className="absolute w-[96%] left-[2%] h-0.5 bg-red-500/80 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)] animate-[scan_2.5s_ease-in-out_infinite]" />
            </div>
            {/* Tip label */}
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="inline-block bg-slate-900/85 border border-slate-800 text-[10px] font-medium text-slate-300 px-3 py-1 rounded-full shadow-md">
                Aponte para o código de barras ou QR Code
              </span>
            </div>
          </div>
        )}

        {/* ── Processing overlay (Turbo mode) ── */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-30">
            <Loader2 className="h-7 w-7 text-amber-400 animate-spin" />
            <span className="text-sm text-amber-200 font-semibold animate-pulse">Buscando & Salvando Livro...</span>
            <span className="text-[10px] text-slate-400">Modo Turbo Ativo ⚡</span>
          </div>
        )}
      </div>

      {/* ── Controls Panel ── */}
      <div className="w-full p-4 bg-slate-950 border-t border-slate-900 space-y-3">

        {/* Camera selector — only shown when multiple cameras available and scanning */}
        {cameras.length > 1 && scanState === "scanning" && (
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-slate-400 shrink-0" />
            <Select value={activeCameraId} onValueChange={handleCameraSwitch}>
              <SelectTrigger className="w-full bg-slate-900 border-slate-800 text-white hover:bg-slate-850 h-9 text-xs">
                <SelectValue placeholder="Alternar câmera" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                {cameras.map((cam, i) => (
                  <SelectItem
                    key={cam.id}
                    value={cam.id}
                    className="text-xs hover:bg-slate-800 focus:bg-slate-800"
                  >
                    {cam.label || `Câmera ${i + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Aux controls: sound & torch */}
        <div className="flex justify-between items-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-900 gap-1.5 px-2.5 rounded-lg"
            onClick={() => setSoundEnabled(v => !v)}
          >
            {soundEnabled ? (
              <><Volume2 className="h-4 w-4 text-emerald-400" /> Beep Ativo</>
            ) : (
              <><VolumeX className="h-4 w-4 text-slate-500" /> Bip Silenciado</>
            )}
          </Button>

          {hasTorch && scanState === "scanning" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-900 gap-1.5 px-2.5 rounded-lg"
              onClick={toggleTorch}
            >
              {isTorchOn ? (
                <><ZapOff className="h-4 w-4 text-amber-400 animate-pulse" /> Desligar Flash</>
              ) : (
                <><Zap className="h-4 w-4 text-slate-400" /> Ligar Flash</>
              )}
            </Button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 4%; }
          50% { top: 96%; }
        }
        #${FALLBACK_DIV_ID} {
          display: none !important;
        }
        video::-webkit-media-controls { display: none !important; }
      `}</style>
    </div>
  );
}
