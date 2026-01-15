import { useState, useEffect } from "react";
import { X, Share, PlusSquare, Smartphone, ExternalLink } from "lucide-react";

const STORAGE_KEY = "ios-install-prompt-dismissed";
const DISMISS_DURATION_DAYS = 7;

export function IosInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isChrome, setIsChrome] = useState(false);

  useEffect(() => {
    // Check if already dismissed recently
    const dismissedAt = localStorage.getItem(STORAGE_KEY);
    if (dismissedAt) {
      const dismissedDate = new Date(parseInt(dismissedAt));
      const daysSinceDismissal = (Date.now() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissal < DISMISS_DURATION_DAYS) {
        return;
      }
    }

    // Check if device is iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // Check if already installed as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    // Check if using Chrome on iOS (CriOS is Chrome on iOS)
    const isChromeOnIOS = /CriOS/.test(navigator.userAgent);

    if (isIOS && !isStandalone) {
      setIsChrome(isChromeOnIOS);
      // Small delay before showing
      setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
    }
  }, []);

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  if (!showPrompt) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-300"
        onClick={handleDismiss}
      />
      
      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-sm p-6 bg-white rounded-2xl shadow-2xl animate-in zoom-in-95 duration-300" dir="rtl">
        <button 
          onClick={handleDismiss}
          className="absolute top-3 left-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center gap-4">
          {/* App Icon */}
          <div className="h-16 w-16 bg-gradient-to-br from-gray-900 to-gray-700 rounded-2xl flex items-center justify-center shadow-lg">
            <Smartphone size={32} className="text-white" />
          </div>

          {isChrome ? (
            // Chrome on iOS - Guide to Safari
            <>
              <div className="space-y-2">
                <h3 className="font-bold text-xl text-gray-900">פתח ב-Safari להתקנה</h3>
                <p className="text-gray-500 text-sm">
                  להתקנת האפליקציה על האייפון, יש לפתוח את האתר בדפדפן Safari
                </p>
              </div>

              <div className="w-full space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-800 bg-blue-50 px-4 py-3 rounded-xl border border-blue-100">
                  <ExternalLink size={20} className="text-blue-500 shrink-0" />
                  <span>העתק את הכתובת ופתח ב-Safari</span>
                </div>
              </div>

              <button 
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  alert('הקישור הועתק! פתח את Safari והדבק אותו');
                }}
                className="w-full bg-black text-white py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-800 active:scale-[0.98] transition-all"
              >
                העתק קישור
              </button>
            </>
          ) : (
            // Safari on iOS - Normal install instructions
            <>
              <div className="space-y-2">
                <h3 className="font-bold text-xl text-gray-900">התקן את האפליקציה</h3>
                <p className="text-gray-500 text-sm">
                  הוסף את BARBERSHOP למסך הבית שלך לגישה מהירה
                </p>
              </div>

              <div className="w-full space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-800 bg-gray-50 px-4 py-3 rounded-xl border">
                  <Share size={20} className="text-blue-500 shrink-0" />
                  <span>1. לחץ על כפתור השיתוף למטה</span>
                </div>
                
                <div className="flex items-center gap-3 text-sm text-gray-800 bg-gray-50 px-4 py-3 rounded-xl border">
                  <PlusSquare size={20} className="text-gray-600 shrink-0" />
                  <span>2. בחר "הוסף למסך הבית"</span>
                </div>
              </div>
            </>
          )}

          <button 
            onClick={handleDismiss}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            לא עכשיו
          </button>
        </div>
      </div>
    </>
  );
}