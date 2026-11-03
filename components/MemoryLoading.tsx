export default function MemoryLoading({ title = 'Opening Notely', detail = 'Gathering your thoughts' }: { title?: string; detail?: string }) {
  return (
    <div className="memory-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="memory-loading-mark" aria-hidden="true"><span /><span /><span /></div>
      <div className="memory-loading-title">{title}</div>
      <p>{detail}</p>
      <div className="memory-loading-track" aria-hidden="true"><span /></div>
    </div>
  )
}
