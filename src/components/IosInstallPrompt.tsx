import { useState, useEffect } from "react";
import { X, Share, PlusSquare } from "lucide-react";

export function IosInstallPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // בדיקה אם המכשיר הוא iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    // בדיקה אם האתר כבר מותקן כ-App (לא בדפדפן)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    // אם זה אייפון והאתר לא מותקן -> הצג את ההודעה
    if (isIOS && !isStandalone) {
      setShowPrompt(true);
    }
  }, []);

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-8 bg-white border-t shadow-2xl animate-in slide-in-from-bottom duration-500" dir="rtl">
      <button 
        onClick={() => setShowPrompt(false)}
        className="absolute top-2 left-2 p-1 text-gray-400 hover:text-gray-600"
      >
        <X size={20} />
      </button>

      <div className="flex flex-col items-center gap-4 text-center">
        <div className="space-y-2">
          <h3 className="font-bold text-lg text-gray-900">התקנת האפליקציה 📱</h3>
          <p className="text-sm text-gray-600">
            לחוויה הטובה ביותר, מומלץ להוסיף את האפליקציה למסך הבית.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-gray-800 bg-gray-50 px-4 py-2 rounded-lg border w-full justify-center">
          <span>1. לחץ על כפתור השיתוף</span>
          <Share size={18} className="text-blue-500" />
        </div>
        
        <div className="flex items-center gap-2 text-sm text-gray-800 bg-gray-50 px-4 py-2 rounded-lg border w-full justify-center">
          <span>2. בחר ב-"הוסף למסך הבית"</span>
          <PlusSquare size={18} className="text-gray-600" />
        </div>
      </div>
    </div>
  );
}