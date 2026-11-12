/**
 * Executable transition contracts for Notely's asynchronous workflows.
 * UI components may still own presentation state; these contracts define
 * the legal lifecycle edges shared by the application and regression tests.
 */
export const STATE_MACHINES = Object.freeze({
  auth: { initial: 'initializing', transitions: {
    initializing: { GUEST: 'guest', SESSION_FOUND: 'authenticated', FAILED: 'error' },
    guest: { SIGN_IN: 'authenticating', SIGN_UP: 'authenticating' },
    authenticating: { AUTHENTICATED: 'authenticated', FAILED: 'guest', CANCEL: 'guest' },
    authenticated: { SIGN_OUT: 'signingOut', SESSION_EXPIRED: 'guest' },
    signingOut: { SIGNED_OUT: 'guest', FAILED: 'authenticated' },
    error: { RETRY: 'initializing' },
  }},
  workspace: { initial: 'loading', transitions: {
    loading: { LOCAL_LOADED: 'hydrating', LOCAL_FAILED: 'cloudLoading', CANCEL: 'cancelled' },
    hydrating: { CLOUD_LOADING: 'cloudLoading', READY_OFFLINE: 'readyOffline', READY: 'ready', FAILED: 'error' },
    cloudLoading: { CLOUD_LOADED: 'ready', CLOUD_FAILED: 'readyOffline', CANCEL: 'cancelled' },
    readyOffline: { ONLINE: 'syncing', REFRESH: 'cloudLoading' },
    ready: { OFFLINE: 'readyOffline', REFRESH: 'cloudLoading', SYNC: 'syncing' },
    syncing: { SYNCED: 'ready', SYNC_FAILED: 'readyOffline', OFFLINE: 'readyOffline' },
    error: { RETRY: 'loading' }, cancelled: {},
  }},
  note: { initial: 'new', transitions: {
    new: { OPEN: 'active', PERSIST_LOCAL: 'draft' },
    draft: { OPEN: 'active', SAVE: 'saving', DELETE: 'deleting' },
    active: { EDIT: 'dirty', SAVE: 'saving', DELETE: 'deleting', CLOSE: 'closed' },
    dirty: { EDIT: 'dirty', DEBOUNCE: 'saving', SAVE: 'saving', CLOSE: 'closing', DELETE: 'deleting' },
    saving: { EDIT: 'dirty', SAVED: 'active', FAILED: 'saveError', SUPERSEDED: 'dirty', DELETE: 'deleting' },
    saveError: { RETRY: 'saving', EDIT: 'dirty', DELETE: 'deleting' },
    closing: { FLUSHED: 'closed', FAILED: 'saveError' },
    deleting: { DELETED: 'deleted', FAILED: 'active' }, closed: { OPEN: 'active' }, deleted: {},
  }},
  saveQueue: { initial: 'idle', transitions: {
    idle: { ENQUEUE: 'queued' }, queued: { START: 'running', REPLACE: 'queued', CANCEL: 'idle' },
    running: { SUCCESS: 'idle', FAILURE: 'failed', ENQUEUE: 'queued', SUPERSEDE: 'queued' },
    failed: { RETRY: 'queued', ENQUEUE: 'queued', CANCEL: 'idle' },
  }},
  noteSync: { initial: 'clean', transitions: {
    clean: { CREATE: 'pendingCreate', UPDATE: 'pendingUpdate', DELETE: 'pendingDelete' },
    pendingCreate: { START: 'creating', UPDATE: 'pendingCreate', DELETE: 'pendingDelete' },
    creating: { CREATED: 'clean', CONFLICT: 'pendingUpdate', FAILURE: 'blocked', DELETE: 'pendingDelete', SUPERSEDE: 'pendingCreate' },
    pendingUpdate: { START: 'updating', DELETE: 'pendingDelete', UPDATE: 'pendingUpdate' },
    updating: { SYNCED: 'clean', FAILURE: 'blocked', DELETE: 'pendingDelete', SUPERSEDE: 'pendingUpdate' },
    pendingDelete: { START: 'deleting', CANCEL_DELETE: 'pendingUpdate' },
    deleting: { DELETED: 'clean', FAILURE: 'blocked', DELETE: 'pendingDelete' },
    blocked: { RETRY: 'pendingUpdate', DELETE: 'pendingDelete', DISCARD: 'clean' },
  }},
  parkingSync: { initial: 'clean', transitions: {
    clean: { CREATE: 'pendingCreate', DELETE: 'pendingDelete' },
    pendingCreate: { START: 'creating', UPDATE: 'pendingCreate', DELETE: 'pendingDelete' },
    creating: { CREATED: 'clean', FAILURE: 'blocked', DELETE: 'pendingDelete' },
    pendingDelete: { START: 'deleting', CANCEL_DELETE: 'pendingCreate' },
    deleting: { DELETED: 'clean', FAILURE: 'blocked' },
    blocked: { RETRY: 'pendingCreate', DISCARD: 'clean', DELETE: 'pendingDelete' },
  }},
  imageSync: { initial: 'local', transitions: {
    local: { UPLOAD: 'uploading', DISCARD: 'discarded' },
    uploading: { UPLOADED: 'remote', FAILURE: 'blocked', CANCEL: 'local' },
    remote: { CLEANUP_LOCAL: 'complete', KEEP_LOCAL: 'complete' },
    blocked: { RETRY: 'uploading', DISCARD: 'discarded' }, complete: {}, discarded: {},
  }},
  realtime: { initial: 'disconnected', transitions: {
    disconnected: { SUBSCRIBE: 'subscribing' }, subscribing: { SUBSCRIBED: 'connected', FAILURE: 'disconnected' },
    connected: { EVENT: 'reconciling', DISCONNECT: 'disconnected' },
    reconciling: { APPLY: 'connected', IGNORE: 'connected', CONFLICT: 'connected', DISCONNECT: 'disconnected' },
  }},
  history: { initial: 'followingLatest', transitions: {
    followingLatest: { SELECT_VERSION: 'browsing' }, browsing: { SELECT_VERSION: 'browsing', RETURN_LATEST: 'followingLatest', RESTORE: 'restoring' },
    restoring: { SAVED: 'followingLatest', FAILURE: 'browsing' },
  }},
  voice: { initial: 'idle', transitions: {
    idle: { START: 'starting' }, starting: { STARTED: 'listening', UNSUPPORTED: 'error', DENIED: 'error', FAILURE: 'error' },
    listening: { RESULT: 'listening', STOP: 'stopping', ERROR: 'error', ENDED: 'idle' },
    stopping: { ENDED: 'idle', ERROR: 'error' }, error: { RETRY: 'starting', DISMISS: 'idle' },
  }},
  aiTask: { initial: 'idle', transitions: {
    idle: { START: 'running' }, running: { SUCCESS: 'succeeded', FAILURE: 'failed', CANCEL: 'cancelled', STALE: 'stale' },
    succeeded: { RESET: 'idle' }, failed: { RETRY: 'running', RESET: 'idle' },
    cancelled: { RESET: 'idle' }, stale: { RESET: 'idle' },
  }},
  focusTimer: { initial: 'idle', transitions: {
    idle: { START: 'running', RESET: 'idle' }, running: { PAUSE: 'paused', COMPLETE: 'completed', RESET: 'idle' },
    paused: { RESUME: 'running', RESET: 'idle' }, completed: { START: 'running', RESET: 'idle' },
  }},
  capture: { initial: 'empty', transitions: {
    empty: { TYPE: 'capturing' }, capturing: { TYPE: 'capturing', ORGANIZE: 'organizing', SAVE: 'saving', CLEAR: 'empty' },
    organizing: { SUCCESS: 'preview', FAILURE: 'capturing', CANCEL: 'capturing' },
    preview: { SAVE: 'saving', EDIT: 'capturing', DISCARD: 'capturing' },
    saving: { SAVED: 'empty', FAILURE: 'capturing' },
  }},
  memorySearch: { initial: 'idle', transitions: {
    idle: { SEARCH: 'searching' }, searching: { RESULTS: 'ranked', EMPTY: 'empty', FAILURE: 'failed', CANCEL: 'idle' },
    ranked: { OPEN: 'opened', SEARCH: 'searching' }, empty: { SEARCH: 'searching' },
    failed: { RETRY: 'searching', SEARCH: 'searching' }, opened: { BACK: 'ranked', SEARCH: 'searching' },
  }},
  indexing: { initial: 'idle', transitions: {
    idle: { START: 'indexing' }, indexing: { PROGRESS: 'indexing', COMPLETE: 'complete', FAILURE: 'failed', CANCEL: 'cancelled' },
    failed: { RETRY: 'indexing' }, cancelled: { RETRY: 'indexing' }, complete: { REINDEX: 'indexing' },
  }},
  mobileNavigation: { initial: 'list', transitions: {
    list: { OPEN_NOTE: 'editor' }, editor: { BACK: 'list', OPEN_NOTE: 'editor' },
  }},
  linkCapture: { initial: 'empty', transitions: {
    empty: { SUBMIT: 'fetching' }, fetching: { EXTRACTED: 'extracted', FAILURE: 'failed', CANCEL: 'empty' },
    extracted: { ANALYSE: 'analysing', SAVE: 'saving', RESET: 'empty' },
    analysing: { ANALYSED: 'preview', FAILURE: 'extracted', CANCEL: 'extracted' },
    preview: { SAVE: 'saving', RESET: 'empty' }, saving: { SAVED: 'complete', FAILURE: 'preview' },
    failed: { RETRY: 'fetching', RESET: 'empty' }, complete: { RESET: 'empty' },
  }},

  tagSync: { initial: 'clean', transitions: {
    clean: { CHANGE: 'pending' }, pending: { START: 'saving', CHANGE: 'pending' },
    saving: { SAVED: 'clean', FAILURE: 'blocked', CHANGE: 'pending' },
    blocked: { RETRY: 'pending', DISCARD: 'clean', CHANGE: 'pending' },
  }},
  thoughtConnections: { initial: 'unselected', transitions: {
    unselected: { SELECT: 'selected' }, selected: { MATCH: 'matching', CLEAR: 'unselected', SELECT: 'selected' },
    matching: { RESULTS: 'results', EMPTY: 'empty', FAILURE: 'failed', CANCEL: 'selected' },
    results: { OPEN: 'opened', SELECT: 'selected', CLEAR: 'unselected' },
    empty: { MATCH: 'matching', SELECT: 'selected', CLEAR: 'unselected' },
    failed: { RETRY: 'matching', SELECT: 'selected', CLEAR: 'unselected' },
    opened: { BACK: 'results', CLEAR: 'unselected' },
  }},
  memoryResurface: { initial: 'idle', transitions: {
    idle: { RANK: 'ranking' }, ranking: { RANKED: 'ranked', EMPTY: 'empty', FAILURE: 'failed' },
    ranked: { FILTER: 'filtered', OPEN: 'opened', REFRESH: 'ranking' },
    filtered: { FILTER: 'filtered', CLEAR_FILTER: 'ranked', OPEN: 'opened' },
    empty: { REFRESH: 'ranking' }, failed: { RETRY: 'ranking' }, opened: { BACK: 'ranked' },
  }},
  timeMachine: { initial: 'closed', transitions: {
    closed: { OPEN: 'choosingDate' }, choosingDate: { SELECT_DATE: 'loading', CLOSE: 'closed' },
    loading: { RESULTS: 'results', EMPTY: 'empty', FAILURE: 'failed', CLOSE: 'closed' },
    results: { OPEN_NOTE: 'noteOpened', SELECT_DATE: 'loading', CLOSE: 'closed' },
    empty: { SELECT_DATE: 'loading', CLOSE: 'closed' }, failed: { RETRY: 'loading', CLOSE: 'closed' },
    noteOpened: { BACK: 'results', CLOSE: 'closed' },
  }},
  searchFilter: { initial: 'idle', transitions: {
    idle: { QUERY: 'filtering' }, filtering: { RESULTS: 'filtered', EMPTY: 'empty', CLEAR: 'idle', QUERY: 'filtering' },
    filtered: { QUERY: 'filtering', CLEAR: 'idle', OPEN: 'opened' },
    empty: { QUERY: 'filtering', CLEAR: 'idle' }, opened: { BACK: 'filtered', QUERY: 'filtering' },
  }},
  exportShare: { initial: 'idle', transitions: {
    idle: { EXPORT: 'preparing', SHARE: 'preparing' }, preparing: { READY: 'ready', FAILURE: 'failed', CANCEL: 'idle' },
    ready: { DOWNLOAD: 'complete', SHARED: 'complete', FAILURE: 'failed', CANCEL: 'idle' },
    failed: { RETRY: 'preparing', CANCEL: 'idle' }, complete: { RESET: 'idle' },
  }},
  deploymentRefresh: { initial: 'current', transitions: {
    current: { UPDATE_AVAILABLE: 'available' }, available: { RELOAD: 'reloading', DISMISS: 'current' },
    reloading: { RELOADED: 'current', FAILURE: 'available' },
  }},
  memoryArchive: { initial: 'loading', transitions: {
    loading: { CACHE_READY: 'cached', CLOUD_READY: 'ready', FAILURE: 'failed' },
    cached: { CLOUD_REFRESH: 'refreshing', READY_OFFLINE: 'readyOffline', FAILURE: 'failed' },
    refreshing: { CLOUD_READY: 'ready', FAILURE: 'readyOffline', CANCEL: 'cached' },
    readyOffline: { ONLINE: 'refreshing' }, ready: { REFRESH: 'refreshing', OFFLINE: 'readyOffline' },
    failed: { RETRY: 'loading' },
  }},

});

export function transition(machineName, currentState, event) {
  const machine = STATE_MACHINES[machineName];
  if (!machine) throw new Error(`Unknown state machine: ${machineName}`);
  const next = machine.transitions[currentState]?.[event];
  if (!next) throw new Error(`Illegal transition: ${machineName}.${currentState} --${event}-->`);
  return next;
}

export function canTransition(machineName, currentState, event) {
  return Boolean(STATE_MACHINES[machineName]?.transitions[currentState]?.[event]);
}
