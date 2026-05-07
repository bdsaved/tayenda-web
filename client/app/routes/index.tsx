import { createFileRoute, Link } from '@tanstack/react-router'
import { ArrowRight, Database, FileUp, Smartphone } from 'lucide-react'

import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { getApiBaseUrl } from '../lib/api'

export const Route = createFileRoute('/')({
  component: HomePage,
})

const workflow = [
  {
    title: 'Mobile capture',
    detail: 'Android devices register once, send manifests, upload chunks, and finalize trips safely.',
    icon: Smartphone,
  },
  {
    title: 'Web intake',
    detail: 'Operators can upload trip files directly with the required metadata when field sync needs intervention.',
    icon: FileUp,
  },
  {
    title: 'Shared records',
    detail: 'The dashboard reads the same trip states the mobile workflow writes, so review stays consistent.',
    icon: Database,
  },
] as const

function HomePage() {
  return (
    <main className="px-4 py-4 md:px-6 md:py-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-7xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="section-enter flex flex-col justify-between border border-border bg-card p-8 md:p-10">
          <div className="space-y-6">
            <Badge className="w-fit">Tayenda Sync Console</Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
                Clean web review for the same trip pipeline the mobile app uses.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                The web workspace now mirrors the manifest, chunk upload, finalize, and audit states
                used by the Android client. Operators can also import trip files manually when they
                need to complete a handoff from end to end.
              </p>
            </div>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/dashboard">
                Open workspace
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a href={`${getApiBaseUrl()}/openapi.json`} target="_blank" rel="noreferrer">
                API schema
              </a>
            </Button>
          </div>
        </section>

        <section className="section-enter grid gap-4">
          {workflow.map(({ title, detail, icon: Icon }) => (
            <Card key={title}>
              <CardHeader className="pb-0">
                <div className="flex items-center justify-between">
                  <CardTitle>{title}</CardTitle>
                  <div className="border border-border bg-secondary p-2">
                    <Icon className="size-4 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <p className="text-sm leading-6 text-muted-foreground">{detail}</p>
              </CardContent>
            </Card>
          ))}

          <Card className="grid-dots">
            <CardContent className="p-6">
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Upload contract
              </p>
              <div className="mt-4 space-y-2 text-sm text-foreground">
                <p><code>POST /api/v1/devices/register</code></p>
                <p><code>POST /api/v1/trips/manifest</code></p>
                <p><code>POST /api/v1/trips/&#123;tripId&#125;/chunks</code></p>
                <p><code>POST /api/v1/trips/&#123;tripId&#125;/finalize</code></p>
                <p><code>POST /api/v1/web/trips/upload</code></p>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
