import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendSmsRequest {
  phone: string;
  type: "verification" | "booking_confirmation" | "booking_cancelled" | "booking_updated";
  data?: {
    code?: string;
    date?: string;
    time?: string;
    name?: string;
  };
}

const HEBREW_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

function formatDateHebrew(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const dayName = HEBREW_DAYS[date.getDay()];
  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `יום ${dayName} ${day}/${month}`;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
      console.error("Missing Twilio credentials");
      throw new Error("Twilio credentials not configured");
    }

    const { phone, type, data }: SendSmsRequest = await req.json();

    // Validate Israeli phone number format
    if (!phone || !/^05\d{8}$/.test(phone)) {
      throw new Error("Invalid phone number format");
    }

    // Format phone for international (Israel +972)
    const formattedPhone = `+972${phone.slice(1)}`;

    // Generate message based on type
    let message = "";
    switch (type) {
      case "verification":
        const code = data?.code || Math.floor(100000 + Math.random() * 900000).toString();
        message = `קוד האימות שלך הוא: ${code}\nBARBERSHOP by Mohammad Eyad`;
        
        // Store verification code in database
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Delete old codes for this phone
        await supabase
          .from("verification_codes")
          .delete()
          .eq("phone", phone);
        
        // Insert new code with 5-minute expiry
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
        await supabase.from("verification_codes").insert({
          phone,
          code,
          expires_at: expiresAt,
          verified: false,
        });
        
        break;
        
      case "booking_confirmation":
        const formattedDateConfirm = data?.date ? formatDateHebrew(data.date) : data?.date;
        message = `התור שלך אושר!\nתאריך: ${formattedDateConfirm}\nשעה: ${data?.time}\nBARBERSHOP by Mohammad Eyad`;
        break;
        
      case "booking_cancelled":
        const formattedDateCancel = data?.date ? formatDateHebrew(data.date) : data?.date;
        message = `התור שלך בתאריך ${formattedDateCancel} בשעה ${data?.time} בוטל.\nBARBERSHOP by Mohammad Eyad`;
        break;
        
      case "booking_updated":
        const formattedDateUpdate = data?.date ? formatDateHebrew(data.date) : data?.date;
        message = `התור שלך עודכן!\nתאריך: ${formattedDateUpdate}\nשעה: ${data?.time}\nBARBERSHOP by Mohammad Eyad`;
        break;
        
      default:
        throw new Error("Invalid message type");
    }

    console.log(`Sending SMS to ${formattedPhone}: ${type}`);

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const credentials = btoa(`${accountSid}:${authToken}`);

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: twilioPhone,
        Body: message,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Twilio error:", result);
      throw new Error(result.message || "Failed to send SMS");
    }

    console.log("SMS sent successfully:", result.sid);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: result.sid,
        type 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in send-sms function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
