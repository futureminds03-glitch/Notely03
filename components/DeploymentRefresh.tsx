'use client'

import { useEffect, useState } from 'react'

type DeploymentVersion = { version: string | null }

export default function DeploymentRefresh() {
  const [updateAvailable, setUpdateAvailable] = useState(false)

  useEffect(() => {
    let active = true
    let currentVersion: string | null = null
    let checking = false

    const checkForDeployment = async () => {
      if (!navigator.onLine || checking) return
      checking = true
      try {
        const response = await fetch('/api/deployment-version', {
          cache: 'no-store',
          headers: { 'cache-control': 'no-cache' },
        })
        if (!response.ok) return
        const data = await response.json() as DeploymentVersion
        if (!active || !data.version) return
        if (currentVersion === null) {
          currentVersion = data.version
        } else if (data.version !== currentVersion) {
          setUpdateAvailable(true)
        }
      } catch {
        // A failed check is harmless; retry on the next interval or reconnect.
      } finally {
        checking = false
      }
    }

    void checkForDeployment()
    const interval = window.setInterval(() => void checkForDeployment(), 60_000)
    window.addEventListener('online', checkForDeployment)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('online', checkForDeployment)
    }
  }, [])

  if (!updateAvailable) return null

  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      aria-label="Refresh Notely to load the latest update"
      title="A Notely update is ready — refresh to load it"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        marginLeft: 5,
        padding: 0,
        border: '1px solid var(--line)',
        borderRadius: 8,
        background: 'var(--paper-deep)',
        color: 'var(--ink)',
        cursor: 'pointer',
        verticalAlign: 'middle',
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 3v12m0 0 5-5m-5 5-5-5M5 17v3h14v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
