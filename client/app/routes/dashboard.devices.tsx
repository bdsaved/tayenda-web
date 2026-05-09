import { createFileRoute } from '@tanstack/react-router'
import { Smartphone, Signal, HardDrive, Clock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Badge>Devices</Badge>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Collector fleet</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Device-level view of recent activity, samples, trip count, and sync attention state.
          </p>
        </div>
        <Badge variant="secondary">{devices.length} devices</Badge>
      </div>

      {error ? <Card><CardContent className="py-4 text-sm">{error}</CardContent></Card> : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {devices.map((device) => (
          <Card key={device.id} className="glass-panel">
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-4 inline-flex border border-border bg-secondary p-3">
                    <Smartphone className="size-5" />
                  </div>
                  <CardTitle className="truncate">{device.model}</CardTitle>
                  <CardDescription className="truncate font-mono">{device.id}</CardDescription>
                </div>
                <Badge variant={device.status === 'attention' ? 'destructive' : device.status === 'idle' ? 'warning' : 'success'}>
                  {device.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3">
                <DeviceStat icon={Signal} label="Trips" value={String(device.trips)} />
                <DeviceStat icon={HardDrive} label="Samples" value={device.samples.toLocaleString()} />
                <DeviceStat icon={Clock} label="Last seen" value={formatDate(device.lastSeen)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {devices.length === 0 ? (
        <Card className="glass-panel">
          <CardContent className="py-8 text-sm text-muted-foreground">No registered field devices have uploaded trips yet.</CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function DeviceStat({ icon: Icon, label, value }: { icon: typeof Signal; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border border-border bg-secondary/40 p-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="size-4" />
        <span>{label}</span>
      </div>
      <span className="text-right text-sm font-semibold">{value}</span>
    </div>
  )
}
