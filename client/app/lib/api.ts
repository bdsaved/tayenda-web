export type TripListItem = {
  trip_id: string
  server_trip_id: string
  device_id: string
  device_model: string | null
  operator_name: string | null
  status: string
  upload_source: string
  start_time: number
  end_time: number | null
  total_samples: number
  total_samples_received: number
  total_chunks_expected: number
  total_chunks_received: number
  road_surface: string | null
  vehicle_type: string | null
  mount_type: string | null
  sampling_profile: string | null
  mount_quality: number | null
  avg_speed: number | null
  total_distance: number | null
  created_at: number
  finalized_at: number | null
}

export type TripsResponse = {
  items: TripListItem[]
}

export type HealthResponse = {
  status: string
}

export type WebTripUploadResponse = {
  trip_id: string
  status: string
  chunks_received: number
  samples_received: number
  artifact_path: string | null
}

export type UserResponse = {
  username: string
  email: string
  full_name: string | null
  role: string
}

export type LoginResponse = {
  access_token: string
  token_type: 'bearer'
  user: UserResponse
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/$/, '')

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window === 'undefined' ? null : window.localStorage.getItem('tayenda.operator.token')
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(errorText || `Request failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}

export function getApiBaseUrl() {
  return API_BASE_URL
}

export function getTripDownloadUrl(tripId: string) {
  return `${API_BASE_URL}/api/v1/trips/${tripId}/download`
}

export async function fetchHealth() {
  return request<HealthResponse>('/api/v1/health')
}

export async function loginOperator(username: string, password: string) {
  return request<LoginResponse>('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

export async function fetchCurrentUser() {
  return request<UserResponse>('/api/v1/auth/me')
}

export async function fetchTrips(query?: string) {
  const search = query ? `?q=${encodeURIComponent(query)}` : ''
  return request<TripsResponse>(`/api/v1/trips${search}`)
}

export async function uploadWebTrip(formData: FormData) {
  return request<WebTripUploadResponse>('/api/v1/web/trips/upload', {
    method: 'POST',
    body: formData,
  })
}
