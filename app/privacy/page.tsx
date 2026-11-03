import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy — Notely',
  description: 'How Notely handles notes, account information, saved links and optional AI processing.',
  alternates: { canonical: 'https://notelyapp.com/privacy' },
}

const sections = [
  ['1. Who this policy covers', 'This policy applies to the Notely web application intended to be served at notelyapp.com. Notely is a product of FutureMinds Co. References to “we” and “us” mean FutureMinds Co. as the product operator. Privacy requests can be sent to privacy@notelyapp.com.'],
  ['2. Information you choose to store', 'If you use an account, we process your email address and account identifier, a record of the Terms version you agreed to and Privacy Policy version you acknowledged (including the acceptance time and method), the notes and titles you create, tags, timestamps, note versions, saved source URLs, webpage text you choose to save, and memory insights generated to support search and recall. Archived notes remain in your account until you restore or permanently delete them.'],
  ['3. Guest mode and local storage', 'If you use Notely without signing in, notes and some preferences are stored in your browser on that device. They are not synced to your Notely account. Clearing browser storage or changing devices can remove access to those local notes. Guest notes are not included in account exports because they are not held in your account.'],
  ['4. Voice capture', 'If you use voice capture, your browser’s speech-recognition feature converts speech into text. Depending on your browser and its configuration, audio may be processed by the browser or its speech-recognition provider. Notely receives the resulting transcript. You can use text entry instead.'],
  ['5. Optional AI features', 'AI features are optional. In the current production configuration, no AI provider key is configured, so external AI summaries, organization and AI synthesis are disabled. If an AI provider is enabled in a future release, Notely asks for an affirmative choice before sending the relevant note text, thought, search phrase, selected note text or extracted webpage text to that provider. Groq may process text for summaries and organization; OpenAI may process text to create semantic search embeddings. If you decline, Notely uses local/extractive or text-based alternatives where available. Do not submit information to an AI feature unless you are comfortable with the disclosed provider processing.'],
  ['6. Link capture', 'When you ask Notely to read a public webpage, our server fetches that URL and extracts page metadata and readable text so you can review and save it. Notely does not access private pages that require your sign-in. Extracted text is sent to an AI provider only if you separately opt in to AI analysis.'],
  ['7. Where information is processed', 'Notely uses Supabase for authentication and cloud database storage, and Vercel to host and run the web application. The current Supabase project is in the ap-northeast-1 (Tokyo) region; the current Vercel serverless-function region is iad1 (United States). Provider infrastructure and support operations may involve other locations. Optional AI providers are described above.'],
  ['8. Cookies, analytics and advertising', 'Notely uses the browser storage and authentication mechanisms needed to keep the app working, including local storage for guest notes and Supabase authentication cookies for signed-in sessions. The current application code does not include advertising pixels or third-party analytics SDKs. We do not sell personal information or use notes to target advertising.'],
  ['9. Why we use information', 'We use information to provide note-taking, synchronization, version history, link capture, search and recall; secure accounts; prevent abuse; troubleshoot failures; and respond to privacy or support requests. We do not use private note content for advertising.'],
  ['10. Retention and deletion', 'Account notes and saved content remain until you delete them or delete your account. Archiving is reversible and does not permanently erase a note. You can restore archived notes or permanently delete them in Account & Privacy. Account deletion removes the account and its associated notes, versions, saved sources, derived memory records and legal acceptance records through Supabase Auth deletion and database relationships. Guest notes remain in your browser until you remove them there. Some infrastructure backups and security logs may persist for limited periods under provider retention cycles.'],
  ['11. Your controls', 'Signed-in users can download a JSON export of account notes, note versions, saved sources, source links, memory insights and their legal acceptance records from Account & Privacy. You can archive, restore or permanently delete archived notes, and you can permanently delete your account after confirming your password.'],
  ['12. Security', 'Notely uses authenticated access, owner-scoped database policies and server-side checks to protect account data. No online service can guarantee absolute security. Keep your account credentials private and avoid using Notely as a password vault or emergency-only storage system.'],
  ['13. Children', 'Notely is a general-purpose productivity and note-taking service and is not designed for children under 13. Do not create an account if you are under 13.'],
  ['14. Changes and contact', 'We may update this policy when the product or its data practices change. The effective date will be shown at the top of this page. For privacy questions or requests, email privacy@notelyapp.com.'],
]

export default function PrivacyPage() {
  return (
    <main className="legal-document-page" style={{ maxWidth: 780, margin: '0 auto', padding: '48px 22px 80px', color: 'var(--ink)' }}>
      <a href="/">← Back to Notely</a>
      <p style={{ marginTop: 36, letterSpacing: '.16em', fontSize: 10, color: 'var(--accent)' }}>NOTELY · PRIVACY</p>
      <h1 style={{ font: '500 clamp(38px,7vw,58px)/1.08 Georgia,serif', letterSpacing: '-.045em' }}>Privacy Policy</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>Effective 1 November 2026 · Version 2026-11-01-r2 · Free web application · notelyapp.com</p>
      <p style={{ font: '19px/1.65 Georgia,serif', color: 'var(--muted)', margin: '28px 0 38px' }}>Your notes are personal. This policy explains what Notely stores, what stays in your browser, and when information may be sent to service providers.</p>
      {sections.map(([title, body]) => <section key={title} style={{ padding: '18px 0', borderTop: '1px solid var(--line)' }}><h2 style={{ font: '500 20px Georgia,serif', margin: '0 0 9px' }}>{title}</h2><p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--muted)', margin: 0 }}>{body}</p></section>)}
      <p style={{ fontSize: 13, padding: '20px 0' }}>Privacy contact: <a href="mailto:privacy@notelyapp.com">privacy@notelyapp.com</a></p>
      <nav style={{ display: 'flex', gap: 20, paddingTop: 20, borderTop: '1px solid var(--line)', fontSize: 13 }}><a href="/terms">Terms of Service</a><a href="/">Notely home</a></nav>
    </main>
  )
}
