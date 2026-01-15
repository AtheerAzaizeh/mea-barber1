/**
 * verify-code Edge Function
 * SECURITY FIXES APPLIED:
 * - Fix #2: Rate limiting (10 attempts per 15 min, lockout after 5 failures)
 * - Fix #6: Atomic verification update to prevent race condition
 * - Fix #9: Phone normalization to E.164
 * - Fix #16: CORS restricted to production domain
 * - Fix #17: Phone numbers masked in logs
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  getCorsHeaders,
  getSupabaseClient,
  normalizePhone,
  checkRateLimit,
  recordRateLimit,
  maskPhone,
  sanitizeError,
} from "../_shared/security.ts";

interface VerifyCodeRequest {
  phone: string;
  code: string;
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
    const { phone, code }: VerifyCodeRequest = await req.json();

    if (!phone || !code) {
      throw new Error("Phone and code are required");
    }

    // Validate code format
    if (!/^\d{6}$/.test(code)) {
      throw new Error("Invalid code format");
    }

    // ===== SECURITY: Normalize phone (Fix #9) =====
    let normalizedPhone: string;
    try {
      normalizedPhone = normalizePhone(phone);
    } catch {
      throw new Error("Invalid phone number format");
    }

    const maskedPhone = maskPhone(normalizedPhone);
    console.log(`Verifying code for: ${maskedPhone}`);

    // ===== SECURITY: Rate limiting (Fix #2) =====
    // Check verify_attempt rate limit
    const attemptAllowed = await checkRateLimit(supabase, normalizedPhone, "verify_attempt");
    if (!attemptAllowed) {
      console.log(`Rate limited verification for: ${maskedPhone}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "יותר מדי ניסיונות, נסה שוב בעוד 15 דקות" 
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    // Check if locked out due to too many failures
    const failuresAllowed = await checkRateLimit(supabase, normalizedPhone, "verify_fail");
    if (!failuresAllowed) {
      console.log(`Account locked for: ${maskedPhone}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "החשבון נעול, נסה שוב בעוד 15 דקות" 
        }),
        { status: 429, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    // Record verification attempt
    await recordRateLimit(supabase, normalizedPhone, "verify_attempt");

    // ===== SECURITY: Atomic verification (Fix #6) =====
    // Use UPDATE...RETURNING to atomically mark code as verified
    // This prevents race condition where two requests verify the same code
    const { data: verifiedCode, error: updateError } = await supabase
      .from("verification_codes")
      .update({ verified: true })
      .eq("phone", normalizedPhone)
      .eq("code", code)
      .eq("verified", false)
      .gt("expires_at", new Date().toISOString())
      .select()
      .maybeSingle();

    if (updateError) {
      console.error("Database error:", updateError);
      throw new Error("Database error");
    }

    if (!verifiedCode) {
      // Record failed attempt for lockout tracking
      await recordRateLimit(supabase, normalizedPhone, "verify_fail");
      
      console.log(`Invalid/expired code for: ${maskedPhone}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "קוד שגוי או פג תוקף" 
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...headers } }
      );
    }

    console.log(`Code verified successfully for: ${maskedPhone}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json", ...headers } }
    );
  } catch (error: any) {
    console.error("Error in verify-code function:", error.message);
    return new Response(
      JSON.stringify({ success: false, error: sanitizeError(error) }),
      { status: 500, headers: { "Content-Type": "application/json", ...getCorsHeaders(null) } }
    );
  }
};

serve(handler);
