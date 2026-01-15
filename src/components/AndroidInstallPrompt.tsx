import { useState, useEffect } from "react";
import { Download, X } from "lucide-react"; 

export function AndroidInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsVisible(false);
      setDeferredPrompt(null);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 p-4 bg-white rounded-xl shadow-2xl border border-gray-200 animate-in slide-in-from-bottom duration-500" dir="rtl">
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="h-10 w-10 bg-black rounded-lg flex items-center justify-center shrink-0">
             <span className="text-xl">💈</span> {/* או שתשים כאן את תמונת הלוגו שלך */}
          </div>
          <div>
            <h3 className="font-bold text-gray-900">התקן את האפליקציה</h3>
            <p className="text-sm text-gray-500">גישה מהירה לקביעת תורים</p>
          </div>
        </div>
        <button onClick={() => setIsVisible(false)} className="text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>
      
      <button 
        onClick={handleInstallClick}
        className="mt-4 w-full bg-black text-white py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        <Download size={18} />
        התקנה
      </button>
    </div>
  );
}