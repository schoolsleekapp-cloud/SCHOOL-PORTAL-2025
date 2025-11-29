
import React, { useEffect, useState, useRef } from 'react';
import { X, Camera, AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';

interface Props {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
}

const QrScannerModal: React.FC<Props> = ({ onScanSuccess, onClose }) => {
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isEmbedded, setIsEmbedded] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = "html5qr-code-full-region";

  useEffect(() => {
    // Check if the app is running inside an iframe (e.g., Google Sites)
    const inIframe = window.self !== window.top;
    setIsEmbedded(inIframe);

    // 0. Security Check
    if (window.isSecureContext === false) {
      setPermissionError("Camera access requires a secure connection (HTTPS). If testing locally, use localhost.");
      return;
    }

    // 1. Browser Support Check
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setPermissionError("Your browser does not support camera access.");
      return;
    }

    const Html5QrcodeScanner = (window as any).Html5QrcodeScanner;
    const Html5QrcodeSupportedFormats = (window as any).Html5QrcodeSupportedFormats;

    if (!Html5QrcodeScanner) {
      setPermissionError("Scanner library failed to load. Please check your internet connection.");
      return;
    }

    // Function to initialize the library
    const startScanner = () => {
        // Clear any existing instance
        if (scannerRef.current) {
            scannerRef.current.clear().catch(() => {});
            scannerRef.current = null;
        }

        const timerId = setTimeout(() => {
            try {
              if (scannerRef.current) return;
      
              const scanner = new Html5QrcodeScanner(
                scannerContainerId,
                { 
                  fps: 10, 
                  qrbox: { width: 250, height: 250 },
                  aspectRatio: 1.0,
                  showTorchButtonIfSupported: true,
                  formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE ],
                  // experimentalFeatures: { useBarCodeDetectorIfSupported: true } 
                },
                /* verbose= */ false
              );
              
              scannerRef.current = scanner;
      
              scanner.render(
                (decodedText: string) => {
                  // Prevent multiple calls
                  if (scannerRef.current) {
                      scannerRef.current.clear().then(() => {
                          onScanSuccess(decodedText);
                      }).catch(() => {
                          onScanSuccess(decodedText);
                      });
                      scannerRef.current = null;
                  }
                }, 
                (errorMessage: any) => {
                  // Ignore parse errors
                }
              );
      
            } catch (err: any) {
              console.error("Scanner Init Error:", err);
              setPermissionError("Failed to initialize scanner UI.");
            }
          }, 300); // Delay to ensure previous streams are fully closed
          
          return () => clearTimeout(timerId);
    };

    // 2. Explicitly request permission first to catch errors reliably
    const requestPermissionAndStart = async () => {
      try {
        // Use generic constraints (video: true) to avoid OverconstrainedError on devices without 'environment' cam
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        // CRITICAL: Stop the stream immediately. 
        // We only opened it to trigger the permission prompt/check.
        stream.getTracks().forEach(track => track.stop());
        
        // Permission granted, now start the library which handles its own stream
        startScanner();

      } catch (err: any) {
        console.error("Camera Permission Error:", err);
        
        let errorMessage = "Failed to access camera.";
        
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
           if (inIframe) {
             errorMessage = "Camera access is blocked by the iframe/embed container. Open in new tab.";
           } else {
             errorMessage = "Permission denied. Click the Lock icon in your address bar to allow Camera access.";
           }
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
           errorMessage = "No camera device found.";
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
           errorMessage = "Camera is in use by another app.";
        } else {
           errorMessage = `Camera Error: ${err.message || 'Unknown'}`;
        }
        
        setPermissionError(errorMessage);
      }
    };

    requestPermissionAndStart();

    // 3. Cleanup function
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch(() => {});
          scannerRef.current = null;
        } catch (e) {
          console.warn("Error during scanner cleanup", e);
        }
      }
    };
  }, [onScanSuccess]);

  const handleReload = () => {
      setPermissionError(null);
      window.location.reload();
  };

  const handleOpenNewTab = () => {
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden relative shadow-2xl">
        <div className="p-4 bg-gray-900 text-white flex justify-between items-center">
             <div className="flex items-center gap-2 font-bold">
                <Camera size={18} />
                Scan QR Code
             </div>
             <button onClick={onClose} className="text-gray-400 hover:text-white transition rounded-full p-1 hover:bg-gray-800">
                <X size={20} />
             </button>
        </div>

        <div className="p-4 bg-gray-100 min-h-[300px] flex flex-col items-center justify-center">
             {permissionError ? (
               <div className="text-center p-4 w-full">
                  <AlertCircle size={48} className="text-red-500 mx-auto mb-2" />
                  <p className="text-red-600 font-bold mb-1">Camera Issue</p>
                  <p className="text-sm text-gray-600 mb-6">{permissionError}</p>
                  
                  <div className="flex flex-col gap-3 w-full">
                    {isEmbedded && (
                        <button 
                            onClick={handleOpenNewTab} 
                            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 flex items-center justify-center gap-2 shadow-md transition-all"
                        >
                            <ExternalLink size={16} /> Open App in New Tab
                        </button>
                    )}
                    <button onClick={handleReload} className="w-full px-4 py-3 bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold hover:bg-gray-300 transition-all flex items-center justify-center gap-2">
                        <RefreshCw size={16} /> Retry / Reload
                    </button>
                  </div>
               </div>
             ) : (
               <>
                 <div id={scannerContainerId} className="w-full rounded-lg overflow-hidden bg-white shadow-inner"></div>
                 <p className="text-center text-xs text-gray-500 mt-4">
                    Position QR code within frame.
                 </p>
               </>
             )}
        </div>
      </div>
    </div>
  );
};

export default QrScannerModal;
