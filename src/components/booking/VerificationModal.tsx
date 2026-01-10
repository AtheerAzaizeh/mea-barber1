import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (code: string) => void;
  phone: string;
}

export function VerificationModal({
  isOpen,
  onClose,
  onSuccess,
  phone,
}: VerificationModalProps) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");
  const [canResend, setCanResend] = useState(false);
  const [countdown, setCountdown] = useState(60);

  // Send SMS when modal opens
  useEffect(() => {
    if (isOpen && phone) {
      sendVerificationCode();
    }
    // Reset state when modal closes
    if (!isOpen) {
      setCode("");
      setError("");
      setCountdown(60);
      setCanResend(false);
    }
  }, [isOpen, phone]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || canResend) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, canResend]);

  const sendVerificationCode = async () => {
    setIsSending(true);
    setError("");

    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          phone,
          type: "verification",
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("קוד אימות נשלח לטלפון שלך");
      setCountdown(60);
      setCanResend(false);
    } catch (err: any) {
      console.error("Error sending SMS:", err);
      setError("שגיאה בשליחת הקוד, נסה שוב");
      toast.error("שגיאה בשליחת SMS");
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("הקוד חייב להכיל 6 ספרות");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      // Pass the code back to parent - the booking creation will validate the code
      onSuccess(code);
    } catch (err: any) {
      console.error("Error verifying code:", err);
      setError("שגיאה באימות הקוד");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 bg-card rounded-2xl p-6 w-[90%] max-w-sm animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-6">
          <h3 className="text-lg font-semibold">
            הקלד קוד אימות שנשלח לטלפון
          </h3>

          {isSending ? (
            <p className="text-muted-foreground">שולח קוד אימות...</p>
          ) : (
            <>
              <input
                type="text"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                className="input-field text-center text-xl tracking-widest"
                placeholder="000000"
                dir="ltr"
                disabled={isLoading}
              />

              {error && <p className="text-destructive text-sm">{error}</p>}

              <button
                onClick={handleVerify}
                disabled={code.length !== 6 || isLoading}
                className="btn-gold w-full disabled:opacity-50"
              >
                {isLoading ? "מאמת..." : "אימות"}
              </button>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  הקוד נשלח ל: {phone}
                </p>

                {canResend ? (
                  <button
                    onClick={sendVerificationCode}
                    disabled={isSending}
                    className="text-sm text-primary hover:underline"
                  >
                    שלח קוד מחדש
                  </button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    ניתן לשלוח שוב בעוד {countdown} שניות
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
