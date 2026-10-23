-- Back to one owner for the whole deal. Nothing that existed before today is
-- touched by this; only the nine columns added with it go.
alter table public.deals drop column if exists bc_owner_officer;
alter table public.deals drop column if exists bc_owner_name;
alter table public.deals drop column if exists bc_owner_since;
alter table public.deals drop column if exists lo_owner_officer;
alter table public.deals drop column if exists lo_owner_name;
alter table public.deals drop column if exists lo_owner_since;
alter table public.deals drop column if exists compliance_owner_officer;
alter table public.deals drop column if exists compliance_owner_name;
alter table public.deals drop column if exists compliance_owner_since;
