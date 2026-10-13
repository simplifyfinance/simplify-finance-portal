-- WHAT CREDIT TELLS THE BROKER WHEN THEY HAND A DEAL OVER.
--
-- 13 Oct 2026. Run in the Supabase SQL editor, staging first then live. Safe to
-- run twice.
--
-- Fabio, 13 Oct 2026: "when a credit is building the BC and is sending to the
-- broker for the broker to accept and email the client, there's no box to
-- communicate with the broker why... just an internal communication."
--
-- It is its own table rather than a column on deals because a deal is handed
-- over more than once - the borrowing capacity, then the lending options, and
-- again if either goes back - and the one before must stay readable. Nothing
-- here is ever edited or deleted.
--
-- THE NOTE IS INTERNAL AND IT STAYS INTERNAL. It is not compliance, it is not
-- client-facing, and Paco never reads a word of it. Only the surprise becomes
-- team knowledge, and it goes to paco_knowledge as its own row with its own
-- name and date - see lib/handover-notes.ts.

create table if not exists public.deal_handovers (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,

  -- Which handover this was. 'bc' asks what was hard; 'lo' asks why these
  -- lenders. The questions differ because the moments differ.
  stage text not null check (stage in ('bc', 'lo')),

  -- For the broker. Internal, never sent anywhere, never read by Paco.
  note text not null default '',

  -- The taps. Counted by Paco, never quoted by him: a count is not a reason.
  hard text[] not null default '{}',
  easier text[] not null default '{}',

  -- lender name -> why it is on the deal. jsonb because the lenders differ
  -- deal by deal and there is nothing to index here.
  why jsonb not null default '{}'::jsonb,

  -- THE ONE THING THAT BECOMES KNOWLEDGE. A sentence a person wrote on purpose
  -- about a bank. The copy that answers questions lives in paco_knowledge; this
  -- one stays here so the handover reads whole.
  surprise text not null default '',
  surprise_lender text not null default '',
  surprise_tier text not null default 'D' check (surprise_tier in ('B', 'D')),

  -- WHO AND WHEN, ON EVERY ROW. The whole point of a community building this
  -- is that every line can be traced to a person and a day.
  said_by uuid not null references auth.users(id),
  said_by_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists deal_handovers_deal_idx on public.deal_handovers (deal_id, created_at desc);

alter table public.deal_handovers enable row level security;

-- Signed in, same as every other table in this portal. A handover note is
-- internal team communication, not client data, and everybody on the team needs
-- to read it.
drop policy if exists deal_handovers_read on public.deal_handovers;
create policy deal_handovers_read on public.deal_handovers
  for select to authenticated using (true);

drop policy if exists deal_handovers_write on public.deal_handovers;
create policy deal_handovers_write on public.deal_handovers
  for insert to authenticated with check (said_by = auth.uid());

-- NOTHING IS EVER EDITED OR DELETED. A note with a name on it that somebody
-- could go back and change afterwards is worth nothing. There is deliberately
-- no update policy and no delete policy, so both are refused by the database
-- rather than by a promise in the code.

select count(*) as handovers_so_far from public.deal_handovers;
