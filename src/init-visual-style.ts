// Ultra-early visual style default before paint to avoid flash.
const KEY = 'komaritheme:theme'
const KEY_DEFAULT = 'komaritheme:theme-default'
const ALLOWED = ['stardew', 'baseline'] as const

function parse(raw: string | null): string {
  if (!raw) return 'stardew'
  const v = raw.trim()
  return (ALLOWED as readonly string[]).includes(v) ? v : 'stardew'
}
try {
  const saved = parse(localStorage.getItem(KEY))
  const fallback = parse(localStorage.getItem(KEY_DEFAULT))
  document.documentElement.setAttribute('data-theme', saved)
} catch {
  document.documentElement.setAttribute('data-theme', 'stardew')
}
