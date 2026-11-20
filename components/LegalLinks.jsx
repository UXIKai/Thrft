import { useState } from 'react'
import { createPortal } from 'react-dom'
import './LegalLinks.css'

const COMPANY = 'Diaita Group Inc.'
const UPDATED = 'Last updated: January 1, 2025'

const DOCS = {
  terms: {
    title: 'Terms of Service',
    sections: [
      ['Agreement', `These Terms govern your use of Thrft at thrft.xyz, operated by ${COMPANY} ("we", "us"). By creating an account, signing in, or placing an order you agree to them. If you do not agree, do not use the service.`],
      ['Accounts', 'You must be at least 13 years old and provide accurate information. You are responsible for activity under your account and for keeping your credentials secure.'],
      ['Purchases and payment', 'Payments are processed by Stripe. Prices, shipping, and taxes are shown at checkout. Orders for printed Store products are produced on demand by our fulfillment partner and shipped to the address you provide.'],
      ['Market resale', 'Market listings are one-of-a-kind items sold by independent sellers. A listing is marked sold as soon as payment completes. Sellers are responsible for describing items accurately and shipping them promptly using the provided label.'],
      ['Creator content', 'You keep ownership of what you upload. You grant us a license to host, display, and reproduce it to operate the service and fulfil orders. You must have the rights to everything you upload and must not post unlawful, infringing, or harmful content.'],
      ['Shipping and returns', 'Made-to-order items can be returned or refunded only if they arrive damaged or defective. Contact us promptly after delivery. Market items are sold as described by the seller.'],
      ['Acceptable use', 'Do not abuse, harass, or defraud others, interfere with the service, or attempt to access it without authorization. We may suspend accounts that violate these Terms.'],
      ['Disclaimers and liability', `The service is provided "as is" without warranties. To the fullest extent permitted by law, ${COMPANY} is not liable for indirect or consequential damages, and our total liability is limited to the amount you paid us in the 12 months before the claim.`],
      ['Changes', 'We may update these Terms. Continued use after changes means you accept them.'],
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['Who we are', `${COMPANY} operates Thrft at thrft.xyz and is responsible for the personal information described here.`],
      ['What we collect', 'Account details (email, username, profile information), content you upload or post, messages, order and shipping details, and basic device and usage data.'],
      ['How we use it', 'To provide and secure the service, process payments and fulfil orders, show your profile and content, communicate with you, and prevent fraud and abuse.'],
      ['Sign in with Apple and Google', 'If you sign in with Apple or Google, we receive the basic profile information you approve (such as name and email, which may be a private relay address). We do not receive your password.'],
      ['Who we share it with', 'Service providers that help us run Thrft: Stripe (payments), Printful and Shippo/UPS (production and shipping), and Supabase (hosting and authentication). Shipping details are shared with sellers and carriers to deliver your order. We do not sell your personal information.'],
      ['Retention and your choices', 'We keep information while your account is active and as needed for legal, tax, and fraud-prevention purposes. You can edit your profile in Settings and ask us to delete your account and data.'],
      ['Security', 'We use industry-standard safeguards, but no system is completely secure.'],
      ['Children', 'Thrft is not directed to children under 13.'],
      ['Changes', 'We will post updates to this policy here.'],
    ],
  },
}

export default function LegalLinks({ className = '', prefix = '' }) {
  const [doc, setDoc] = useState(null)
  const open = doc ? DOCS[doc] : null
  return <>
    <p className={`legal-links ${className}`}>
      {prefix}{prefix ? ' ' : ''}
      <button type="button" className="is-bare" onClick={() => setDoc('terms')}>Terms of Service</button>
      {' · '}
      <button type="button" className="is-bare" onClick={() => setDoc('privacy')}>Privacy Policy</button>
    </p>
    {open && createPortal(<section className="legal-modal" role="dialog" aria-modal="true" aria-label={open.title}>
      <header className="legal-top">
        <button type="button" className="legal-back is-bare" aria-label="Close" onClick={() => setDoc(null)}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5.5 8.5 12 15 18.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1>{open.title}</h1>
        <span aria-hidden="true" className="legal-spacer" />
      </header>
      <div className="legal-body">
        <p className="legal-meta">{COMPANY} · thrft.xyz · {UPDATED}</p>
        {open.sections.map(([heading, text]) => <div key={heading}>
          <h2>{heading}</h2>
          <p>{text}</p>
        </div>)}
      </div>
    </section>, document.body)}
  </>
}
