'use client'

import { useEffect, useRef } from 'react'
import { getOfflineImage, saveOfflineImage } from '@/lib/offline-images'

type Props = {
  value: string
  noteId: string
  onChange: (value: string) => void
  editorRef: React.RefObject<HTMLDivElement | null>
}

const markerPattern = /!\\[image\\]\\(notely-(?:image|local):[^)]+\\)/g

function renderContent(element: HTMLDivElement, value: string) {
  element.replaceChildren()
  const parts = value.split(markerPattern)
  const markers = value.match(markerPattern) ?? []
  parts.forEach((part, index) => {
    if (part) {
      const lines = part.split('\\n')
      lines.forEach((line, lineIndex) => {
        if (line) element.append(document.createTextNode(line))
        if (lineIndex < lines.length - 1) element.append(document.createElement('br'))
      })
    }
    const marker = markers[index]
    if (!marker) return
    const match = marker.match(/^!\\[image\\]\\(notely-(image|local):([^)]+)\\)$/)
    if (!match) return
    const image = document.createElement('img')
    image.alt = 'Pasted image'
    image.className = 'note-inline-image'
    if (match[1] === 'image') {
      image.dataset.storagePath = match[2]
      image.src = '/api/note-images?path=' + encodeURIComponent(match[2])
    } else {
      image.dataset.localImageId = match[2]
      image.dataset.imagePending = 'true'
      image.alt = 'Locally saved image'
      void getOfflineImage(match[2]).then(record => {
        if (record && image.isConnected) {
          image.src = URL.createObjectURL(record.blob)
          image.dataset.imagePending = 'false'
        }
      }).catch(() => undefined)
    }
    element.append(image)
  })
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ''
  if (!(node instanceof HTMLElement)) return ''
  if (node.tagName === 'IMG') {
    if (node.dataset.storagePath) return '![image](notely-image:' + node.dataset.storagePath + ')'
    if (node.dataset.localImageId) return '![image](notely-local:' + node.dataset.localImageId + ')'
    return ''
  }
  if (node.tagName === 'BR') return '\\n'
  const content = Array.from(node.childNodes).map(serializeNode).join('')
  return ['DIV', 'P'].includes(node.tagName) ? content + '\\n' : content
}

function serializeEditor(element: HTMLDivElement) {
  return Array.from(element.childNodes).map(serializeNode).join('').replace(/\\n{3,}/g, '\\n\\n').replace(/\\n$/, '')
}

export default function NoteBodyEditor({ value, noteId, onChange, editorRef }: Props) {
  const lastEmitted = useRef(value)
  const uploading = useRef(false)

  useEffect(() => {
    const element = editorRef.current
    if (!element || value === lastEmitted.current) return
    renderContent(element, value)
    lastEmitted.current = value
  }, [value, noteId, editorRef])

  function emitChange() {
    const element = editorRef.current
    if (!element) return
    const next = serializeEditor(element)
    lastEmitted.current = next
    onChange(next)
  }

  async function insertImages(files: File[]) {
    const element = editorRef.current
    if (!element || uploading.current) return
    const images = files.filter(file => file.type.startsWith('image/')).slice(0, 5)
    if (!images.length) return
    uploading.current = true
    try {
      for (const file of images) {
        if (file.size > 8 * 1024 * 1024) continue
        const id = await saveOfflineImage(noteId, file)
        const image = document.createElement('img')
        image.alt = 'Pasted image'
        image.className = 'note-inline-image'
        image.dataset.localImageId = id
        image.src = URL.createObjectURL(file)
        const selection = window.getSelection()
        if (selection?.rangeCount && element.contains(selection.anchorNode)) {
          const range = selection.getRangeAt(0)
          range.deleteContents()
          range.insertNode(image)
          range.setStartAfter(image)
          range.collapse(true)
          selection.removeAllRanges()
          selection.addRange(range)
        } else {
          element.append(image)
        }
      }
      emitChange()
    } finally {
      uploading.current = false
    }
  }

  return (
    <div
      ref={editorRef}
      className="note-body note-rich-body"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-label="Note body"
      aria-multiline="true"
      data-placeholder="Start writing… Paste or drop an image"
      onInput={emitChange}
      onPaste={event => {
        const files = Array.from(event.clipboardData.items)
          .filter(item => item.kind === 'file')
          .map(item => item.getAsFile())
          .filter((file): file is File => Boolean(file))
        if (files.some(file => file.type.startsWith('image/'))) {
          event.preventDefault()
          void insertImages(files)
        }
      }}
      onDragOver={event => {
        if (Array.from(event.dataTransfer.types).includes('Files')) event.preventDefault()
      }}
      onDrop={event => {
        const files = Array.from(event.dataTransfer.files)
        if (files.some(file => file.type.startsWith('image/'))) {
          event.preventDefault()
          void insertImages(files)
        }
      }}
    />
  )
}
