-- WHO RECEIVES THE COMPLIANCE PACK.
--
-- 28 Oct 2026. One setting was doing two unrelated jobs.
--
-- "When a deal moves stage — who is asked to move the SalesTrekker card"
-- controlled four emails. Three of them are a chore: move the card to BC
-- Actioned, to LO Actioned, to Compliance. The fourth is not a chore at all -
-- it is the push to SalesTrekker, carrying the Fact Find, the Handover and the
-- Broker Notes, which are the compliance record of what went to credit that
-- day and have to be filed into the client's OneDrive folder.
--
-- So the pack could not be sent to one person without sending every
-- card-moving chore to the same person. On 28 Oct the pack for a live deal
-- went to Ellie when it was meant for Ellesse, and nobody could see why,
-- because the label on the setting says nothing about three PDFs.
--
-- Fabio: "The settings is not very clear who is receiving what."
--
-- NOTHING CHANGES ON THE DAY THIS RUNS. The column starts null, and null means
-- "whoever is asked to move the card" - exactly what happens today. It only
-- changes behaviour once somebody deliberately picks a different person in
-- Settings → Notifications.

alter table settings add column if not exists compliance_issued_notification_user_id uuid;

comment on column settings.compliance_issued_notification_user_id is
  'Who receives the push-to-SalesTrekker email carrying the Fact Find, Handover and Broker Notes. Null falls back to stage_move_notification_user_id, which is how it behaved before this column existed.';
