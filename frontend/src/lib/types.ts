export interface User {
  id: string
  email: string
  name: string
  timezone: string
  locale: string
  created_at: string
}

export interface HealthMetric {
  id: string
  user_id: string
  ts: string
  metric_type: string
  value: number
  unit?: string
  source: string
  confidence: number
}

export interface HealthEvent {
  id: string
  user_id: string
  ts: string
  event_type: string
  title: string
  description?: string
  metadata_json?: string
}

export interface DailyBrief {
  narrative: string
  date: string
  key_metrics: Record<string, number>
  recommendation: string
  generated_at: string
}

export interface Whisper {
  id: string
  severity: 'info' | 'watch' | 'act' | 'urgent'
  title: string
  narrative: string
  evidence: WhisperEvidence[]
  confidence: number
  lookalike_pattern?: string
  recommended_actions: string[]
  expires_at?: string
  generated_at: string
  is_active: boolean
  helpful?: boolean
  action_taken?: string
}

export interface WhisperEvidence {
  metric: string
  observed: number
  baseline: number
  z: number
}

export interface Pattern {
  id: string
  title: string
  description?: string
  antecedent_json?: string
  consequent_json?: string
  lag_hours?: number
  occurrences: number
  n_observations: number
  confidence: number
  last_seen_at?: string
  status: string
  suggested_intervention?: string
  discovered_at: string
}

export interface HealthScore {
  overall: number
  readiness: number
  sleep_score: number
  recovery_score: number
  stress_score: number
  activity_score: number
  nutrition_score: number
  mind_score: number
  date: string
  breakdown?: Record<string, number>
  narrative?: string
}

export interface TimelineTrack {
  metric_type: string
  data: Array<{ ts: string; value: number }>
}

export interface CascadeExplanation {
  narrative: string
  timeline_summary: Array<{ day_offset: number; key_event: string }>
  contributing_factors: Array<{
    factor: string
    weight: number
    evidence: string
    metric_refs: string[]
  }>
  confidence: number
  alternative_explanations: string[]
}

export interface BodyTwinState {
  systems: {
    cardio: BodySystem
    sleep: BodySystem
    metabolic: BodySystem
    mental: BodySystem
    musculoskeletal: BodySystem
    immune: BodySystem
  }
}

export interface BodySystem {
  score: number
  label: string
  one_liner: string
  metrics: Record<string, number>
}

export interface SimulationResult {
  narrative: string
  projected_changes: Array<{
    metric: string
    baseline: number
    projected: number
    delta_pct: number
    confidence: number
  }>
  secondary_effects: string[]
  what_could_go_wrong: string[]
  evidence_basis: string
}

export interface LabResult {
  id: string
  panel_name: string
  drawn_at: string
  claude_summary?: string
  flags_json?: string
  values: LabValue[]
}

export interface LabValue {
  id: string
  marker: string
  value: number
  unit?: string
  ref_low?: number
  ref_high?: number
  flag: 'low' | 'normal' | 'high' | 'critical'
}

export interface Meal {
  id: string
  ts: string
  photo_url?: string
  claude_analysis_json?: string
  calories_est?: number
  protein_g?: number
  carbs_g?: number
  fat_g?: number
  fiber_g?: number
  notes?: string
}

export interface Symptom {
  id: string
  name: string
  severity: number
  started_at: string
  resolved_at?: string
  body_region?: string
  notes?: string
}

export interface Medication {
  id: string
  name: string
  dose?: number
  unit?: string
  frequency?: string
  start_date?: string
  end_date?: string
  prescribed_by?: string
  notes?: string
}

export interface VoiceNote {
  id: string
  ts: string
  audio_url?: string
  transcript?: string
  claude_extraction_json?: string
  mood_score?: number
  symptoms_extracted?: string
  topics?: string
}
