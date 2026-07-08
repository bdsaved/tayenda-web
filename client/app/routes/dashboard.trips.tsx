import { Link, createFileRoute } from '@tanstack/react-router'
import { Download, FileUp, Inbox, LoaderCircle, Search, X } from 'lucide-react'
import { type ChangeEvent, type FormEvent, type ReactNode, startTransition, useDeferredValue, useEffect, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'
import { Input } from '../components/ui/input'
import { Notice } from '../components/ui/notice'
import { PageHeader } from '../components/ui/page-header'
import { Select } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Textarea } from '../components/ui/textarea'
import { fetchTrips, getTripDownloadUrl, type TripListItem, uploadWebTrip } from '../lib/api'

export const Route = createFileRoute('/dashboard/trips')({
  component: TripsPage,
})

type UploadFormState = {
  tripId: string
  deviceId: string
  deviceModel: string
  collectorName: string
  mountType: string
  vehicleType: string
  roadSurface: string
  samplingProfile: string
  startTime: string
  endTime: string
  totalDistance: string
  avgSpeed: string
  mountQuality: string
  notes: string
}

const DEFAULT_FORM: UploadFormState = {
  tripId: '',
  deviceId: 'web-device-01',
  deviceModel: 'Browser Upload',
  collectorName: '',
  mountType: 'RIGID',
  vehicleType: 'SUV',
  roadSurface: 'PAVED',
  samplingProfile: 'BALANCED',
  startTime: toDateTimeLocal(new Date()),
  endTime: '',
  totalDistance: '0',
  avgSpeed: '0',
  mountQuality: '0',
  notes: '',
}

function TripsPage() {
  const [trips, setTrips] = useState<TripListItem[]>([])
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [formState, setFormState] = useState<UploadFormState>(DEFAULT_FORM)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        const response = await fetchTrips(deferredQuery.trim())
        if (cancelled) return
        startTransition(() => {
          setTrips(response.items)
          setError(null)
          setLoading(false)
        })
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : 'Failed to load trips')
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [deferredQuery])

  async function refreshTrips() {
    const response = await fetchTrips(deferredQuery.trim())
    setTrips(response.items)
  }

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      setError('Select a trip sample file before uploading.')
      return
    }

    setSubmitting(true)
    setError(null)
    setUploadMessage(null)

    try {
      const payload = new FormData()
      payload.set('trip_id', formState.tripId)
      payload.set('device_id', formState.deviceId)
      payload.set('device_model', formState.deviceModel)
      payload.set('collector_name', formState.collectorName)
      payload.set('mount_type', formState.mountType)
      payload.set('vehicle_type', formState.vehicleType)
      payload.set('road_surface', formState.roadSurface)
      payload.set('sampling_profile', formState.samplingProfile)
      payload.set('start_time', String(new Date(formState.startTime).getTime()))
      if (formState.endTime) {
        payload.set('end_time', String(new Date(formState.endTime).getTime()))
      }
      payload.set('total_distance', formState.totalDistance)
      payload.set('avg_speed', formState.avgSpeed)
      payload.set('mount_quality', formState.mountQuality)
      payload.set('notes', formState.notes)
      payload.set('sample_file', file)

      const response = await uploadWebTrip(payload)
      setUploadMessage(
        `Trip ${response.trip_id} uploaded with ${response.samples_received.toLocaleString()} samples.`,
      )
      setFormState({
        ...DEFAULT_FORM,
        startTime: toDateTimeLocal(new Date()),
      })
      setFile(null)
      setShowUpload(false)
      await refreshTrips()
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  function updateField<K extends keyof UploadFormState>(key: K, value: UploadFormState[K]) {
    setFormState((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trips"
        description="Trip records finalized by the Android uploader and manual web imports."
        actions={
          <Button variant={showUpload ? 'secondary' : 'default'} onClick={() => setShowUpload((open) => !open)}>
            {showUpload ? <X className="size-4" /> : <FileUp className="size-4" />}
            {showUpload ? 'Close upload' : 'Upload trip'}
          </Button>
        }
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {uploadMessage ? <Notice tone="success">{uploadMessage}</Notice> : null}

      {showUpload ? (
        <div className="flat-panel p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-foreground">Manual web upload</h2>
            <p className="text-sm text-muted-foreground">
              Import a JSON, NDJSON, JSONL, or GZip trip sample file with the metadata the app needs.
            </p>
          </div>
          <form className="space-y-4" onSubmit={handleUpload}>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Trip ID (optional)">
                <Input
                  value={formState.tripId}
                  onChange={(event) => updateField('tripId', event.target.value)}
                  placeholder="web-trip-001"
                />
              </Field>
              <Field label="Collector name">
                <Input
                  value={formState.collectorName}
                  onChange={(event) => updateField('collectorName', event.target.value)}
                  placeholder="Field operator"
                  required
                />
              </Field>
              <Field label="Device ID">
                <Input
                  value={formState.deviceId}
                  onChange={(event) => updateField('deviceId', event.target.value)}
                  required
                />
              </Field>
              <Field label="Device model">
                <Input
                  value={formState.deviceModel}
                  onChange={(event) => updateField('deviceModel', event.target.value)}
                  required
                />
              </Field>
              <Field label="Start time">
                <Input
                  type="datetime-local"
                  value={formState.startTime}
                  onChange={(event) => updateField('startTime', event.target.value)}
                  required
                />
              </Field>
              <Field label="End time">
                <Input
                  type="datetime-local"
                  value={formState.endTime}
                  onChange={(event) => updateField('endTime', event.target.value)}
                />
              </Field>
              <Field label="Mount type">
                <Select
                  value={formState.mountType}
                  onChange={(event) => updateField('mountType', event.target.value)}
                >
                  {['RIGID', 'DASH', 'HANDHELD'].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Vehicle type">
                <Select
                  value={formState.vehicleType}
                  onChange={(event) => updateField('vehicleType', event.target.value)}
                >
                  {['SUV', 'SEDAN', 'TRUCK', 'BUS', 'MOTORBIKE'].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Road surface">
                <Select
                  value={formState.roadSurface}
                  onChange={(event) => updateField('roadSurface', event.target.value)}
                >
                  {['PAVED', 'GRAVEL', 'DIRT', 'MIXED'].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Sampling profile">
                <Select
                  value={formState.samplingProfile}
                  onChange={(event) => updateField('samplingProfile', event.target.value)}
                >
                  {['HIGH', 'BALANCED', 'ECO'].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Distance (km)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.totalDistance}
                  onChange={(event) => updateField('totalDistance', event.target.value)}
                />
              </Field>
              <Field label="Average speed (m/s)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.avgSpeed}
                  onChange={(event) => updateField('avgSpeed', event.target.value)}
                />
              </Field>
              <Field label="Mount quality">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formState.mountQuality}
                  onChange={(event) => updateField('mountQuality', event.target.value)}
                />
              </Field>
              <Field label="Sample file">
                <input
                  type="file"
                  className="field-shell pt-1.5"
                  accept=".json,.jsonl,.ndjson,.gz"
                  onChange={handleFileChange(setFile)}
                  required
                />
              </Field>
            </div>

            <Field label="Notes">
              <Textarea
                value={formState.notes}
                onChange={(event) => updateField('notes', event.target.value)}
                placeholder="Context for review or recovery"
              />
            </Field>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                {submitting ? 'Uploading trip...' : 'Upload trip'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      <div className="flat-panel overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search trip, device, or operator"
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading...' : `${trips.length} trip${trips.length === 1 ? '' : 's'}`}
          </p>
        </div>

        {loading ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">Loading trips...</p>
        ) : trips.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No trips matched the current query"
            description="Trips synced from the field app or uploaded here will appear in this registry."
            className="m-4"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Trip</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Artifact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {trips.map((trip) => (
                <TableRow key={trip.trip_id}>
                  <TableCell>
                    <Link
                      to="/dashboard/trips/$tripId"
                      params={{ tripId: trip.trip_id }}
                      className="font-mono text-xs font-medium text-primary hover:underline"
                    >
                      {trip.trip_id}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-foreground">{trip.device_model ?? 'Unknown device'}</p>
                    <p className="text-xs text-muted-foreground">{trip.device_id}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <p>{trip.upload_source}</p>
                    <p className="text-xs">{trip.operator_name ?? 'Mobile sync'}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(trip.start_time)}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-foreground">
                      {trip.total_chunks_received}/{Math.max(trip.total_chunks_expected, 1)} chunks
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {trip.total_samples_received.toLocaleString()} samples
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(trip.status)}>{trip.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {trip.status === 'UPLOADED' ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={getTripDownloadUrl(trip.trip_id)}>
                          <Download className="size-4" />
                          Download
                        </a>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">Not ready</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm text-foreground">
      <span className="block font-medium">{label}</span>
      {children}
    </label>
  )
}

function handleFileChange(setFile: (file: File | null) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null)
  }
}

export function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'outline' {
  if (status === 'UPLOADED') return 'success'
  if (status === 'FAILED') return 'destructive'
  if (status === 'UPLOADING' || status === 'PENDING' || status === 'STORED' || status === 'PROCESSING') {
    return 'warning'
  }
  return 'outline'
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function toDateTimeLocal(value: Date) {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  const hours = String(value.getHours()).padStart(2, '0')
  const minutes = String(value.getMinutes()).padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}
