-- Lending Options AI feedback loop (31 Aug 2026)
-- Run in the Supabase SQL editor. Safe to re-run.

-- Which stage a flag came from. Existing flags are all Compliance.
alter table public.compliance_flags
  add column if not exists stage text not null default 'compliance';

-- Promoted LO corrections. Kept separate from compliance_style_notes on purpose:
-- a correction about an LO recommendation must never change a Compliance answer.
alter table public.settings
  add column if not exists lo_style_notes jsonb;
