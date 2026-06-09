/*
  # Phase 3 - Ticket attendee information

  Store attendee details collected during ticket purchase in a separate table
  linked one-to-one with tickets.
*/

CREATE TABLE IF NOT EXISTS ticket_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  owner_user_id uuid NOT NULL,
  full_name text NOT NULL,
  student_id text,
  ic_or_passport text NOT NULL,
  phone_number text NOT NULL,
  student_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ticket_attendees_student_type_check
    CHECK (student_type IN ('xmum_student', 'non_xmum_student')),
  CONSTRAINT ticket_attendees_full_name_not_blank
    CHECK (length(trim(full_name)) > 0),
  CONSTRAINT ticket_attendees_ic_or_passport_not_blank
    CHECK (length(trim(ic_or_passport)) > 0),
  CONSTRAINT ticket_attendees_phone_number_not_blank
    CHECK (length(trim(phone_number)) > 0),
  CONSTRAINT ticket_attendees_xmum_student_id_required
    CHECK (
      student_type <> 'xmum_student'
      OR length(trim(COALESCE(student_id, ''))) > 0
    )
);

CREATE INDEX IF NOT EXISTS idx_ticket_attendees_ticket_id
  ON ticket_attendees(ticket_id);

CREATE INDEX IF NOT EXISTS idx_ticket_attendees_event_id
  ON ticket_attendees(event_id);

CREATE INDEX IF NOT EXISTS idx_ticket_attendees_owner_user_id
  ON ticket_attendees(owner_user_id);

CREATE INDEX IF NOT EXISTS idx_ticket_attendees_student_type
  ON ticket_attendees(student_type);
