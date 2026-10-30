'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

type Note = { id:string; title:string; body:string; created_at:string; updated_at:string; started_at?:string; tags?:string[]; synced?:boolean }
const KEY='notely_notes'
const PRESETS=['Brain Dump','New Idea','To-do','Study','Work','Personal','Important']
const colors=['#9b7bc8','#6b9b78','#c28b53','#6689b5','#8b8175','#b4778b','#bd9d4d']
const styles:Record<string,React.CSSProperties> = {
  shell:{height:'100dvh',minHeight:0,overflowY:'auto',overscrollBehaviorY:'contain',WebkitOverflowScrolling:'touch',scrollbarWidth:'none',background:'var(--paper)',padding:'clamp(20px,4vw,52px)',paddingBottom:'max(clamp(20px,4vw,52px), env(safe-area-inset-bottom))',color:'var(--ink)'},
  wrap:{maxWidth:1000,margin:'0 auto'},
  eyebrow:{fontSize:10,letterSpacing:'.17em',fontWeight:700,color:'var(--accent)',textTransform:'uppercase'},
  heading:{fontFamily:'Georgia,serif',fontSize:'clamp(28px,4vw,42px)',letterSpacing:'-.045em',fontWeight:500,margin:'8px 0'},
  muted:{color:'var(--ink-faint)',fontSize:13,lineHeight:1.6},
  panel:{border:'1px solid var(--line)',borderRadius:12,background:'var(--paper)',padding:18},
  input:{width:'100%',border:'1px solid var(--line)',borderRadius:8,background:'var(--paper)',color:'var(--ink)',padding:'12px 13px',font:'14px Georgia,serif',outlineColor:'var(--accent)'},
  button:{border:'1px solid var(--line)',borderRadius:7,padding:'9px 13px',background:'transparent',color:'var(--ink-light)',font:'12px Georgia,serif',cursor:'pointer'},
  primary:{border:0,borderRadius:7,padding:'10px 15px',background:'var(--accent)',color:'white',font:'12px Georgia,serif',cursor:'pointer'},
}
function readGuest():Note[]{try{return JSON.parse(localStorage.getItem(KEY)||'[]')}catch{return[]}}
function terms(s:string){return new Set(s.toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(w=>w.length>3))}
function overlap(a:string,b:string){const aa=terms(a),bb=terms(b);if(!aa.size||!bb.size)return 0;let n=0;aa.forEach(x=>{if(bb.has(x))n++});return n/Math.sqrt(aa.size*bb.size)}
function badgeStyle(tag:string):React.CSSProperties{const i=Math.max(0,PRESETS.indexOf(tag));return {fontSize:10,padding:'4px 8px',borderRadius:20,border:'1px solid '+colors[i%colors.length]+'66',color:colors[i%colors.length],background:colors[i%colors.length]+'12',whiteSpace:'nowrap'}}

export default function MemoryStudio(){
 const router=useRouter()
 const [notes,setNotes]=useState<Note[]>([])
 const [ready,setReady]=useState(false)
 const [cloudMode,setCloudMode]=useState(false)
 const [query,setQuery]=useState('')
 const [draft,setDraft]=useState('')
 const [activeTag,setActiveTag]=useState('All')
 const [customTag,setCustomTag]=useState('')
 const [question,setQuestion]=useState('')
 const [answer,setAnswer]=useState('')
 const [asking,setAsking]=useState(false)
 const [voice,setVoice]=useState(false)
 const [voiceError,setVoiceError]=useState('')
 const [tab,setTab]=useState<'inbox'|'memory'|'connections'>('inbox')
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const recognitionRef=useRef<any>(null)
 const voiceBaseRef=useRef('')
 const voiceFinalRef=useRef('')
 const [customTags,setCustomTags]=useState<string[]>([])
 const [resurfaceIndex,setResurfaceIndex]=useState(0)

 const persistGuest=useCallback((next:Note[])=>{localStorage.setItem(KEY,JSON.stringify(next));setNotes(next)},[])
 useEffect(()=>{let alive=true;(async()=>{try{const r=await fetch('/api/notes',{cache:'no-store'});if(r.ok){const data=await r.json();if(alive){setCloudMode(true);setNotes(data);setReady(true)}return}if(r.status===401){if(alive){setCloudMode(false);setNotes(readGuest());setReady(true)}return}}catch{}if(alive){setCloudMode(false);setNotes(readGuest());setReady(true)}})();return()=>{alive=false}},[])
 const allTags=useMemo(()=>[...PRESETS,...customTags,...Array.from(new Set(notes.flatMap(n=>n.tags||[])))].filter((v,i,a)=>a.indexOf(v)===i),[notes,customTags])
 const filtered=useMemo(()=>notes.filter(n=>{const tagMatches=activeTag==='All'||(n.tags||[]).includes(activeTag);const textMatches=!query||(n.title+' '+n.body).toLowerCase().includes(query.toLowerCase());return tagMatches&&textMatches}),[notes,activeTag,query])
 const resurfaced=useMemo(()=>notes.filter(n=>n.body.trim()).sort((a,b)=>Date.parse(a.updated_at)-Date.parse(b.updated_at)).slice(0,8),[notes])
 const connections=useMemo(()=>{const pairs:{a:Note;b:Note;score:number}[]=[];for(let i=0;i<notes.length;i++)for(let j=i+1;j<notes.length;j++){const score=overlap((notes[i].title+' '+notes[i].body).slice(0,1800),(notes[j].title+' '+notes[j].body).slice(0,1800));if(score>=.18)pairs.push({a:notes[i],b:notes[j],score})}return pairs.sort((a,b)=>b.score-a.score).slice(0,12)},[notes])
 const updateTags=async(id:string,tags:string[])=>{const previous=notes;const next=notes.map(n=>n.id===id?{...n,tags}:n);setNotes(next);if(!next.find(n=>n.id===id)?.synced){persistGuest(next);return}try{const r=await fetch('/api/notes/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({tags})});if(!r.ok)throw new Error('Tag save failed')}catch{setNotes(previous);setMessage('Could not save tags. Your previous tags have been restored; please try again.')}}
 const addThought=async()=>{const body=draft.trim();if(!body)return;setBusy(true);const now=new Date().toISOString();const title=body.split(/\n/)[0].slice(0,72)||'Untitled thought';if(cloudMode){try{const r=await fetch('/api/notes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,body,started_at:now,tags:['Brain Dump']})});if(!r.ok){setMessage('Could not save this thought to your account. Your text is still here; try again.');setBusy(false);return}const n=await r.json();setNotes(p=>[n,...p]);setDraft('');setMessage('Thought captured. You can organize it later.')}catch{setMessage('Connection interrupted. Your text is still here; try again.')}finally{setBusy(false)}return}const n:Note={id:'local-'+Date.now(),title,body,created_at:now,updated_at:now,started_at:now,tags:['Brain Dump']};persistGuest([n,...notes]);setDraft('');setMessage('Thought captured in this browser.');setBusy(false)}
 const askMemory=async()=>{if(!question.trim())return;setAsking(true);setAnswer('');try{const r=await fetch('/api/memory/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,notes:notes.map(n=>({id:n.id,title:n.title,body:n.body,created_at:n.created_at,tags:n.tags||[]}))})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Memory search unavailable');setAnswer(d.answer)}catch(e){setAnswer(e instanceof Error?e.message:'Could not search your memory.')}finally{setAsking(false)}}
 const startVoice=()=>{if(voice){recognitionRef.current?.stop();return}setVoiceError('');const w=window as Window&{webkitSpeechRecognition?:new()=>any;SpeechRecognition?:new()=>any};const Recognition=w.SpeechRecognition||w.webkitSpeechRecognition;if(!Recognition){setVoiceError('Voice capture is not supported in this browser. Try Chrome or Edge.');return}try{const rec=new Recognition();recognitionRef.current=rec;const base=draft.trim();voiceBaseRef.current=base;voiceFinalRef.current='';rec.lang=navigator.language||'en-US';rec.continuous=true;rec.interimResults=true;rec.onresult=(event:any)=>{let interim='';const startIndex=Number.isInteger(event.resultIndex)?event.resultIndex:0;for(let i=startIndex;i<event.results.length;i++){const result=event.results[i];const text=result[0]?.transcript||'';if(result.isFinal)voiceFinalRef.current+=text+' ';else interim+=text}const captured=[voiceFinalRef.current,interim].filter(Boolean).join(' ').replace(/\\s+/g,' ').trim();setDraft((voiceBaseRef.current?voiceBaseRef.current+' ':'')+captured)};rec.onerror=(event:any)=>{setVoice(false);setVoiceError(event?.error==='not-allowed'?'Microphone permission was denied. Allow microphone access in your browser and try again.':'Microphone capture stopped. Check your microphone and browser permissions.');recognitionRef.current=null};rec.onend=()=>{setVoice(false);recognitionRef.current=null};rec.start();setVoice(true)}catch{recognitionRef.current=null;setVoice(false);setVoiceError('Could not start microphone capture. Check browser microphone permissions and try again.')}}
 const openNote=(n:Note)=>{router.push('/?note='+encodeURIComponent(n.id))}
 const assignTag=async(id:string,tag:string)=>{const n=notes.find(x=>x.id===id);if(!n)return;const tags=n.tags||[];await updateTags(id,tags.includes(tag)?tags.filter(x=>x!==tag):[...tags,tag])}
 const currentResurfaced=resurfaced.length?resurfaced[resurfaceIndex%resurfaced.length]:null
 useEffect(()=>()=>{recognitionRef.current?.stop();recognitionRef.current=null},[])
 if(!ready)return <div className="memory-loading" role="status" aria-live="polite" aria-busy="true">
  <div className="memory-loading-mark"><span/><span/><span/></div>
  <div className="memory-loading-title">Opening Memory Studio</div>
  <p>Gathering your thoughts and connections</p>
  <div className="memory-loading-track"><span/></div>
 </div>
 return <div className="memory-studio-scroll" style={styles.shell}><div style={styles.wrap}>
  <button style={{...styles.button,marginBottom:24}} onClick={()=>router.push('/')}>← Back to notes</button>
  <div style={styles.eyebrow}>YOUR PERSONAL MEMORY</div><h1 style={styles.heading}>A little more room to think.</h1><p style={styles.muted}>Capture now. Make sense of it later. Find it when it matters.</p>
  <div style={{display:'flex',gap:8,flexWrap:'wrap',margin:'24px 0 20px'}}>{(['inbox','memory','connections'] as const).map(t=><button key={t} style={{...styles.button,background:tab===t?'var(--paper-dark)':'transparent',borderColor:tab===t?'var(--accent)':'var(--line)'}} onClick={()=>setTab(t)}>{t==='inbox'?'Thought Inbox':t==='memory'?'Ask My Memory':'Thought Connections'}</button>)}</div>
  {tab==='inbox'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:16}}>
   <section style={styles.panel}><div style={styles.eyebrow}>QUICK CAPTURE</div><h2 style={{font:'22px Georgia,serif',fontWeight:500,margin:'8px 0 12px'}}>What's on your mind?</h2><textarea style={{...styles.input,minHeight:150,resize:'vertical',lineHeight:1.7}} value={draft} disabled={voice} onChange={e=>setDraft(e.target.value)} placeholder="A thought, an idea, something to remember…"/><div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:10,flexWrap:'wrap',marginTop:12}}><div style={{display:'flex',gap:8,alignItems:'center'}}>{voice?<div className="voice-live" role="status" aria-live="polite"><span className="voice-live-orb"><span/></span><span className="voice-wave" aria-hidden="true">{Array.from({length: 9},(_,i)=><i key={i} style={{'--bar':i} as React.CSSProperties}/>)}</span><span className="voice-live-label">Listening · live transcription</span><button className="voice-stop" onClick={startVoice}>Stop recording</button></div>:<button style={styles.button} onClick={startVoice}>◉ Voice dump</button>}<button style={styles.button} disabled={voice} onClick={()=>{setDraft('');setVoiceError('')}}>Clear</button></div><button style={styles.primary} disabled={busy||!draft.trim()} onClick={addThought}>{busy?'Saving…':'Capture thought →'}</button></div>{voiceError&&<p style={{...styles.muted,color:'#b45c54'}}>{voiceError}</p>}{message&&<p style={styles.muted}>{message}</p>}</section>
   <section style={styles.panel}><div style={styles.eyebrow}>MEMORY RESURFACING</div><h2 style={{font:'22px Georgia,serif',fontWeight:500,margin:'8px 0 12px'}}>A thought from before</h2>{currentResurfaced?<><p style={{font:'16px Georgia,serif',lineHeight:1.6}}>{currentResurfaced.title||'Untitled'}</p><p style={styles.muted}>{currentResurfaced.body.slice(0,240)}</p><p style={styles.muted}>Last touched {new Date(currentResurfaced.updated_at).toLocaleDateString()}</p><button style={styles.button} onClick={()=>setResurfaceIndex(i=>i+1)}>Another memory ↗</button></>:<p style={styles.muted}>Your older thoughts will appear here as you build your memory.</p>}</section>
  </div>}
  {tab==='memory'&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,300px),1fr))',gap:16}}><section style={styles.panel}><div style={styles.eyebrow}>ASK YOUR NOTES</div><h2 style={{font:'22px Georgia,serif',fontWeight:500,margin:'8px 0 12px'}}>What are you trying to remember?</h2><textarea style={{...styles.input,minHeight:90}} value={question} onChange={e=>setQuestion(e.target.value)} placeholder="What did I write about starting a business?"/><button style={{...styles.primary,marginTop:12}} disabled={asking||!question.trim()} onClick={askMemory}>{asking?'Searching your notes…':'Ask my memory →'}</button>{answer&&<div style={{marginTop:18,padding:14,background:'var(--paper-dark)',borderRadius:8,whiteSpace:'pre-wrap',lineHeight:1.7,fontSize:14}}>{answer}</div>}</section><section style={styles.panel}><div style={styles.eyebrow}>YOUR ARCHIVE</div><h2 style={{font:'22px Georgia,serif',fontWeight:500,margin:'8px 0'}}>What Notely can search</h2><p style={styles.muted}>{notes.length} notes available. Answers are generated from the notes you provide and may miss context; open source notes to verify important details.</p><p style={styles.muted}>Notely searches the notes you share when you ask a question. If AI is configured, it composes an answer; otherwise it returns matching excerpts. Note text is sent to the AI provider only when you submit a question.</p></section></div>}
  {tab==='connections'&&<section style={styles.panel}><div style={styles.eyebrow}>RELATED THINKING</div><h2 style={{font:'22px Georgia,serif',fontWeight:500,margin:'8px 0 6px'}}>Thoughts that may belong together</h2><p style={styles.muted}>Suggestions are based on shared words. They're clues, not guaranteed relationships.</p>{connections.length?connections.map((p,i)=><div key={p.a.id+p.b.id} style={{padding:'14px 0',borderTop:'1px solid var(--line)',display:'grid',gridTemplateColumns:'1fr auto 1fr',gap:12,alignItems:'center'}}><button style={{...styles.button,textAlign:'left'}} onClick={()=>openNote(p.a)}>{p.a.title||'Untitled'}<div style={styles.muted}>{p.a.body.slice(0,90)}</div></button><span style={styles.muted}>↔</span><button style={{...styles.button,textAlign:'left'}} onClick={()=>openNote(p.b)}>{p.b.title||'Untitled'}<div style={styles.muted}>{p.b.body.slice(0,90)}</div></button></div>):<p style={{...styles.muted,padding:20}}>As you add more notes, Notely will suggest potentially related thoughts here.</p>}</section>}
  <section style={{...styles.panel,marginTop:18}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}><div><div style={styles.eyebrow}>YOUR THOUGHT LIBRARY</div><h2 style={{font:'22px Georgia,serif',fontWeight:500,margin:'7px 0'}}>Everything you've captured</h2></div><span style={styles.muted}>{filtered.length} notes</span></div>
   <input style={{...styles.input,margin:'12px 0'}} value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search your thoughts…"/>
   <div style={{display:'flex',gap:7,flexWrap:'wrap',marginBottom:16}}><button style={styles.button} onClick={()=>setActiveTag('All')}>All · {notes.length}</button>{allTags.map(tag=><button key={tag} style={{...styles.button,borderColor:activeTag===tag?'var(--accent)':'var(--line)'}} onClick={()=>setActiveTag(tag)}>{tag} · {notes.filter(n=>(n.tags||[]).includes(tag)).length}</button>)}</div>
   <div style={{display:'flex',gap:8,marginBottom:14}}><input style={{...styles.input,maxWidth:260}} value={customTag} onChange={e=>setCustomTag(e.target.value)} placeholder="Create a tag…"/><button style={styles.button} onClick={()=>{const t=customTag.trim();if(t&&!allTags.includes(t)){setCustomTags(p=>[...p,t]);setCustomTag('')}}}>Add tag</button></div>
   {filtered.map(n=><article key={n.id} style={{padding:'14px 0',borderTop:'1px solid var(--line)'}}><div style={{display:'flex',justifyContent:'space-between',gap:12,alignItems:'flex-start'}}><button style={{border:0,background:'transparent',color:'var(--ink)',font:'16px Georgia,serif',textAlign:'left',cursor:'pointer'}} onClick={()=>openNote(n)}>{n.title||'Untitled'}<div style={styles.muted}>{n.body.slice(0,160)}</div></button><span style={{...styles.muted,whiteSpace:'nowrap'}}>{new Date(n.updated_at).toLocaleDateString()}</span></div><div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:9}}>{(n.tags||[]).map(t=><button key={t} style={badgeStyle(t)} onClick={()=>assignTag(n.id,t)} title="Remove tag">{t} ×</button>)}{allTags.filter(t=>!(n.tags||[]).includes(t)).slice(0,4).map(t=><button key={t} style={{...badgeStyle(t),opacity:.65,cursor:'pointer'}} onClick={()=>assignTag(n.id,t)}>+ {t}</button>)}</div></article>)}
   {!filtered.length&&<p style={styles.muted}>Nothing here yet. Capture a thought above to get started.</p>}
  </section>
 </div></div>
}
