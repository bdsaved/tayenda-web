import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowRight, ShieldCheck, Sparkles, Waypoints } from 'lucide-react'
import { type FormEvent, type ReactNode, useState } from 'react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card'
import { Input } from '../components/ui/input'

export const Route = createFileRoute('/')({
  component: LoginComponent,
})

function LoginComponent() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault()
    console.log('Login attempt:', { username, password })
    await navigate({ to: '/dashboard' })
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-6 py-10 lg:px-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="section-enter relative space-y-8">
          <Badge className="w-fit">Road Intelligence Console</Badge>
          <div className="max-w-2xl space-y-5">
            <h1 className="font-display text-5xl leading-tight text-balance text-foreground md:text-6xl">
              Malawi corridor insight with a calmer, sharper operator view.
            </h1>
            <p className="max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
              Tayenda brings field capture, route quality scoring, and audit review
              into one clean control surface for transport and maintenance teams.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <HeroStat
              icon={<Waypoints className="size-5" />}
              label="Mapped corridors"
              value="1,284 km"
            />
            <HeroStat
              icon={<ShieldCheck className="size-5" />}
              label="Trips verified"
              value="98.4%"
            />
            <HeroStat
              icon={<Sparkles className="size-5" />}
              label="Signal confidence"
              value="High"
            />
          </div>

          <Card className="max-w-2xl border-white/70 bg-white/70">
            <CardContent className="grid gap-4 py-6 md:grid-cols-[1.1fr_0.9fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                  Today&apos;s operating focus
                </p>
                <p className="mt-3 font-display text-3xl text-foreground">
                  Blantyre to Lilongwe survey handoff
                </p>
              </div>
              <div className="rounded-[24px] bg-primary/8 p-4 text-sm leading-6 text-muted-foreground">
                Review newly uploaded field sessions, flag weak GPS traces, and
                push validated segments into corridor planning without leaving the dashboard.
              </div>
            </CardContent>
          </Card>
        </section>

        <Card className="section-enter border-white/70 bg-white/88">
          <CardHeader className="pb-2">
            <Badge variant="outline" className="w-fit">
              Secure Access
            </Badge>
            <CardTitle className="mt-3 text-3xl">Sign in to Tayenda</CardTitle>
            <CardDescription>
              Use your operator account to access the monitoring workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Username</label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="rflmwcom"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="........"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                Continue to dashboard
                <ArrowRight className="size-4" />
              </Button>
            </form>

            <div className="rounded-[24px] bg-secondary/70 p-4 text-sm leading-6 text-secondary-foreground">
              <p className="font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Deployment
              </p>
              <p className="mt-2">tayenda.renai-labs.com</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}

function HeroStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) {
  return (
    <Card className="border-white/70 bg-white/60">
      <CardContent className="flex items-center gap-4 py-5">
        <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {icon}
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}
