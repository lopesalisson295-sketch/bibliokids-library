import { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Camera, RefreshCw, Volume2, VolumeX, X,
  Zap, ZapOff, Loader2, ShieldAlert
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  /** Pre-acquired MediaStream from the user gesture click handler */
  stream: MediaStream;
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
  isProcessing?: boolean;
}

const NATIVE_FORMATS = [
  "ean_13", "ean_8", "qr_code", "code_128", "code_39", "upc_a", "upc_e", "data_matrix"
];

const FALLBACK_DIV_ID = "__bcs_fallback__";

export default function BarcodeScanner({
  stream,
  onScanSuccess,
  onClose,
  isProcessing = false,
}: BarcodeScannerProps) {
  const [scanActive, setScanActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeDetectorRef = useRef<InstanceType<NonNullable<Window["BarcodeDetector"]>> | null>(null);
  const fallbackRef = useRef<Html5Qrcode | null>(null);
  const cooldownRef = useRef(false);
  const mountedRef = useRef(true);

  const isProcessingRef = useRef(isProcessing);
  isProcessingRef.current = isProcessing;
  const soundRef = useRef(soundEnabled);
  soundRef.current = soundEnabled;
  const onSuccessRef = useRef(onScanSuccess);
  onSuccessRef.current = onScanSuccess;

  const { toast } = useToast();

  // --- Beep ---
  const playBeep = useCallback(() => {
    if (!soundRef.current) return;
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
    } catch { /* ignore */ }
  }, []);

  // --- Detection handler ---
  const handleDetected = useCallback((value: string) => {
    if (!value || !mountedRef.current || isProcessingRef.current || cooldownRef.current) return;
    cooldownRef.current = true;
    playBeep();
    navigator.vibrate?.(100);
    onSuccessRef.current(value);
    setTimeout(() => { cooldownRef.current = false; }, 2500);
  }, [playBeep]);

  // --- Cleanup scan loops ---
  const stopScanLoops = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  }, []);

  // --- Native BarcodeDetector scan loop ---
  const startNativeLoop = useCallback((video: HTMLVideoElement) => {
    if (!nativeDetectorRef.current) return;
    const detector = nativeDetectorRef.current;
    const loop = async () => {
      if (!mountedRef.current) return;
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
        try {
          const results = await detector.detect(video);
          if (results.length > 0) handleDetected(results[0].rawValue);
        } catch { /* ignore bad frames */ }
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [handleDetected]);

  // --- Canvas fallback scan loop ---
  const startFallbackLoop = useCallback((video: HTMLVideoElement) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    
    // Disable smoothing for sharper barcode edges
    ctx.imageSmoothingEnabled = false;

    // Ensure hidden root div exists
    if (!document.getElementById(FALLBACK_DIV_ID)) {
      const div = document.createElement("div");
      div.id = FALLBACK_DIV_ID;
      div.style.cssText = "display:none!important;position:absolute;opacity:0;pointer-events:none;";
      document.body.appendChild(div);
    }
    if (!fallbackRef.current) {
      fallbackRef.current = new Html5Qrcode(FALLBACK_DIV_ID, { verbose: false } as any);
    }
    const scanner = fallbackRef.current;

    intervalRef.current = setInterval(() => {
      if (!mountedRef.current || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || video.videoWidth === 0) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      // Re-apply after resize
      ctx.imageSmoothingEnabled = false; 
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(async (blob) => {
        if (!blob || !mountedRef.current) return;
        try {
          const file = new File([blob], "f.jpg", { type: "image/jpeg" });
          // Scan with specific formats to improve speed and accuracy
          const result = await scanner.scanFile(file, false);
          if (result) handleDetected(result);
        } catch { /* no barcode in frame */ }
      }, "image/jpeg", 0.85); // slightly higher quality
    }, 150); // Fast 150ms interval (approx ~6-7 fps)
  }, [handleDetected]);

  // --- Attach pre-acquired stream to video and start scanning ---
  useEffect(() => {
    mountedRef.current = true;
    const video = videoRef.current;
    if (!video || !stream) return;

    // Wire the pre-acquired stream directly to the video element.
    // No getUserMedia call here — the stream was already acquired in the click handler.
    video.srcObject = stream;

    const onPlaying = () => {
      if (!mountedRef.current) return;
      setScanActive(true);

      // Check torch capability
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const caps = track.getCapabilities() as any;
          setHasTorch(!!caps?.torch);
        } catch { /* ignore */ }
      }

      // Start barcode detection loop
      if (window.BarcodeDetector) {
        try {
          nativeDetectorRef.current = new window.BarcodeDetector({ formats: NATIVE_FORMATS });
          startNativeLoop(video);
        } catch {
          nativeDetectorRef.current = null;
          startFallbackLoop(video);
        }
      } else {
        startFallbackLoop(video);
      }
    };

    video.addEventListener("playing", onPlaying, { once: true });

    video.play().catch((err) => {
      console.warn("Video play error:", err);
    });

    return () => {
      mountedRef.current = false;
      stopScanLoops();
      video.removeEventListener("playing", onPlaying);
      // We do NOT stop the stream here — the parent component owns it
      video.srcObject = null;
      const div = document.getElementById(FALLBACK_DIV_ID);
      if (div) div.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream]);

  // --- Torch toggle ---
  const toggleTorch = async () => {
    const track = stream?.getVideoTracks()[0];
    if (!track || !hasTorch) return;
    try {
      const next = !isTorchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as any] });
      setIsTorchOn(next);
    } catch {
      toast({ title: "Erro na Lanterna", description: "Flash indisponível.", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto bg-slate-950 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800 animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between w-full p-4 border-b border-slate-900">
        <div className="flex items-center gap-2">
          <Camera className={`h-5 w-5 ${scanActive ? "text-emerald-400 animate-pulse" : "text-slate-500"}`} />
          <span className="font-semibold text-sm text-slate-200">Leitor de Código de Barras & QR Code</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-900 text-slate-400 hover:text-white" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Video viewport */}
      <div className="relative w-full aspect-video bg-black overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover contrast-[1.15] brightness-[1.05] grayscale-[0.1]"
        />
        {/* Hidden canvas for fallback frame decoding */}
        <canvas ref={canvasRef} className="absolute -z-10 opacity-0 w-1 h-1 pointer-events-none" />

        {/* Loading overlay */}
        {!scanActive && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 z-10">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
            <span className="text-xs text-slate-400 font-medium">Iniciando câmera...</span>
          </div>
        )}

        {/* Scanning guide overlay */}
        {scanActive && !isProcessing && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[82%] max-w-[310px] h-[38%] max-h-[150px] border-2 border-emerald-400 rounded-xl bg-black/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm" />
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm" />
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-sm" />
              <div className="absolute w-[96%] left-[2%] h-0.5 bg-red-500/80 shadow-[0_0_8px_2px_rgba(239,68,68,0.6)] animate-[scan_2.5s_ease-in-out_infinite]" />
            </div>
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className="inline-block bg-slate-900/85 border border-slate-800 text-[10px] font-medium text-slate-300 px-3 py-1 rounded-full shadow-md">
                Aponte para o código de barras ou QR Code
              </span>
            </div>
          </div>
        )}

        {/* Processing overlay */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-30">
            <Loader2 className="h-7 w-7 text-amber-400 animate-spin" />
            <span className="text-sm text-amber-200 font-semibold animate-pulse">Buscando & Salvando Livro...</span>
            <span className="text-[10px] text-slate-400">Modo Turbo Ativo ⚡</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="w-full p-4 bg-slate-950 border-t border-slate-900">
        <div className="flex justify-between items-center">
          <Button
            type="button" variant="ghost" size="sm"
            className="h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-900 gap-1.5 px-2.5 rounded-lg"
            onClick={() => setSoundEnabled(v => !v)}
          >
            {soundEnabled ? <><Volume2 className="h-4 w-4 text-emerald-400" /> Beep Ativo</> : <><VolumeX className="h-4 w-4 text-slate-500" /> Bip Silenciado</>}
          </Button>
          {hasTorch && scanActive && (
            <Button
              type="button" variant="ghost" size="sm"
              className="h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-900 gap-1.5 px-2.5 rounded-lg"
              onClick={toggleTorch}
            >
              {isTorchOn ? <><ZapOff className="h-4 w-4 text-amber-400 animate-pulse" /> Desligar Flash</> : <><Zap className="h-4 w-4 text-slate-400" /> Ligar Flash</>}
            </Button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% { top: 4%; }
          50% { top: 96%; }
        }
        #${FALLBACK_DIV_ID} { display: none !important; }
        video::-webkit-media-controls { display: none !important; }
      `}</style>
    </div>
  );
}
