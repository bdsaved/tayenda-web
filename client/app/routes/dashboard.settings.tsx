import { createFileRoute } from '@tanstack/react-router'

import { PageHeader } from '../components/ui/page-header'
import { getApiBaseUrl } from '../lib/api'
import { getStoredUser } from '../lib/auth'

export const Route = createFileRoute('/dashboard/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const user = getStoredUser()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Current runtime details and deployment notes for this console."
      />

      <div className="flat-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Access</h2>
        </div>
        <dl className="divide-y divide-border">
          <SettingRow label="Operator" value={user?.username ?? 'Unknown'} />
          <SettingRow label="Email" value={user?.email ?? 'No email stored'} />
          <SettingRow label="Role" value={user?.role ?? 'operator'} />
          <SettingRow label="Auth mode" value="JWT bearer (mobile devices use API keys)" />
          <SettingRow label="API base" value={getApiBaseUrl()} mono />
        </dl>
      </div>

      <div className="flat-panel">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">Deployment</h2>
        </div>
        <div className="space-y-3 px-4 py-4 text-sm leading-6 text-muted-foreground">
          <p>
            Because this client uses TanStack React Start/Vinxi, it is not just static files in the same
            way a plain Vite app can be. Bundling it directly inside FastAPI would make SSR and routing
            harder to operate.
          </p>
          <p>
            The cleaner production shape is: FastAPI serves <span className="font-mono text-xs">/api</span>,
            the client serves <span className="font-mono text-xs">/</span>, and Nginx/Caddy/Traefik routes
            both under one domain with HTTPS.
          </p>
        </div>
      </div>
    </div>
  )
}

function SettingRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={`text-sm text-foreground ${mono ? 'font-mono text-xs' : ''}`}>{value}</dd>
    </div>
  )
}
