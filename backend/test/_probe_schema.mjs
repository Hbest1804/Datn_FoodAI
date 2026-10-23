// Probe actual Supabase schema (read-only)
import { supabaseAdmin } from '../src/config/supabase.js';

const probes = {
  dishes: ['id', 'category', 'category_id', 'category_normalized', 'region_id', 'steps', 'is_published', 'created_by'],
  categories: ['id', 'name'],
  regions: ['id'],
  ingredients: ['id', 'name', 'needs_review', 'normalized_name', 'created_by', 'aliases', 'allergen_group_id'],
  recipe_steps: ['dish_id', 'step_order', 'content'],
  chat_messages: ['id', 'flagged', 'flag_reason', 'flagged_by', 'latency_ms', 'outcome', 'feedback', 'tokens', 'referenced_dish_ids'],
  app_settings: ['key', 'value', 'updated_by', 'updated_at'],
  system_config: ['key', 'value'],
  audit_logs: ['id', 'actor_id', 'action', 'target_type', 'target_id', 'detail', 'created_at'],
  interaction_logs: ['id', 'event_type', 'interaction_type', 'context'],
  view_history: ['user_id', 'view_count'],
  guest_chat_sessions: ['id'],
  user_profiles: ['user_id', 'preferred_region_id'],
  users: ['id', 'avatar_url', 'status'],
};

for (const [table, cols] of Object.entries(probes)) {
  const t = await supabaseAdmin.from(table).select('*').limit(1);
  if (t.error) { console.log(`TABLE ${table}: MISSING (${t.error.message})`); continue; }
  const res = [];
  for (const c of cols) {
    const r = await supabaseAdmin.from(table).select(c).limit(1);
    res.push(`${c}=${r.error ? 'NO' : 'ok'}`);
  }
  console.log(`TABLE ${table}: ${res.join(' ')} | sample keys: ${t.data?.[0] ? Object.keys(t.data[0]).join(',') : '(empty)'}`);
}
// sample of distinct values
const ev = await supabaseAdmin.from('interaction_logs').select('event_type').limit(500);
console.log('event_types:', [...new Set((ev.data || []).map(r => r.event_type))]);
const oc = await supabaseAdmin.from('chat_messages').select('outcome, feedback').limit(1000);
console.log('outcomes:', [...new Set((oc.data || []).map(r => r.outcome))], 'feedback:', [...new Set((oc.data || []).map(r => r.feedback))]);
const st = await supabaseAdmin.from('dishes').select('steps').limit(1);
console.log('steps sample:', JSON.stringify(st.data?.[0]?.steps)?.slice(0, 200));
process.exit(0);
