/**
 * send-sms Edge Function
 * SECURITY FIXES APPLIED:
 * - Fix #3: Test account moved to environment variables, only works in staging
 * - Fix #4: Rate limiting (3 SMS per phone per hour)
 * - Fix #9: Phone normalization to E.164
 * - Fix #16: CORS restricted to production domain
 * - Fix #17: Phone numbers masked in logs
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  getCorsHeaders,
  getSupabaseClient,
  normalizePhone,
  toLocalPhone,
  isValidIsraeliPhone,
  isTestAccount,
  getTestCode,
  checkRateLimit,
  recordRateLimit,
  maskPhone,
  sanitizeError,
} from "../_shared/security.ts";

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
  const origin = req.headers.get("Origin");
  const headers = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  try {
    const supabase = getSupabaseClient();
    const { phone, type, data }: SendSmsRequest = await req.json();

    // ===== SECURITY: Normalize and validate phone =====
    if (!phone) {
      throw new Error("Phone number is required");
    }

    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch {
      throw new Error("Invalid phone number format");
    }

    if (!isValidIsraeliPhone(normalizedPhone)) {
      throw new Error("Invalid phone number format");
    }

    const localPhone = toLocalPhone(normalizedPhone);
    const maskedPhone = maskPhone(normalizedPhone);

    // ===== SECURITY: Rate limiting (Fix #4) =====
    const isAllowed = await checkRateLimit(supabase, normalizedPhone, "sms_send");
    if (!isAllowed) {
      console.log(`Rate limited SMS for: ${maskedPhone}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "יותר מדי ניסיונות, נסה שוב בעוד שעה" 
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    // Record SMS attempt for rate limiting
    await recordRateLimit(supabase, normalizedPhone, "sms_send");

    // ===== SECURITY: Test account check (Fix #3) =====
    const isTest = isTestAccount(normalizedPhone);
    
    // Generate message based on type
    let message = "";
    switch (type) {
      case "verification": {
        // Use test code only in staging environment
        const testCode = getTestCode();
        const code = isTest && testCode 
          ? testCode 
          : (data?.code || Math.floor(100000 + Math.random() * 900000).toString());
        
        message = `קוד האימות שלך הוא: ${code}\nBARBERSHOP by Mohammad Eyad`;
        
        // Delete old codes for this phone
        await supabase
          .from("verification_codes")
          .delete()
          .eq("phone", normalizedPhone);
        
        // Insert new code with appropriate expiry
        // Test accounts get 30 days (for app store review), regular users get 5 minutes
        const expiryMs = isTest ? 30 * 24 * 60 * 60 * 1000 : 5 * 60 * 1000;
        const expiresAt = new Date(Date.now() + expiryMs).toISOString();
        
        await supabase.from("verification_codes").insert({
          phone: normalizedPhone,
          code,
          expires_at: expiresAt,
          verified: false,
        });
        
        // Skip actual SMS for test accounts
        if (isTest) {
          console.log(`Test account SMS skipped: ${maskedPhone}`);
          return new Response(
            JSON.stringify({ success: true, type, testAccount: true }),
            { status: 200, headers: { "Content-Type": "application/json", ...headers } }
          );
        }
        break;
      }
        
      case "booking_confirmation": {
        const formattedDate = data?.date ? formatDateHebrew(data.date) : data?.date;
        message = `התור שלך אושר!\nתאריך: ${formattedDate}\nשעה: ${data?.time}\n\nלביטול התור שלח 0 (לפחות 3 שעות לפני התור)\nBARBERSHOP by Mohammad Eyad`;
        break;
      }
        
      case "booking_cancelled": {
        const formattedDate = data?.date ? formatDateHebrew(data.date) : data?.date;
        message = `התור שלך בתאריך ${formattedDate} בשעה ${data?.time} בוטל.\nBARBERSHOP by Mohammad Eyad`;
        break;
      }
        
      case "booking_updated": {
        const formattedDate = data?.date ? formatDateHebrew(data.date) : data?.date;
        message = `התור שלך עודכן!\nתאריך: ${formattedDate}\nשעה: ${data?.time}\nBARBERSHOP by Mohammad Eyad`;
        break;
      }
        
      default:
        throw new Error("Invalid message type");
    }

    // Send SMS via gateway
    const smsGatewayLogin = Deno.env.get("SMS_GATEWAY_LOGIN");
    const smsGatewayPassword = Deno.env.get("SMS_GATEWAY_PASSWORD");

    if (!smsGatewayLogin || !smsGatewayPassword) {
      console.error("Missing SMS Gateway credentials");
      throw new Error("SMS Gateway not configured");
    }

    console.log(`Sending SMS to ${maskedPhone}: ${type}`);

    const gatewayUrl = "https://api.sms-gate.app/3rdparty/v1/message";
    const authHeader = "Basic " + btoa(`${smsGatewayLogin}:${smsGatewayPassword}`);

    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
      },
      body: JSON.stringify({
        textMessage: { text: message },
        phoneNumbers: [normalizedPhone],
      }),
    });

    const responseText = await response.text();
    console.log(`SMS Gateway response (${response.status}):`, responseText);

    if (!response.ok) {
      console.error("SMS Gateway error:", responseText);
      throw new Error("Failed to send SMS via gateway");
    }

    console.log(`SMS sent successfully to ${maskedPhone}`);

    return new Response(
      JSON.stringify({ success: true, type, gateway: "capcom6" }),
      { status: 200, headers: { "Content-Type": "application/json", ...headers } }
    );
  } catch (error: any) {
    console.error("Error in send-sms function:", error.message);
    return new Response(
      JSON.stringify({ error: sanitizeError(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(null) } }
    );
  }
};

serve(handler);
