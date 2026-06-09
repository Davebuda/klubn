import { Link } from 'react-router-dom';
import PageSeo from '../components/common/PageSeo';

const LAST_UPDATED = '9 June 2026';

const TermsPage = () => {
  return (
    <div className="min-h-screen text-white">
      <PageSeo
        title="Terms of Sale — Klubn"
        description="Klubn terms of sale: payment, delivery, cancellation, refunds and your consumer rights for event tickets in Norway."
        canonical="/terms"
      />

      {/* Header */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#5D1725]/20 via-transparent to-orange-950/15" />
        <div className="relative max-w-3xl mx-auto px-6 lg:px-10 py-16 lg:py-20 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-1 w-10 bg-gradient-to-r from-orange-400 to-transparent rounded-full" />
            <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-bold">Legal</p>
          </div>
          <h1 className="font-display text-4xl lg:text-5xl font-black tracking-tight">Terms of Sale</h1>
          <p className="text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Body */}
      <section className="max-w-3xl mx-auto px-6 lg:px-10 pb-24 space-y-8 text-[15px] leading-relaxed text-gray-300">
        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">1. Parties</h2>
          <p>
            The seller is <strong>DJ DIP AV BUKENYA</strong> (&ldquo;Klubn&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;),
            organisation number 933&nbsp;809&nbsp;048, registered address St. Edmunds Vei 39D, 0280 Oslo, Norway,
            email <a className="text-orange-300 hover:text-orange-200" href="mailto:tickets@klubn.no">tickets@klubn.no</a>,
            phone +47&nbsp;967&nbsp;36&nbsp;112. The buyer is the consumer who places an order through klubn.no
            (&ldquo;you&rdquo;). All events and tickets are sold by Klubn as the seller and merchant of record.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">2. Payment</h2>
          <p>
            Prices are shown in Norwegian kroner (NOK) and include 12% VAT on event tickets. Payment is made at
            checkout via Vipps MobilePay. You are charged when your order is confirmed, and the ticket is issued only
            after payment is completed successfully. The price shown at checkout is the total price you pay for the
            ticket before confirming payment, including any applicable fees.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">3. Delivery</h2>
          <p>
            Tickets are digital. After successful payment, your ticket (with a QR code) is delivered to the email
            address you provide at checkout and is also available in your account under &ldquo;My tickets&rdquo;.
            Present the QR code at the venue for entry. If you do not receive your ticket, contact{' '}
            <a className="text-orange-300 hover:text-orange-200" href="mailto:tickets@klubn.no">tickets@klubn.no</a>.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">4. Right of withdrawal (angrerett)</h2>
          <p>
            Under the Norwegian Right of Withdrawal Act (angrerettloven § 22 letter m), the 14-day right of withdrawal
            does not apply to tickets for events tied to a specific date or time. A ticket purchase is therefore
            binding once payment is completed.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">5. Cancellation and changes</h2>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Tickets are personal and valid only for the named event, date and time.</li>
            <li>Unless a transfer feature is clearly offered through Klubn, tickets may not be resold or transferred.</li>
            <li>
              Purchased tickets cannot be cancelled, changed or refunded by the buyer, except where required by law or
              where the event is cancelled or rescheduled (see section 6).
            </li>
            <li>
              If Klubn cancels or reschedules an event, you are entitled to a full refund to your original payment
              method, or a valid ticket for the new date where such an option is offered.
            </li>
          </ul>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">6. Returns and refunds</h2>
          <p>
            As tickets are digital and event-bound, ordinary returns do not apply. Refunds are issued only where an
            event is cancelled or rescheduled, where required by law, or where Klubn chooses to offer a refund as a
            goodwill gesture. Approved refunds are made via the original payment method used at checkout.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">7. Complaints handling (reklamasjon)</h2>
          <p>
            If something is wrong with your order or ticket, contact us at{' '}
            <a className="text-orange-300 hover:text-orange-200" href="mailto:tickets@klubn.no">tickets@klubn.no</a> or
            +47&nbsp;967&nbsp;36&nbsp;112. We aim to respond within 5 business days. You may complain about defects under
            the Consumer Purchases Act (forbrukerkjøpsloven).
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">8. Conflict resolution</h2>
          <p>
            If a dispute cannot be resolved directly, you may bring it to the Norwegian Consumer Authority
            (Forbrukertilsynet) or the Consumer Council (Forbrukerrådet) for mediation. Consumers in the EU/EEA may also
            use the EU ODR platform where applicable. Disputes are governed by Norwegian law.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-lg font-bold text-white">9. Privacy</h2>
          <p>
            Klubn processes the minimum personal data needed to sell and deliver your ticket, such as your name, email,
            order details, and payment status. Klubn does not receive your card details or extra profile data from
            Vipps. See our{' '}
            <Link className="text-orange-300 hover:text-orange-200" to="/privacy">Privacy Policy</Link> for more
            information.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm text-gray-400">
          <p className="text-white font-semibold">Klubn — DJ DIP AV BUKENYA</p>
          <p>Org. nr: 933 809 048</p>
          <p>St. Edmunds Vei 39D, 0280 Oslo, Norway</p>
          <p>
            <a className="text-orange-300 hover:text-orange-200" href="mailto:tickets@klubn.no">tickets@klubn.no</a>
            {' · '}+47 967 36 112
          </p>
        </div>
      </section>
    </div>
  );
};

export default TermsPage;
