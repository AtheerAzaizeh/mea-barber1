import { useState } from "react";
import { z } from "zod";
import { DaySelector } from "./DaySelector";
import { TimeSelector } from "./TimeSelector";
import { VerificationModal } from "./VerificationModal";
import { SuccessModal } from "./SuccessModal";
import { HEBREW_DAYS, toDateKey } from "@/lib/constants";
import { useBookings } from "@/hooks/useBookings";
import { useClosedSlots } from "@/hooks/useClosedSlots";
import { bookingSchema } from "@/lib/validations";
import { toast } from "sonner";

interface BookingFormProps {
  onClose?: () => void;
}

export function BookingForm({ onClose }: BookingFormProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    name?: string;
    phone?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const { createBooking, getBookedTimesForDate } = useBookings();
  const { isSlotClosed } = useClosedSlots();

  const bookedTimes = selectedDate ? getBookedTimesForDate(selectedDate) : [];

  const validateForm = () => {
    try {
      bookingSchema.parse({ name, phone });
      setValidationErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: { name?: string; phone?: string } = {};
        err.errors.forEach((e) => {
          if (e.path[0] === "name") errors.name = e.message;
          if (e.path[0] === "phone") errors.phone = e.message;
        });
        setValidationErrors(errors);
      }
      return false;
    }
  };

  const isFormValid =
    name.trim() && phone.trim() && selectedDate && selectedTime;

  const handleSubmit = () => {
    if (!isFormValid) return;
    if (!validateForm()) return;

    // Check if slot is still available
    if (selectedDate && selectedTime) {
      if (isSlotClosed(selectedDate, selectedTime)) {
        toast.error("השעה הזו לא זמינה יותר");
        return;
      }
    }

    setShowVerification(true);
  };

  const handleVerificationSuccess = async (code: string) => {
    setShowVerification(false);
    setIsSubmitting(true);
    setVerificationCode(code);

    try {
      if (!selectedDate || !selectedTime) return;

      await createBooking({
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        booking_date: toDateKey(selectedDate),
        booking_time: selectedTime,
        code,
      });

      setShowSuccess(true);
    } catch (error: any) {
      toast.error(error.message || "שגיאה בשמירת התור");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    // Reset form
    setName("");
    setPhone("");
    setSelectedDate(null);
    setSelectedTime(null);
    setValidationErrors({});
    onClose?.();
  };

  return (
    <div className="bg-background min-h-screen">
      <div className="max-w-md mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-center mb-8">קביעת תור</h2>

        <div className="space-y-6">
          {/* Name Input */}
          <div className="space-y-2">
            <label className="block text-right font-medium">שם</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field text-right"
              placeholder="הכנס את שמך"
              maxLength={100}
            />
            {validationErrors.name && (
              <p className="text-destructive text-xs text-right">
                {validationErrors.name}
              </p>
            )}
          </div>

          {/* Phone Input */}
          <div className="space-y-2">
            <label className="block text-right font-medium">מספר טלפון</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field text-right"
              placeholder="0501234567"
              dir="ltr"
              maxLength={10}
            />
            {validationErrors.phone && (
              <p className="text-destructive text-xs text-right">
                {validationErrors.phone}
              </p>
            )}
          </div>

          {/* Day Selector */}
          <DaySelector
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setSelectedTime(null);
            }}
            isSlotClosed={isSlotClosed}
          />

          {/* Time Selector */}
          <TimeSelector
            selectedTime={selectedTime}
            onSelectTime={setSelectedTime}
            bookedTimes={bookedTimes}
            selectedDate={selectedDate}
            isSlotClosed={isSlotClosed}
          />

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!isFormValid || isSubmitting}
            className="btn-gold w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "שולח..." : "סיום"}
          </button>
        </div>
      </div>

      {/* Verification Modal */}
      <VerificationModal
        isOpen={showVerification}
        onClose={() => setShowVerification(false)}
        onSuccess={handleVerificationSuccess}
        phone={phone}
      />

      {/* Success Modal */}
      <SuccessModal
        isOpen={showSuccess}
        onClose={handleSuccessClose}
        date={selectedDate}
        time={selectedTime}
        dayName={selectedDate ? HEBREW_DAYS[selectedDate.getDay()] : ""}
      />
    </div>
  );
}
