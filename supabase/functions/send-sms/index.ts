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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhone = Deno.env.get("TWILIO_PHONE_NUMBER");

    if (!accountSid || !authToken || !twilioPhone) {
      throw new Error("Twilio credentials not configured");
    }

    const { phone, type, data }: SendSmsRequest = await req.json();

    if (!phone || !/^05\d{8}$/.test(phone)) {
      throw new Error("Invalid phone number format");
    }

    const formattedPhone = `+972${phone.slice(1)}`;
    let message = "";

    switch (type) {
      case "verification":
        const code = data?.code || Math.floor(100000 + Math.random() * 900000).toString();
        message = `קוד האימות שלך הוא: ${code}\nBARBERSHOP by Mohammad Eyad`;
        
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        await supabase.from("verification_codes").delete().eq("phone", phone);
        await supabase.from("verification_codes").insert({
          phone,
          code,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          verified: false,
        });
        break;
        
      case "booking_confirmation":
        const formattedDateConfirm = data?.date ? formatDateHebrew(data.date) : data?.date;
        message = `התור שלך אושר!\nתאריך: ${formattedDateConfirm}\nשעה: ${data?.time}\n\nלביטול התור שלח 0 (לפחות 3 שעות לפני התור)\n\nBARBERSHOP by Mohammad Eyad`;
        break;
        
      case "booking_cancelled":
        const formattedDateCancel = data?.date ? formatDateHebrew(data.date) : data?.date;
        message = `התור שלך בתאריך ${formattedDateCancel} בשעה ${data?.time} בוטל.\nBARBERSHOP by Mohammad Eyad`;
        break;
        
      case "booking_updated":
        const formattedDateUpdate = data?.date ? formatDateHebrew(data.date) : data?.date;
        message = `התור שלך עודכן!\nתאריך: ${formattedDateUpdate}\nשעה: ${data?.time}\n\nלביטול התור שלח 0 (לפחות 3 שעות לפני התור)\n\nBARBERSHOP by Mohammad Eyad`;
        break;
        
      default:
        throw new Error("Invalid message type");
    }

    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${accountSid}:${authToken}`)}`,
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
      throw new Error(result.message || "Failed to send SMS");
    }

    return new Response(
      JSON.stringify({ success: true, messageId: result.sid, type }),
      { headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
