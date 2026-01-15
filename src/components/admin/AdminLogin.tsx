import { useState } from "react";
import { z } from "zod";
import heroImage from "@/assets/barbershop-daburiyya-israel-haircut.webp";
import { adminLoginSchema } from "@/lib/validations";

interface AdminLoginProps {
  onLogin: (email: string, password: string) => Promise<{ error: any }>;
}

export function AdminLogin({ onLogin }: AdminLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState<{
    email?: string;
    password?: string;
  }>({});

  const validateForm = () => {
    try {
      adminLoginSchema.parse({ email, password });
      setValidationErrors({});
      return true;
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors: { email?: string; password?: string } = {};
        err.errors.forEach((e) => {
          if (e.path[0] === "email") errors.email = e.message;
          if (e.path[0] === "password") errors.password = e.message;
        });
        setValidationErrors(errors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const { error } = await onLogin(email, password);

      if (error) {
        if (error.message?.includes("Invalid login credentials")) {
          setError("אימייל או סיסמה שגויים");
        } else if (error.message?.includes("Email not confirmed")) {
          setError("יש לאשר את האימייל לפני הכניסה");
        } else {
          setError(error.message || "שגיאה בהתחברות");
        }
      }
    } catch (err) {
      setError("שגיאה לא צפויה, נסה שוב");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src={heroImage}
          alt="מספרה בדבוריה - כניסת מנהל BARBERSHOP"
          className="w-full h-full object-cover"
        />
        <div className="hero-overlay" />
      </div>

      {/* Login Form */}
      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-black tracking-wider mb-2">
            BARBERSHOP
          </h1>
          <p className="text-lg text-muted-foreground">by Mohammad Eyad</p>
          <p className="text-sm text-muted-foreground mt-2">ניהול</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-right text-sm font-medium mb-1">
              אימייל
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="admin@example.com"
              dir="ltr"
              disabled={isLoading}
            />
            {validationErrors.email && (
              <p className="text-destructive text-xs text-right mt-1">
                {validationErrors.email}
              </p>
            )}
          </div>

          <div>
            <label className="block text-right text-sm font-medium mb-1">
              סיסמה
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder="הכנס סיסמה"
              disabled={isLoading}
            />
            {validationErrors.password && (
              <p className="text-destructive text-xs text-right mt-1">
                {validationErrors.password}
              </p>
            )}
          </div>

          {error && (
            <p className="text-destructive text-sm text-center">{error}</p>
          )}

          <button
            type="submit"
            className="btn-gold w-full disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "טוען..." : "כניסה"}
          </button>
        </form>
      </div>
    </div>
  );
}
