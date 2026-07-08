import { createFileRoute } from '@tanstack/react-router'
import { CheckCircle2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { EmptyState } from '../components/ui/empty-state'
import { Notice } from '../components/ui/notice'
import { PageHeader } from '../components/ui/page-header'
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
      <PageHeader
        title="Alerts"
        description="Sync failures, short captures, and missing trip metadata that need review."
      />

      {error ? <Notice tone="error">{error}</Notice> : null}

      {alerts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="No active alerts"
          description="The current trip set has no obvious operational issues."
        />
      ) : (
        <div className="flat-panel divide-y divide-border">
          {alerts.map((alert) => (
            <div key={alert.id} className="flex items-start justify-between gap-4 px-4 py-3.5">
              <div className="flex gap-2.5">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${severityDot(alert.severity)}`} />
                <div>
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="mt-0.5 text-sm leading-5 text-muted-foreground">{alert.detail}</p>
                </div>
              </div>
              <Badge
                variant={
                  alert.severity === 'critical'
                    ? 'destructive'
                    : alert.severity === 'warning'
                      ? 'warning'
                      : 'outline'
                }
              >
                {alert.severity}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function severityDot(severity: 'critical' | 'warning' | 'info') {
  if (severity === 'critical') return 'bg-destructive'
  if (severity === 'warning') return 'bg-warning'
  return 'bg-primary'
}
