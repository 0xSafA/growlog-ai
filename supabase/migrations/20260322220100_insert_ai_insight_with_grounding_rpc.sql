-- ADR-004: атомарная вставка ai_insights + insight_grounding в одной транзакции (откат при ошибке grounding).

create or replace function public.insert_ai_insight_with_grounding(
  p_farm_id uuid,
  p_cycle_id uuid,
  p_scope_id uuid,
  p_insight_type text,
  p_title text,
  p_body text,
  p_user_query text,
  p_facts_json jsonb,
  p_interpretation_json jsonb,
  p_recommendation_json jsonb,
  p_hypotheses_json jsonb,
  p_confidence numeric,
  p_confidence_label text,
  p_missing_data_json jsonb,
  p_trust_flags_json jsonb,
  p_model_name text,
  p_created_by uuid,
  p_grounding jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  el jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_farm_id is null or p_farm_id not in (select public.user_farm_ids()) then
    raise exception 'Invalid farm access';
  end if;

  insert into public.ai_insights (
    farm_id, cycle_id, scope_id, insight_type, title, body, user_query,
    facts_json, interpretation_json, recommendation_json, hypotheses_json,
    confidence, confidence_label, missing_data_json, trust_flags_json,
    model_name, created_by
  ) values (
    p_farm_id, p_cycle_id, p_scope_id, p_insight_type, p_title, p_body, p_user_query,
    coalesce(p_facts_json, '[]'::jsonb),
    coalesce(p_interpretation_json, '{}'::jsonb),
    coalesce(p_recommendation_json, '{}'::jsonb),
    coalesce(p_hypotheses_json, '[]'::jsonb),
    p_confidence, p_confidence_label,
    coalesce(p_missing_data_json, '[]'::jsonb),
    coalesce(p_trust_flags_json, '[]'::jsonb),
    p_model_name, p_created_by
  )
  returning id into v_id;

  for el in select * from jsonb_array_elements(coalesce(p_grounding, '[]'::jsonb))
  loop
    if trim(both from coalesce(el->>'source_type', '')) = '' then
      continue;
    end if;
    insert into public.insight_grounding (farm_id, insight_id, source_type, source_id, excerpt, weight)
    values (
      p_farm_id,
      v_id,
      trim(both from coalesce(el->>'source_type', '')),
      case
        when el ? 'source_id' and nullif(trim(el->>'source_id'), '') is not null
        then (el->>'source_id')::uuid
        else null
      end,
      case when el ? 'excerpt' then nullif(trim(el->>'excerpt'), '') else null end,
      null
    );
  end loop;

  return v_id;
end;
$$;

grant execute on function public.insert_ai_insight_with_grounding(
  uuid, uuid, uuid, text, text, text, text,
  jsonb, jsonb, jsonb, jsonb, numeric, text, jsonb, jsonb, text, uuid, jsonb
) to authenticated;

comment on function public.insert_ai_insight_with_grounding is
  'ADR-004: single-transaction insert for ai_insights + insight_grounding; rolls back if grounding invalid.';
