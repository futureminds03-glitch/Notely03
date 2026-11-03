import type { OfflineNote } from '@/lib/offline-notes'

export type OfflineParkingItem = { id:string; text:string; createdAt:string; synced?:boolean }
type StoredParking = { key:string; ownerId:string; item:OfflineParkingItem; pendingDelete:boolean }

const DB='notely-local', STORE='workspace'
function openDb():Promise<IDBDatabase>{
 return new Promise((resolve,reject)=>{
  if(typeof indexedDB==='undefined'){reject(new Error('IndexedDB is unavailable'));return}
  const request=indexedDB.open(DB,3)
  request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains('notes')){const notes=db.createObjectStore('notes',{keyPath:'key'});notes.createIndex('ownerId','ownerId',{unique:false})}if(!db.objectStoreNames.contains(STORE)){const store=db.createObjectStore(STORE,{keyPath:'key'});store.createIndex('ownerId','ownerId',{unique:false})}if(!db.objectStoreNames.contains('tagUpdates')){const tags=db.createObjectStore('tagUpdates',{keyPath:'key'});tags.createIndex('ownerId','ownerId',{unique:false})}}
  request.onsuccess=()=>resolve(request.result)
  request.onerror=()=>reject(request.error??new Error('Could not open offline workspace'))
 })
}
async function all(ownerId:string):Promise<StoredParking[]>{
 const db=await openDb()
 return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),request=tx.objectStore(STORE).index('ownerId').getAll(ownerId);request.onsuccess=()=>resolve(request.result as StoredParking[]);request.onerror=()=>reject(request.error);tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error)}})
}
async function put(record:StoredParking):Promise<void>{
 const db=await openDb()
 return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(record);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})
}
async function remove(ownerId:string,id:string):Promise<void>{
 const db=await openDb()
 return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(ownerId+':parking:'+id);tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)}})
}
export async function getOfflineParking(ownerId:string):Promise<OfflineParkingItem[]>{
 return (await all(ownerId)).filter(r=>!r.pendingDelete).map(r=>r.item).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))
}
export async function getPendingParking(ownerId:string):Promise<StoredParking[]>{
 return (await all(ownerId)).filter(r=>r.pendingDelete||!r.item.synced)
}
export async function saveOfflineParking(ownerId:string,item:OfflineParkingItem):Promise<void>{
 const key=ownerId+':parking:'+item.id
 await put({key,ownerId,item:{...item,synced:false},pendingDelete:false})
}
export async function cacheOfflineParking(ownerId:string,item:OfflineParkingItem):Promise<void>{
 const key=ownerId+':parking:'+item.id
 const existing=(await all(ownerId)).find(r=>r.key===key)
 if(existing&&(existing.pendingDelete||!existing.item.synced))return
 await put({key,ownerId,item:{...item,synced:true},pendingDelete:false})
}
export async function markParkingDeleted(ownerId:string,id:string):Promise<void>{
 const existing=(await all(ownerId)).find(r=>r.item.id===id)
 if(!existing){await remove(ownerId,id);return}
 await put({...existing,pendingDelete:true})
}
export async function removeOfflineParking(ownerId:string,id:string):Promise<void>{await remove(ownerId,id)}
export async function remapOfflineParking(ownerId:string,oldId:string,item:OfflineParkingItem):Promise<void>{
 await remove(ownerId,oldId)
 await put({key:ownerId+':parking:'+item.id,ownerId,item:{...item,synced:true},pendingDelete:false})
}
export type { OfflineNote }

type StoredTagUpdate = { key:string; ownerId:string; noteId:string; tags:string[] }
async function withTagStore<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
 const db=await openDb()
 return new Promise((resolve,reject)=>{const tx=db.transaction('tagUpdates',mode),request=action(tx.objectStore('tagUpdates'));request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error??new Error('Offline tag update failed'));tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error)}})
}
export async function saveOfflineTagUpdate(ownerId:string,noteId:string,tags:string[]):Promise<void>{
 await withTagStore<IDBValidKey>('readwrite',store=>store.put({key:ownerId+':tags:'+noteId,ownerId,noteId,tags} satisfies StoredTagUpdate))
}
export async function getPendingOfflineTagUpdates(ownerId:string):Promise<StoredTagUpdate[]>{
 return withTagStore<StoredTagUpdate[]>('readonly',store=>store.index('ownerId').getAll(ownerId))
}
export async function removeOfflineTagUpdate(ownerId:string,noteId:string):Promise<void>{
 await withTagStore<undefined>('readwrite',store=>store.delete(ownerId+':tags:'+noteId))
}
