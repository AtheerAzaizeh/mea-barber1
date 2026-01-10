import { format } from "date-fns";

// Barbershop configuration
export const BARBERSHOP_CONFIG = {
  name: "BARBERSHOP",
  owner: "Mohammad Eyad",
  phone: "0540000000",
  hours: "10:00-17:00",
  location: "מיקום",
  
  // Working hours
  openingTime: 10, // 10:00
  closingTime: 17, // 17:00
  slotDuration: 40, // minutes
  
  // Monday is closed (0 = Sunday, 1 = Monday, etc.)
  closedDays: [1], // Monday
  
  // Cancellation policy
  minCancelHours: 3, // Must cancel at least 3 hours before
};

// Hebrew day names
export const HEBREW_DAYS = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
];

// Hebrew month names
export const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

// Generate time slots based on configuration
export function generateTimeSlots(): string[] {
  const slots: string[] = [];
  const { openingTime, closingTime, slotDuration } = BARBERSHOP_CONFIG;
  
  let currentMinutes = openingTime * 60;
  const endMinutes = closingTime * 60;
  
  while (currentMinutes < endMinutes) {
    const hours = Math.floor(currentMinutes / 60);
    const minutes = currentMinutes % 60;
    slots.push(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
    currentMinutes += slotDuration;
  }
  
  return slots;
}

// Convert a Date to a local YYYY-MM-DD key (avoids UTC timezone shifts)
export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

// Get available dates for the next week (excluding closed days)
export function getAvailableDates(): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    // Skip closed days (Monday = 1)
    if (!BARBERSHOP_CONFIG.closedDays.includes(date.getDay())) {
      dates.push(date);
    }
  }

  return dates;
}
