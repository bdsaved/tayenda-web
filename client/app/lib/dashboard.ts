import type { TripListItem } from './api'

export type FleetDevice = {
  id: string
  model: string
  trips: number
  samples: number
  lastSeen: number
  status: 'online' | 'attention' | 'idle'
  source: string
}

export type DashboardAlert = {
  id: string
  title: string
  detail: string
  severity: 'critical' | 'warning' | 'info'
}

export function deriveDevices(trips: TripListItem[]): FleetDevice[] {
  const devices = new Map<string, FleetDevice>()
  for (const trip of trips) {
    const existing = devices.get(trip.device_id)
    if (!existing) {
      devices.set(trip.device_id, {
        id: trip.device_id,
        model: trip.device_model ?? 'Unknown device',
        trips: 1,
        samples: trip.total_samples_received,
        lastSeen: trip.created_at,
        status: trip.status === 'FAILED' ? 'attention' : trip.status === 'UPLOADED' ? 'online' : 'idle',
        source: trip.upload_source,
      })
      continue
    }
    existing.trips += 1
    existing.samples += trip.total_samples_received
    existing.lastSeen = Math.max(existing.lastSeen, trip.created_at)
    if (trip.status === 'FAILED') existing.status = 'attention'
    if (trip.status !== 'UPLOADED' && existing.status !== 'attention') existing.status = 'idle'
  }
  return [...devices.values()].sort((a, b) => b.lastSeen - a.lastSeen)
}

export function deriveAlerts(trips: TripListItem[]): DashboardAlert[] {
  const alerts: DashboardAlert[] = []
  const failed = trips.filter((trip) => trip.status === 'FAILED')
  const pending = trips.filter((trip) => trip.status === 'PENDING' || trip.status === 'UPLOADING')
  const lowSampleTrips = trips.filter((trip) => trip.status === 'UPLOADED' && trip.total_samples_received < 250)
  const missingMetadata = trips.filter((trip) => !trip.road_surface || !trip.vehicle_type || !trip.mount_type)

  if (failed.length > 0) {
    alerts.push({
      id: 'failed-uploads',
      title: `${failed.length} failed upload${failed.length === 1 ? '' : 's'}`,
      detail: 'Retry from the trip registry or inspect the device before the next field run.',
      severity: 'critical',
    })
  }
  if (pending.length > 0) {
    alerts.push({
      id: 'pending-sync',
      title: `${pending.length} trip${pending.length === 1 ? '' : 's'} still syncing`,
      detail: 'Keep the device online until all chunks are finalized.',
      severity: 'warning',
    })
  }
  if (lowSampleTrips.length > 0) {
    alerts.push({
      id: 'low-samples',
      title: `${lowSampleTrips.length} short capture${lowSampleTrips.length === 1 ? '' : 's'}`,
      detail: 'These trips may not contain enough accelerometer samples for meaningful review.',
      severity: 'warning',
    })
  }
  if (missingMetadata.length > 0) {
    alerts.push({
      id: 'metadata',
      title: `${missingMetadata.length} metadata gap${missingMetadata.length === 1 ? '' : 's'}`,
      detail: 'Road surface, vehicle, and mount metadata make the dashboard more useful.',
      severity: 'info',
    })
  }

  return alerts
}

export function captureScore(trips: TripListItem[]) {
  if (trips.length === 0) return 0
  const uploaded = trips.filter((trip) => trip.status === 'UPLOADED').length
  const metadataComplete = trips.filter(
    (trip) => trip.road_surface && trip.vehicle_type && trip.mount_type && trip.sampling_profile,
  ).length
  return Math.round(((uploaded / trips.length) * 0.65 + (metadataComplete / trips.length) * 0.35) * 100)
}

export function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatDistance(value: number | null) {
  if (!value) return '0.0 km'
  return `${value.toFixed(1)} km`
}
