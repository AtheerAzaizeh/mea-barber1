import { getAvailableDates, HEBREW_DAYS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface DaySelectorProps {
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
  isSlotClosed?: (date: Date, time?: string) => boolean;
}

export function DaySelector({
  selectedDate,
  onSelectDate,
  isSlotClosed,
}: DaySelectorProps) {
  const availableDates = getAvailableDates();

  return (
    <div className="w-full">
      <h3 className="text-right text-lg font-semibold mb-4">יום</h3>
      <div className="flex flex-wrap justify-end gap-3">
        {availableDates.map((date) => {
          const isSelected =
            selectedDate?.toDateString() === date.toDateString();
          const dayName = HEBREW_DAYS[date.getDay()];
          const dayNumber = date.getDate();
          const isClosed = isSlotClosed?.(date);

          return (
            <button
              key={date.toISOString()}
              onClick={() => !isClosed && onSelectDate(date)}
              disabled={isClosed}
              className={cn(
                "day-card min-w-[70px] transition-all duration-200",
                isSelected && "day-card-selected",
                isClosed && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="text-sm font-medium">{dayName}</div>
              <div className="text-xl font-bold">{dayNumber}</div>
              {isClosed && (
                <div className="text-xs text-destructive">סגור</div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
