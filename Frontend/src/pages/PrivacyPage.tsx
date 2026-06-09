import { Link } from 'react-router-dom';
import PageSeo from '../components/common/PageSeo';

const LAST_UPDATED = '9 June 2026';

const PrivacyPage = () => {
  return (
    <div className="min-h-screen text-white">
      <PageSeo
        title="Privacy Policy — Klubn"
        description="How Klubn processes personal data when you browse events, buy tickets and manage your account. GDPR-compliant, data-minimising, EU/EEA hosted."
        canonical="/privacy"
      />

      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#5D1725]/20 via-transparent to-orange-950/15" />
        <div className="relative max-w-3xl mx-auto px-6 lg:px-10 py-16 lg:py-20 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-1 w-10 bg-gradient-to-r from-orange-400 to-transparent rounded-full" />
            <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-bold">Legal</p>
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Body */}
      <section className="max-w-3xl mx-auto px-6 lg:px-10 pb-24 space-y-8 text-[15px] leading-relaxed text-gray-300">
        <p>
          <strong className="text-white">Data controller:</strong> DJ DIP AV BUKENYA, org. nr 933&nbsp;809&nbsp;048,
          St. Edmunds Vei 39D, 0280 Oslo, Norway ·{' '}
          <a className="text-orange-300 hover:text-orange-200" href="mailto:tickets@klubn.no">tickets@klubn.no</a>.
          This policy explains how Klubn processes personal data when you use klubn.no to browse events, buy tickets,
          and manage your account.
        </p>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">1. What we collect</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Account data:</strong> your name and email if you create an account.</li>
            <li><strong>Ticket purchase data:</strong> the email you give at checkout, the event or ticket bought, the amount paid, and payment status.</li>
            <li><strong>Technical and security data:</strong> basic operational and security logs needed to run and protect the service.</li>
          </ul>
          <p>
            Klubn does not collect or store your card details, and does not request your phone number, address, or extra
            profile data from Vipps. Payment handling stays entirely with Vipps MobilePay.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">2. Why we use it (lawful basis)</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>To sell and deliver your ticket and provide entry to the event — performance of a contract with you (GDPR Article 6(1)(b)).</li>
            <li>To keep accounting records — legal obligation (GDPR Article 6(1)(c)).</li>
            <li>To secure and operate the service — legitimate interest (GDPR Article 6(1)(f)).</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">3. Who we share it with</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Vipps MobilePay</strong> (Norway/EEA) — to process your payment.</li>
            <li><strong>Webhuset</strong> (Norway/EEA) — email delivery of your ticket and confirmations.</li>
            <li><strong>Hetzner</strong> (EU/EEA) — secure hosting of klubn.no.</li>
          </ul>
          <p>
            Klubn does not sell personal data or share it for advertising. Tickets are not delivered via Instagram or
            other social direct messages. These providers process personal data only as needed for their role, under
            data processing agreements and appropriate safeguards.
          </p>
          <p>
            <strong className="text-white">Hosting &amp; location.</strong> klubn.no is hosted on servers located within
            the EU/EEA. Currently all our processors are located within the EU/EEA. If we later use a provider outside
            the EEA (for example an additional payment provider), we will rely on recognised safeguards such as the EU
            Standard Contractual Clauses or the EU-US Data Privacy Framework.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">4. Cookies and similar storage</h2>
          <p>
            Klubn uses only storage that is strictly necessary to operate the website and keep it secure. Specifically:
          </p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>a login session token, to keep you signed in;</li>
            <li>your shopping cart, to remember your selected tickets;</li>
            <li>offline/app cache and basic security state.</li>
          </ul>
          <p>
            These are required for the service you request and do not need consent. Klubn does not use analytics,
            advertising, or third-party tracking cookies, so no cookie consent banner is shown. If we introduce
            analytics in future, we will use a privacy-friendly, cookieless solution or ask for your consent first.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">5. How long we keep it</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong>Accounting-related data</strong> (amount paid, ticket type, purchase date): retained ~5 years where required for bookkeeping and legal obligations.</li>
            <li><strong>Name and email:</strong> normally anonymised about 30 days after the event, unless still needed for an active account, ongoing support case, dispute, or legal obligation.</li>
            <li><strong>Security logs:</strong> kept only as long as reasonably necessary for security and operational follow-up.</li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">6. Your rights</h2>
          <p>
            You can ask Klubn to provide access to your personal data, correct inaccurate data, delete data where
            possible, restrict processing in certain cases, object to processing, or receive a portable copy where
            applicable. Where Klubn must retain accounting records, the personal parts are anonymised where possible
            rather than deleted. You may also complain to the Norwegian Data Protection Authority (Datatilsynet).
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">7. Contact</h2>
          <p>
            Privacy questions or requests can be sent to{' '}
            <a className="text-orange-300 hover:text-orange-200" href="mailto:tickets@klubn.no">tickets@klubn.no</a>.
            Please also see the{' '}
            <Link className="text-orange-300 hover:text-orange-200" to="/terms">Terms of Sale</Link> for conditions
            related to ticket purchases.
          </p>
        </div>
      </section>
    </div>
  );
};

export default PrivacyPage;
