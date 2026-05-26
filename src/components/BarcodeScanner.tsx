import { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Camera, RefreshCw, Volume2, VolumeX, X, Zap, ZapOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
  isProcessing?: boolean;
}

export default function BarcodeScanner({ onScanSuccess, onClose, isProcessing = false }: BarcodeScannerProps) {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const startAttemptRef = useRef<number>(0);
  const runningCameraIdRef = useRef<string | null>(null); // Track active camera to prevent redundant loop restarts
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
    // Se a câmera que queremos iniciar já é a que está atualmente ativa e rodando,
    // evitamos reinicializar redundante para não causar race condition ou travar o hardware no mobile.
    if (selectedCameraId && selectedCameraId === runningCameraIdRef.current) {
      return;
    }

    // Atraso de 250ms antes de iniciar o scanner para dar tempo ao Dialog de montar o DOM
    const timer = setTimeout(() => {
      startScanner();
    }, 250);

    return () => {
      clearTimeout(timer);
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCameraId]);

  const startScanner = async () => {
    const attemptId = ++startAttemptRef.current;
    setIsLoading(true);
    
    try {
      // 1. Polling seguro para garantir que o elemento viewport foi montado no DOM pelo Dialog
      let element = document.getElementById("barcode-scanner-viewport");
      if (!element) {
        for (let i = 0; i < 20; i++) {
          await new Promise(resolve => setTimeout(resolve, 50));
          // Se uma nova tentativa de inicialização começou enquanto esperávamos, aborta esta
          if (attemptId !== startAttemptRef.current) return;
          element = document.getElementById("barcode-scanner-viewport");
          if (element) break;
        }
      }

      if (!element) {
        throw new Error("Viewport do scanner não encontrado no DOM (limite de tempo excedido).");
      }

      // 2. Parar qualquer scanner ativo
      if (html5QrcodeRef.current) {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current = null;
      }

      // 3. Instanciar o leitor HTML5-QRCode
      const html5Qrcode = new Html5Qrcode("barcode-scanner-viewport");
      html5QrcodeRef.current = html5Qrcode;

      // Configuração de câmera ideal para celular (HD, autofoco contínuo e modo seguro):
      const cameraConfig = selectedCameraId 
        ? { 
            deviceId: selectedCameraId,
            width: { ideal: 1280 },
            height: { ideal: 720 },
            advanced: [{ focusMode: "continuous" }]
          } 
        : { 
            facingMode: "environment",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            advanced: [{ focusMode: "continuous" }]
          };

      await html5Qrcode.start(
        cameraConfig as any,
        {
          fps: 20, // Aumentar de 12 para 20 quadros/seg melhora muito o rastreamento em celulares
          // Omitimos/não definimos 'qrbox' para decodificar o FRAME INTEIRO do vídeo.
          // Isso é CRÍTICO para suportar códigos pequenos, quadrados e de variadas formas,
          // além de evitar desalinhamento visual entre o frame e a caixa matemática no celular.
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true // Habilita detecção nativa acelerada no Chrome/Android e iOS
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
          if (isProcessing) return;
          playBeep();
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }
          // Chamar callback de sucesso com o código lido
          onScanSuccess(decodedText);
        },
        () => {
          // Callback de busca em andamento (silencioso para performance)
        }
      );

      // Confirmar que esta tentativa ainda é a ativa
      if (attemptId !== startAttemptRef.current) return;

      setIsScanning(true);
      setIsLoading(false);
      setIsTorchOn(false);

      // Sincronizar o runningCameraIdRef com a câmera ativada real
      const activeTrackSettings = html5Qrcode.getRunningTrackSettings();
      if (activeTrackSettings && activeTrackSettings.deviceId) {
        runningCameraIdRef.current = activeTrackSettings.deviceId;
      }

      // Verificar se a câmera ativa suporta Lanterna (Flash/Torch)
      try {
        const track = html5Qrcode.getRunningTrackCapabilities();
        setHasTorch(!!(track && (track as any).torch));
      } catch {
        setHasTorch(false);
      }

      // 4. Buscar câmeras disponíveis em segundo plano para preencher o seletor (se ainda não preenchido)
      if (cameras.length === 0) {
        Html5Qrcode.getCameras()
          .then((devices) => {
            if (attemptId === startAttemptRef.current && devices && devices.length > 0) {
              setCameras(devices);
              
              // Sincronizar o selectedCameraId sem causar reinicializações
              if (activeTrackSettings && activeTrackSettings.deviceId) {
                setSelectedCameraId(activeTrackSettings.deviceId);
              }
            }
          })
          .catch((err) => console.warn("Erro ao buscar lista de câmeras:", err));
      }

    } catch (err: any) {
      console.error("Erro completo ao iniciar câmera:", err);
      if (attemptId !== startAttemptRef.current) return;
      
      toast({
        title: "Acesso à câmera recusado",
        description: "Não foi possível acessar a câmera. Certifique-se de dar permissões de câmera e que nenhuma outra aba/app a esteja usando.",
        variant: "destructive"
      });
      onClose();
    }
  };

  const stopScanner = async () => {
    startAttemptRef.current++;
    runningCameraIdRef.current = null;
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      try {
        await html5QrcodeRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error("Erro ao parar leitor:", err);
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
      console.error("Falha ao ligar/desligar lanterna:", err);
      toast({
        title: "Erro na Lanterna",
        description: "Seu dispositivo ou navegador não permitiu acionar o flash no momento.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-md mx-auto bg-slate-950 text-white rounded-2xl overflow-hidden shadow-2xl border border-slate-800 animate-in fade-in zoom-in-95 duration-200">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between w-full p-4 border-b border-slate-900 bg-slate-950">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-emerald-400 animate-pulse" />
          <span className="font-semibold text-sm text-slate-200">Leitor de Código de Barras</span>
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

      {/* Janela da Câmera (Viewport) */}
      <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
        {/* Este é o elemento exato onde o html5-qrcode renderiza o stream */}
        <div id="barcode-scanner-viewport" className="w-full h-full object-cover"></div>

        {/* Overlay do Scanner de Alta Qualidade */}
        {isScanning && !isLoading && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
            {/* Retângulo de Foco */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[85%] max-w-[320px] h-[35%] max-h-[140px] border-2 border-emerald-400 rounded-xl flex items-center justify-center bg-black/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]">
              {/* Cantoneiras estilizadas */}
              <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-sm"></div>
              <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-sm"></div>
              <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-sm"></div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-sm"></div>

              {/* Linha Laser Pulsante */}
              <div className="absolute w-[96%] h-0.5 bg-red-500/80 shadow-[0_0_8px_2px_rgba(239,68,68,0.7)] animate-[scan_2s_ease-in-out_infinite]"></div>
            </div>

            {/* Texto de orientação */}
            <div className="absolute bottom-4 left-0 right-0 text-center pointer-events-none">
              <span className="inline-block bg-slate-900/90 border border-slate-800 text-[11px] font-medium text-slate-300 px-3 py-1 rounded-full shadow-md">
                Aponte para o código de barras (retangular ou quadrado)
              </span>
            </div>
          </div>
        )}

        {/* Overlay de Inicialização e Carregamento */}
        {isLoading && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 text-emerald-400 animate-spin" />
            <span className="text-xs text-slate-400 font-medium">Iniciando câmera traseira...</span>
          </div>
        )}

        {/* Overlay de Processamento do Livro (Modo Turbo) */}
        {isProcessing && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30">
            <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
            <span className="text-sm text-amber-200 font-semibold animate-pulse">Buscando & Salvando Livro...</span>
            <span className="text-[10px] text-slate-400">Modo Turbo Ativo ⚡</span>
          </div>
        )}
      </div>

      {/* Painel de Controles */}
      <div className="w-full p-4 bg-slate-950 border-t border-slate-900 flex flex-col gap-3">
        {/* Seletor de Câmeras Traseiras e Frontais (Mostrado apenas se houver mais de uma câmera) */}
        {cameras.length > 1 && (
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-slate-400 shrink-0" />
            <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
              <SelectTrigger className="w-full bg-slate-900 border-slate-800 text-white hover:bg-slate-850 h-9 text-xs">
                <SelectValue placeholder="Alternar câmera" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800 text-white">
                {cameras.map((cam) => (
                  <SelectItem key={cam.deviceId} value={cam.deviceId} className="text-xs hover:bg-slate-800 focus:bg-slate-800">
                    {cam.label || `Câmera ${cameras.indexOf(cam) + 1}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Botões Auxiliares (Lanterna e Som de Beep) */}
        <div className="flex justify-between items-center mt-1">
          {/* Habilitar / Desabilitar Som */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-900 gap-1.5 px-2.5 rounded-lg"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="h-4 w-4 text-emerald-400" /> Beep Ativo
              </>
            ) : (
              <>
                <VolumeX className="h-4 w-4 text-slate-500" /> Bip Silenciado
              </>
            )}
          </Button>

          {/* Habilitar / Desabilitar Lanterna */}
          {hasTorch && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-900 gap-1.5 px-2.5 rounded-lg"
              onClick={toggleTorch}
            >
              {isTorchOn ? (
                <>
                  <ZapOff className="h-4 w-4 text-amber-400 animate-pulse" /> Desligar Flash
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 text-slate-400" /> Ligar Flash
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
        #barcode-scanner-viewport video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}</style>
    </div>
  );
}
