import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toDateKey } from "@/lib/constants";

/**
 * Checks if a booking date+time is in the past
 */
function isBookingInPast(bookingDate: string, bookingTime: string): boolean {
  const [hours, minutes] = bookingTime.split(":").map(Number);
  const bookingDateTime = new Date(bookingDate + "T00:00:00");
  bookingDateTime.setHours(hours, minutes, 0, 0);
  return bookingDateTime < new Date();
}

export interface Booking {
  id: string;
  customer_name: string;
  customer_phone: string;
  booking_date: string;
  booking_time: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .order("booking_date", { ascending: true })
        .order("booking_time", { ascending: true });

      if (error) throw error;
      setBookings(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();

    // Set up realtime subscription
    const channel = supabase
      .channel("bookings-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings",
        },
        () => {
          fetchBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const createBooking = async (booking: {
    customer_name: string;
    customer_phone: string;
    booking_date: string;
    booking_time: string;
    code: string;
  }) => {
    // Use edge function to create booking securely
    const { data, error } = await supabase.functions.invoke("create-booking", {
      body: {
        phone: booking.customer_phone,
        code: booking.code,
        customer_name: booking.customer_name,
        booking_date: booking.booking_date,
        booking_time: booking.booking_time,
      },
    });

    if (error) throw error;

    if (!data?.success) {
      throw new Error(data?.error || "שגיאה ביצירת התור");
    }

    return data.booking;
  };

  // Admin-only booking creation (uses service role via edge function)
  const createBookingAdmin = async (booking: {
    customer_name: string;
    customer_phone: string;
    booking_date: string;
    booking_time: string;
  }) => {
    const { data, error } = await supabase.functions.invoke("admin-create-booking", {
      body: booking,
    });

    if (error) throw error;

    if (!data?.success) {
      throw new Error(data?.error || "שגיאה ביצירת התור");
    }

    return data.booking;
  };

  const updateBooking = async (
    id: string,
    updates: Partial<{
      customer_name: string;
      customer_phone: string;
      booking_date: string;
      booking_time: string;
      status: string;
    }>,
    sendSms = true
  ) => {
    // Get current booking for SMS
    const currentBooking = bookings.find((b) => b.id === id);

    const { data, error } = await supabase
      .from("bookings")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    // Send update SMS if requested
    if (sendSms && currentBooking) {
      try {
        await supabase.functions.invoke("send-sms", {
          body: {
            phone: currentBooking.customer_phone,
            type: "booking_updated",
            data: {
              date: updates.booking_date || currentBooking.booking_date,
              time: updates.booking_time || currentBooking.booking_time,
            },
          },
        });
      } catch (smsError) {
        console.error("Failed to send update SMS:", smsError);
      }
    }

    return data;
  };

  const deleteBooking = async (id: string, sendSms = true) => {
    // Get booking info for SMS before deletion
    const bookingToDelete = bookings.find((b) => b.id === id);

    const { error } = await supabase.from("bookings").delete().eq("id", id);
    if (error) throw error;

    // Only send cancellation SMS if:
    // 1. sendSms flag is true
    // 2. Booking exists
    // 3. Booking is NOT in the past (no point notifying about already-passed bookings)
    if (sendSms && bookingToDelete) {
      const isPast = isBookingInPast(bookingToDelete.booking_date, bookingToDelete.booking_time);
      
      if (!isPast) {
        try {
          await supabase.functions.invoke("send-sms", {
            body: {
              phone: bookingToDelete.customer_phone,
              type: "booking_cancelled",
              data: {
                date: bookingToDelete.booking_date,
                time: bookingToDelete.booking_time,
              },
            },
          });
        } catch (smsError) {
          console.error("Failed to send cancellation SMS:", smsError);
        }
      } else {
        console.log("Skipping SMS for past booking:", bookingToDelete.booking_date, bookingToDelete.booking_time);
      }
    }
  };

  const getBookedTimesForDate = (date: Date): string[] => {
    const dateStr = toDateKey(date);
    return bookings
      .filter((b) => b.booking_date === dateStr && b.status !== "cancelled")
      .map((b) => b.booking_time);
  };

  // Helper to get only future bookings (for admin display)
  const getFutureBookings = (): Booking[] => {
    return bookings.filter((b) => !isBookingInPast(b.booking_date, b.booking_time));
  };

  return {
    bookings,
    loading,
    error,
    createBooking,
    createBookingAdmin,
    updateBooking,
    deleteBooking,
    getBookedTimesForDate,
    getFutureBookings,
    refetch: fetchBookings,
  };
}
