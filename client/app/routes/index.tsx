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
        <section className="brand-gradient relative order-2 flex overflow-hidden p-6 text-white md:p-10 lg:order-1">
          <div className="pointer-events-none absolute inset-0 grid-dots opacity-30" />
          <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex w-full max-w-2xl flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-xl bg-white/15 text-lg font-bold backdrop-blur">
                  T
                </div>
                <span className="font-display text-lg font-semibold tracking-tight">Tayenda</span>
              </div>
              <p className="mt-10 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]">
                <span className="size-1.5 rounded-full bg-white live-dot" /> Resilience &amp; green mobility
              </p>
              <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl">
                Every journey becomes live road intelligence.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-white/85">
                Map potholes, rough roads, and flood-prone routes across Malawi&apos;s communities —
                then plan safer, greener, more reliable mobility from one operations surface.
              </p>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-3">
              <Capability icon={Smartphone} label="Devices" value="Sync health" />
              <Capability icon={UploadCloud} label="Uploads" value="Chunk status" />
              <Capability icon={Server} label="API" value={getApiBaseUrl().replace(/^https?:\/\//, '')} />
            </div>
          </div>
        </section>

        <section className="order-1 flex bg-background px-4 py-6 md:px-8 md:py-8 lg:order-2 lg:p-10">
          <div className="glass-panel m-auto w-full max-w-md p-6 md:p-8">
            <div className="mb-7 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <LockKeyhole className="size-5" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-semibold tracking-tight">Operator Login</h2>
                <p className="text-sm text-muted-foreground">Use the backend operator account.</p>
              </div>
            </div>

            {error ? (
              <div className="mb-4 rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-[hsl(2_70%_42%)]">
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
    <div className="rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur">
      <Icon className="size-5 text-white/80" />
      <p className="mt-4 text-sm font-semibold text-white">{label}</p>
      <p className="mt-1 truncate text-sm text-white/70">{value}</p>
    </div>
  )
}
