import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, RefreshCw, Volume2, VolumeX, X, Zap, ZapOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const { toast } = useToast();
  
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = 1100;
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (err) {
      console.warn("Could not play scan beep:", err);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    Html5Qrcode.getCameras()
      .then((devices) => {
        if (devices && devices.length > 0) {
          setCameras(devices);
          
          // Buscar câmera traseira padrão
          const backCamera = devices.find(d => 
            d.label.toLowerCase().includes("back") || 
            d.label.toLowerCase().includes("traseira") ||
            d.label.toLowerCase().includes("environment")
          );
          
          setSelectedCameraId(backCamera ? backCamera.id : devices[0].id);
        } else {
          toast({
            title: "Nenhuma câmera encontrada",
            description: "Certifique-se de que seu aparelho possui uma câmera funcional.",
            variant: "destructive"
          });
          onClose();
        }
      })
      .catch((err) => {
        console.error("Error getting cameras", err);
        toast({
          title: "Sem permissão de câmera",
          description: "Por favor, autorize o acesso à câmera para usar o leitor de código de barras.",
          variant: "destructive"
        });
        onClose();
      })
      .finally(() => setIsLoading(false));

    return () => {
      if (html5QrcodeRef.current) {
        if (html5QrcodeRef.current.isScanning) {
          html5QrcodeRef.current.stop().catch(console.error);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedCameraId || isLoading) return;
    
    startScanner(selectedCameraId);
    
    return () => {
      stopScanner();
    };
  }, [selectedCameraId, isLoading]);

  const startScanner = async (cameraId: string) => {
    try {
      setIsLoading(true);
      
      if (html5QrcodeRef.current) {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
      }
      
      const html5Qrcode = new Html5Qrcode("barcode-scanner-viewport");
      html5QrcodeRef.current = html5Qrcode;
      
      await html5Qrcode.start(
        cameraId,
        {
          fps: 15,
          qrbox: (width, height) => {
            const boxWidth = Math.min(width * 0.85, 320);
            const boxHeight = Math.min(height * 0.35, 140);
            return {
              x: (width - boxWidth) / 2,
              y: (height - boxHeight) / 2,
              width: boxWidth,
              height: boxHeight,
            };
          },
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39
          ]
        },
        (decodedText) => {
          playBeep();
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          onScanSuccess(decodedText);
        },
        () => {
          // Ignorado - scan silencioso em progresso
        }
      );
      
      setIsScanning(true);
      setIsTorchOn(false);
      
      try {
        const track = html5Qrcode.getRunningTrackCapabilities();
        if (track && (track as any).torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch {
        setHasTorch(false);
      }
      
    } catch (err) {
      console.error("Failed to start scanner:", err);
      toast({
        title: "Falha ao iniciar câmera",
        description: "Não foi possível abrir a câmera selecionada. Tente outra.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopScanner = async () => {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      try {
        await html5QrcodeRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Failed to stop scanner:", err);
      }
    }
  };

  const toggleTorch = async () => {
    if (!html5QrcodeRef.current || !hasTorch) return;
    try {
      const nextTorchState = !isTorchOn;
      await html5QrcodeRef.current.applyVideoConstraints({
        advanced: [{ torch: nextTorchState } as any]
      });
      setIsTorchOn(nextTorchState);
    } catch (err) {
      console.error("Failed to toggle torch:", err);
      toast({
        title: "Erro na lanterna",
        description: "Não foi possível acionar a lanterna do aparelho.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto bg-slate-950 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between w-full p-4 border-b border-slate-900 bg-slate-950">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-emerald-400 animate-pulse" />
          <span className="font-semibold text-sm text-slate-200">Leitor de Código de Barras</span>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-900 text-slate-400 hover:text-white" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Janela de Câmera */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        <div id="barcode-scanner-viewport" className="w-full h-full object-cover"></div>

        {/* Overlay do Scanner de Design Premium */}
        {isScanning && !isLoading && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
            {/* Caixa Guia de Foco */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-[320px] h-[35%] max-h-[140px] border-2 border-emerald-400 rounded-xl flex items-center justify-center bg-black/20 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]">
              {/* Bordas extras para destacar o cantos */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-500 rounded-tl-sm"></div>
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-500 rounded-tr-sm"></div>
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-500 rounded-bl-sm"></div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-500 rounded-br-sm"></div>

              {/* Linha do Laser Vermelho */}
              <div className="absolute w-[96%] h-0.5 bg-red-500/80 shadow-[0_0_8px_2px_rgba(239,68,68,0.7)] animate-[scan_2s_ease-in-out_infinite]"></div>
            </div>

            {/* Texto de Ajuda */}
            <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
              <span className="inline-block bg-slate-900/80 border border-slate-800 text-[11px] font-medium text-slate-300 px-3 py-1 rounded-full shadow-md">
                Posicione o código de barras no centro do retângulo
              </span>
            </div>
          </div>
        )}

        {/* Overlay de Inicialização */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
            <span className="text-xs text-slate-400 font-medium">Iniciando câmera...</span>
          </div>
        )}
      </div>

      {/* Controles do Rodapé */}
      <div className="w-full p-4 bg-slate-950 border-t border-slate-900 flex flex-col gap-3">
        {/* Seleção de Câmeras (Mobile com multi-câmeras traseiras) */}
        {cameras.length > 1 && (
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-slate-400 shrink-0" />
            <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
              <SelectTrigger className="w-full bg-slate-900 border-slate-800 text-white hover:bg-slate-850 h-9 text-xs">
                <SelectValue placeholder="Selecione a câmera" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                {cameras.map((cam) => (
                  <SelectItem key={cam.id} value={cam.id} className="text-xs hover:bg-slate-800 focus:bg-slate-800">
                    {cam.label || `Câmera ${cameras.indexOf(cam) + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Configurações Auxiliares (Lanterna e Mudo) */}
        <div className="flex justify-between items-center mt-1">
          {/* Som Beep de Confirmação */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-900 gap-1.5 px-2.5 rounded-lg"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="h-4 w-4 text-emerald-400" /> Som Ativado
              </>
            ) : (
              <>
                <VolumeX className="h-4 w-4 text-slate-500" /> Som Desativado
              </>
            )}
          </Button>

          {/* Ativar/Desativar Lanterna */}
          {hasTorch && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-900 gap-1.5 px-2.5 rounded-lg"
              onClick={toggleTorch}
            >
              {isTorchOn ? (
                <>
                  <ZapOff className="h-4 w-4 text-amber-400 animate-pulse" /> Desligar Lanterna
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 text-slate-400" /> Ligar Lanterna
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes scan {
          0%, 100% {
            top: 4%;
          }
          50% {
            top: 96%;
          }
        }
      `}</style>
    </div>
  );
}
