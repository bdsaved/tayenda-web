import { createFileRoute } from '@tanstack/react-router'
import { Smartphone } from 'lucide-react'

import { EmptyState } from '../components/ui/empty-state'
import { Notice } from '../components/ui/notice'
import { PageHeader } from '../components/ui/page-header'
import { StatTile } from '../components/ui/stat-tile'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { fetchDevices } from '../lib/api'
import { formatDate, formatDay, formatDistance, formatRelative } from '../lib/format'
import { useApi } from '../lib/hooks'

export const Route = createFileRoute('/dashboard/devices')({
  component: DevicesPage,
})

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function DevicesPage() {
  const devices = useApi(fetchDevices, [])
  const items = [...(devices.data?.items ?? [])].sort((a, b) => (b.last_seen_at ?? 0) - (a.last_seen_at ?? 0))
  const now = Date.now()
  const activeWeek = items.filter((device) => device.last_seen_at != null && now - device.last_seen_at < WEEK_MS).length
  const totalDistance = items.reduce((sum, device) => sum + (device.distance_m ?? 0), 0)

  return (
    <div className="space-y-4">
      <PageHeader title="Devices" description="Registered collector phones and when each last reached the server." />

      {devices.error ? <Notice tone="error">{devices.error}</Notice> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Devices" value={devices.data ? items.length.toLocaleString() : '—'} />
        <StatTile label="Seen in last 7 days" value={devices.data ? activeWeek.toLocaleString() : '—'} />
        <StatTile label="Distance recorded" value={devices.data ? formatDistance(totalDistance) : '—'} />
      </div>

      {devices.loading && !devices.data ? (
        <p className="text-sm text-muted-foreground">Loading devices...</p>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No devices yet"
          description="Phones appear here once they register with the server."
        />
      ) : (
        <div className="flat-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Device</TableHead>
                <TableHead>Versions</TableHead>
                <TableHead className="text-right">Trips</TableHead>
                <TableHead className="text-right">Distance</TableHead>
                <TableHead>Last trip</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((device) => {
                const stale = device.last_seen_at == null || now - device.last_seen_at > WEEK_MS
                return (
                  <TableRow key={device.hashed_device_id}>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{device.model ?? 'Unknown model'}</p>
                      <p className="max-w-[200px] truncate font-mono text-[11px] text-muted-foreground" title={device.hashed_device_id}>
                        {device.hashed_device_id}
                      </p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      <p>OS {device.os_version ?? '—'}</p>
                      <p className="text-xs">App {device.app_version ?? '—'}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{device.trip_count.toLocaleString()}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">{formatDistance(device.distance_m)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(device.last_trip_at)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className={stale ? 'text-muted-foreground' : 'text-foreground'}>{formatRelative(device.last_seen_at)}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDay(device.created_at)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
