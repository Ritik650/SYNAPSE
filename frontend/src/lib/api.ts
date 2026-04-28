import axios from 'axios'

// Dynamically construct backend URL based on current host
function getBackendURL(): string {
  const env = import.meta.env.VITE_API_URL
  if (env && env !== '/api/v1') {
    return env
  }
  
  // Get current host (e.g., localhost, 10.15.26.249, etc)
  const host = window.location.hostname
  const port = window.location.port ? ':8000' : ':8000'
  
  // Use the same host but with backend port
  return `http://${host}${port}/api/v1`
}

const BASE_URL = getBackendURL()

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('synapse_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('synapse_token')
      window.location.href = '/auth'
    }
    return Promise.reject(err)
  }
)

export const setToken = (token: string) => {
  localStorage.setItem('synapse_token', token)
  api.defaults.headers.Authorization = `Bearer ${token}`
}

export const clearToken = () => {
  localStorage.removeItem('synapse_token')
  delete api.defaults.headers.Authorization
}

// API calls
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string }>('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) =>
    api.post<{ access_token: string }>('/auth/register', { email, password, name }),
  me: () => api.get('/auth/me'),
}

export const healthApi = {
  check: () => api.get<{ status: string; message: string; claude: string }>('/health'),
}

export const ingestApi = {
  seedDemo: () => api.post('/ingest/seed-demo'),
  manualMetric: (data: object) => api.post('/ingest/manual/metric', data),
  manualEvent: (data: object) => api.post('/ingest/manual/event', data),
  manualSymptom: (data: object) => api.post('/ingest/manual/symptom', data),
  uploadAppleHealth: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/ingest/apple-health', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  uploadMealPhoto: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/ingest/meal-photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  uploadLabPdf: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/ingest/lab-pdf', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  uploadVoice: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return api.post('/ingest/voice', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

export const timelineApi = {
  get: (params: { from?: string; to?: string; metrics?: string; granularity?: string }) =>
    api.get('/timeline', { params }),
  baselines: () => api.get('/metrics/baselines'),
  events: (params: { from?: string; to?: string; types?: string }) =>
    api.get('/events', { params }),
}

export const intelligenceApi = {
  brief: () => api.get('/brief/today'),
  cascade: (event_id: string) => api.post('/cascade/explain', { event_id }),
  patterns: () => api.get('/patterns'),
  refreshPatterns: () => api.post('/patterns/refresh'),
  whispers: () => api.get('/whispers/active'),
  whisperFeedback: (id: string, helpful: boolean, action_taken?: string) =>
    api.post(`/whispers/${id}/feedback`, { helpful, action_taken }),
  simulate: (payload: { interventions: Record<string, number>; duration_days: number }) =>
    api.post('/simulate', payload),
  triage: (symptoms_text: string) => api.post('/triage', { symptoms_text }),
  score: () => api.get('/score/today'),
  scoreHistory: (days: number = 30) => api.get('/score/history', { params: { days } }),
  bodyTwin: () => api.get('/body-twin/state'),
}

export const careCircleApi = {
  list: () => api.get('/care-circle/members'),
  invite: (data: { email: string; name: string; role: string }) =>
    api.post('/care-circle/invite', data),
  updateSharing: (id: string, sharing: object) =>
    api.patch(`/care-circle/members/${id}/sharing`, sharing),
  remove: (id: string) => api.delete(`/care-circle/members/${id}`),
}

export const reportsApi = {
  doctorPrep: (data: { visit_reason: string; visit_date: string; physician_name?: string }) =>
    api.post('/reports/doctor-prep', data),
  doctorPrepPdf: async (data: object): Promise<Blob> => {
    const r = await api.post('/reports/doctor-prep/pdf', data, { responseType: 'blob' })
    return r.data as Blob
  },
}

export const recordsApi = {
  symptoms: {
    list: () => api.get('/records/symptoms'),
    create: (data: object) => api.post('/records/symptoms', data),
    resolve: (id: string) => api.patch(`/records/symptoms/${id}/resolve`),
  },
  meals: {
    list: () => api.get('/records/meals'),
  },
  labs: {
    list: () => api.get('/records/labs'),
    get: (id: string) => api.get(`/records/labs/${id}`),
  },
  medications: {
    list: () => api.get('/records/medications'),
    create: (data: object) => api.post('/records/medications', data),
    logDose: (medId: string) => api.post(`/records/medications/${medId}/doses`),
  },
  voiceNotes: {
    list: () => api.get('/records/voice-notes'),
  },
  goals: {
    list: () => api.get('/records/goals'),
    create: (data: object) => api.post('/records/goals', data),
  },
  habits: {
    list: () => api.get('/records/habits'),
    create: (data: object) => api.post('/records/habits', data),
    complete: (id: string) => api.post(`/records/habits/${id}/complete`),
  },
  doctorVisits: {
    list: () => api.get('/records/doctor-visits'),
  },
}
