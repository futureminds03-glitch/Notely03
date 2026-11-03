export const MCP_SCOPES = ['notes:read','notes:write','timeline:read','search:read','context:read','intelligence:read','parking:read','parking:write'] as const
export type McpScope = (typeof MCP_SCOPES)[number]
export type McpAction = 'READ' | 'WRITE' | 'DELETE'

export type McpToolMetadata = Readonly<{
  name: string
  version: 'v1'
  capability_group: 'core'|'notes'|'timeline'|'search'|'versions'|'relationships'|'context'|'intelligence'|'parking'|'links'|'health_logs'
  action: McpAction
  required_scopes: readonly McpScope[]
  description: string
  risk: 'low'|'medium'|'high'
}>

export const MCP_TOOL_REGISTRY: readonly McpToolMetadata[] = [
  {name:'search_tools',version:'v1',capability_group:'core',action:'READ',required_scopes:['search:read'],description:'Discover domain capabilities available to this authorization.',risk:'low'},
  {name:'get_note',version:'v1',capability_group:'notes',action:'READ',required_scopes:['notes:read'],description:'Retrieve one active note owned by the caller.',risk:'low'},
  {name:'query_notes',version:'v1',capability_group:'notes',action:'READ',required_scopes:['notes:read'],description:'Query active notes with bounded stable cursor pagination.',risk:'low'},
  {name:'create_note',version:'v1',capability_group:'notes',action:'WRITE',required_scopes:['notes:write'],description:'Create an authoritative user-created note with idempotency protection.',risk:'medium'},
  {name:'update_note',version:'v1',capability_group:'notes',action:'WRITE',required_scopes:['notes:write'],description:'Update an owned note with optimistic concurrency.',risk:'medium'},
  {name:'delete_note',version:'v1',capability_group:'notes',action:'DELETE',required_scopes:['notes:write'],description:'Soft-delete an owned note; permanent deletion is unavailable.',risk:'high'},
  {name:'restore_note',version:'v1',capability_group:'notes',action:'WRITE',required_scopes:['notes:write'],description:'Restore an owned soft-deleted note.',risk:'medium'},
  {name:'search_notes',version:'v1',capability_group:'search',action:'READ',required_scopes:['search:read'],description:'Search active notes using PostgreSQL full-text search and temporal bounds.',risk:'low'},
  {name:'get_timeline',version:'v1',capability_group:'timeline',action:'READ',required_scopes:['timeline:read'],description:'Retrieve active notes ordered by started_at, the capture-start timestamp.',risk:'low'},
  {name:'get_notes_for_period',version:'v1',capability_group:'timeline',action:'READ',required_scopes:['timeline:read'],description:'Retrieve active notes inside an explicit started_at interval.',risk:'low'},
  {name:'get_note_versions',version:'v1',capability_group:'versions',action:'READ',required_scopes:['notes:read'],description:'Retrieve bounded immutable note history.',risk:'low'},
  {name:'get_note_version',version:'v1',capability_group:'versions',action:'READ',required_scopes:['notes:read'],description:'Retrieve one immutable note version.',risk:'low'},
  {name:'assemble_notely_context',version:'v1',capability_group:'context',action:'READ',required_scopes:['context:read'],description:'Assemble bounded source-backed evidence for external reasoning.',risk:'low'},
  {name:'search_saved_links',version:'v1',capability_group:'links',action:'READ',required_scopes:['search:read'],description:'Search saved links owned by the caller.',risk:'low'},
  {name:'get_link_context',version:'v1',capability_group:'links',action:'READ',required_scopes:['search:read'],description:'Retrieve a saved link with bounded linked-note context.',risk:'low'},
  {name:'list_tags',version:'v1',capability_group:'notes',action:'READ',required_scopes:['notes:read'],description:'List active-note tags with note counts.',risk:'low'},
  {name:'get_note_insights',version:'v1',capability_group:'intelligence',action:'READ',required_scopes:['intelligence:read'],description:'Retrieve extracted topics, entities, action items and summary for an owned note.',risk:'low'},
  {name:'get_related_memories',version:'v1',capability_group:'intelligence',action:'READ',required_scopes:['intelligence:read'],description:'Find related owned notes using Notely ranked memory retrieval.',risk:'low'},
  {name:'search_smart_recall',version:'v1',capability_group:'intelligence',action:'READ',required_scopes:['intelligence:read'],description:'Search ranked memory evidence without invoking an external AI provider.',risk:'low'},
  {name:'get_parking_lot',version:'v1',capability_group:'parking',action:'READ',required_scopes:['parking:read'],description:'Read the authenticated user’s synced Parking Lot thoughts.',risk:'low'},
  {name:'capture_to_parking_lot',version:'v1',capability_group:'parking',action:'WRITE',required_scopes:['parking:write'],description:'Capture a thought in Parking Lot with atomic idempotency.',risk:'medium'},
  {name:'delete_parking_item',version:'v1',capability_group:'parking',action:'DELETE',required_scopes:['parking:write'],description:'Permanently remove one owned Parking Lot thought.',risk:'high'}
]

export function visibleTools(scopes: readonly string[], query = '', capabilityGroup?: string): readonly McpToolMetadata[] {
  const normalizedQuery = query.trim().toLowerCase()
  return MCP_TOOL_REGISTRY.filter(tool =>
    tool.required_scopes.every(scope => scopes.includes(scope)) &&
    (!capabilityGroup || tool.capability_group === capabilityGroup) &&
    (!normalizedQuery || [tool.name,tool.capability_group,tool.action,tool.description].some(value => value.toLowerCase().includes(normalizedQuery)))
  )
}

export function assertRegistryIntegrity(): void {
  const names = new Set<string>()
  for (const tool of MCP_TOOL_REGISTRY) {
    if (names.has(tool.name)) throw new Error(`Duplicate MCP tool: ${tool.name}`)
    names.add(tool.name)
    if (!tool.required_scopes.length) throw new Error(`Tool ${tool.name} has no required scope`)
  }
}