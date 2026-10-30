import NotelyFlow from '@/components/NotelyFlow'

export const metadata = {
  title: 'Notely Flow — Make room to think',
  description: 'A calmer workspace for capturing thoughts, reducing clutter, and finding what matters.',
}

export default function FlowPage() {
  return <><div className="flow-link-entry"><a href="/flow/links">↗ Save a webpage</a></div><NotelyFlow /><style jsx>{`.flow-link-entry{position:relative;z-index:2;max-width:1040px;margin:0 auto;padding:12px 24px 0;text-align:right}.flow-link-entry a{display:inline-flex;align-items:center;gap:8px;padding:9px 13px;border:1px solid var(--line,#e5e5df);border-radius:999px;color:var(--text,#333);background:var(--panel,#fff);font-size:12px;font-weight:650;text-decoration:none}.flow-link-entry a:hover{border-color:var(--accent,#71856f);color:var(--accent,#71856f)}`}</style></>
}
