/**
 * admin-create-booking Edge Function
 * SECURITY FIXES APPLIED:
 * - Fix #5: Added slot availability checks (same as public endpoint)
 * - Fix #9: Phone normalization to E.164
 * - Fix #11: Date validation (future dates only, max 60 days)
 * - Fix #16: CORS restricted to production domain
 * - Fix #17: Phone numbers masked in logs
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  getCorsHeaders,
  getSupabaseClient,
  normalizePhone,
  toLocalPhone,
  maskPhone,
  sanitizeError,
  isValidBookingDate,
} from "../_shared/security.ts";

interface AdminCreateBookingRequest {
  customer_name: string;
  customer_phone: string;
  booking_date: string;
  booking_time: string;
}

const handler = async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin");
  const headers = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const supabase = getSupabaseClient();

    // ===== Verify admin authentication =====
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    // Check if user is admin
    const { data: isAdmin } = await supabase.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ success: false, error: "Forbidden - Admin only" }),
        { status: 403, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    const { customer_name, customer_phone, booking_date, booking_time }: AdminCreateBookingRequest = await req.json();

    // Validate required inputs
    if (!customer_name || !customer_phone || !booking_date || !booking_time) {
      throw new Error("Missing required fields");
    }

    // ===== SECURITY: Normalize phone (Fix #9) =====
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhone(customer_phone);
    } catch {
      throw new Error("Invalid phone number format");
    }

    const maskedPhone = maskPhone(normalizedPhone);
    console.log(`Admin creating booking: ${booking_date} ${booking_time} for ${maskedPhone}`);

    // ===== SECURITY: Date validation (Fix #11) =====
    if (!isValidBookingDate(booking_date)) {
      return new Response(
        JSON.stringify({ success: false, error: "תאריך לא תקין" }),
        { status: 200, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    // ===== SECURITY: Slot availability checks (Fix #5) =====
    // Check if slot is already booked
    const { data: existingBooking } = await supabase
      .from("bookings")
      .select("id")
      .eq("booking_date", booking_date)
      .eq("booking_time", booking_time)
      .neq("status", "cancelled")
      .maybeSingle();

    if (existingBooking) {
      return new Response(
        JSON.stringify({ success: false, error: "השעה הזו כבר תפוסה" }),
        { status: 200, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    // Check if slot is closed
    const { data: closedSlot } = await supabase
      .from("closed_slots")
      .select("id")
      .eq("closed_date", booking_date)
      .or(`closed_time.eq.${booking_time},closed_time.is.null`)
      .maybeSingle();

    if (closedSlot) {
      return new Response(
        JSON.stringify({ success: false, error: "השעה הזו סגורה" }),
        { status: 200, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert([{
        customer_name: customer_name.trim(),
        customer_phone: normalizedPhone,
        booking_date,
        booking_time,
        status: "confirmed"
      }])
      .select()
      .single();

    if (bookingError) {
      // Handle unique constraint violation (race condition)
      if (bookingError.code === "23505") {
        return new Response(
          JSON.stringify({ success: false, error: "השעה הזו כבר תפוסה" }),
          { status: 200, headers: { "Content-Type": "application/json", ...headers } }
        );
      }
      console.error("Booking error:", bookingError);
      throw new Error("Failed to create booking");
    }

    console.log(`Admin booking created: ${booking.id}`);

    // Send confirmation SMS
    try {
      const localPhone = toLocalPhone(normalizedPhone);
      await supabase.functions.invoke("send-sms", {
        body: {
          phone: localPhone,
          type: "booking_confirmation",
          data: {
            date: booking_date,
            time: booking_time,
            name: customer_name,
          },
        },
      });
      console.log(`Confirmation SMS sent for admin booking: ${booking.id}`);
    } catch (smsError) {
      console.error("Failed to send confirmation SMS:", smsError);
    }

    return new Response(
      JSON.stringify({ success: true, booking }),
      { status: 200, headers: { "Content-Type": "application/json", ...headers } }
    );
  } catch (error: any) {
    console.error("Error in admin-create-booking function:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: sanitizeError(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...headers } }
    );
  }
};

serve(handler);
