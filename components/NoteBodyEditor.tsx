'use client'

import { useEffect, useRef, useState } from 'react'
import { getOfflineImage, saveOfflineImage } from '@/lib/offline-images'

type Props = {
  value: string
  noteId: string
  onChange: (value: string) => void
  editorRef: React.RefObject<HTMLDivElement | null>
}


type InlinePage = { id: string; title: string; body: string }
const editorMarkerPattern = /<!--notely-page:[\s\S]*?-->|!\[image\]\(notely-(?:image|local):[^)]+\)/g
function encodePage(page: InlinePage) { return '<!--notely-page:' + encodeURIComponent(JSON.stringify(page)) + '-->' }
function decodePage(marker: string): InlinePage | null {
  try {
    const page = JSON.parse(decodeURIComponent(marker.slice('<!--notely-page:'.length, -'-->'.length)))
    if (typeof page.id !== 'string' || typeof page.title !== 'string' || typeof page.body !== 'string') return null
    return page as InlinePage
  } catch { return null }
}


function renderContent(element: HTMLDivElement, value: string) {
  element.replaceChildren()
  const parts = value.split(editorMarkerPattern)
  const markers = value.match(editorMarkerPattern) ?? []
  const appendPart = (target: HTMLDivElement, part: string) => {
    const lines = part.split('\n')
    let index = 0
    while (index < lines.length) {
      const line = lines[index]
      const separator = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/
      if (line.trim().startsWith('|') && index + 1 < lines.length && separator.test(lines[index + 1])) {
        const table = document.createElement('table')
        table.className = 'note-inline-table'
        const body = document.createElement('tbody')
        table.append(body)
        while (index < lines.length && lines[index].trim().startsWith('|')) {
          const rowLine = lines[index]
          if (!separator.test(rowLine)) {
            const row = document.createElement('tr')
            rowLine.trim().replace(/^\||\|$/g, '').split('|').forEach(value => {
              const cell = document.createElement('td')
              cell.contentEditable = 'true'
              cell.textContent = value.trim()
              row.append(cell)
            })
            body.append(row)
          }
          index += 1
        }
        target.append(table)
        if (index < lines.length) target.append(document.createElement('br'))
        continue
      }
      if (/^[☐☑]\s/.test(line)) {
        const task = document.createElement('label')
        task.className = 'note-task-line'
        task.dataset.notelyTask = 'true'
        const checkbox = document.createElement('input')
        checkbox.type = 'checkbox'
        checkbox.checked = line.startsWith('☑')
        checkbox.contentEditable = 'false'
        const text = document.createElement('span')
        text.textContent = line.slice(2)
        task.append(checkbox, text)
        target.append(task)
      } else if (line.startsWith('▸ ')) {
        const page = document.createElement('div')
        page.className = 'note-inline-page'
        page.dataset.notelyPage = 'true'
        page.dataset.pageId = crypto.randomUUID()
        page.dataset.pageTitle = line.slice(2).trim() || 'Untitled page'
        page.dataset.pageBody = ''
        page.contentEditable = 'false'
        const trigger = document.createElement('button')
        trigger.type = 'button'
        trigger.className = 'note-inline-page-trigger'
        trigger.textContent = page.dataset.pageTitle
        trigger.setAttribute('aria-label', 'Open page ' + page.dataset.pageTitle)
        page.append(trigger)
        target.append(page)
      } else if (line) {
        target.append(document.createTextNode(line))
      }
      if (index < lines.length - 1) target.append(document.createElement('br'))
      index += 1
    }
  }
  parts.forEach((part, index) => {
    if (part) appendPart(element, part)
    const marker = markers[index]
    if (!marker) return
    if (marker.startsWith('<!--notely-page:')) {
      const data = decodePage(marker)
      if (!data) return
      const page = document.createElement('div')
      page.className = 'note-inline-page'
      page.dataset.notelyPage = 'true'
      page.dataset.pageId = data.id
      page.dataset.pageTitle = data.title
      page.dataset.pageBody = data.body
      page.contentEditable = 'false'
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'note-inline-page-trigger'
      button.textContent = data.title || 'Untitled page'
      button.setAttribute('aria-label', 'Open page ' + (data.title || 'Untitled page'))
      page.append(button)
      element.append(page)
      return
    }
    const match = marker.match(/^!\[image\]\(notely-(image|local):([^)]+)\)$/)
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
  if (node.tagName === 'LABEL' && node.dataset.notelyTask) {
    const checkbox = node.querySelector('input[type="checkbox"]') as HTMLInputElement | null
    const text = node.querySelector('span')?.textContent ?? ''
    return (checkbox?.checked ? '☑ ' : '☐ ') + text
  }
  if (node.tagName === 'TABLE') {
    const rows = Array.from(node.querySelectorAll('tr')).map(row => '| ' + Array.from(row.children).map(cell => cell.textContent ?? '').join(' | ') + ' |')
    if (rows.length > 1) rows.splice(1, 0, '| ' + Array.from(node.querySelectorAll('tr')[0].children).map(() => '---').join(' | ') + ' |')
    return rows.join('\n')
  }
  if (node.dataset.notelyPage) return encodePage({ id: node.dataset.pageId ?? crypto.randomUUID(), title: node.dataset.pageTitle ?? 'Untitled page', body: node.dataset.pageBody ?? '' })
  if (node.tagName === 'IMG') {
    if (node.dataset.storagePath) return '![image](notely-image:' + node.dataset.storagePath + ')'
    if (node.dataset.localImageId) return '![image](notely-local:' + node.dataset.localImageId + ')'
    return ''
  }
  if (node.tagName === 'BR') return '\n'
  const content = Array.from(node.childNodes).map(serializeNode).join('')
  return ['DIV', 'P'].includes(node.tagName) ? (content.endsWith('\n') ? content : content + '\n') : content
}

function serializeEditor(element: HTMLDivElement) {
  return Array.from(element.childNodes).map(serializeNode).join('').replace(/\n{3,}/g, '\n\n').replace(/\n$/, '')
}

const slashCommands = [{id:'todo',label:'To-do list',description:'Add task checkboxes',icon:'☐',insert:'☐ Task\n'},{id:'database',label:'Inline database',description:'Start a name and status database',icon:'▦',insert:'| Name | Status |\n| --- | --- |\n| New item | Not started |\n'},{id:'table',label:'Table',description:'Insert a two-column table',icon:'▤',insert:'| Column 1 | Column 2 |\n| --- | --- |\n| | |\n'},{id:'page',label:'Inline page',description:'Create a page that opens in the side panel',icon:'▸',insert:'page'}]

export default function NoteBodyEditor({ value, noteId, onChange, editorRef }: Props) {
  const [openPage,setOpenPage]=useState<InlinePage|null>(null)
  const [pageTitle,setPageTitle]=useState('')
  const [pageBody,setPageBody]=useState('')
  const [slashOpen,setSlashOpen]=useState(false)
  const [slashQuery,setSlashQuery]=useState('')
  const [slashIndex,setSlashIndex]=useState(0)
  const slashRange=useRef<Range|null>(null)
  const lastEmitted = useRef(value)
  const lastRenderedNoteId = useRef<string | null>(null)
  const uploading = useRef(false)

  useEffect(() => {
    const element = editorRef.current
    if (!element || (value === lastEmitted.current && noteId === lastRenderedNoteId.current)) return
    renderContent(element, value)
    lastEmitted.current = value
    lastRenderedNoteId.current = noteId
  }, [value, noteId, editorRef])

  function emitChange() {
    const element = editorRef.current
    if (!element) return
    const next = serializeEditor(element)
    lastEmitted.current = next
    lastRenderedNoteId.current = noteId
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

  function inspectSlashCommand(){const selection=window.getSelection(),element=editorRef.current;if(!selection?.rangeCount||!element||!selection.isCollapsed||!element.contains(selection.anchorNode)){setSlashOpen(false);return}const node=selection.anchorNode;if(!node||node.nodeType!==Node.TEXT_NODE){setSlashOpen(false);return}const before=(node.textContent??'').slice(0,selection.anchorOffset),match=before.match(/(^|\s)\/([a-z-]*)$/i);if(!match){setSlashOpen(false);slashRange.current=null;return}const range=document.createRange();range.setStart(node,selection.anchorOffset-match[2].length-1);range.setEnd(node,selection.anchorOffset);slashRange.current=range;setSlashQuery(match[2].toLowerCase());setSlashIndex(0);setSlashOpen(true)}
  const matchingCommands=slashCommands.filter(command=>(command.label+' '+command.id).toLowerCase().includes(slashQuery))
  function insertSlashCommand(command: typeof slashCommands[number]) {
    const range = slashRange.current
    const element = editorRef.current
    if (!range || !element) return
    element.focus()
    range.deleteContents()
    let block: HTMLElement
    if (command.id === 'todo') {
      const task = document.createElement('label')
      task.className = 'note-task-line'
      task.dataset.notelyTask = 'true'
      const checkbox = document.createElement('input')
      checkbox.type = 'checkbox'
      checkbox.contentEditable = 'false'
      const text = document.createElement('span')
      text.textContent = 'Task'
      task.append(checkbox, text)
      block = task
    } else if (command.id === 'table' || command.id === 'database') {
      const table = document.createElement('table')
      table.className = 'note-inline-table'
      const body = document.createElement('tbody')
      const rows = command.id === 'database'
        ? [['Name', 'Status'], ['New item', 'Not started']]
        : [['Column 1', 'Column 2'], ['', '']]
      rows.forEach(values => {
        const row = document.createElement('tr')
        values.forEach(value => {
          const cell = document.createElement('td')
          cell.textContent = value
          row.append(cell)
        })
        body.append(row)
      })
      table.append(body)
      block = table
    } else {
      const page = document.createElement('div')
      page.className = 'note-inline-page'
      page.dataset.notelyPage = 'true'
      page.dataset.pageId = crypto.randomUUID()
      page.dataset.pageTitle = 'New page'
      page.dataset.pageBody = ''
      page.contentEditable = 'false'
      const trigger = document.createElement('button')
      trigger.type = 'button'
      trigger.className = 'note-inline-page-trigger'
      trigger.textContent = 'New page'
      trigger.setAttribute('aria-label', 'Open page New page')
      page.append(trigger)
      block = page
    }
    range.insertNode(block)
    const lineBreak = document.createElement('br')
    range.setStartAfter(block)
    range.insertNode(lineBreak)
    range.setStartAfter(lineBreak)
    range.collapse(true)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    slashRange.current = null
    setSlashOpen(false)
    setSlashQuery('')
    emitChange()
  }
  return (
    <div className="note-editor-shell">
    {slashOpen&&matchingCommands.length>0&&<div className="note-slash-menu" role="listbox" aria-label="Insert a block"><div className="note-slash-heading">INSERT A BLOCK</div>{matchingCommands.map((command,index)=><button type="button" key={command.id} role="option" aria-selected={index===slashIndex} className={index===slashIndex?'active':''} onMouseDown={event=>event.preventDefault()} onClick={()=>insertSlashCommand(command)}><span className="note-slash-icon">{command.icon}</span><span><strong>{command.label}</strong><small>{command.description}</small></span></button>)}</div>}
    <div
      ref={editorRef}
      className="note-body note-rich-body"
      contentEditable
      spellCheck={false}
      autoCorrect="off"
      autoCapitalize="off"
      suppressContentEditableWarning
      role="textbox"
      aria-label="Note body"
      aria-multiline="true"
      data-placeholder="Start writing… Paste or drop an image"
      onClick={event => {
        const trigger = (event.target as HTMLElement).closest('.note-inline-page-trigger')
        const page = trigger?.closest<HTMLElement>('[data-notely-page]')
        if (page) {
          setOpenPage({ id: page.dataset.pageId ?? '', title: page.dataset.pageTitle ?? 'Untitled page', body: page.dataset.pageBody ?? '' })
          setPageTitle(page.dataset.pageTitle ?? 'Untitled page')
          setPageBody(page.dataset.pageBody ?? '')
        }
      }}
      onInput={() => {emitChange();inspectSlashCommand()}}
      onChange={event => { if ((event.target as HTMLElement).tagName === 'INPUT') emitChange() }}
      onKeyUp={inspectSlashCommand}
      onKeyDown={event=>{if(!slashOpen)return;if(event.key==='Escape'){event.preventDefault();setSlashOpen(false);slashRange.current=null}if(event.key==='ArrowDown'&&matchingCommands.length){event.preventDefault();setSlashIndex(i=>(i+1)%matchingCommands.length)}if(event.key==='ArrowUp'&&matchingCommands.length){event.preventDefault();setSlashIndex(i=>(i-1+matchingCommands.length)%matchingCommands.length)}if(event.key==='Enter'&&matchingCommands[slashIndex]){event.preventDefault();insertSlashCommand(matchingCommands[slashIndex])}}}
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
    </div>
    {openPage && <div className="note-page-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setOpenPage(null) }}>
      <aside className="note-page-sidebar" role="dialog" aria-label="Inline page">
        <div className="note-page-sidebar-header"><span>PAGE</span><button type="button" aria-label="Close page" onClick={() => setOpenPage(null)}>×</button></div>
        <input className="note-page-title" aria-label="Page title" value={pageTitle} onChange={event => setPageTitle(event.target.value)} placeholder="Untitled page" />
        <textarea className="note-page-content" aria-label="Page content" value={pageBody} onChange={event => setPageBody(event.target.value)} placeholder="Start writing…" />
        <div className="note-page-sidebar-footer"><button type="button" onClick={() => setOpenPage(null)}>Cancel</button><button type="button" onClick={() => {
          const element = editorRef.current
          const page = element?.querySelector<HTMLElement>('[data-notely-page][data-page-id="' + openPage.id + '"]')
          if (page) {
            page.dataset.pageTitle = pageTitle.trim() || 'Untitled page'
            page.dataset.pageBody = pageBody
            const trigger = page.querySelector('.note-inline-page-trigger')
            if (trigger) { trigger.textContent = page.dataset.pageTitle; trigger.setAttribute('aria-label', 'Open page ' + page.dataset.pageTitle) }
            emitChange()
          }
          setOpenPage(null)
        }}>Save page</button></div>
      </aside>
    </div>}
    </div>
  )
}
