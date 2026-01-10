import { generateTimeSlots } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface TimeSelectorProps {
  selectedTime: string | null;
  onSelectTime: (time: string) => void;
  bookedTimes?: string[];
  selectedDate: Date | null;
  isSlotClosed?: (date: Date, time?: string) => boolean;
}

export function TimeSelector({
  selectedTime,
  onSelectTime,
  bookedTimes = [],
  selectedDate,
  isSlotClosed,
}: TimeSelectorProps) {
  const timeSlots = generateTimeSlots();

  // Determine if a time slot is in the past
  const isTimePast = (time: string): boolean => {
    if (!selectedDate) return false;

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const selectedDateOnly = new Date(selectedDate);
    selectedDateOnly.setHours(0, 0, 0, 0);

    // If selected date is not today, no slots are past
    if (selectedDateOnly.getTime() !== today.getTime()) return false;

    // Check if the time has passed
    const [hours, minutes] = time.split(":").map(Number);
    const slotTime = new Date();
    slotTime.setHours(hours, minutes, 0, 0);

    return slotTime.getTime() < now.getTime();
  };

  return (
    <div className="w-full">
      <h3 className="text-right text-lg font-semibold mb-4">שעה</h3>
      <div className="flex flex-wrap justify-end gap-3">
        {timeSlots.map((time) => {
          const isSelected = selectedTime === time;
          const isBooked = bookedTimes.includes(time);
          const isPast = isTimePast(time);
          const isClosed =
            selectedDate && isSlotClosed
              ? isSlotClosed(selectedDate, time)
              : false;
          const isDisabled = isBooked || isPast || isClosed;

          return (
            <button
              key={time}
              onClick={() => !isDisabled && onSelectTime(time)}
              disabled={isDisabled}
              className={cn(
                "time-slot min-w-[70px] transition-all duration-200",
                isSelected && "time-slot-selected",
                isDisabled && "time-slot-disabled"
              )}
            >
              {time}
            </button>
          );
        })}
      </div>
    </div>
  );
}
