'use client'

import { useEffect, useState } from 'react'

const themes = [
  { id: 'warm', name: 'Notely Warm', description: 'Warm paper · earthy ink · signature terracotta', tagline: 'Your thoughts, in their natural warmth.' },
  { id: 'mono', name: 'Monochrome', description: 'Apple-inspired black & white · calm contrast', tagline: 'Quiet, crisp, and beautifully minimal.' },
  { id: 'midnight', name: 'Midnight Ink', description: 'Deep charcoal · moonlit text · electric lavender', tagline: 'A focused sanctuary after dark.' },
  { id: 'sage', name: 'Sage Garden', description: 'Soft botanical green · natural cream · forest accents', tagline: 'A little room to breathe and grow.' },
  { id: 'rose', name: 'Rose Quartz', description: 'Blush porcelain · muted plum · rose accents', tagline: 'Gentle colour for tender thoughts.' },
  { id: 'ocean', name: 'Ocean Glass', description: 'Cool mist · deep teal · clear blue accents', tagline: 'A fresh current for new ideas.' },
] as const

type Theme = typeof themes[number]['id']

const themeColors: Record<Theme, string> = {
  warm: '#f5f0e8', mono: '#ffffff', midnight: '#171820',
  sage: '#edf1e8', rose: '#f7edf0', ocean: '#eaf2f4',
}

export default function ThemeSettings() {
  const [theme, setTheme] = useState<Theme>('warm')

  useEffect(() => {
    const stored = localStorage.getItem('notely-theme') as Theme | null
    const current = themes.some(item => item.id === stored) ? stored! : 'warm'
    setTheme(current)
    document.documentElement.dataset.theme = current
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[current])
  }, [])

  function selectTheme(next: Theme) {
    setTheme(next)
    document.documentElement.dataset.theme = next
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColors[next])
    try { localStorage.setItem('notely-theme', next) } catch { /* Current session remains themed. */ }
  }

  return (
    <main className="themes-page">
      <a className="themes-back" href="/">← Back to notes</a>
      <header className="themes-heading">
        <span>YOUR SPACE, YOUR FEEL</span>
        <h1>Themes</h1>
        <p>Choose the atmosphere you want to write in. Your notes, layout and features stay exactly the same.</p>
      </header>
      <section className="themes-grid" aria-label="Available themes">
        {themes.map(item => (
          <button key={item.id} type="button" className={'theme-card ' + (theme === item.id ? 'selected' : '')} onClick={() => selectTheme(item.id)} aria-pressed={theme === item.id}>
            <div className={'theme-preview theme-preview-' + item.id}>
              <div className="theme-preview-sidebar"><i/><i/><i/></div>
              <div className="theme-preview-paper"><b>Notely.</b><span>Just write.</span><hr/><em>{item.tagline}</em></div>
            </div>
            <div className="theme-card-copy">
              <span><strong>{item.name}</strong><small>{item.description}</small></span>
              <span className="theme-choice">{theme === item.id ? '✓ Selected' : 'Select theme'}</span>
            </div>
          </button>
        ))}
      </section>
      <p className="themes-note">Your choice is saved on this device and works offline. You can switch themes any time.</p>
    </main>
  )
}
