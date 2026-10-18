-- A MONTHLY FEE ON A PRODUCT.
--
-- 18 Oct 2026. Fabio: "I need to find to add a box that says monthly fees box
-- on product library it is causing confusion."
--
-- The product carried application, annual, valuation, legal, rate lock, early
-- repayment and discharge. A lender charging $10 a month had nowhere to put it,
-- so it went into the annual box as $120 - or into Internal notes, where
-- nothing reads it. Both are wrong on a comparison a client reads.
--
-- TEXT, LIKE EVERY OTHER FEE ON THIS TABLE. These are not amounts the portal
-- does arithmetic on; they are what the lender says, printed as the lender says
-- it. "None", "Free up to $360" and "$150, or None - government" are all real
-- values already in these columns.
--
-- RUN ON STAGING AND LIVE. Safe to run twice; changes no existing row.
alter table public.lender_products
  add column if not exists monthly_fee text;
