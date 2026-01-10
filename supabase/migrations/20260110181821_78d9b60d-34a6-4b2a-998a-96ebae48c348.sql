-- Fix bookings table: restrict SELECT to admin only
DROP POLICY IF EXISTS "Public can view bookings" ON public.bookings;
CREATE POLICY "Admins can view bookings" ON public.bookings
FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix verification_codes table: remove public SELECT and UPDATE
-- Verification should only happen via edge function with service role
DROP POLICY IF EXISTS "Public can view own verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "Public can update verification codes" ON public.verification_codes;

-- Only allow service role to read/update verification codes (via edge functions)
-- Keep INSERT for creating codes via edge function
-- No SELECT/UPDATE policies needed since edge functions use service role key