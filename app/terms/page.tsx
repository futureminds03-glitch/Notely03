import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of Service — Notely',
  description: 'Terms for using the free Notely note-taking web application.',
  alternates: { canonical: 'https://notelyapp.com/terms' },
}

const sections = [
  ['1. About Notely', 'Notely is a web-based note-taking and personal thinking workspace intended to be available at notelyapp.com. These terms apply when you access or use the service. If you do not agree, do not use Notely.'],
  ['2. Free service', 'Notely is currently free to use. There are no paid plans, subscriptions, in-app purchases or payment obligations at this time. If this changes, we will present the applicable price and terms before asking you to pay.'],
  ['3. Your account', 'You are responsible for keeping your sign-in credentials secure and for activity under your account. Provide an email address you control. You can export your account data and request account deletion from Account & Privacy.'],
  ['4. Your content', 'You retain your rights to the notes, links and other content you submit. You give Notely a limited permission to store, process, back up and display that content only as needed to operate, secure and improve the features you choose to use. This permission ends when the content is deleted, subject to limited backup and security-log retention by infrastructure providers.'],
  ['5. Optional AI tools', 'AI summaries, organization, link analysis and AI-assisted recall are optional and require an explicit choice before relevant content is sent to an AI provider. AI output can be incomplete, incorrect or misleading. Review it before relying on it. You are responsible for deciding whether to submit confidential, personal or sensitive material to an optional AI feature.'],
  ['6. Not professional or medical advice', 'Notely is a productivity and note-taking tool. It is not a medical device, mental-health service, diagnostic tool or substitute for professional medical, legal, financial or other advice. Focus timers, memory prompts and organizational suggestions are general-purpose features, not treatment or clinical recommendations.'],
  ['7. Acceptable use', 'Do not use Notely to break the law, infringe another person’s rights, distribute malware, attempt unauthorized access, interfere with the service, or submit content you are not entitled to use. Do not probe or bypass authentication, rate limits or security controls.'],
  ['8. Third-party services and links', 'Notely relies on third-party infrastructure for hosting, authentication and database services. Optional features may also use AI providers or browser speech-recognition services as described in the Privacy Policy. External websites you save or open are controlled by their respective operators.'],
  ['9. Availability and changes', 'Notely is provided free of charge and without a guaranteed uptime commitment. We may change, suspend or discontinue features to maintain or improve the service. We will take reasonable steps to avoid unnecessary loss of user content, but you should export important information and keep your own backups.'],
  ['10. Suspension and termination', 'We may restrict access where reasonably necessary to protect users, investigate abuse, comply with law or maintain service security. You may stop using Notely at any time and can delete your account through Account & Privacy.'],
  ['11. Disclaimers and liability', 'To the extent permitted by applicable law, Notely is provided “as is” and “as available”, without warranties that it will be uninterrupted, error-free or suitable for every purpose. Nothing in these terms excludes liability that cannot legally be excluded, including mandatory consumer rights or liability for fraud or intentional misconduct.'],
  ['12. Changes to these terms', 'We may update these terms when the product or its features change. Continued use after an updated version takes effect means you accept the updated terms, to the extent permitted by applicable law. The effective date will be shown on this page.'],
  ['13. Contact', 'Questions about these terms can be sent to legal@notelyapp.com. Privacy requests can be sent to privacy@notelyapp.com.'],
]

export default function TermsPage() {
  return (
    <main style={{ maxWidth: 780, margin: '0 auto', padding: '48px 22px 80px', color: 'var(--ink)' }}>
      <a href="/">← Back to Notely</a>
      <p style={{ marginTop: 36, letterSpacing: '.16em', fontSize: 10, color: 'var(--accent)' }}>NOTELY · TERMS</p>
      <h1 style={{ font: '500 clamp(38px,7vw,58px)/1.08 Georgia,serif', letterSpacing: '-.045em' }}>Terms of Service</h1>
      <p style={{ fontSize: 12, color: 'var(--muted)' }}>Effective 1 November 2026 · Free web application · notelyapp.com</p>
      <p style={{ font: '19px/1.65 Georgia,serif', color: 'var(--muted)', margin: '28px 0 38px' }}>Simple terms for a free product. Notely helps you capture and revisit your thoughts; you remain in control of your content.</p>
      {sections.map(([title, body]) => <section key={title} style={{ padding: '18px 0', borderTop: '1px solid var(--line)' }}><h2 style={{ font: '500 20px Georgia,serif', margin: '0 0 9px' }}>{title}</h2><p style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--muted)', margin: 0 }}>{body}</p></section>)}
      <nav style={{ display: 'flex', gap: 20, paddingTop: 20, borderTop: '1px solid var(--line)', fontSize: 13 }}><a href="/privacy">Privacy Policy</a><a href="/">Notely home</a></nav>
    </main>
  )
}
