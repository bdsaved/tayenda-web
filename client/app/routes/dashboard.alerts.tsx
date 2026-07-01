import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { fetchTrips, type TripListItem } from '../lib/api'
import { deriveAlerts } from '../lib/dashboard'

export const Route = createFileRoute('/dashboard/alerts')({
  component: AlertsPage,
})

function AlertsPage() {
  const [trips, setTrips] = useState<TripListItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const alerts = useMemo(() => deriveAlerts(trips), [trips])

  useEffect(() => {
    fetchTrips()
      .then((response) => setTrips(response.items))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Failed to load alerts'))
  }, [])

  return (
    <div className="space-y-4">
      <div>
        <Badge>Alerts</Badge>
        <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight">Troubleshooting queue</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          A practical checklist for sync failures, short captures, and missing trip metadata.
        </p>
      </div>

      {error ? <Card className="border-destructive/30 bg-destructive/5"><CardContent className="py-4 text-sm text-[hsl(2_70%_42%)]">{error}</CardContent></Card> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {alerts.length === 0 ? (
          <Card className="glass-panel xl:col-span-2">
            <CardContent className="flex gap-3 py-8">
              <CheckCircle2 className="size-5 text-primary" />
              <div>
                <p className="font-semibold">No active alerts</p>
                <p className="mt-1 text-sm text-muted-foreground">The current trip set has no obvious operational issues.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          alerts.map((alert) => (
            <Card key={alert.id} className="glass-panel">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex gap-3">
                    <AlertTriangle className={`mt-1 size-5 ${alert.severity === 'critical' ? 'text-destructive' : 'text-[hsl(38_92%_42%)]'}`} />
                    <div>
                      <CardTitle>{alert.title}</CardTitle>
                      <CardDescription>{alert.detail}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={alert.severity === 'critical' ? 'destructive' : alert.severity === 'warning' ? 'warning' : 'outline'}>
                    {alert.severity}
                  </Badge>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
