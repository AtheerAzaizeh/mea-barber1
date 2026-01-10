import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface AdminCreateBookingRequest {
  customer_name: string;
  customer_phone: string;
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

    // Verify admin token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
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
        { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { customer_name, customer_phone, booking_date, booking_time }: AdminCreateBookingRequest = await req.json();

    console.log(`Admin creating booking: ${booking_date} ${booking_time} for ${customer_name}`);

    // Validate inputs
    if (!customer_name || !customer_phone || !booking_date || !booking_time) {
      throw new Error("Missing required fields");
    }

    // Create the booking
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert([{
        customer_name: customer_name.trim(),
        customer_phone: customer_phone.trim(),
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

    console.log("Admin booking created:", booking.id);

    // Send confirmation SMS
    try {
      const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
      const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
      const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

      if (twilioAccountSid && twilioAuthToken && twilioPhoneNumber) {
        const formattedPhone = customer_phone.startsWith("0") 
          ? `+972${customer_phone.slice(1)}` 
          : customer_phone;

        const message = `✂️ התור שלך אושר!\n📅 תאריך: ${booking_date}\n⏰ שעה: ${booking_time}\n\nBARBERSHOP by Mohammad Eyad`;

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
    }

    return new Response(
      JSON.stringify({ success: true, booking }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in admin-create-booking function:", error);
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
