'use client'
import dynamic from 'next/dynamic'
import MemoryLoading from '@/components/MemoryLoading'

const NotelyApp = dynamic(() => import('@/components/NotelyApp'), { ssr: false, loading: () => <MemoryLoading title="Opening Notely" detail="Getting your notes ready" /> })

export default function Home() {
  return <NotelyApp />
}
