/**
 * Shared Security Utilities for Supabase Edge Functions
 * Implements: Rate Limiting, Phone Normalization, Error Sanitization
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===================
// CORS Configuration (Fix #16)
// ===================
const ALLOWED_ORIGINS = [
  "https://mea-barber.com",
  "https://www.mea-barber.com",
  // Add localhost for development
  ...(Deno.env.get("IS_STAGING") === "true" ? ["http://localhost:8080", "http://localhost:5173"] : [])
];

export function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) 
    ? origin 
    : ALLOWED_ORIGINS[0];
  
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

// Legacy fallback for gradual migration
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


// ===================
// Phone Normalization (Fix #9)
// ===================
/**
 * Normalizes phone number to E.164 format (+972...)
 * Accepts: 0541234567, +972541234567, 972541234567
 * Returns: +972541234567
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, "");
  
  // Handle various Israeli formats
  if (cleaned.startsWith("+972")) {
    return cleaned; // Already E.164
  }
  if (cleaned.startsWith("972")) {
    return `+${cleaned}`; // Missing +
  }
  if (cleaned.startsWith("0")) {
    return `+972${cleaned.slice(1)}`; // Local format
  }
  
  // Assume local format if just 9 digits
  if (/^\d{9}$/.test(cleaned)) {
    return `+972${cleaned}`;
  }
  
  throw new Error("Invalid phone number format");
}

/**
 * Converts E.164 to local Israeli format (05XXXXXXXX)
 */
export function toLocalPhone(phone: string): string {
  const normalized = normalizePhone(phone);
  return `0${normalized.slice(4)}`; // +972 -> 0
}

/**
 * Validates Israeli mobile phone format
 */
export function isValidIsraeliPhone(phone: string): boolean {
  try {
    const normalized = normalizePhone(phone);
    // Israeli mobile starts with +9725
    return /^\+9725\d{8}$/.test(normalized);
  } catch {
    return false;
  }
}


// ===================
// Rate Limiting (Fix #2 & #4)
// ===================
interface RateLimitConfig {
  maxAttempts: number;
  windowMinutes: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  sms_send: { maxAttempts: 3, windowMinutes: 60 },      // 3 SMS per hour
  verify_attempt: { maxAttempts: 10, windowMinutes: 15 }, // 10 attempts per 15 min
  verify_fail: { maxAttempts: 5, windowMinutes: 15 },     // 5 failures = lockout
};

/**
 * Checks if an action is rate limited
 * @returns true if action is ALLOWED, false if rate limited
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  actionType: keyof typeof RATE_LIMITS
): Promise<boolean> {
  const config = RATE_LIMITS[actionType];
  if (!config) {
    console.warn(`Unknown rate limit action: ${actionType}`);
    return true; // Allow unknown actions
  }

  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_identifier: identifier,
    p_action_type: actionType,
    p_max_attempts: config.maxAttempts,
    p_window_minutes: config.windowMinutes,
  });

  if (error) {
    console.error("Rate limit check error:", error);
    return true; // Fail open on error
  }

  return data === true;
}

/**
 * Records an action for rate limiting
 */
export async function recordRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  actionType: string
): Promise<void> {
  const { error } = await supabase.rpc("record_rate_limit", {
    p_identifier: identifier,
    p_action_type: actionType,
  });

  if (error) {
    console.error("Rate limit record error:", error);
  }
}


// ===================
// Test Account Security (Fix #3)
// ===================
const TEST_PHONE_ENV = Deno.env.get("TEST_PHONE") || "";
const TEST_CODE_ENV = Deno.env.get("TEST_CODE") || "";
const IS_STAGING = Deno.env.get("IS_STAGING") === "true";

/**
 * Checks if a phone number is the test account
 * Test accounts only work in staging environment
 */
export function isTestAccount(phone: string): boolean {
  if (!IS_STAGING) {
    return false; // Test accounts disabled in production
  }
  
  try {
    const normalized = normalizePhone(phone);
    const testNormalized = TEST_PHONE_ENV ? normalizePhone(TEST_PHONE_ENV) : "";
    return normalized === testNormalized;
  } catch {
    return false;
  }
}

/**
 * Gets the test code if applicable
 */
export function getTestCode(): string | null {
  if (!IS_STAGING || !TEST_CODE_ENV) {
    return null;
  }
  return TEST_CODE_ENV;
}


// ===================
// Error Sanitization (Fix #8)
// ===================
const SAFE_ERROR_MESSAGES: Record<string, string> = {
  "Missing required fields": "חסרים שדות חובה",
  "Invalid phone number format": "מספר טלפון לא תקין",
  "Invalid code format": "קוד לא תקין",
  "Rate limit exceeded": "יותר מדי ניסיונות, נסה שוב מאוחר יותר",
  "Slot already booked": "השעה הזו כבר תפוסה",
  "Slot not available": "השעה הזו לא זמינה",
};

/**
 * Sanitizes error messages to prevent information disclosure
 */
export function sanitizeError(error: Error | string): string {
  const message = typeof error === "string" ? error : error.message;
  
  // Return safe message if mapped
  for (const [key, safe] of Object.entries(SAFE_ERROR_MESSAGES)) {
    if (message.includes(key)) {
      return safe;
    }
  }
  
  // Generic fallback - never expose internal errors
  console.error("Internal error (sanitized):", message);
  return "אירעה שגיאה, נסה שוב";
}


// ===================
// Phone Masking for Logs (Fix #17)
// ===================
/**
 * Masks phone number for logging: 05***4567
 */
export function maskPhone(phone: string): string {
  try {
    const local = toLocalPhone(phone);
    return `${local.slice(0, 2)}***${local.slice(-4)}`;
  } catch {
    return "***masked***";
  }
}


// ===================
// Date Validation (Fix #11)
// ===================
/**
 * Validates booking date is within acceptable range
 * Must be: today or in future, not more than 60 days ahead
 */
export function isValidBookingDate(dateStr: string): boolean {
  const date = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + 60);
  
  return date >= today && date <= maxDate;
}


// ===================
// Supabase Client Helper
// ===================
export function getSupabaseClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key);
}
