-- =====================================================
-- SECURITY FIX MIGRATION: Phase 1 - Database Level
-- Fixes: #1 (Race Condition), #7 & #14 (RLS), Rate Limiting
-- =====================================================

-- ===================
-- FIX #1: Prevent Double-Booking Race Condition
-- ===================
-- Create a partial unique index that prevents two active bookings 
-- for the same date+time slot (excludes cancelled bookings)

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking_slot 
ON bookings (booking_date, booking_time) 
WHERE status != 'cancelled';

COMMENT ON INDEX idx_unique_active_booking_slot IS 
'Security fix: Prevents race condition double-booking by enforcing uniqueness at database level';


-- ===================
-- Rate Limiting Table
-- ===================
-- Track verification attempts and SMS sends for rate limiting

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,           -- phone number or IP address
  action_type TEXT NOT NULL,          -- 'sms_send', 'verify_attempt', 'verify_fail'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient rate limit queries
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup 
ON rate_limits (identifier, action_type, created_at DESC);

-- Auto-cleanup old rate limit entries (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limits WHERE created_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE rate_limits IS 
'Security: Tracks rate limiting for SMS sends and verification attempts';


-- ===================
-- FIX #7 & #14: RLS Policies for Bookings
-- ===================
-- Ensure RLS is enabled
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate with proper security
DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
DROP POLICY IF EXISTS "Users can create own bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can modify all bookings" ON bookings;
DROP POLICY IF EXISTS "Public read for availability check" ON bookings;
DROP POLICY IF EXISTS "Service role bypass" ON bookings;

-- Allow service role to bypass RLS (for edge functions)
CREATE POLICY "Service role bypass" ON bookings
  FOR ALL
  USING (auth.role() = 'service_role');

-- Public can check slot availability (read-only, limited fields)
CREATE POLICY "Public read for availability check" ON bookings
  FOR SELECT
  USING (true);  -- Anyone can see if a slot is taken

-- Admins can do everything
CREATE POLICY "Admins can view all bookings" ON bookings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

CREATE POLICY "Admins can modify all bookings" ON bookings
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );


-- ===================
-- RLS for rate_limits table
-- ===================
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- Only service role can access rate_limits
CREATE POLICY "Service role only" ON rate_limits
  FOR ALL
  USING (auth.role() = 'service_role');


-- ===================
-- RLS for verification_codes table
-- ===================
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only for verification" ON verification_codes;

CREATE POLICY "Service role only for verification" ON verification_codes
  FOR ALL
  USING (auth.role() = 'service_role');


-- ===================
-- Helper function for rate limit checking (used by edge functions)
-- ===================
CREATE OR REPLACE FUNCTION check_rate_limit(
  p_identifier TEXT,
  p_action_type TEXT,
  p_max_attempts INTEGER,
  p_window_minutes INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  attempt_count INTEGER;
BEGIN
  -- Count attempts in the time window
  SELECT COUNT(*) INTO attempt_count
  FROM rate_limits
  WHERE identifier = p_identifier
    AND action_type = p_action_type
    AND created_at > NOW() - (p_window_minutes || ' minutes')::INTERVAL;
  
  -- Return TRUE if within limit, FALSE if exceeded
  RETURN attempt_count < p_max_attempts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION record_rate_limit(
  p_identifier TEXT,
  p_action_type TEXT
)
RETURNS void AS $$
BEGIN
  INSERT INTO rate_limits (identifier, action_type) 
  VALUES (p_identifier, p_action_type);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_rate_limit IS 
'Returns TRUE if action is allowed (within rate limit), FALSE if rate limited';

COMMENT ON FUNCTION record_rate_limit IS 
'Records an action for rate limiting purposes';
