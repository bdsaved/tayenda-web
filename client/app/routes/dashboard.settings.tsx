import { createFileRoute } from '@tanstack/react-router'
import { type ReactNode, useEffect, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Notice } from '../components/ui/notice'
import { PageHeader } from '../components/ui/page-header'
import { type UserResponse, fetchProcessingHealth, getApiBaseUrl } from '../lib/api'
import { getStoredUser } from '../lib/auth'
import { formatDate, formatDistance, formatRelative } from '../lib/format'
import { useApi } from '../lib/hooks'

export const Route = createFileRoute('/dashboard/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const health = useApi(fetchProcessingHealth, [])
  const [user, setUser] = useState<UserResponse | null>(null)
  useEffect(() => setUser(getStoredUser()), [])
  const h = health.data

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" description="Live configuration reported by the server. Read-only." />

      {health.error ? <Notice tone="error">{health.error}</Notice> : null}

      <Section
        title="Processing"
        action={h ? <Badge variant="outline">{h.status}</Badge> : null}
      >
        <Row label="Roughness thresholds" value={h ? `Fair ≥ ${h.roughness_fair.toFixed(2)} m/s² · Poor ≥ ${h.roughness_poor.toFixed(2)} m/s²` : '—'} />
        <Row label="Segment length" value={h ? formatDistance(h.segment_length_m) : '—'} />
        <Row label="Run interval" value={h ? formatInterval(h.interval_seconds) : '—'} />
        <Row label="Last run" value={!h ? '—' : h.last_run_at ? `${formatDate(h.last_run_at)} (${formatRelative(h.last_run_at)})` : 'Not yet'} />
        <Row label="Next run" value={h?.next_run_at ? formatDate(h.next_run_at) : '—'} />
        <Row label="Last run processed" value={h ? `${h.processed_trips_last_run} trips · ${h.cleaned_files_last_run} raw files cleaned` : '—'} />
        <Row label="Raw data retention" value={h ? `${h.raw_retention_days} days` : '—'} />
      </Section>

      <Section title="Connection">
        <Row label="API base URL" value={getApiBaseUrl()} mono />
      </Section>

      <Section title="Signed in">
        <Row label="Username" value={user?.username ?? '—'} />
        <Row label="Name" value={user?.full_name ?? '—'} />
        <Row label="Email" value={user?.email ?? '—'} />
        <Row label="Role" value={user?.role ?? '—'} />
      </Section>
    </div>
  )
}

function formatInterval(seconds: number) {
  if (seconds < 120) return `every ${seconds} s`
  if (seconds < 7200) return `every ${Math.round(seconds / 60)} min`
  return `every ${Math.round(seconds / 3600)} h`
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flat-panel">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {action}
      </div>
      <dl className="divide-y divide-border">{children}</dl>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`break-all text-sm text-foreground ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}
