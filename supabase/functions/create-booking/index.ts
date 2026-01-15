/**
 * create-booking Edge Function
 * SECURITY FIXES APPLIED:
 * - Fix #1: Relies on database UNIQUE constraint for race condition protection
 * - Fix #6: Atomic verification code update
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

interface CreateBookingRequest {
  phone: string;
  code: string;
  customer_name: string;
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
    const { phone, code, customer_name, booking_date, booking_time }: CreateBookingRequest = await req.json();

    // Validate required inputs
    if (!phone || !code || !customer_name || !booking_date || !booking_time) {
      throw new Error("Missing required fields");
    }

    // Validate code format
    if (!/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ success: false, error: "קוד לא תקין" }),
        { status: 200, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    // ===== SECURITY: Normalize phone (Fix #9) =====
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch {
      throw new Error("Invalid phone number format");
    }

    const maskedPhone = maskPhone(normalizedPhone);
    console.log(`Creating booking for: ${maskedPhone}, date: ${booking_date}, time: ${booking_time}`);

    // ===== SECURITY: Date validation (Fix #11) =====
    if (!isValidBookingDate(booking_date)) {
      return new Response(
        JSON.stringify({ success: false, error: "תאריך לא תקין" }),
        { status: 200, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    // ===== SECURITY: Atomic verification (Fix #6) =====
    // Use UPDATE...RETURNING to atomically consume the verification code
    const { data: verifiedCode, error: verifyError } = await supabase
      .from("verification_codes")
      .update({ verified: true })
      .eq("phone", normalizedPhone)
      .eq("code", code)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .select()
      .maybeSingle();

    if (verifyError) {
      console.error("Database error:", verifyError);
      throw new Error("Database error");
    }

    if (!verifiedCode) {
      console.log(`Invalid/expired code for: ${maskedPhone}`);
      return new Response(
        JSON.stringify({ success: false, error: "קוד שגוי או פג תוקף" }),
        { status: 200, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    // Check if slot is already booked (defense in depth - DB constraint is primary)
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
        JSON.stringify({ success: false, error: "השעה הזו לא זמינה" }),
        { status: 200, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    // ===== Create the booking =====
    // The database UNIQUE constraint (Fix #1) ensures no double-booking
    // even if two requests pass the above checks concurrently
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert([{
        customer_name: customer_name.trim(),
        customer_phone: normalizedPhone, // Store normalized E.164 format
        booking_date,
        booking_time,
        status: "confirmed"
      }])
      .select()
      .single();

    if (bookingError) {
      // Check if it's a unique constraint violation (race condition caught)
      if (bookingError.code === "23505") {
        console.log(`Race condition caught by DB constraint for: ${booking_date} ${booking_time}`);
        return new Response(
          JSON.stringify({ success: false, error: "השעה הזו כבר תפוסה" }),
          { status: 200, headers: { "Content-Type": "application/json", ...headers } }
        );
      }
      console.error("Booking error:", bookingError);
      throw new Error("Failed to create booking");
    }

    console.log(`Booking created: ${booking.id} for ${maskedPhone}`);

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
      console.log(`Confirmation SMS sent for booking: ${booking.id}`);
    } catch (smsError) {
      console.error("Failed to send confirmation SMS:", smsError);
      // Don't fail the booking if SMS fails
    }

    return new Response(
      JSON.stringify({ success: true, booking }),
      { status: 200, headers: { "Content-Type": "application/json", ...headers } }
    );
  } catch (error: any) {
    console.error("Error in create-booking function:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: sanitizeError(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...headers } }
    );
  }
};

serve(handler);
