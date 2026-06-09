/*
  # Phase 2 - VIP and Normal ticket types

  Add event-level capacity and pricing for VIP and Normal tickets, and
  store the selected ticket type on each ticket.
*/

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS vip_capacity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS normal_capacity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vip_price numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS normal_price numeric(10, 2) NOT NULL DEFAULT 0;

ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_vip_capacity_nonnegative,
  DROP CONSTRAINT IF EXISTS events_normal_capacity_nonnegative,
  DROP CONSTRAINT IF EXISTS events_vip_price_nonnegative,
  DROP CONSTRAINT IF EXISTS events_normal_price_nonnegative;

ALTER TABLE events
  ADD CONSTRAINT events_vip_capacity_nonnegative CHECK (vip_capacity >= 0),
  ADD CONSTRAINT events_normal_capacity_nonnegative CHECK (normal_capacity >= 0),
  ADD CONSTRAINT events_vip_price_nonnegative CHECK (vip_price >= 0),
  ADD CONSTRAINT events_normal_price_nonnegative CHECK (normal_price >= 0);

ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS ticket_type text DEFAULT 'Normal';

UPDATE tickets
SET ticket_type = 'Normal'
WHERE ticket_type IS NULL;

ALTER TABLE tickets
  ALTER COLUMN ticket_type SET NOT NULL;

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_ticket_type_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_ticket_type_check
  CHECK (ticket_type IN ('VIP', 'Normal'));

CREATE INDEX IF NOT EXISTS idx_tickets_event_type_status
  ON tickets(event_id, ticket_type, status);
