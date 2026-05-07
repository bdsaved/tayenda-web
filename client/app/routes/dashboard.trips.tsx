import { createFileRoute } from '@tanstack/react-router'
import { Download, FileUp, LoaderCircle, Search } from 'lucide-react'
import { type ChangeEvent, type FormEvent, type ReactNode, startTransition, useDeferredValue, useEffect, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
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

  const totals = trips.reduce(
    (accumulator, trip) => {
      accumulator.samples += trip.total_samples_received
      accumulator.pending += trip.status === 'UPLOADED' ? 0 : 1
      return accumulator
    },
    { samples: 0, pending: 0 },
  )

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
    <div className="section-enter space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <Badge className="w-fit">Trips</Badge>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            Live audit and upload
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Review the same trip records the Android uploader finalizes, and import trip files
            manually when the field team needs a web-based handoff.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <StatBox label="Trips listed" value={String(trips.length)} />
          <StatBox label="Pending" value={String(totals.pending)} />
          <StatBox label="Samples" value={totals.samples.toLocaleString()} />
        </div>
      </div>

      {(error || uploadMessage) ? (
        <Card className={error ? 'border-rose-300' : 'border-emerald-300'}>
          <CardContent className="py-4 text-sm">
            <span className={error ? 'text-rose-700' : 'text-emerald-700'}>{error ?? uploadMessage}</span>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-border pb-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Trip registry</CardTitle>
                <CardDescription>Search and download uploaded trip bundles.</CardDescription>
              </div>
              <div className="relative min-w-[260px]">
                <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search trip, device, or operator"
                  className="pl-10"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto px-0 pb-0">
            <table className="min-w-full text-left">
              <thead className="border-b border-border bg-secondary/40">
                <tr>
                  <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Trip
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Source
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Start
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Progress
                  </th>
                  <th className="px-5 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Status
                  </th>
                  <th className="px-5 py-3 text-right font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                    Artifact
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-sm text-muted-foreground">
                      Loading trips...
                    </td>
                  </tr>
                ) : trips.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-sm text-muted-foreground">
                      No trips matched the current query.
                    </td>
                  </tr>
                ) : (
                  trips.map((trip) => (
                    <tr key={trip.trip_id} className="border-b border-border last:border-b-0">
                      <td className="px-5 py-4">
                        <p className="font-mono text-xs font-medium text-primary">{trip.trip_id}</p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {trip.device_model ?? 'Unknown device'}
                        </p>
                        <p className="text-sm text-muted-foreground">{trip.device_id}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        <p>{trip.upload_source}</p>
                        <p>{trip.operator_name ?? 'Mobile sync'}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-muted-foreground">
                        {formatDate(trip.start_time)}
                      </td>
                      <td className="px-5 py-4">
                        <p className="text-sm font-medium text-foreground">
                          {trip.total_chunks_received}/{Math.max(trip.total_chunks_expected, 1)} chunks
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {trip.total_samples_received.toLocaleString()} samples
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant={statusVariant(trip.status)}>{trip.status}</Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileUp className="size-4 text-primary" />
              <CardTitle>Manual web upload</CardTitle>
            </div>
            <CardDescription>
              Import a JSON, NDJSON, JSONL, or GZip trip sample file with the metadata the app needs.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleUpload}>
              <div className="grid gap-4 md:grid-cols-2">
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
                  <SelectField
                    value={formState.mountType}
                    onChange={(event) => updateField('mountType', event.target.value)}
                    options={['RIGID', 'DASH', 'HANDHELD']}
                  />
                </Field>
                <Field label="Vehicle type">
                  <SelectField
                    value={formState.vehicleType}
                    onChange={(event) => updateField('vehicleType', event.target.value)}
                    options={['SUV', 'SEDAN', 'TRUCK', 'BUS', 'MOTORBIKE']}
                  />
                </Field>
                <Field label="Road surface">
                  <SelectField
                    value={formState.roadSurface}
                    onChange={(event) => updateField('roadSurface', event.target.value)}
                    options={['PAVED', 'GRAVEL', 'DIRT', 'MIXED']}
                  />
                </Field>
                <Field label="Sampling profile">
                  <SelectField
                    value={formState.samplingProfile}
                    onChange={(event) => updateField('samplingProfile', event.target.value)}
                    options={['HIGH', 'BALANCED', 'ECO']}
                  />
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
                    className="field-shell h-11 pt-2.5"
                    accept=".json,.jsonl,.ndjson,.gz"
                    onChange={handleFileChange(setFile)}
                    required
                  />
                </Field>
              </div>

              <Field label="Notes">
                <textarea
                  className="field-shell min-h-24 py-3"
                  value={formState.notes}
                  onChange={(event) => updateField('notes', event.target.value)}
                  placeholder="Context for review or recovery"
                />
              </Field>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                {submitting ? 'Uploading trip...' : 'Upload trip to shared pipeline'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-2 text-sm text-foreground">
      <span className="block font-medium">{label}</span>
      {children}
    </label>
  )
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void
  options: string[]
}) {
  return (
    <select className="field-shell" value={value} onChange={onChange}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-border bg-card px-4 py-3">
      <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
    </div>
  )
}

function handleFileChange(setFile: (file: File | null) => void) {
  return (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null)
  }
}

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'outline' {
  if (status === 'UPLOADED') return 'success'
  if (status === 'FAILED') return 'destructive'
  if (status === 'UPLOADING' || status === 'PENDING') return 'warning'
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
