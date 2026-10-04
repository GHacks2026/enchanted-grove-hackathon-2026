-- Sprout database schema. Source of truth: CONTRACT.md §7.
-- Run once in the Supabase SQL editor. Do not edit here without updating CONTRACT.md.

create table groves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null default 'My Grove',
  goal text not null,
  is_active boolean not null default false, -- exactly one active grove per user, switched by set_active_grove
  created_at timestamptz not null default now()
);
create index idx_groves_user_id on groves(user_id);

create table pillars (
  id uuid primary key default gen_random_uuid(),
  grove_id uuid not null references groves(id) on delete cascade,
  name text not null,
  description text not null default '',
  position int not null
);

create table journals (
  id uuid primary key default gen_random_uuid(),
  grove_id uuid not null references groves(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table extractions (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references journals(id) on delete cascade,
  raw_json jsonb not null,          -- model output exactly as returned (first attempt)
  dropped_json jsonb,               -- items that failed grounding after retry
  lantern text not null,
  status text not null default 'pending_review'
    check (status in ('pending_review','confirmed')),
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table items (
  id uuid primary key default gen_random_uuid(),
  extraction_id uuid not null references extractions(id) on delete cascade,
  kind text not null check (kind in ('bloom','friction')),
  original_interpretation text not null,
  original_pillar_id uuid references pillars(id),
  final_interpretation text not null,
  final_pillar_id uuid references pillars(id),
  evidence_quote text not null,     -- immutable after insert
  quote_start int not null,
  quote_end int not null,
  status text not null default 'proposed'
    check (status in ('proposed','accepted','edited','deleted')),
  -- a bloom must have a pillar unless it is deleted
  check (
    kind = 'friction'
    or status = 'deleted'
    or (original_pillar_id is not null and final_pillar_id is not null)
  )
);

create index on items (extraction_id);
create index on items (final_pillar_id);
create index on extractions (confirmed_at);

-- Confirm runs as one function so it either fully saves or not at all.
-- The only code path that flips an extraction to 'confirmed'.
create or replace function confirm_extraction(p_extraction_id uuid, p_items jsonb)
returns void
language plpgsql
as $$
declare
  v_expected int;
  v_matched  int;
begin
  -- 1. Flip the extraction. The row lock makes a double-click wait, then find
  --    status already 'confirmed', so it updates nothing.
  update extractions
     set status = 'confirmed', confirmed_at = now()
   where id = p_extraction_id and status = 'pending_review';

  if not found then
    if exists (select 1 from extractions where id = p_extraction_id) then
      raise exception 'already_confirmed' using errcode = 'SP409';
    else
      raise exception 'not_found' using errcode = 'SP404';
    end if;
  end if;

  -- 2. The client must send every item of this extraction, each exactly once.
  select count(*) into v_expected from items where extraction_id = p_extraction_id;

  select count(distinct i.id) into v_matched
    from jsonb_to_recordset(p_items) as e(id uuid)
    join items i on i.id = e.id and i.extraction_id = p_extraction_id;

  if v_matched <> v_expected or jsonb_array_length(p_items) <> v_expected then
    raise exception 'item_mismatch' using errcode = 'SP400';
  end if;

  -- 3. Apply decisions. The server decides accepted vs edited by comparing to
  --    the original. Deleted items keep their previous final_* values.
  update items i
     set status = case
           when e.action = 'delete' then 'deleted'
           when e.final_interpretation is distinct from i.original_interpretation
             or e.final_pillar_id is distinct from i.original_pillar_id then 'edited'
           else 'accepted'
         end,
         final_interpretation = case when e.action = 'delete'
           then i.final_interpretation else e.final_interpretation end,
         final_pillar_id = case when e.action = 'delete'
           then i.final_pillar_id else e.final_pillar_id end
    from jsonb_to_recordset(p_items)
         as e(id uuid, action text, final_interpretation text, final_pillar_id uuid)
   where i.id = e.id and i.extraction_id = p_extraction_id;
end;
$$;

-- Switch the user's active grove. Raises SP404 if the grove isn't theirs (the whole call rolls back).
create or replace function set_active_grove(p_user_id uuid, p_grove_id uuid)
returns void
language plpgsql
as $$
begin
  update groves set is_active = false where user_id = p_user_id;
  update groves set is_active = true where id = p_grove_id and user_id = p_user_id;
  if not found then
    raise exception 'grove_not_found' using errcode = 'SP404';
  end if;
end;
$$;
