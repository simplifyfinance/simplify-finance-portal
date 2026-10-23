-- WHO ACTUALLY DID EACH STAGE.
--
-- 23 Oct 2026. Fabio: "i need each stage tro be recoreded and managed by that
-- perison remmeber as we measure productivy".
--
-- The portal has stored ONE credit officer for the whole deal since it was
-- built. So a broker who writes the BC himself and then hands the lending
-- options to Sylvan ends up with a deal that says Sylvan did both, and every
-- workload number credits him with a BC he never opened.
--
-- Three stages, three owners, three clocks. A null officer means the broker
-- did it themselves - the name beside it says which broker.
--
-- RUN ON STAGING FIRST, then live. It only adds columns and backfills what we
-- already know; nothing existing is changed or dropped.

-- NO FOREIGN KEY ON THESE THREE. READ THIS BEFORE ADDING ONE BACK.
--
-- 23 Oct 2026, live, 20 minutes of the whole team seeing an empty deals list.
-- I wrote these three columns as "references public.credit_officers(id)" out of
-- habit. The deals list asks Supabase for "credit_officers(name)" alongside the
-- deal, and that only works while there is exactly ONE link between the two
-- tables. Three more links and it stops guessing and refuses the whole query -
-- so the page asked for deals, got an error, and drew nothing. Every deal was
-- sitting in the table the entire time.
--
-- The column holds the officer's id either way. The constraint bought us
-- nothing and cost us the afternoon. If a foreign key is ever added here, the
-- query in app/(app)/deals/page.tsx has to name which link it means first.

-- If an earlier run of this file added them, take them off.
do $$
declare c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_attribute a
        on a.attrelid = con.conrelid and a.attnum = any (con.conkey)
     where con.conrelid  = 'public.deals'::regclass
       and con.contype   = 'f'
       and con.confrelid = 'public.credit_officers'::regclass
       and a.attname in ('bc_owner_officer','lo_owner_officer','compliance_owner_officer')
  loop
    execute format('alter table public.deals drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.deals add column if not exists bc_owner_officer         uuid;
alter table public.deals add column if not exists bc_owner_name            text;
alter table public.deals add column if not exists bc_owner_since           timestamptz;

alter table public.deals add column if not exists lo_owner_officer         uuid;
alter table public.deals add column if not exists lo_owner_name            text;
alter table public.deals add column if not exists lo_owner_since           timestamptz;

alter table public.deals add column if not exists compliance_owner_officer uuid;
alter table public.deals add column if not exists compliance_owner_name    text;
alter table public.deals add column if not exists compliance_owner_since   timestamptz;

-- WHAT WE ALREADY KNOW, WRITTEN DOWN ONCE.
--
-- Every deal with a credit officer had that one officer on the whole file, so
-- the honest backfill is to say they owned each stage that has been worked.
-- It is not better than the truth, but it is exactly what the portal has been
-- reporting all along - so no number moves on the day this ships, and every
-- number recorded from here is real.
update public.deals
   set bc_owner_officer = assigned_credit_officer,
       bc_owner_since   = coalesce(credit_assigned_at, created_at)
 where assigned_credit_officer is not null
   and bc_owner_officer is null;

update public.deals
   set lo_owner_officer = assigned_credit_officer,
       lo_owner_since   = coalesce(bc_completed_at, credit_assigned_at, created_at)
 where assigned_credit_officer is not null
   and lo_owner_officer is null
   and (lo_completed_at is not null or lo_sent_at is not null);

update public.deals
   set compliance_owner_officer = assigned_credit_officer,
       compliance_owner_since   = coalesce(lo_completed_at, credit_assigned_at, created_at)
 where assigned_credit_officer is not null
   and compliance_owner_officer is null
   and compliance_completed_at is not null;

-- AND THE NAME BESIDE THE ID.
--
-- The blue box on the deal shows a name, not a uuid. Without this a backfilled
-- deal would open with "— credit" and nothing in front of it.
update public.deals d
   set bc_owner_name = co.name
  from public.credit_officers co
 where co.id = d.bc_owner_officer
   and d.bc_owner_name is null;

update public.deals d
   set lo_owner_name = co.name
  from public.credit_officers co
 where co.id = d.lo_owner_officer
   and d.lo_owner_name is null;

update public.deals d
   set compliance_owner_name = co.name
  from public.credit_officers co
 where co.id = d.compliance_owner_officer
   and d.compliance_owner_name is null;

-- A deal nobody gave to credit was the broker's. Said out loud rather than
-- left null, so "nobody has decided yet" and "the broker did it" stay apart.
update public.deals
   set bc_owner_name = assigned_broker,
       bc_owner_since = coalesce(bc_owner_since, created_at)
 where assigned_credit_officer is null
   and bc_owner_officer is null
   and bc_owner_name is null
   and assigned_broker is not null;

create index if not exists deals_bc_owner_idx         on public.deals (bc_owner_officer);
create index if not exists deals_lo_owner_idx         on public.deals (lo_owner_officer);
create index if not exists deals_compliance_owner_idx on public.deals (compliance_owner_officer);
