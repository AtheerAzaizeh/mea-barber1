import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CreateBookingRequest {
  phone: string;
  code: string;
  customer_name: string;
  booking_date: string;
  booking_time: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { phone, code, customer_name, booking_date, booking_time }: CreateBookingRequest = await req.json();

    console.log(`Creating booking for phone: ${phone}, date: ${booking_date}, time: ${booking_time}`);

    // Validate inputs
    if (!phone || !code || !customer_name || !booking_date || !booking_time) {
      throw new Error("Missing required fields");
    }

    // Validate code format
    if (!/^\d{6}$/.test(code)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "קוד לא תקין" 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Find and validate the verification code
    const { data: verificationData, error: fetchError } = await supabase
      .from("verification_codes")
      .select("*")
      .eq("phone", phone)
      .eq("code", code)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (fetchError) {
      console.error("Database error:", fetchError);
      throw new Error("Database error");
    }

    if (!verificationData) {
      console.log("Invalid or expired code");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "קוד שגוי או פג תוקף" 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Mark code as verified
    await supabase
      .from("verification_codes")
      .update({ verified: true })
      .eq("id", verificationData.id);

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
        JSON.stringify({ 
          success: false, 
          error: "השעה הזו כבר תפוסה" 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
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
        JSON.stringify({ 
          success: false, 
          error: "השעה הזו לא זמינה" 
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert([{
        customer_name: customer_name.trim(),
        customer_phone: phone,
        booking_date,
        booking_time,
        status: "confirmed"
      }])
      .select()
      .single();

    if (bookingError) {
      console.error("Booking error:", bookingError);
      throw new Error("Failed to create booking");
    }

    console.log("Booking created successfully:", booking.id);

    // Send confirmation SMS
    try {
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
        const formattedPhone = phone.startsWith("0") 
          ? `+972${phone.slice(1)}` 
          : phone;

        const message = `✂️ התור שלך אושר!\n📅 תאריך: ${booking_date}\n⏰ שעה: ${booking_time}\n\nאנא שים לב: ביטול תור חייב להיעשות לפחות 3 שעות לפני התור.\nכדי לבטל את התור שלח הודעת SMS עם הספרה 0.\n\nBARBERSHOP by Mohammad Eyad`;

        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;

        await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Authorization": `Basic ${btoa(`${twilioAccountSid}:${twilioAuthToken}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            To: formattedPhone,
            From: twilioPhoneNumber,
            Body: message,
          }),
        });

        console.log("Confirmation SMS sent");
      }
    } catch (smsError) {
      console.error("Failed to send confirmation SMS:", smsError);
      // Don't fail the booking if SMS fails
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        booking 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in create-booking function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
