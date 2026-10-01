import { Link, createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Button } from '../components/ui/button'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

/** Published by the deploy alongside the APK: /downloads/latest.json */
interface AppRelease {
  version: string
  versionCode: number
  file: string
  sizeBytes: number
  sha256: string
  releasedAt: string
}

function formatMegabytes(bytes: number) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function useRelease() {
  const [release, setRelease] = useState<AppRelease | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    fetch('/downloads/latest.json', { cache: 'no-store' })
      .then((response) => (response.ok ? (response.json() as Promise<AppRelease>) : null))
      .catch(() => null)
      .then((data) => {
        if (!cancelled) setRelease(data)
      })
    return () => {
      cancelled = true
    }
  }, [])
  return release
}

function QrCode({ url }: { url: string }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let cancelled = false
    void import('qrcode').then(({ default: QRCode }) =>
      QRCode.toString(url, { type: 'svg', margin: 1, width: 168, color: { dark: '#0b1f15', light: '#ffffff' } }).then(
        (markup) => {
          if (!cancelled) setSvg(markup)
        },
      ),
    )
    return () => {
      cancelled = true
    }
  }, [url])
  if (!svg) return <div className="size-[168px] rounded-md bg-secondary" aria-hidden />
  return (
    <div
      className="size-[168px] overflow-hidden rounded-md border border-border bg-white"
      role="img"
      aria-label="QR code that opens the app download"
      // The markup comes from our own QR encoder, not from user input.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

const STEPS = [
  {
    title: 'Mount your phone',
    body: 'Fix the phone firmly on the dashboard or handlebar, screen up, and choose how it is mounted and what you are driving.',
  },
  {
    title: 'Press Start and drive',
    body: 'The app records GPS and motion in the background, even with the screen off. See a pothole, flood or obstruction? Tap Mark hazard.',
  },
  {
    title: 'Stop and it uploads',
    body: 'Trips are saved on the phone and sent when there is a network. Nothing is lost if you have no signal for days.',
  },
  {
    title: 'Roads get a score',
    body: 'The server cuts each trip into 50 m stretches, scores how rough each one felt, and flags big jolts. Operators see it all on a map.',
  },
]

const INSTALL = [
  'Open this page on your Android phone and tap Download Tayenda.',
  'When the file finishes, open it. If Android asks, allow installs from your browser (Settings, Install unknown apps).',
  'Tap Install, then open Tayenda and allow Location. Allow Notifications and the battery prompt so recording keeps running.',
  'On Tecno, Infinix and Xiaomi phones, also set Tayenda to "No restrictions" or turn on Autostart in the phone’s battery settings.',
]

function LandingPage() {
  const release = useRelease()
  const origin = typeof window === 'undefined' ? 'https://tayenda.renai-labs.com' : window.location.origin
  const apkUrl = release ? `/downloads/${release.file}` : '/downloads/tayenda.apk'

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-base font-bold text-primary-foreground">
            T
          </div>
          <span className="text-base font-semibold">Tayenda</span>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/login">Operator sign in</Link>
        </Button>
      </header>

      <main>
        <section className="mx-auto grid max-w-5xl gap-8 px-4 pb-10 pt-6 md:grid-cols-[1.1fr_0.9fr] md:items-center md:pt-12">
          <div>
            <p className="text-sm font-medium text-primary">Road conditions for Malawi</p>
            <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-tight md:text-4xl">
              Turn every journey into a map of which roads are safe.
            </h1>
            <p className="mt-4 text-base text-muted-foreground">
              Tayenda records how rough the road feels as you drive, with your phone and nothing else. Mappers,
              drivers and riders build a live picture of potholes, rough sections and flood-prone routes, so
              communities and planners can see where to fix and which way to go.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <a href={apkUrl} download>
                  Download Tayenda for Android
                </a>
              </Button>
              <a href="#install" className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                How to install
              </a>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {release === undefined
                ? 'Checking the latest version…'
                : release
                  ? `Version ${release.version} · ${formatMegabytes(release.sizeBytes)} · Android 8 or newer · free`
                  : 'The Android app is being prepared. Check back shortly.'}
            </p>
          </div>

          <figure className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
            <img
              src="/media/dashboard-route.png"
              alt="Dashboard map showing a 182 km trip from Dedza to Blantyre, coloured by road condition"
              width={1400}
              height={900}
              loading="lazy"
              className="h-auto w-full"
            />
            <figcaption className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
              One real trip: Dedza to Blantyre, 182 km. Green is smooth, orange fair, red rough; dots are big jolts.
            </figcaption>
          </figure>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-5xl px-4 py-10">
            <h2 className="text-xl font-semibold">How it works</h2>
            <ol className="mt-5 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
              {STEPS.map((step, index) => (
                <li key={step.title} className="rounded-lg border border-border bg-background p-4">
                  <span className="flex size-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-foreground">
                    {index + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="install" className="mx-auto grid max-w-5xl gap-8 px-4 py-10 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h2 className="text-xl font-semibold">Install the app</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tayenda is installed straight from this page, so it works on any Android phone without an app store.
            </p>
            <ol className="mt-4 space-y-3">
              {INSTALL.map((text, index) => (
                <li key={text} className="flex gap-3 text-sm">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {index + 1}
                  </span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-muted-foreground">
              Already have Tayenda? Installing the new version keeps your saved trips and updates the app in place.
            </p>
          </div>

          <div className="flat-panel flex flex-col items-center gap-3 p-5 text-center">
            <QrCode url={`${origin}${apkUrl}`} />
            <p className="text-sm font-medium">Scan with the phone you want to install on</p>
            {release ? (
              <p className="break-all text-xs text-muted-foreground">
                SHA-256 {release.sha256.slice(0, 16)}…{release.sha256.slice(-8)}
              </p>
            ) : null}
          </div>
        </section>

        <section className="border-t border-border bg-card">
          <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold">Private by design</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Tayenda collects no names, phone numbers or accounts. Your phone is identified only by an anonymous
                code, and public maps show road conditions, never individual journeys.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">Built for low connectivity</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Recording needs no internet. Trips upload when a connection appears and retry on their own if it
                drops.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold">For operators and planners</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                A web dashboard shows road condition on a map, ranks hazards by how many trips confirm them, and
                exports data for reports.{' '}
                <Link to="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                  Operator sign in
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-4 py-6 text-xs text-muted-foreground">
        Tayenda Resilience, a Renai Labs project. Road scores are a first layer of evidence and do not replace an
        engineering assessment.
      </footer>
    </div>
  )
}
