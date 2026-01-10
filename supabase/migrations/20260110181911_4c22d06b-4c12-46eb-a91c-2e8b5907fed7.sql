-- Remove the overly permissive bookings INSERT policy
-- Bookings will be created via edge function with service role
DROP POLICY IF EXISTS "Authenticated users can create bookings" ON public.bookings;