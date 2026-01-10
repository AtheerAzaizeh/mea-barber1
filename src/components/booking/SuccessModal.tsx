import { Check } from "lucide-react";

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: Date | null;
  time: string | null;
  dayName: string;
}

export function SuccessModal({ isOpen, onClose, date, time, dayName }: SuccessModalProps) {
  if (!isOpen || !date || !time) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 bg-card rounded-2xl p-8 w-[90%] max-w-sm animate-scale-in text-center">
        <h3 className="text-xl font-semibold mb-4">
          התור נקבע בהצלחה
        </h3>
        
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-check-bounce">
            <Check className="w-10 h-10 text-primary" strokeWidth={3} />
          </div>
        </div>

        <div className="space-y-2 text-lg">
          <p className="font-semibold">
            יום {dayName} {date.getDate()}.{date.getMonth() + 1}
          </p>
          <p>
            שעה {time}
          </p>
        </div>

        <button
          onClick={onClose}
          className="btn-gold w-full mt-8"
        >
          סגור
        </button>
      </div>
    </div>
  );
}
