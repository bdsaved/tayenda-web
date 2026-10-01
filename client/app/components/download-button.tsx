import { Download, LoaderCircle } from 'lucide-react'
import { useState } from 'react'

import { errorMessage } from '../lib/api'
import { Button, type ButtonProps } from './ui/button'

/** Button that runs an authenticated download and reports failures via onError. */
export function DownloadButton({
  download,
  label,
  onError,
  disabled,
  disabledReason,
  variant = 'outline',
  size = 'sm',
}: {
  download: () => Promise<void>
  label: string
  onError?: (message: string | null) => void
  disabled?: boolean
  disabledReason?: string
  variant?: ButtonProps['variant']
  size?: ButtonProps['size']
}) {
  const [busy, setBusy] = useState(false)

  async function run() {
    setBusy(true)
    onError?.(null)
    try {
      await download()
    } catch (error) {
      onError?.(errorMessage(error, 'Download failed'))
    } finally {
      setBusy(false)
    }
  }

  // Disabled buttons swallow pointer events, so the tooltip lives on a wrapper.
  return (
    <span title={disabled ? disabledReason : undefined} className="inline-flex">
      <Button variant={variant} size={size} onClick={run} disabled={disabled || busy}>
        {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />}
        {label}
      </Button>
    </span>
  )
}
