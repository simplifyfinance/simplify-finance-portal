-- LINKING THE DEALS ALREADY IN THE BOOK TO THEIR CLIENT RECORDS
--
-- 21 September 2026.
--
-- Every deal carries its applicants inside fact_find_data. Each applicant is
-- supposed to hold the id of their client record, and everything that writes a
-- client's financial position is gated on that one field. A deal started from a
-- NEW client was never given it - the screen built the applicant with nothing
-- in that slot - so on most of the book the capture was invisible.
--
-- The code is fixed for new deals. This is for the ones already here.
--
-- WHAT IT DOES: where a deal points at a client (deals.client_id) and its FIRST
-- applicant has no link, it writes that client's id onto that applicant.
--
-- WHAT IT CANNOT DO: it only handles the first applicant, because the first
-- applicant is the one the deal's own client_id refers to. A second applicant's
-- record cannot be guessed from here and is left alone.
--
-- IT ONLY EVER ADDS A KEY. jsonb_set writes one field into one object. No
-- applicant is removed, no other field is touched, no deal is deleted. Running
-- it twice changes nothing the second time, because the second time there is
-- nothing left that matches.
--
-- RUN STEP 1 FIRST AND READ IT. Then run step 2.

-- ----------------------------------------------------------------------
-- STEP 1 - LOOK. Changes nothing.
-- ----------------------------------------------------------------------
select
  count(*)                                                as real_deals,
  count(*) filter (where client_id is not null)           as points_at_a_client,
  count(*) filter (where coalesce(fact_find_data->'applicants'->0->>'clientId', '') <> '')
                                                          as first_applicant_already_linked,
  count(*) filter (where client_id is not null
                     and jsonb_array_length(coalesce(fact_find_data->'applicants', '[]'::jsonb)) > 0
                     and coalesce(fact_find_data->'applicants'->0->>'clientId', '') = '')
                                                          as this_will_link
from deals
where not is_test;

-- ----------------------------------------------------------------------
-- STEP 2 - LINK THEM. Adds one field to one applicant per deal.
-- ----------------------------------------------------------------------
update deals d
set fact_find_data = jsonb_set(
      d.fact_find_data,
      '{applicants,0,clientId}',
      to_jsonb(d.client_id::text),
      true)
where d.client_id is not null
  and not d.is_test
  and jsonb_array_length(coalesce(d.fact_find_data->'applicants', '[]'::jsonb)) > 0
  and coalesce(d.fact_find_data->'applicants'->0->>'clientId', '') = ''
returning d.deal_name,
          d.fact_find_data->'applicants'->0->>'clientId' as now_linked_to;

-- ----------------------------------------------------------------------
-- STEP 3 - LOOK AGAIN. The last column should now be zero.
-- ----------------------------------------------------------------------
select
  count(*) filter (where client_id is not null
                     and jsonb_array_length(coalesce(fact_find_data->'applicants', '[]'::jsonb)) > 0
                     and coalesce(fact_find_data->'applicants'->0->>'clientId', '') = '')
    as still_unlinked
from deals
where not is_test;
