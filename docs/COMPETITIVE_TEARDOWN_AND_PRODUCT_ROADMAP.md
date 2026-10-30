# Notely — Competitive Teardown & Product Roadmap

**Research date:** 31 October 2026  
**Repository:** https://github.com/futureminds03-glitch/Notely03  
**Product baseline reviewed:** README.md, docs/PRODUCT_BRIEF.md, docs/ARCHITECTURE.md, CHANGELOG.md  
**Status:** Strategy proposal grounded in current repository; roadmap items are not claims of implementation.

---

## Executive decision

Notely should not position itself as another general-purpose notes workspace. The strongest strategic position is:

> **An effortless personal memory system: capture anything in seconds, let Notely make sense of it, and bring the right memory back when it matters.**

The product's defensible experience should be a loop:

1. **Capture:** voice, text, links and quick thoughts with almost no setup.
2. **Understand:** extract meaning, entities, people, topics, decisions and useful context.
3. **Connect:** associate new information with existing memories without asking users to maintain a knowledge graph.
4. **Recall:** answer questions with trustworthy source links and proactively resurface useful context.
5. **Reflect:** help users revisit what they thought, learned, decided and experienced over time.

The differentiation is not a larger feature checklist. It is less cognitive administration and a higher probability that something important can be found again.

### Strategic choices

- **Primary audience:** people with high idea volume and low tolerance for organizing information; ADHD users are an important design audience, without making clinical claims or requiring a diagnosis.
- **Primary job:** remember and retrieve useful personal context, not author polished documents.
- **Product principle:** capture first, organize invisibly, explain recommendations, preserve user control.
- **Do not chase:** team workspaces, project management, complex databases, enterprise collaboration or a plugin ecosystem before personal memory works exceptionally well.
- **Platform:** keep the web app reliable while progressing toward genuinely native iOS and Android experiences. The current PWA is not a substitute for native mobile capability.

---

## 1. Notely's actual baseline

The repository describes Notely as a lightweight personal note-taking app with an adaptive Flow workspace. It already has more than a basic notes MVP.

### Implemented capabilities documented in the repository

| Area | Current implementation | Important limitation |
|---|---|---|
| Writing | Title/body editor, word count, save status | Not a rich document workspace |
| Persistence | Autosave, serialized writes, guest local storage | Guest notes do not automatically migrate/sync to account |
| Accounts | Supabase Auth and owner-scoped cloud notes | Requires correct Supabase configuration |
| Search | Title/body search and indexed Postgres ranked retrieval | Not embedding-based semantic search |
| Smart Recall | Natural-language query, related memories, source-linked Q&A | Retrieval is full-text ranking; AI synthesis requires Groq |
| Time Travel | Historical body snapshots and restore | Body-focused, not full-document history |
| Flow | Brain dump, Parking Lot, focus timer, contextual resurfacing | Some state remains browser-local |
| Voice | Browser speech recognition to text | Browser-dependent; raw audio is not retained |
| AI De-Clutter | Non-destructive structured copy of a brain dump | Requires GROQ_API_KEY |
| Link Capture | Guarded webpage extraction, metadata and source-linked insights | Third-party HTML varies; AI enhancement optional |
| PWA | Responsive interface, manifest, service worker registration | Full offline operation/background sync not established |
| Quick Capture | App-wide overlay and keyboard shortcut | Not an OS-level overlay/widget |

**Important product-truth corrections:**

- Smart Recall is not yet vector-embedding semantic retrieval.
- Current contextual resurfacing is a lexical-overlap heuristic.
- Voice stores recognized text, not audio.
- AI De-Clutter and AI synthesis depend on a configured Groq key.
- Production product documentation says GROQ_API_KEY is not configured, so those AI paths must not be marketed as fully available until configuration and production behavior are verified.
- Native iOS/Android applications are not present in the repository baseline.
- Memory Studio and Time Travel should be treated as experiences to refine, not proof of an autonomous memory engine.

These limitations are useful because they prevent the roadmap from duplicating features that already exist or claiming capabilities prematurely.

---

## 2. Competitor landscape

### Competitive roles

| Competitor | Primary battleground | Threat to Notely |
|---|---|---|
| Saner.AI | ADHD-oriented personal assistant | Very high |
| Tana | Voice + AI knowledge workspace | High |
| Capacities | Connected personal knowledge | High |
| Reflect | Fast, networked notes and retrieval | High |
| HyNote AI | Multimodal capture and transcription | Medium-high |
| Craft | Premium writing and interaction design | Medium |
| Superlist | Notes + tasks + everyday productivity | Adjacent |
| Superpowered | Meeting capture and follow-through | Adjacent |

Product Hunt ratings are directional social proof, not a measure of market share or product quality. The earlier Product Hunt search returned 4.76/5 for Saner.AI, 4.76/5 for Tana, 4.77/5 for Capacities, 4.82/5 for HyNote, 4.59/5 for Craft and 4.52/5 for Superlist. Review counts were relatively small.

### A. Saner.AI — closest direct competitor

**Positioning:** ADHD-friendly AI assistant for notes, email and calendar. Its promise is reducing the burden of keeping life organized.

**Features**
- Quick capture and a central inbox.
- AI chat over personal notes and imported material.
- Semantic search and document Q&A.
- Email, calendar and external data integrations.
- Tasks, OCR, multilingual support and browser extension.
- Mobile app and proactive assistance.

**Onboarding**
- The value proposition is immediately understandable to ADHD users.
- The product invites users to connect existing information sources, rather than starting with an empty note-taking system.
- Free access lowers trial friction; users can experience AI before paying.
- The integration-led approach can create setup burden before the product has delivered personal value.

**Pricing published**
- Free: $0, 100 notes, 100 MB storage and 30 AI messages/month.
- Starter: $8/month.
- Standard: $16/month.
- Paid tiers expand note, storage and AI limits. External model costs may be separate.

**UX strengths**
- Speaks directly to cognitive overload.
- One conversational interface can replace multiple app-switching workflows.
- Strong emphasis on bringing forgotten work back to attention.

**Weaknesses / opportunities**
- Product Hunt feedback mentions import friction, file-size limits, limited capture methods, and requests for richer editing, backup and integrations.
- Integrations and AI features can make the experience feel like an assistant dashboard rather than a calm place to capture a thought.
- Notely can win with much faster first capture, simpler mental models, and memory that works without requiring users to connect their entire digital life.

**What Notely should learn:** ADHD is a real product positioning opportunity, but the experience must reduce decisions rather than add more controls.

Sources: https://www.saner.ai/pricing and https://www.producthunt.com/products/saner-ai

### B. Tana — strongest advanced AI/voice benchmark

**Positioning:** An AI-native workspace that turns information into structured, actionable knowledge.

**Features**
- Voice capture and meeting transcription.
- AI summaries and workflows.
- Supertags and structured objects.
- Search, live queries and knowledge graph.
- Automations, integrations and offline support.
- Meeting workflows and AI agents.

**Onboarding**
- Users are introduced to a flexible, powerful system.
- The product's core concepts—nodes, tags, structured data and workflows—reward investment.
- This creates a higher learning curve than a simple capture tool.
- The user needs to understand the system to unlock its full potential.

**Pricing published**
- Free: $0; five hosted meetings/month, one calendar and 50 AI queries.
- Pro: displayed at $30/user/month standard price, with an early-bird price of $20.
- Max: displayed at $120/user/month standard price, with an early-bird price of $80.
- Business: custom.

**UX strengths**
- Powerful, flexible knowledge model.
- Voice and meeting capture are integrated into the workspace.
- Structured data makes information reusable.

**Weaknesses / opportunities**
- Product Hunt reviews repeatedly mention learning curve, mobile limitations, integrations and collaboration gaps.
- It is possible to spend more time designing a Tana workflow than capturing the information itself.
- Notely should not reproduce its complexity.

**What Notely should learn:** voice is not a novelty feature. It can be a primary interface for capturing and processing thought. But the user should never need to learn a schema before speaking.

Sources: https://tana.inc/pricing and https://www.producthunt.com/products/tana

### C. Capacities — strongest connected-memory benchmark

**Positioning:** A studio for the mind, based on connected objects and personal knowledge.

**Features**
- Object-based notes: people, books, projects, places and ideas.
- Custom object types and properties.
- Backlinks and graph visualization.
- Daily notes and calendar.
- WhatsApp, Telegram and email capture.
- Weblink and image analysis, AI assistant and smart queries on paid plans.
- Cross-platform apps, imports and exports.

**Onboarding**
- Starts with a calm explanation of objects and connections.
- Offers built-in templates and examples.
- Encourages users to create object types and link information gradually.
- The model is more approachable than a blank database, but still asks users to learn a conceptual system.

**Pricing published**
- Basic: free, unlimited objects/blocks, sync, search and offline support, with media limits.
- Pro: $9.99/month on the current pricing page; adds AI, smart search, task management, integrations and more.
- Believer: supporter tier from $12.49/month on the pricing page.
- Additional AI budget is available as an add-on.

**UX strengths**
- Excellent mental model for connected knowledge.
- Daily notes provide a low-friction inbox.
- Flexible without forcing folders.
- Time and graph views help users rediscover information.

**Weaknesses / opportunities**
- Product Hunt feedback mentions learning curve, mobile limitations, offline limitations and missing advanced table/import capabilities.
- Users can still be responsible for creating and maintaining structure.
- Notely can create relationships automatically and explain why two memories are connected.

**What Notely should learn:** time, people and concepts are powerful anchors for recall. The user should not need to manually build a graph to benefit from them.

Sources: https://capacities.io/pricing, https://docs.capacities.io/tutorials/getting-started and https://www.producthunt.com/products/capacities

### D. Reflect — strongest minimalist retrieval benchmark

**Positioning:** Fast networked notes, daily notes, backlinks and frictionless search.

**Product distinction:** Reflect has evolved into more than one product surface. Reflect Classic and the newer Reflect Open should not be confused.

**Features**
- Daily notes and networked notes.
- Backlinks, tags and keyboard-first capture.
- Web clipping and audio memos.
- Local Markdown files and user-controlled storage in Reflect Open.
- Optional AI for note search, summaries, writing and voice transcription.
- AI can use the user's own API key, with provider costs billed separately.

**Onboarding**
- Classic onboarding starts on desktop/web, followed by account setup, an encryption password and recovery kit.
- A short tutorial introduces the system.
- The usage philosophy is simple: put information in today's daily note, then link related concepts when useful.
- Reflect Open emphasizes local Markdown and a simpler storage foundation.

**Pricing published**
- Reflect Open: free on Mac; iPhone/iPad requires a paid subscription with local App Store pricing.
- Optional AI: bring-your-own API key, provider charges separate.
- Reflect Classic: its own legacy subscription/trial arrangement; do not mix Classic pricing with Open.

**UX strengths**
- Daily notes remove the question of where to write.
- Keyboard-first interactions are fast.
- Backlinks provide discoverability.
- Local Markdown is an attractive portability and trust proposition.

**Weaknesses / opportunities**
- The Classic setup has additional security steps.
- The no-hierarchy model may not suit everyone.
- BYOK AI makes AI less turnkey for non-technical users.
- Notely can offer a similarly calm capture experience with automatic context and no API-key setup.

**What Notely should learn:** the best organization system is often a single obvious place to start. The system can add connections later.

Sources: https://reflect.app/home, https://reflect.app/blog/reflect-open, https://reflect.academy/getting-started-with-reflect

### E. HyNote AI — strongest multimodal capture benchmark

**Positioning:** Turn meetings, audio and mixed-format information into structured notes.

**Features**
- Audio recording and transcription.
- Meeting summaries and templates.
- PDF, document, webpage and media processing.
- Speaker identification and translation on higher tiers.
- Chat with notes and cross-device synchronization.
- Export and third-party document integrations.

**Onboarding**
- Free plan allows users to try recording and transcription without a card.
- The product demonstrates value through an immediate input/output workflow.
- Templates and supported file types help users understand what can be processed.
- Feature tiers and transcription quotas introduce a usage-management decision.

**Pricing published**
- Free: $0, limited transcription and 120-minute maximum session length.
- Pro: $79.99/year ($6.66/month equivalent).
- Plus: $129.99/year ($10.83/month equivalent).
- Unlimited: $189.99/year ($15.83/month equivalent).
- Teams: $15/seat/month, billed annually.

**UX strengths**
- Strong input-format breadth.
- Clear immediate value: upload or record, receive useful notes.
- Free entry point.
- Good benchmark for transcription and summary quality.

**Weaknesses / opportunities**
- Product Hunt feedback mentions speaker-label errors, limited visual structure and a billing/refund complaint.
- Meeting-centric products are not necessarily designed for spontaneous everyday thoughts.
- Notely can make the same capture pipeline work for a passing thought, a webpage, a voice note or a long-form reflection.

**What Notely should learn:** capture should be multimodal, but the result must land in one coherent personal memory system.

Sources: https://hynote.ai/pricing, https://hynote.ai/features and https://www.producthunt.com/products/hynote-ai

### F. Craft — premium design benchmark

**Positioning:** Beautiful documents, notes, tasks and collaboration.

**Features**
- Structured documents and block editor.
- Templates, sharing, publishing and collaboration.
- AI assistant, document summarization and search.
- Cross-device sync and API/MCP capabilities.
- Rich formatting and polished layouts.

**Onboarding**
- Guided getting-started materials introduce adding, styling, summarizing, organizing, finding, importing and sharing.
- The user is encouraged to create and shape documents.
- This is useful for a document product, but more than Notely needs for a quick thought.

**Pricing published**
- Free: 1,500 blocks, 1 GB storage and 15 AI credits.
- Plus: $8/month monthly or $6.40/month with annual billing.
- Family: $15/month or $12/month annual equivalent.
- Team: $50/month for up to 10 people.

**UX strengths**
- Strong visual polish.
- Good typography, editor interactions and document presentation.
- Rich but approachable writing environment.

**Weaknesses / opportunities**
- Its document-first model is not the same as a personal memory-first model.
- More formatting and document structure can add friction to spontaneous capture.
- Notely should borrow Craft's attention to visual quality, not its feature breadth.

**What Notely should learn:** premium UX is not decoration. Motion, typography, spacing, loading states and interaction feedback are part of perceived product quality.

Sources: https://www.craft.do/pricing and https://www.craft.do/getting-started

### Adjacent competitors

**Superlist:** Notes and tasks in a polished personal/team productivity product. It competes for the user's daily attention, but its primary value is list/task management rather than long-term memory. Product Hunt feedback mentions missing advanced note features and occasional collaboration/sync issues.

**Superpowered:** Meeting assistant focused on reducing meeting overhead through calendar workflows and AI notes. It is a useful benchmark for turning captured information into follow-through, but it is not a general personal memory system.

Sources: https://www.producthunt.com/products/superlist and https://www.producthunt.com/products/superpowered-me

---

## 3. Feature comparison against Notely

Legend: **Yes** = clearly documented core capability; **Partial** = limited, dependent or not equivalent; **No/unclear** = not established by the reviewed public material. This is a product-documentation comparison, not a hands-on QA certification.

| Capability | Notely | Saner | Tana | Capacities | Reflect | HyNote | Craft |
|---|---|---|---|---|---|---|---|
| Low-friction text capture | Yes | Yes | Yes | Yes | Yes | Partial | Yes |
| ADHD-specific positioning | Yes, design intent | Yes | No | No | No | No | No |
| Voice capture | Partial | Partial | Yes | Partial | Yes | Yes | Partial |
| Link/web capture | Yes | Partial | Partial | Yes | Yes | Yes | Partial |
| Multimodal file ingestion | Partial | Yes | Partial | Partial | Partial | Yes | Partial |
| AI organization | Partial | Yes | Yes | Yes | Yes | Yes | Yes |
| Connected memory/graph | Partial | Partial | Yes | Yes | Yes | Partial | Partial |
| Natural-language memory Q&A | Partial | Yes | Yes | Yes | Yes | Yes | Yes |
| Proactive resurfacing | Partial | Yes | Yes | Partial | Partial | Partial | Partial |
| Source-linked answers | Yes, current Smart Recall design | Partial | Partial | Partial | Yes | Partial | Partial |
| Time-based reflection | Partial | Partial | Partial | Yes | Yes | Partial | Partial |
| Native mobile apps | No | Yes | Yes, limitations noted | Yes | Yes | Yes | Yes |
| Offline-first guarantee | No | Unclear | Yes, announced | Yes | Yes, local files | Unclear | Partial |
| User-controlled local files | No | No/unclear | No/unclear | Export | Yes | No/unclear | Partial |

The important gap is not note creation. Notely already has capture, search, version history, link extraction, brain dumps and a first version of Smart Recall. The next step is to make those pieces behave like one coherent system.

---

## 4. Onboarding teardown and recommended Notely onboarding

| Competitor | First-use model | What works | What Notely should avoid |
|---|---|---|---|
| Saner.AI | Assistant + integrations | Clear ADHD value proposition | Asking for integrations before value |
| Tana | Flexible workspace concepts | Power and customization | Teaching a system before first capture |
| Capacities | Objects + templates | Calm, guided mental model | Making users design schemas |
| Reflect | Today's daily note | One obvious place to start | Too many setup/security steps for a basic trial |
| HyNote | Record/upload → result | Immediate visible payoff | Usage limits dominating the first impression |
| Craft | Create and style a document | Premium guided editor | Making formatting the first task |

### Proposed Notely first-session experience

**Step 1 — Promise:** “Your mind moves fast. Notely helps you keep up.”

**Step 2 — Immediate choice:** Let the user type, speak or paste a link. Do not require an account before a first successful capture if guest persistence can safely support it.

**Step 3 — Visible payoff:** Save the thought, show that it is safe, and display one useful transformation: key points, a cue for future-you or a related memory.

**Step 4 — Demonstrate recall:** Ask the user to search or ask a simple question about what they just captured. Show the source note.

**Step 5 — Introduce Memory Studio:** Explain that Notely can connect and resurface memories over time. Keep advanced capabilities discoverable rather than forcing a tour.

**Step 6 — Account conversion:** Explain the concrete benefit of signing in: cloud persistence and cross-device access. Be honest about guest-to-account migration behavior and implement safe migration before promising it.

**Activation metric:** first capture successfully saved, followed by a successful return to that capture through search/recall. Account creation alone is not activation.

---

## 5. Product opportunity map

### Opportunity 1 — Invisible organization

**Problem:** Every competitor has some form of organization, but most still require user effort.

**Notely opportunity:** Extract topics, people, organizations, dates, decisions and concepts from captured information. Suggest connections automatically and allow users to correct or dismiss them.

**Success:** More useful retrieval without more manual tagging or folder maintenance.

### Opportunity 2 — Trustworthy memory retrieval

**Problem:** AI chat over notes is common. Correct, traceable retrieval is harder.

**Notely opportunity:** Retrieve relevant memories, rank them, show excerpts and link every material claim to its source. If evidence is missing, say so.

**Success:** Users can answer “What did I decide?”, “Where did I read that?” and “What was I thinking about last month?” with confidence.

### Opportunity 3 — Proactive resurfacing

**Problem:** Notes are usually passive. Users forget to search.

**Notely opportunity:** Surface a small number of relevant memories based on current context, time, recurring topics and unfinished thoughts. Every suggestion must explain why it appeared and be dismissible.

**Success:** Useful resurfacing opens and leads to action or reflection, without notification fatigue.

### Opportunity 4 — Capture anywhere

**Problem:** A thought can disappear before the user opens an app.

**Notely opportunity:** Make capture instant across web, mobile, share sheet, widgets, voice and links. Native iOS and Android are strategic enablers, not cosmetic ports.

**Success:** Low capture latency and high successful-save rate across devices.

### Opportunity 5 — A beautiful, calm interface

**Problem:** Advanced knowledge tools become cognitively heavy.

**Notely opportunity:** Keep the main writing surface simple; make Memory Studio and Time Travel visually distinct, discoverable and fast. Use subtle motion and clear loading/progress states.

**Success:** Users can complete common tasks without learning the architecture.

---

## 6. Prioritized product roadmap

Prioritization uses user value, differentiation, dependency and implementation risk. P0 is foundational; P1 creates differentiation; P2 expands capability. This is a recommended sequence, not a committed release schedule.

### P0 — Make the current product trustworthy

**Goal:** Ensure every capture is safe, every memory is retrievable and every AI capability is honestly available.

1. **Production capability audit**
   - Verify Supabase and Groq configuration.
   - Test guest and signed-in capture, cloud sync, AI De-Clutter, link capture and Smart Recall in production.
   - Remove or clearly label unavailable AI paths.
   - Add visible, truthful save and sync states.

2. **Unified capture reliability**
   - Consolidate text, brain dump, Parking Lot, quick capture and link capture into a consistent capture pipeline.
   - Prevent duplicate writes and silent data loss.
   - Add guest-to-account migration with conflict handling and explicit confirmation.
   - Preserve source URL and timestamps.

3. **Smart Recall quality**
   - Improve query normalization and lexical ranking.
   - Add evaluation fixtures for people, dates, decisions, topics and vague natural-language queries.
   - Show why a result matched and provide direct source links.
   - Keep retrieval usable without an AI key.

4. **Product analytics**
   - Instrument first capture, save latency, search success, source opens, recall success, resurfacing engagement and mobile completion.
   - Use privacy-preserving event metadata; never log note bodies.

**Exit criteria:** no silent capture loss in tested flows; production configuration is verified; source-grounded recall has a repeatable evaluation baseline.

### P1 — Build the memory engine

**Goal:** Move from storing notes to understanding and connecting them.

1. **Memory ingestion pipeline**
   - Normalize notes, voice transcripts, links and imported content into a shared source model.
   - Extract entities, concepts, dates, decisions and action items.
   - Preserve provenance and original text.

2. **Semantic retrieval**
   - Add embeddings and hybrid retrieval (full-text + vector + metadata).
   - Evaluate retrieval quality against a fixed query/answer test set.
   - Keep source-grounding mandatory.
   - Add a graceful lexical fallback if embedding generation is unavailable.

3. **Automatic memory connections**
   - Generate related-memory suggestions with evidence.
   - Allow accept, dismiss and correction.
   - Avoid presenting uncertain relationships as facts.

4. **Memory Studio**
   - Present a clear view of people, topics, projects, ideas and connections.
   - Make generated summaries traceable to original sources.
   - Explain what is known, inferred and uncertain.

**Exit criteria:** retrieval beats the current lexical baseline on the evaluation set; every generated relationship and answer can be traced to source content.

### P2 — Make memory proactive

**Goal:** Bring back relevant information at the right moment.

1. **Contextual resurfacing v2**
   - Combine recency, semantic relevance, unresolved actions and user feedback.
   - Avoid repeating dismissed suggestions.
   - Explain “why now?” for each surfaced memory.

2. **Time Machine**
   - Improve chronological exploration and topic timelines.
   - Connect thoughts, decisions and source material across time.
   - Support full-document history only after data model and migration design are verified.

3. **Personal memory assistant**
   - Questions over the user's memories.
   - “What did I decide about this?”
   - “What am I forgetting?”
   - “Show me related thoughts.”
   - Responses cite source notes and distinguish facts from inference.

4. **Gentle review loops**
   - Optional daily/weekly memory review.
   - User-controlled cadence and quiet hours.
   - No streak pressure or guilt mechanics.

**Exit criteria:** surfaced memories are opened and rated useful; dismissals and notification opt-outs remain low.

### P3 — Native mobile capture

**Goal:** Make Notely available at the moment a thought occurs.

1. Native iOS and Android applications (not an Expo-based port).
2. Native voice capture with clear recording state and reliable transcription.
3. Share-sheet capture for links, text and files.
4. Home-screen widgets and quick actions.
5. Offline capture queue with conflict-safe sync.
6. Push notifications only for user-authorized, high-confidence memory resurfacing.

**Architecture decision:** evaluate native platform implementation options against shared backend contracts, release/maintenance cost, accessibility, offline behavior and platform integrations. Do not choose a framework before validating these constraints.

**Exit criteria:** capture and sync are reliable on both platforms; offline-created memories survive app restarts and reconcile without data loss.

### P4 — Expand the memory ecosystem

**Goal:** Increase usefulness without turning Notely into a general-purpose workspace.

1. Import from common note formats and competing tools.
2. Export all user data in open, portable formats.
3. Browser extension for one-click capture.
4. Optional calendar/context integrations, permission-scoped.
5. Advanced privacy controls and transparent AI-provider/data handling.
6. Personalization based on user feedback, not opaque behavioral profiling.

**Exit criteria:** imports preserve source content and timestamps; users can export their data; integrations are opt-in and revocable.

---

## 7. Prioritization matrix

| Initiative | User value | Differentiation | Dependency | Priority |
|---|---|---|---|---|
| Production capability audit | Critical | Medium | None | P0 |
| Unified capture reliability | Critical | High | Existing capture paths | P0 |
| Smart Recall evaluation + ranking | High | High | Existing search | P0 |
| Privacy-safe analytics | High | Medium | Event design | P0 |
| Entity/concept extraction | High | High | Ingestion pipeline | P1 |
| Hybrid semantic retrieval | High | High | Evaluation + embeddings | P1 |
| Automatic memory connections | High | Very high | Extraction + retrieval | P1 |
| Memory Studio source transparency | High | High | Memory model | P1 |
| Proactive resurfacing v2 | High | Very high | P1 memory engine | P2 |
| Time Machine evolution | Medium-high | High | History model | P2 |
| Native iOS + Android | Very high | High | Stable backend contracts | P3 |
| Imports and integrations | Medium | Medium | Stable data model | P4 |

### Explicitly defer

- Team collaboration and shared workspaces.
- Full project management and kanban systems.
- A complex custom database builder.
- Social feeds or public profiles.
- Gamified streaks and punitive reminders.
- An expansive plugin marketplace.
- Expensive always-on AI agents before cost, privacy and utility are proven.

---

## 8. Metrics and decision gates

### North-star metric

**Weekly successful memory retrievals:** a user finds, opens or uses a previously captured memory and the retrieval is judged useful.

This measures the product promise better than raw note count or AI request volume.

### Supporting metrics

| Metric | What it tells us |
|---|---|
| Time to first saved capture | Initial friction |
| Capture success rate | Reliability |
| Save latency | Responsiveness |
| 7-day return to a saved memory | Retrieval habit |
| Search-to-source-open rate | Retrieval relevance |
| Source-grounded answer acceptance | Trust |
| Related-memory usefulness | Connection quality |
| Resurfacing open/dismiss ratio | Proactive value |
| Mobile capture completion | Platform quality |
| Guest-to-account conversion | Cloud value |
| AI cost per weekly active user | Economic sustainability |

Do not set arbitrary numeric targets before measuring the current baseline. Establish baselines, then set targets by cohort and platform.

### Release gates

- No feature is marked complete based on UI appearance alone.
- Capture paths require E2E tests for guest and signed-in states.
- AI answers require source-grounding tests and a no-provider fallback.
- Memory migrations require backup/rollback plans.
- Native apps require offline, sync, accessibility and device-level verification.
- Deploy only after CI passes; preserve the Vercel Free constraint and avoid redundant builds.

---

## 9. Final product strategy

The competitive map is clear:

- Saner proves ADHD-specific productivity is a credible market.
- Tana proves voice and AI can make knowledge actionable.
- Capacities proves connected knowledge can feel personal and calm.
- Reflect proves that a single daily capture surface and fast retrieval can be powerful.
- HyNote proves users value turning many input formats into usable information.
- Craft proves visual quality is a competitive advantage.

**Notely's opportunity is to combine the best of these without inheriting their complexity.**

The product should feel like a quiet extension of the user's mind:

- Capture without deciding where things belong.
- Let the system connect information in the background.
- Recall with evidence, not hallucination.
- Resurface gently, not constantly.
- Keep the experience beautiful, fast and available wherever the user thinks.

**The immediate engineering priority is P0, followed by the memory engine in P1.** Do not start a broad feature expansion or native-app rewrite until capture reliability, retrieval quality and the shared memory model are solid.

---

## Research sources

Vendor/product documentation:
- Saner.AI pricing: https://www.saner.ai/pricing
- Tana pricing: https://tana.inc/pricing
- Capacities pricing: https://capacities.io/pricing
- Capacities onboarding: https://docs.capacities.io/tutorials/getting-started
- Reflect Open: https://reflect.app/home
- Reflect Open announcement: https://reflect.app/blog/reflect-open
- Reflect Classic onboarding: https://reflect.academy/getting-started-with-reflect
- HyNote pricing: https://hynote.ai/pricing
- HyNote feature comparison: https://hynote.ai/features
- Craft pricing: https://www.craft.do/pricing
- Craft getting started: https://www.craft.do/getting-started

Product Hunt:
- https://www.producthunt.com/products/saner-ai
- https://www.producthunt.com/products/tana
- https://www.producthunt.com/products/capacities
- https://www.producthunt.com/products/hynote-ai
- https://www.producthunt.com/products/craft-do
- https://www.producthunt.com/products/superlist
- https://www.producthunt.com/products/superpowered-me

Pricing and features are snapshots of public pages reviewed on 31 October 2026. Vendor plans, early-bird rates, regional prices and product editions can change. Reflect Classic and Reflect Open are treated separately.
