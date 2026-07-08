import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { type FormEvent, useState } from 'react'

import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Notice } from '../components/ui/notice'
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
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-6 flex flex-col items-center gap-2">
        <div className="flex size-10 items-center justify-center rounded-md bg-primary text-base font-bold text-primary-foreground">
          T
        </div>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-foreground">Tayenda</h1>
          <p className="text-sm text-muted-foreground">Operator console</p>
        </div>
      </div>

      <div className="flat-panel w-full max-w-sm p-6">
        <h2 className="text-base font-semibold text-foreground">Sign in</h2>
        <p className="mt-1 text-sm text-muted-foreground">Use the backend operator account.</p>

        {error ? (
          <Notice tone="error" className="mt-4">
            {error}
          </Notice>
        ) : null}

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Username</span>
            <Input value={username} onChange={(event) => setUsername(event.target.value)} required />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Password</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </Button>
        </form>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        API: <span className="font-mono">{getApiBaseUrl().replace(/^https?:\/\//, '')}</span>
      </p>
    </main>
  )
}
