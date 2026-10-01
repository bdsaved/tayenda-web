import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, FileUp, Inbox, LoaderCircle, Search, X } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'

import { ConditionBar } from '../components/condition-bar'
import { DownloadButton } from '../components/download-button'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { EmptyState } from '../components/ui/empty-state'
import { Input } from '../components/ui/input'
import { Notice } from '../components/ui/notice'
import { PageHeader } from '../components/ui/page-header'
import { Select } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Textarea } from '../components/ui/textarea'
import { errorMessage, exportTripsCsv, fetchTrips, type TripFilters, uploadWebTrip } from '../lib/api'
import {
  TRIP_STATUSES,
  dateInputToMs,
  formatDate,
  formatDistance,
  formatRoughness,
  statusLabel,
  statusVariant,
} from '../lib/format'
import { useApi, useDebouncedValue } from '../lib/hooks'

export const Route = createFileRoute('/dashboard/trips')({
  component: TripsPage,
})

const PAGE_SIZE = 50

function TripsPage() {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query.trim(), 300)
  const [status, setStatus] = useState('')
  const [sinceDay, setSinceDay] = useState('')
  const [untilDay, setUntilDay] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  const filters: TripFilters = {
    q: debouncedQuery || undefined,
    status: status || undefined,
    since: dateInputToMs(sinceDay, 'start'),
    until: dateInputToMs(untilDay, 'end'),
  }

  // The page number belongs to one filter combination; changing filters returns to page 1
  // without a wasted request for the old page.
  const filterKey = `${debouncedQuery}|${status}|${sinceDay}|${untilDay}`
  const [pageState, setPageState] = useState({ key: filterKey, page: 0 })
  const page = pageState.key === filterKey ? pageState.page : 0
  const setPage = (next: number) => setPageState({ key: filterKey, page: next })

  const trips = useApi(
    () => fetchTrips({ ...filters, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
    [filterKey, page],
  )

  const items = trips.data?.items ?? []
  const total = trips.data?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const firstRow = total === 0 ? 0 : page * PAGE_SIZE + 1
  const lastRow = Math.min(total, (page + 1) * PAGE_SIZE)
  const hasFilters = Boolean(query || status || sinceDay || untilDay)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Trips"
        description="Trips synced from the field app and manual web imports."
        actions={
          <>
            <DownloadButton
              label="Export CSV"
              download={() => exportTripsCsv(filters)}
              onError={(message) => setNotice(message ? { tone: 'error', text: message } : null)}
            />
            <Button size="sm" variant={showUpload ? 'secondary' : 'default'} onClick={() => setShowUpload((open) => !open)}>
              {showUpload ? <X className="size-4" /> : <FileUp className="size-4" />}
              {showUpload ? 'Close upload' : 'Upload trip'}
            </Button>
          </>
        }
      />

      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}

      {showUpload ? (
        <UploadForm
          onUploaded={(message) => {
            setNotice({ tone: 'success', text: message })
            setShowUpload(false)
            trips.reload()
          }}
        />
      ) : null}

      {trips.error ? <Notice tone="error">{trips.error}</Notice> : null}

      <div className="flat-panel overflow-hidden">
        <div className="flex flex-wrap items-end gap-3 border-b border-border px-4 py-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Search trip, device, operator"
              className="pl-9"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search trips"
            />
          </div>
          <Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-auto" aria-label="Status">
            <option value="">All statuses</option>
            {TRIP_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </Select>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            From
            <Input type="date" value={sinceDay} onChange={(event) => setSinceDay(event.target.value)} className="w-auto" />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            To
            <Input type="date" value={untilDay} onChange={(event) => setUntilDay(event.target.value)} className="w-auto" />
          </label>
          {hasFilters ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery('')
                setStatus('')
                setSinceDay('')
                setUntilDay('')
              }}
            >
              Clear
            </Button>
          ) : null}
          <p className="ml-auto text-sm text-muted-foreground tabular-nums">
            {trips.loading ? 'Loading...' : `${firstRow.toLocaleString()}–${lastRow.toLocaleString()} of ${total.toLocaleString()}`}
          </p>
        </div>

        {trips.loading && !trips.data ? (
          <p className="px-4 py-8 text-sm text-muted-foreground">Loading trips...</p>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={hasFilters ? 'No trips match these filters' : 'No trips yet'}
            description="Trips synced from the field app or uploaded here will appear in this list."
            className="m-4"
          />
        ) : (
          <Table className={trips.loading ? 'opacity-60' : undefined}>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Start</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead className="text-right">Distance</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead className="text-right">Avg roughness</TableHead>
                <TableHead className="text-right">Hazards</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((trip) => (
                <TableRow key={trip.trip_id}>
                  <TableCell className="whitespace-nowrap">
                    <Link
                      to="/dashboard/trips/$tripId"
                      params={{ tripId: trip.trip_id }}
                      className="font-medium text-primary hover:underline"
                    >
                      {formatDate(trip.start_time)}
                    </Link>
                    <p className="font-mono text-[11px] text-muted-foreground">{trip.trip_id}</p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-foreground">{trip.device_model ?? 'Unknown device'}</p>
                    <p className="max-w-[160px] truncate font-mono text-[11px] text-muted-foreground">{trip.device_id}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <p>{trip.operator_name ?? '—'}</p>
                    <p className="text-xs">{trip.upload_source}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatDistance(trip.total_distance)}</TableCell>
                  <TableCell>
                    <ConditionBar good={trip.good_m} fair={trip.fair_m} poor={trip.poor_m} unit="m" />
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatRoughness(trip.roughness_avg)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    <span title="Detected jolts">{trip.hazard_count}</span>
                    <span className="text-muted-foreground"> + </span>
                    <span title="Driver-tagged hazards">{trip.tag_count}</span>
                    <p className="text-[11px] text-muted-foreground">detected + tagged</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(trip.status)}>{statusLabel(trip.status)}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {total > PAGE_SIZE ? (
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2.5">
            <span className="mr-2 text-sm text-muted-foreground tabular-nums">
              Page {page + 1} of {pageCount}
            </span>
            <Button variant="outline" size="sm" disabled={page === 0 || trips.loading} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= pageCount || trips.loading}
              onClick={() => setPage(page + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Manual upload
// ---------------------------------------------------------------------------

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
  mountQuality: string
  notes: string
}

function defaultForm(): UploadFormState {
  return {
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
    mountQuality: '',
    notes: '',
  }
}

function UploadForm({ onUploaded }: { onUploaded: (message: string) => void }) {
  const [form, setForm] = useState<UploadFormState>(defaultForm)
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof UploadFormState>(key: K, value: UploadFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file) {
      setError('Select a trip sample file before uploading.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload = new FormData()
      if (form.tripId.trim()) payload.set('trip_id', form.tripId.trim())
      payload.set('device_id', form.deviceId)
      payload.set('device_model', form.deviceModel)
      payload.set('collector_name', form.collectorName)
      payload.set('mount_type', form.mountType)
      payload.set('vehicle_type', form.vehicleType)
      payload.set('road_surface', form.roadSurface)
      payload.set('sampling_profile', form.samplingProfile)
      payload.set('start_time', String(new Date(form.startTime).getTime()))
      if (form.endTime) payload.set('end_time', String(new Date(form.endTime).getTime()))
      if (form.mountQuality !== '') payload.set('mount_quality', form.mountQuality)
      if (form.notes.trim()) payload.set('notes', form.notes.trim())
      payload.set('sample_file', file)

      const response = await uploadWebTrip(payload)
      setForm(defaultForm())
      setFile(null)
      onUploaded(
        `Trip ${response.trip_id} uploaded with ${response.samples_received.toLocaleString()} samples. It will appear as processed once the server has scored it.`,
      )
    } catch (uploadError) {
      setError(errorMessage(uploadError, 'Upload failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flat-panel p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-foreground">Manual web upload</h2>
        <p className="text-sm text-muted-foreground">
          Import a JSON, NDJSON, JSONL, or GZip sample file. Distance, speed and roughness are computed by the server.
        </p>
      </div>
      {error ? <Notice tone="error" className="mb-4">{error}</Notice> : null}
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Trip ID (optional)">
            <Input value={form.tripId} onChange={(event) => update('tripId', event.target.value)} placeholder="web-trip-001" />
          </Field>
          <Field label="Collector name">
            <Input
              value={form.collectorName}
              onChange={(event) => update('collectorName', event.target.value)}
              placeholder="Field operator"
              required
            />
          </Field>
          <Field label="Device ID">
            <Input value={form.deviceId} onChange={(event) => update('deviceId', event.target.value)} required />
          </Field>
          <Field label="Device model">
            <Input value={form.deviceModel} onChange={(event) => update('deviceModel', event.target.value)} required />
          </Field>
          <Field label="Start time">
            <Input type="datetime-local" value={form.startTime} onChange={(event) => update('startTime', event.target.value)} required />
          </Field>
          <Field label="End time (optional)">
            <Input type="datetime-local" value={form.endTime} onChange={(event) => update('endTime', event.target.value)} />
          </Field>
          <Field label="Mount type">
            <OptionSelect value={form.mountType} options={['RIGID', 'DASH', 'HANDHELD']} onChange={(value) => update('mountType', value)} />
          </Field>
          <Field label="Vehicle type">
            <OptionSelect
              value={form.vehicleType}
              options={['SUV', 'SEDAN', 'TRUCK', 'BUS', 'MOTORBIKE']}
              onChange={(value) => update('vehicleType', value)}
            />
          </Field>
          <Field label="Road surface">
            <OptionSelect
              value={form.roadSurface}
              options={['PAVED', 'GRAVEL', 'DIRT', 'MIXED']}
              onChange={(value) => update('roadSurface', value)}
            />
          </Field>
          <Field label="Sampling profile">
            <OptionSelect
              value={form.samplingProfile}
              options={['HIGH', 'BALANCED', 'ECO']}
              onChange={(value) => update('samplingProfile', value)}
            />
          </Field>
          <Field label="Mount quality (optional)">
            <Input
              type="number"
              min="0"
              step="0.01"
              value={form.mountQuality}
              onChange={(event) => update('mountQuality', event.target.value)}
            />
          </Field>
          <Field label="Sample file">
            <input
              type="file"
              className="field-shell pt-1.5"
              accept=".json,.jsonl,.ndjson,.gz"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              required
            />
          </Field>
        </div>

        <Field label="Notes (optional)">
          <Textarea value={form.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Context for review" />
        </Field>

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? <LoaderCircle className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            {submitting ? 'Uploading...' : 'Upload trip'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function OptionSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <Select value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </Select>
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

function toDateTimeLocal(value: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`
}
