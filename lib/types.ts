// Shared types. Source of truth: CONTRACT.md §2. Do not redefine these elsewhere.

export type ItemKind = "bloom" | "friction";
export type ItemStatus = "proposed" | "accepted" | "edited" | "deleted";
export type ExtractionStatus = "pending_review" | "confirmed";
export type ReviewAction = "keep" | "delete"; // what the client sends on confirm

export interface Pillar {
  id: string;
  grove_id: string;
  name: string;
  description: string;
  position: number;
}

export interface Grove {
  id: string;
  user_id?: string;
  title: string;
  goal: string;
  is_active: boolean;
  created_at: string;
}

export interface GroveWithPillars extends Grove {
  pillars: Pillar[];
}

export interface Journal {
  id: string;
  grove_id: string;
  body: string;
  created_at: string;
}

export interface Item {
  id: string;
  extraction_id: string;
  kind: ItemKind;
  original_interpretation: string;
  original_pillar_id: string | null; // null only when kind = "friction"
  final_interpretation: string;      // starts equal to original
  final_pillar_id: string | null;    // null only when kind = "friction" (or a deleted item)
  evidence_quote: string;            // immutable, verbatim from journal
  quote_start: number;               // offsets into normalize(journal.body), see CONTRACT §6
  quote_end: number;
  status: ItemStatus;                // "proposed" until confirm; set by the server, never the client
}

// One error shape for every route (CONTRACT §8).
export type ApiError = { error: { code: string; message: string } };

export interface Extraction {
  id: string;
  journal_id: string;
  lantern: string;
  status: ExtractionStatus;
  created_at: string;
  confirmed_at: string | null;
}