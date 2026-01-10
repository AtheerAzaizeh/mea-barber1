import { z } from "zod";

// Booking validation schema
export const bookingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "השם חייב להכיל לפחות 2 תווים" })
    .max(100, { message: "השם לא יכול להכיל יותר מ-100 תווים" })
    .regex(/^[\p{L}\s\-']+$/u, { message: "השם יכול להכיל רק אותיות ורווחים" }),
  phone: z
    .string()
    .trim()
    .regex(/^05\d{8}$/, { message: "מספר טלפון לא תקין (דוגמה: 0501234567)" }),
});

// Admin login validation schema
export const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email({ message: "כתובת אימייל לא תקינה" })
    .max(255, { message: "כתובת האימייל ארוכה מדי" }),
  password: z
    .string()
    .min(6, { message: "הסיסמה חייבת להכיל לפחות 6 תווים" })
    .max(128, { message: "הסיסמה ארוכה מדי" }),
});

// Verification code validation
export const verificationCodeSchema = z.object({
  code: z
    .string()
    .length(6, { message: "קוד האימות חייב להכיל 6 ספרות" })
    .regex(/^\d{6}$/, { message: "קוד האימות חייב להכיל רק ספרות" }),
});

export type BookingFormData = z.infer<typeof bookingSchema>;
export type AdminLoginData = z.infer<typeof adminLoginSchema>;
export type VerificationCodeData = z.infer<typeof verificationCodeSchema>;
