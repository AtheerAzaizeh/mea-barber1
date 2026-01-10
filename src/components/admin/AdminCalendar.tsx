import { useState } from "react";
import { Plus, Trash2, Edit2, X, Lock, Unlock, LogOut } from "lucide-react";
import {
  getAvailableDates,
  generateTimeSlots,
  HEBREW_DAYS,
  toDateKey,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useBookings, Booking } from "@/hooks/useBookings";
import { useClosedSlots } from "@/hooks/useClosedSlots";
import { bookingSchema } from "@/lib/validations";
import { z } from "zod";
import { toast } from "sonner";

type TabType = "view" | "close" | "edit";

interface AdminCalendarProps {
  onLogout: () => void;
}

export function AdminCalendar({ onLogout }: AdminCalendarProps) {
  const [activeTab, setActiveTab] = useState<TabType>("view");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const { bookings, loading, createBookingAdmin, updateBooking, deleteBooking } =
    useBookings();
  const { closedSlots, closeSlot, openSlot, isSlotClosed } = useClosedSlots();

  const availableDates = getAvailableDates();
  const timeSlots = generateTimeSlots();

  const getBookingAtTime = (date: Date, time: string) => {
    const dateStr = toDateKey(date);
    return bookings.find(
      (b) =>
        b.booking_date === dateStr &&
        b.booking_time === time &&
        b.status !== "cancelled"
    );
  };

  const handleDeleteBooking = async (id: string) => {
    if (confirm("האם למחוק את התור?")) {
      try {
        await deleteBooking(id);
        toast.success("התור נמחק בהצלחה");
      } catch (error) {
        toast.error("שגיאה במחיקת התור");
      }
    }
  };

  const handleToggleSlot = async (date: Date, time: string) => {
    const dateStr = toDateKey(date);

    // Find if slot is closed
    const closedSlot = closedSlots.find(
      (slot) => slot.closed_date === dateStr && slot.closed_time === time
    );

    try {
      if (closedSlot) {
        await openSlot(closedSlot.id);
        toast.success("השעה נפתחה");
      } else {
        await closeSlot(dateStr, time, "נסגר על ידי מנהל");
        toast.success("השעה נסגרה");
      }
    } catch (error) {
      toast.error("שגיאה בעדכון");
    }
  };

  const handleToggleDay = async (date: Date) => {
    const dateStr = toDateKey(date);

    // Find if day is closed
    const closedDay = closedSlots.find(
      (slot) => slot.closed_date === dateStr && slot.closed_time === null
    );

    try {
      if (closedDay) {
        await openSlot(closedDay.id);
        toast.success("היום נפתח");
      } else {
        await closeSlot(dateStr, null, "נסגר על ידי מנהל");
        toast.success("היום נסגר");
      }
    } catch (error) {
      toast.error("שגיאה בעדכון");
    }
  };

  const tabs = [
    { id: "view" as TabType, label: "תצוגה" },
    { id: "close" as TabType, label: "סגירה" },
    { id: "edit" as TabType, label: "עריכה" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">טוען...</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header with Tabs and Logout */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>יציאה</span>
        </button>

        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-6 py-2 rounded-lg font-medium transition-all",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          {/* Days Header */}
          <div
            className="grid gap-2 mb-4"
            style={{
              gridTemplateColumns: `repeat(${availableDates.length}, minmax(0, 1fr))`,
            }}
          >
            {availableDates.map((date) => {
              const isDayClosed = isSlotClosed(date);
              return (
                <div
                  key={date.toISOString()}
                  className={cn(
                    "text-center p-3 rounded-lg relative",
                    isDayClosed ? "bg-destructive/20" : "bg-secondary"
                  )}
                >
                  <div className="text-sm text-muted-foreground">
                    {HEBREW_DAYS[date.getDay()]}
                  </div>
                  <div className="text-lg font-bold">
                    {date.getDate()}.{date.getMonth() + 1}
                  </div>
                  {activeTab === "close" && (
                    <button
                      onClick={() => handleToggleDay(date)}
                      className={cn(
                        "absolute top-1 left-1 p-1 rounded",
                        isDayClosed
                          ? "text-destructive hover:bg-destructive/20"
                          : "text-primary hover:bg-primary/20"
                      )}
                    >
                      {isDayClosed ? (
                        <Unlock className="w-4 h-4" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Time Slots Grid */}
          <div className="space-y-2">
            {timeSlots.map((time) => (
              <div
                key={time}
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${availableDates.length}, minmax(0, 1fr))`,
                }}
              >
                {availableDates.map((date) => {
                  const booking = getBookingAtTime(date, time);
                  const slotClosed = isSlotClosed(date, time);

                  return (
                    <div
                      key={`${date.toISOString()}-${time}`}
                      className={cn(
                        "min-h-[60px] p-2 rounded-lg border transition-all",
                        slotClosed
                          ? "bg-destructive/10 border-destructive/30"
                          : booking
                          ? "bg-primary/20 border-primary"
                          : "bg-card border-border hover:border-primary/50"
                      )}
                    >
                      <div className="text-xs text-muted-foreground mb-1">
                        {time}
                      </div>
                      {booking && (
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1">
                            {activeTab === "edit" && (
                              <>
                                <button
                                  onClick={() => setEditingBooking(booking)}
                                  className="p-1 hover:bg-secondary rounded"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleDeleteBooking(booking.id)
                                  }
                                  className="p-1 hover:bg-destructive/20 rounded text-destructive"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            )}
                          </div>
                          <span className="text-xs font-medium truncate">
                            {booking.customer_name}
                          </span>
                        </div>
                      )}
                      {!booking && activeTab === "close" && !slotClosed && (
                        <button
                          onClick={() => handleToggleSlot(date, time)}
                          className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        >
                          <Lock className="w-4 h-4 text-destructive" />
                        </button>
                      )}
                      {slotClosed && activeTab === "close" && !booking && (
                        <button
                          onClick={() => handleToggleSlot(date, time)}
                          className="w-full h-full flex items-center justify-center"
                        >
                          <Unlock className="w-4 h-4 text-primary" />
                        </button>
                      )}
                      {!booking && !slotClosed && activeTab === "edit" && (
                        <button
                          onClick={() => {
                            setSelectedDate(date);
                            setSelectedTime(time);
                            setShowAddModal(true);
                          }}
                          className="w-full h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        >
                          <Plus className="w-4 h-4 text-primary" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bookings List */}
      <div className="mt-8 space-y-4">
        <h3 className="text-lg font-semibold text-right">תורים קרובים</h3>
        {bookings
          .filter((b) => b.status !== "cancelled")
          .map((booking) => (
            <div
              key={booking.id}
              className="glass-card p-4 flex items-center justify-between"
            >
              <div className="flex gap-2">
                {activeTab === "edit" && (
                  <>
                    <button
                      onClick={() => setEditingBooking(booking)}
                      className="p-2 hover:bg-secondary rounded-lg transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBooking(booking.id)}
                      className="p-2 hover:bg-destructive/20 rounded-lg transition-colors text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
              <div className="text-right">
                <div className="font-semibold">{booking.customer_name}</div>
                <div className="text-sm text-muted-foreground">
                  {booking.booking_time} | {booking.booking_date} |{" "}
                  {booking.customer_phone}
                </div>
              </div>
            </div>
          ))}
        {bookings.filter((b) => b.status !== "cancelled").length === 0 && (
          <p className="text-center text-muted-foreground">אין תורים</p>
        )}
      </div>

      {/* Add Booking Modal */}
      {showAddModal && selectedDate && selectedTime && (
        <AddBookingModal
          date={selectedDate}
          time={selectedTime}
          onClose={() => {
            setShowAddModal(false);
            setSelectedTime(null);
          }}
          onAdd={async (booking) => {
            try {
              await createBookingAdmin(booking);
              toast.success("התור נוסף בהצלחה");
              setShowAddModal(false);
              setSelectedTime(null);
            } catch (error) {
              toast.error("שגיאה בהוספת התור");
            }
          }}
        />
      )}

      {/* Edit Booking Modal */}
      {editingBooking && (
        <EditBookingModal
          booking={editingBooking}
          onClose={() => setEditingBooking(null)}
          onSave={async (updated) => {
            try {
              await updateBooking(updated.id, {
                customer_name: updated.customer_name,
                customer_phone: updated.customer_phone,
                booking_time: updated.booking_time,
              });
              toast.success("התור עודכן בהצלחה");
              setEditingBooking(null);
            } catch (error) {
              toast.error("שגיאה בעדכון התור");
            }
          }}
        />
      )}
    </div>
  );
}

interface AddBookingModalProps {
  date: Date;
  time: string;
  onClose: () => void;
  onAdd: (booking: {
    customer_name: string;
    customer_phone: string;
    booking_date: string;
    booking_time: string;
  }) => void;
}

function AddBookingModal({ date, time, onClose, onAdd }: AddBookingModalProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const handleSubmit = () => {
    try {
      bookingSchema.parse({ name, phone });
      setErrors({});
      onAdd({
        customer_name: name,
        customer_phone: phone,
        booking_date: toDateKey(date),
        booking_time: time,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: { name?: string; phone?: string } = {};
        err.errors.forEach((e) => {
          if (e.path[0] === "name") newErrors.name = e.message;
          if (e.path[0] === "phone") newErrors.phone = e.message;
        });
        setErrors(newErrors);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 bg-card rounded-2xl p-6 w-[90%] max-w-md animate-scale-in">
        <button onClick={onClose} className="absolute top-4 left-4">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-bold text-right mb-6">הוספת תור חדש</h3>

        <div className="mb-4 text-right text-sm text-muted-foreground">
          {HEBREW_DAYS[date.getDay()]} {date.getDate()}.{date.getMonth() + 1} -{" "}
          {time}
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-right text-sm mb-1">שם</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field text-right"
            />
            {errors.name && (
              <p className="text-destructive text-xs text-right mt-1">
                {errors.name}
              </p>
            )}
          </div>
          <div>
            <label className="block text-right text-sm mb-1">טלפון</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field"
              dir="ltr"
              placeholder="0501234567"
            />
            {errors.phone && (
              <p className="text-destructive text-xs text-right mt-1">
                {errors.phone}
              </p>
            )}
          </div>
          <button onClick={handleSubmit} className="btn-gold w-full">
            הוסף
          </button>
        </div>
      </div>
    </div>
  );
}

interface EditBookingModalProps {
  booking: Booking;
  onClose: () => void;
  onSave: (booking: Booking) => void;
}

function EditBookingModal({ booking, onClose, onSave }: EditBookingModalProps) {
  const [name, setName] = useState(booking.customer_name);
  const [phone, setPhone] = useState(booking.customer_phone);
  const [time, setTime] = useState(booking.booking_time);
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});

  const timeSlots = generateTimeSlots();

  const handleSubmit = () => {
    try {
      bookingSchema.parse({ name, phone });
      setErrors({});
      onSave({
        ...booking,
        customer_name: name,
        customer_phone: phone,
        booking_time: time,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: { name?: string; phone?: string } = {};
        err.errors.forEach((e) => {
          if (e.path[0] === "name") newErrors.name = e.message;
          if (e.path[0] === "phone") newErrors.phone = e.message;
        });
        setErrors(newErrors);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 bg-card rounded-2xl p-6 w-[90%] max-w-md animate-scale-in">
        <button onClick={onClose} className="absolute top-4 left-4">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-bold text-right mb-6">עריכת תור</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-right text-sm mb-1">שם</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field text-right"
            />
            {errors.name && (
              <p className="text-destructive text-xs text-right mt-1">
                {errors.name}
              </p>
            )}
          </div>
          <div>
            <label className="block text-right text-sm mb-1">טלפון</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-field"
              dir="ltr"
            />
            {errors.phone && (
              <p className="text-destructive text-xs text-right mt-1">
                {errors.phone}
              </p>
            )}
          </div>
          <div>
            <label className="block text-right text-sm mb-1">שעה</label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="input-field"
            >
              {timeSlots.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <button onClick={handleSubmit} className="btn-gold w-full">
            שמור
          </button>
        </div>
      </div>
    </div>
  );
}
