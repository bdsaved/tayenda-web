import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, LockKeyhole, Server, Smartphone, UploadCloud } from 'lucide-react'
import { type FormEvent, useState } from 'react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { getApiBaseUrl, loginOperator } from '../lib/api'
import { storeSession } from '../lib/auth'

export const Route = createFileRoute('/')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('tayenda-admin')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const session = await loginOperator(username, password)
      storeSession(session.access_token, session.user)
      await navigate({ to: '/dashboard' })
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="order-2 flex border-t border-border bg-card p-6 md:p-10 lg:order-1 lg:border-t-0 lg:border-r">
          <div className="flex w-full max-w-2xl flex-col justify-between">
            <div>
              <Badge className="w-fit">Tayenda Operations</Badge>
              <h1 className="mt-8 text-4xl font-semibold tracking-tight text-foreground md:text-5xl lg:text-6xl">
                Road capture command center for device fleets and trip intelligence.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
                Monitor field collection quality, synchronize uploads, and surface readiness signals
                from one focused operations surface.
              </p>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-3">
              <Capability icon={Smartphone} label="Devices" value="Sync health" />
              <Capability icon={UploadCloud} label="Uploads" value="Chunk status" />
              <Capability icon={Server} label="API" value={getApiBaseUrl()} />
            </div>
          </div>
        </section>

        <section className="order-1 flex bg-background px-4 py-6 md:px-8 md:py-8 lg:order-2 lg:p-10">
          <div className="m-auto w-full max-w-md border border-border bg-card p-6 shadow-[0_18px_48px_rgba(15,23,42,0.09)] md:p-8">
            <div className="mb-7 flex items-center gap-3">
              <div className="border border-border bg-secondary p-3">
                <LockKeyhole className="size-5 text-foreground" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Operator Login</h2>
                <p className="text-sm text-muted-foreground">Use the backend operator account.</p>
              </div>
            </div>

            {error ? (
              <div className="mb-4 border border-zinc-500 bg-zinc-900 px-4 py-3 text-sm text-white">
                {error}
              </div>
            ) : null}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="space-y-2 text-sm font-medium">
                <span>Username</span>
                <Input value={username} onChange={(event) => setUsername(event.target.value)} required />
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Password</span>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Signing in...' : 'Open dashboard'}
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Default local account: admin / tayenda-admin. Change OPERATOR_PASSWORD before deployment.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}

function Capability({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Smartphone
  label: string
  value: string
}) {
  return (
    <div className="border border-border bg-background p-4">
      <Icon className="size-5 text-muted-foreground" />
      <p className="mt-4 text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1 truncate text-sm text-muted-foreground">{value}</p>
    </div>
  )
}
