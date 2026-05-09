import { createFileRoute } from '@tanstack/react-router'
import { KeyRound, Server, ShieldCheck } from 'lucide-react'

import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { getApiBaseUrl } from '../lib/api'
import { getStoredUser } from '../lib/auth'

export const Route = createFileRoute('/dashboard/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const user = getStoredUser()

  return (
    <div className="space-y-4">
      <div>
        <Badge>Settings</Badge>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">Deployment and access</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Current runtime details and the deployment decision for API/client packaging.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <InfoCard icon={ShieldCheck} title="Operator" value={user?.username ?? 'Unknown'} detail={user?.email ?? 'No email stored'} />
        <InfoCard icon={Server} title="API base" value={getApiBaseUrl()} detail="Used by the browser client" />
        <InfoCard icon={KeyRound} title="Auth mode" value="JWT bearer" detail="Mobile devices still use API keys" />
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Backend and client deployment</CardTitle>
          <CardDescription>
            Keep FastAPI and the JavaScript app as separate processes, then put one reverse proxy in front.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
          <p>
            Because this client uses TanStack React Start/Vinxi, it is not just static files in the
            same way a plain Vite app can be. Bundling it directly inside FastAPI would make SSR and
            routing harder to operate.
          </p>
          <p>
            The cleaner production shape is: FastAPI serves `/api`, the client serves `/`, and
            Nginx/Caddy/Traefik routes both under one domain with HTTPS.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function InfoCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: typeof ShieldCheck
  title: string
  value: string
  detail: string
}) {
  return (
    <Card className="glass-panel">
      <CardContent className="py-5">
        <Icon className="size-5 text-muted-foreground" />
        <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
        <p className="mt-2 break-words text-lg font-semibold">{value}</p>
        <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}
