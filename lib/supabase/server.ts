import { createClient } from "@supabase/supabase-js";

// Server-only client using the service-role key. Never import this from a
// client component: the client never talks to Supabase directly (CONTRACT §1).
export function supabaseServer() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
