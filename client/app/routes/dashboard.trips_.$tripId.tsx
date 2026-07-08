import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Download } from 'lucide-react'
import { useEffect, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Notice } from '../components/ui/notice'
import { StatTile } from '../components/ui/stat-tile'
import { fetchTrip, getTripDownloadUrl, type TripDetailResponse } from '../lib/api'
import { statusVariant } from './dashboard.trips'

export const Route = createFileRoute('/dashboard/trips_/$tripId')({
  component: TripDetailPage,
})

function TripDetailPage() {
  const { tripId } = Route.useParams()
  const [detail, setDetail] = useState<TripDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchTrip(tripId)
      .then((response) => {
        if (!cancelled) {
          setDetail(response)
          setError(null)
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load trip')
        }
      })
    return () => {
      cancelled = true
    }
  }, [tripId])

  const trip = detail?.trip

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard/trips">
              <ArrowLeft className="size-4" />
              Trips
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-lg font-semibold text-foreground">{tripId}</h1>
              {trip ? <Badge variant={statusVariant(trip.status)}>{trip.status}</Badge> : null}
            </div>
            {trip ? (
              <p className="text-sm text-muted-foreground">
                {trip.device_model ?? 'Unknown device'} · {trip.upload_source}
              </p>
            ) : null}
          </div>
        </div>
        {trip?.status === 'UPLOADED' ? (
          <Button asChild variant="outline">
            <a href={getTripDownloadUrl(tripId)}>
              <Download className="size-4" />
              Download artifact
            </a>
          </Button>
        ) : null}
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {trip ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile label="Samples received" value={trip.total_samples_received.toLocaleString()} />
            <StatTile
              label="Chunks"
              value={`${trip.total_chunks_received}/${Math.max(trip.total_chunks_expected, 1)}`}
            />
            <StatTile
              label="Distance"
              value={trip.total_distance != null ? `${trip.total_distance.toFixed(2)} km` : '—'}
            />
            <StatTile
              label="Avg speed"
              value={trip.avg_speed != null ? `${trip.avg_speed.toFixed(1)} m/s` : '—'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="flat-panel p-5">
              <h2 className="mb-3 text-base font-semibold text-foreground">Capture</h2>
              <dl className="space-y-2.5">
                <DetailRow label="Device" value={trip.device_model ?? '—'} mono={false} />
                <DetailRow label="Device ID" value={trip.device_id} mono />
                <DetailRow label="Operator" value={trip.operator_name ?? 'Mobile sync'} mono={false} />
                <DetailRow label="Mount" value={trip.mount_type ?? '—'} mono={false} />
                <DetailRow label="Vehicle" value={trip.vehicle_type ?? '—'} mono={false} />
                <DetailRow label="Road surface" value={trip.road_surface ?? '—'} mono={false} />
                <DetailRow label="Sampling profile" value={trip.sampling_profile ?? '—'} mono={false} />
                <DetailRow
                  label="Mount quality"
                  value={trip.mount_quality != null ? trip.mount_quality.toFixed(2) : '—'}
                  mono={false}
                />
              </dl>
            </div>

            <div className="flat-panel p-5">
              <h2 className="mb-3 text-base font-semibold text-foreground">Timeline</h2>
              <dl className="space-y-2.5">
                <DetailRow label="Started" value={formatDate(trip.start_time)} mono={false} />
                <DetailRow
                  label="Ended"
                  value={trip.end_time != null ? formatDate(trip.end_time) : '—'}
                  mono={false}
                />
                <DetailRow label="Created" value={formatDate(trip.created_at)} mono={false} />
                <DetailRow
                  label="Finalized"
                  value={trip.finalized_at != null ? formatDate(trip.finalized_at) : '—'}
                  mono={false}
                />
                <DetailRow label="Server trip ID" value={trip.server_trip_id} mono />
              </dl>

              {detail?.notes ? (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Notes</p>
                  <p className="mt-1 text-sm text-foreground">{detail.notes}</p>
                </div>
              ) : null}

              {detail?.quality_flags && Object.keys(detail.quality_flags).length > 0 ? (
                <div className="mt-4 border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground">Quality flags</p>
                  <pre className="mt-1 overflow-x-auto rounded-md bg-muted/60 p-3 font-mono text-xs text-foreground">
                    {JSON.stringify(detail.quality_flags, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : !error ? (
        <p className="text-sm text-muted-foreground">Loading trip...</p>
      ) : null}
    </div>
  )
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`text-right text-sm text-foreground ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}

function formatDate(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
