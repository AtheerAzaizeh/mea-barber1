import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function toLocalPhone(from: string): string {
  // Twilio sends +9725xxxxxxx for Israeli numbers
  if (from.startsWith("+972")) {
    return `0${from.slice(4)}`;
  }
  // If already local or other format, return as-is
  return from;
}

function buildTwimlMessage(text: string) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response><Message>${text}</Message></Response>`;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Twilio posts form-encoded data
    const form = await req.formData();
    const body = (form.get("Body") as string) || "";
    const from = (form.get("From") as string) || "";

    console.log("Incoming SMS from", from, "body:", body);

    if (!from || !body) {
      const twiml = buildTwimlMessage("תודה. לא התקבלה הודעה תקינה.");
      return new Response(twiml, { headers: { "Content-Type": "application/xml" } });
    }

    const text = body.trim();
    const phone = toLocalPhone(from);

    // Only handle cancellation command '0'
    if (text === "0") {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Fetch upcoming bookings for this phone ordered by date/time
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("customer_phone", phone)
        .neq("status", "cancelled")
        .order("booking_date", { ascending: true })
        .order("booking_time", { ascending: true });

      if (error) {
        console.error("DB error fetching bookings for cancellation:", error);
        const twiml = buildTwimlMessage("אירעה שגיאה פנימית, נסה שוב מאוחר יותר.");
        return new Response(twiml, { headers: { "Content-Type": "application/xml" } });
      }

      const now = new Date();
      const THREE_HOURS_MS = 3 * 60 * 60 * 1000;

      let cancelledBooking = null as any;

      for (const b of bookings || []) {
        // Compose booking datetime. booking_time may be "HH:MM" or include seconds
        const timePart = (b.booking_time || "").length === 5 ? `${b.booking_time}:00` : b.booking_time;
        const bookingDateTime = new Date(`${b.booking_date}T${timePart}`);

        if (isNaN(bookingDateTime.getTime())) continue;

        const diff = bookingDateTime.getTime() - now.getTime();
        if (diff >= THREE_HOURS_MS) {
          // Cancel this booking
          const { error: updateError } = await supabase
            .from("bookings")
            .update({ status: "cancelled" })
            .eq("id", b.id);

          if (updateError) {
            console.error("Failed to cancel booking id", b.id, updateError);
            const twiml = buildTwimlMessage("לא הצלחנו לבטל את התור. נסה שוב מאוחר יותר.");
            return new Response(twiml, { headers: { "Content-Type": "application/xml" } });
          }

          cancelledBooking = b;
          break;
        }
      }

      if (cancelledBooking) {
        const twiml = buildTwimlMessage(`התור שלך בתאריך ${cancelledBooking.booking_date} בשעה ${cancelledBooking.booking_time} בוטל בהצלחה.`);
        return new Response(twiml, { headers: { "Content-Type": "application/xml" } });
      }

      // No cancellable booking found
      const twiml = buildTwimlMessage("לא ניתן לבטל את התור - הביטול חייב להיעשות לפחות 3 שעות לפני התור או שאין תורים מתאימים.");
      return new Response(twiml, { headers: { "Content-Type": "application/xml" } });
    }

    // For other messages, reply with short help text
    const twiml = buildTwimlMessage("הודעה לא מזוהה. לשליחת ביטול תשלח 0 ואנו נבדוק את האפשרות לביטול.");
    return new Response(twiml, { headers: { "Content-Type": "application/xml" } });
  } catch (error) {
    console.error("Error in sms-webhook:", error);
    const twiml = buildTwimlMessage("שגיאה פנימית, נסה שנית מאוחר יותר.");
    return new Response(twiml, { headers: { "Content-Type": "application/xml" } });
  }
};

serve(handler);
