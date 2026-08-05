-- Allow users to insert their own profile (needed for signup trigger + direct insert)
CREATE POLICY "profiles_self_insert" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- Also allow the service role trigger to insert (already works via SECURITY DEFINER)
-- Ensure anon can't bypass - no anon insert policy

-- Fix: allow users to read their own profile even without being authenticated yet (needed right after sign-up)
-- The existing profiles_authenticated_select uses USING(true) which is fine for SELECT
