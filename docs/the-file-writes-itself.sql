-- THE FILE UPDATE LOG REMEMBERS WHAT WAS IN THE EMAIL.
--
-- 29 Oct 2026. Catherine, Operations Manager, item 6: keep a record of our
-- conversations with clients. Fabio: "think of an idea where the file notes is
-- automatically updated with our emails sent to client this for compliance".
--
-- THERE IS NO NEW TABLE AND NO NEW BOX. public.deal_notes already IS the log -
-- append-only, dated, signed, and the portal already writes to it when a deal
-- is sent back or a tab is unlocked. It has never been told about the emails,
-- which is the only reason most files have two entries in it.
--
-- So: one column.
--
-- `body` stays what it always was - the one line the rail shows. `detail` is
-- the wording of the email that went with it, and it is only ever set on an
-- entry the portal wrote.
--
-- WORDING, NOT THE WEB PAGE. Fabio, on storing the emails: "I don't like the
-- idea of storage. So is there a way to make the HTML just wording, structured
-- word, so it doesn't look like a mess on the file notes?" He is right. A
-- borrowing capacity email is sixty to a hundred kilobytes of the table
-- scaffolding Outlook needs; the same content as text is two or three. See
-- lib/email-as-text.ts.
--
-- AND IT IS LESS THAN IS STORED TODAY. The last BC email is already kept on the
-- deal as a whole web page in bc_data.emailHtml, and overwritten every time it
-- is regenerated. This keeps every version, smaller, and keeps the one thing
-- that copy could never give you: the date it went and who sent it.
--
-- Safe to run twice. One nullable column, nothing moved.

alter table public.deal_notes
  add column if not exists detail text;

comment on column public.deal_notes.detail is
  'The wording of the email this entry records, as structured text - never HTML. Set only on entries the portal wrote. body stays the one line the rail shows. See lib/email-as-text.ts.';

-- A CHECK OF WHAT YOU JUST RAN. Expect 1.
select count(*) as new_column
from information_schema.columns
where table_schema = 'public' and table_name = 'deal_notes' and column_name = 'detail';
