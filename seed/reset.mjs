// Clears the database so onboarding can run again (CONTRACT §8). Usage: npm run reset
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Journals first: items reference pillars with no ON DELETE rule, so deleting groves
// alone fails once any item exists. Journals cascade to extractions and items.
const journals = await supabase.from("journals").delete({ count: "exact" }).not("id", "is", null);
if (journals.error) throw journals.error;

// Groves cascade to pillars.
const groves = await supabase.from("groves").delete({ count: "exact" }).not("id", "is", null);
if (groves.error) throw groves.error;

console.log(`Deleted ${groves.count} grove(s) and ${journals.count} journal(s).`);
