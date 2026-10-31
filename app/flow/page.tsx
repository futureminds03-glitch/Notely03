import NotelyFlow from '@/components/NotelyFlow'

export const metadata = {
  title: 'Notely Flow — Make room to think',
  description: 'A calmer workspace for capturing thoughts, reducing clutter, and finding what matters.',
}

export default function FlowPage() {
  return <div className="flow-route"><div className="flow-top-action"><a href="/flow/links">↗ Save a webpage</a></div><NotelyFlow /></div>
}
