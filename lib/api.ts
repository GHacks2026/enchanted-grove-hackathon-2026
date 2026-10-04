import { NextResponse } from "next/server";
import type { ApiError, Grove, GroveWithPillars } from "@/lib/types";
import { supabaseServer } from "@/lib/supabase/server";

// The one error shape every route returns (CONTRACT §8).
export function apiError(code: string, message: string, status: number) {
  return NextResponse.json<ApiError>({ error: { code, message } }, { status });
}

// ==========================================
// Multi-Grove Database Queries
// ==========================================

// Get all groves belonging to a user
export async function getUserGroves(userId: string): Promise<Grove[]> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("groves")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

// Get the user's currently active grove along with its pillars
export async function getActiveGrove(userId: string): Promise<GroveWithPillars | null> {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("groves")
    .select("*, pillars(*)")
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

// Switch the active grove using the set_active_grove stored procedure
export async function switchActiveGrove(userId: string, groveId: string): Promise<void> {
  const supabase = supabaseServer();
  const { error } = await supabase.rpc("set_active_grove", {
    p_user_id: userId,
    p_grove_id: groveId,
  });

  if (error) throw error;
}

// Create a new grove for a user and set it active
export async function createGrove(userId: string, title: string, goal: string): Promise<Grove> {
  const supabase = supabaseServer();

  // Deactivate current active groves for this user
  await supabase
    .from("groves")
    .update({ is_active: false })
    .eq("user_id", userId);

  // Insert the new active grove
  const { data, error } = await supabase
    .from("groves")
    .insert({
      user_id: userId,
      title,
      goal,
      is_active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
