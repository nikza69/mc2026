/*
  # Phase 1 - Supabase ticketing

  Convert ticket state to database-native status values and add QR nonce
  support for signed Supabase-only ticket validation.
*/

-- Ticket status replaces blockchain/verification-specific state.
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

UPDATE tickets
SET status = CASE
  WHEN is_verified = true THEN 'checked_in'
  ELSE 'active'
END
WHERE status IS NULL;

ALTER TABLE tickets
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_status_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_status_check
  CHECK (status IN ('active', 'checked_in', 'cancelled'));

-- QR codes will be signed from ticket_id, event_id, and this secure nonce.
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS qr_nonce text;

UPDATE tickets
SET qr_nonce = gen_random_uuid()::text
WHERE qr_nonce IS NULL;

ALTER TABLE tickets
  ALTER COLUMN qr_nonce SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_qr_nonce
  ON tickets(qr_nonce);

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;

UPDATE tickets
SET checked_in_at = COALESCE(checked_in_at, created_at)
WHERE status = 'checked_in'
  AND checked_in_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_tickets_status
  ON tickets(status);

-- Current staff Edge Functions use email, while the original schema used username.
ALTER TABLE event_staff
  ADD COLUMN IF NOT EXISTS email text;

UPDATE event_staff
SET email = username
WHERE email IS NULL
  AND username IS NOT NULL;

ALTER TABLE event_staff
  ALTER COLUMN username DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_staff_event_email
  ON event_staff(event_id, email)
  WHERE email IS NOT NULL;
