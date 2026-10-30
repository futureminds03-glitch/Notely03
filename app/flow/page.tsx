import NotelyFlow from '@/components/NotelyFlow'

export const metadata = {
  title: 'Notely Flow — Make room to think',
  description: 'A calmer workspace for capturing thoughts, reducing clutter, and finding what matters.',
}

export default function FlowPage() {
  return <><div style={{position:'relative',zIndex:2,maxWidth:1040,margin:'0 auto',padding:'12px 24px 0',textAlign:'right'}}><a href="/flow/links" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'9px 13px',border:'1px solid var(--line, #e5e5df)',borderRadius:999,color:'var(--text, #333)',background:'var(--panel, #fff)',fontSize:12,fontWeight:650,textDecoration:'none'}}>↗ Save a webpage</a></div><NotelyFlow /></>
}
