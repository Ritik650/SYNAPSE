import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(ts: string | Date, fmt = 'MMM d, yyyy') {
  return format(new Date(ts), fmt)
}

export function formatRelative(ts: string | Date) {
  return formatDistanceToNow(new Date(ts), { addSuffix: true })
}

export function formatMetricValue(value: number, metricType: string): string {
  const decimals: Record<string, number> = {
    hrv_rmssd: 0,
    rhr: 0,
    hr: 0,
    steps: 0,
    sleep_duration_min: 0,
    sleep_efficiency: 1,
    spo2: 1,
    glucose: 1,
    weight: 1,
    body_fat_pct: 1,
    vo2max: 1,
    mood_self: 1,
    energy_self: 1,
    stress_self: 1,
  }
  const d = decimals[metricType] ?? 1
  return value.toFixed(d)
}

export function metricUnit(metricType: string): string {
  const units: Record<string, string> = {
    hr: 'bpm',
    hrv_rmssd: 'ms',
    rhr: 'bpm',
    resp_rate: '/min',
    spo2: '%',
    temp_skin: '°C',
    bp_sys: 'mmHg',
    bp_dia: 'mmHg',
    glucose: 'mg/dL',
    weight: 'kg',
    body_fat_pct: '%',
    sleep_duration_min: 'min',
    sleep_efficiency: '%',
    deep_sleep_min: 'min',
    rem_sleep_min: 'min',
    light_sleep_min: 'min',
    awake_min: 'min',
    sleep_score: '/100',
    steps: '',
    active_minutes: 'min',
    vo2max: 'mL/kg/min',
    calories_active: 'kcal',
    calories_resting: 'kcal',
    screen_time_min: 'min',
    mood_self: '/10',
    stress_self: '/10',
    energy_self: '/10',
    pain_self: '/10',
    aqi: '',
    weather_temp: '°C',
    pollen: '',
  }
  return units[metricType] ?? ''
}

export function metricLabel(metricType: string): string {
  const labels: Record<string, string> = {
    hr: 'Heart Rate',
    hrv_rmssd: 'HRV',
    rhr: 'Resting HR',
    resp_rate: 'Resp. Rate',
    spo2: 'SpO2',
    temp_skin: 'Skin Temp',
    bp_sys: 'Systolic BP',
    bp_dia: 'Diastolic BP',
    glucose: 'Glucose',
    weight: 'Weight',
    body_fat_pct: 'Body Fat',
    sleep_duration_min: 'Sleep',
    sleep_efficiency: 'Sleep Efficiency',
    deep_sleep_min: 'Deep Sleep',
    rem_sleep_min: 'REM Sleep',
    light_sleep_min: 'Light Sleep',
    awake_min: 'Awake',
    sleep_score: 'Sleep Score',
    steps: 'Steps',
    active_minutes: 'Active Min',
    vo2max: 'VO2 Max',
    calories_active: 'Active Cal',
    calories_resting: 'Resting Cal',
    screen_time_min: 'Screen Time',
    mood_self: 'Mood',
    stress_self: 'Stress',
    energy_self: 'Energy',
    pain_self: 'Pain',
    aqi: 'Air Quality',
    weather_temp: 'Temperature',
    pollen: 'Pollen',
  }
  return labels[metricType] ?? metricType
}

export function severityColor(severity: string): string {
  const colors: Record<string, string> = {
    info: 'text-accent-soft',
    watch: 'text-warn',
    act: 'text-orange-400',
    urgent: 'text-danger',
  }
  return colors[severity] ?? 'text-text-secondary'
}

export function severityBg(severity: string): string {
  const colors: Record<string, string> = {
    info: 'bg-accent/10 border-accent/20',
    watch: 'bg-warn/10 border-warn/20',
    act: 'bg-orange-400/10 border-orange-400/20',
    urgent: 'bg-danger/10 border-danger/20',
  }
  return colors[severity] ?? 'bg-bg-elevated border-border-subtle'
}

export function scoreColor(score: number): string {
  if (score >= 80) return '#22C55E'
  if (score >= 60) return '#F59E0B'
  if (score >= 40) return '#EF4444'
  return '#8A92A6'
}

export function sleepMinToHours(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}
