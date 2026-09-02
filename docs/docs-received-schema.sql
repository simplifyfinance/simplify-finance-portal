-- DOCUMENTS RECEIVED, AND THE GAP BEFORE THE ASSESSOR IS TOLD.
--
-- One press on the Lending options tab emails the person who files the documents
-- straight away, and the credit assessor half an hour later. The wait exists
-- because telling both at once sends the assessor to a folder full of
-- IMG_4471.jpg. Fabio, 2 Sep 2026: "how about we delay message to credit by 30
-- min normally the time cris to label docs".
--
-- The wait is held by Resend, not by us: the assessor's email is handed over at
-- the moment the button is pressed, with the time it should go. Nothing of ours
-- has to still be awake half an hour later.

alter table deals add column if not exists docs_received_at timestamptz;
alter table deals add column if not exists docs_received_by text;
alter table deals add column if not exists docs_assessor_due_at timestamptz;
alter table deals add column if not exists docs_assessor_email_id text;

comment on column deals.docs_received_at is
  'When the client''s supporting documents were marked received. Claimed atomically, so two people pressing at once send one pair of emails.';
comment on column deals.docs_received_by is
  'Who marked them received.';
comment on column deals.docs_assessor_due_at is
  'When Resend will send the assessor "the documents are ready". Null with docs_received_at set means the send could not be queued - the deal shows that in red.';
comment on column deals.docs_assessor_email_id is
  'Resend''s id for that queued email, so it can be called off while it is still in the future.';

-- Settings: who files, and how long the gap is. Both changeable in
-- Settings -> Notifications without a code change. There is deliberately no
-- setting for who hears second: it is always the credit officer allocated to the
-- deal, and a deal without one cannot be marked at all.
alter table settings add column if not exists docs_file_notification_user_id uuid;
alter table settings add column if not exists docs_delay_minutes integer default 30;

comment on column settings.docs_file_notification_user_id is
  'Who is emailed to rename and file the documents, the moment they are marked received.';
comment on column settings.docs_delay_minutes is
  'Minutes between the two emails. 30 by default, 0 sends both at once, capped at 240.';
