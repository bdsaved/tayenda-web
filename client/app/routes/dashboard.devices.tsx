import { createFileRoute } from '@tanstack/react-router'
import { Smartphone } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { EmptyState } from '../components/ui/empty-state'
import { Notice } from '../components/ui/notice'
import { PageHeader } from '../components/ui/page-header'
import { StatTile } from '../components/ui/stat-tile'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { fetchTrips, type TripListItem } from '../lib/api'
import { deriveDevices, formatDate } from '../lib/dashboard'

export const Route = createFileRoute('/dashboard/devices')({
  component: DevicesPage,
})

function DevicesPage() {
  const [trips, setTrips] = useState<TripListItem[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchTrips()
      .then((response) => setTrips(response.items))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Failed to load devices'))
  }, [])

  const devices = useMemo(() => deriveDevices(trips), [trips])
  const attention = devices.filter((device) => device.status === 'attention').length
  const samples = devices.reduce((total, device) => total + device.samples, 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="Devices"
        description="Device-level view of recent activity, samples, trip count, and sync attention state."
      />

      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Devices" value={devices.length.toLocaleString()} hint="Unique collectors" />
        <StatTile
          label="Needs attention"
          value={attention.toLocaleString()}
          tone={attention > 0 ? 'destructive' : 'default'}
        />
        <StatTile label="Samples collected" value={samples.toLocaleString()} />
      </div>

      {devices.length === 0 ? (
        <EmptyState
          icon={Smartphone}
          title="No devices yet"
          description="Registered field devices will appear here after their first trip upload."
        />
      ) : (
        <div className="flat-panel overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Device</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Trips</TableHead>
                <TableHead className="text-right">Samples</TableHead>
                <TableHead>Last seen</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell>
                    <p className="text-sm font-medium text-foreground">{device.model}</p>
                    <p className="font-mono text-xs text-muted-foreground">{device.id}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{device.source}</TableCell>
                  <TableCell className="text-right tabular-nums">{device.trips}</TableCell>
                  <TableCell className="text-right tabular-nums">{device.samples.toLocaleString()}</TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(device.lastSeen)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        device.status === 'attention'
                          ? 'destructive'
                          : device.status === 'idle'
                            ? 'warning'
                            : 'success'
                      }
                    >
                      {device.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
