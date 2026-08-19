-- Row-level security rollback snapshot - public schema
-- Generated 2026-08-19 13:42 AEST
-- Restores every policy to its state before the Phase 1 rewrite.
-- To undo: run this whole file in the PRODUCTION SQL editor.

BEGIN;

-- Drop every policy currently on the public schema, whatever it is called now.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- Recreate the originals.
CREATE POLICY "Admins and staff can delete clients" ON public.clients AS PERMISSIVE FOR DELETE TO public USING ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "Authenticated can insert clients" ON public.clients AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Client editing via deals" ON public.clients AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM (deals d
     JOIN user_profiles p ON ((p.id = auth.uid())))
  WHERE ((d.client_id = clients.id) AND ((p.role = 'admin'::text) OR ((p.role = 'broker'::text) AND (lower(d.assigned_broker) = lower(p.broker_key))) OR ((p.role = 'staff'::text) AND (d.assigned_credit_officer = ( SELECT credit_officers.id
           FROM credit_officers
          WHERE (credit_officers.user_id = auth.uid()))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (deals d
     JOIN user_profiles p ON ((p.id = auth.uid())))
  WHERE ((d.client_id = clients.id) AND ((p.role = 'admin'::text) OR ((p.role = 'broker'::text) AND (lower(d.assigned_broker) = lower(p.broker_key))) OR ((p.role = 'staff'::text) AND (d.assigned_credit_officer = ( SELECT credit_officers.id
           FROM credit_officers
          WHERE (credit_officers.user_id = auth.uid())))))))));
CREATE POLICY "Client visibility via deals" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (deals d
     JOIN user_profiles p ON ((p.id = auth.uid())))
  WHERE ((d.client_id = clients.id) AND ((p.role = 'admin'::text) OR (lower(p.broker_key) = ANY (ARRAY['fabio'::text, 'mark'::text])) OR ((p.role = 'broker'::text) AND (lower(d.assigned_broker) = lower(p.broker_key))) OR ((p.role = 'staff'::text) AND (d.assigned_credit_officer = ( SELECT credit_officers.id
           FROM credit_officers
          WHERE (credit_officers.user_id = auth.uid())))))))));
CREATE POLICY "Users can view their own newly created clients" ON public.clients AS PERMISSIVE FOR SELECT TO authenticated USING ((created_by = auth.uid()));
CREATE POLICY "Allow all access to compliance_flags" ON public.compliance_flags AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete credit officer broker links" ON public.credit_officer_brokers AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "Admins can insert credit officer broker links" ON public.credit_officer_brokers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "Authenticated users can view credit officer broker links" ON public.credit_officer_brokers AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can delete credit officers" ON public.credit_officers AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "Admins can insert credit officers" ON public.credit_officers AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "Admins can update credit officers" ON public.credit_officers AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "Authenticated users can view credit officers" ON public.credit_officers AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all access to deal_documents" ON public.deal_documents AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Deal editing by role" ON public.deals AS PERMISSIVE FOR ALL TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND ((p.role = 'admin'::text) OR ((p.role = 'broker'::text) AND (lower(deals.assigned_broker) = lower(p.broker_key))) OR ((p.role = 'staff'::text) AND (deals.assigned_credit_officer = ( SELECT credit_officers.id
           FROM credit_officers
          WHERE (credit_officers.user_id = auth.uid()))))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND ((p.role = 'admin'::text) OR ((p.role = 'broker'::text) AND (lower(deals.assigned_broker) = lower(p.broker_key))) OR ((p.role = 'staff'::text) AND (deals.assigned_credit_officer = ( SELECT credit_officers.id
           FROM credit_officers
          WHERE (credit_officers.user_id = auth.uid())))))))));
CREATE POLICY "Deal visibility by role" ON public.deals AS PERMISSIVE FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND ((p.role = 'admin'::text) OR (lower(p.broker_key) = ANY (ARRAY['fabio'::text, 'mark'::text])) OR ((p.role = 'broker'::text) AND (lower(deals.assigned_broker) = lower(p.broker_key))) OR ((p.role = 'staff'::text) AND (deals.assigned_credit_officer = ( SELECT credit_officers.id
           FROM credit_officers
          WHERE (credit_officers.user_id = auth.uid())))))))));
CREATE POLICY "Allow authenticated manage lender_products" ON public.lender_products AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read lender_products" ON public.lender_products AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow all access to lender_rate_observations" ON public.lender_rate_observations AS PERMISSIVE FOR ALL TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated manage lenders" ON public.lenders AS PERMISSIVE FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated read lenders" ON public.lenders AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert settings" ON public.settings AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "Admins can update settings" ON public.settings AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "Authenticated users can view settings" ON public.settings AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can delete profiles" ON public.user_profiles AS PERMISSIVE FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "Admins can insert profiles" ON public.user_profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "Admins can update profiles" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM user_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "Allow authenticated read all profiles" ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated read own profile" ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((auth.uid() = id));

COMMIT;
