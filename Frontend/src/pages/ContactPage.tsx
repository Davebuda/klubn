import { useMutation } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Send, MessageSquare, Clock, Instagram, Facebook, Twitter, Music } from 'lucide-react';
import ContactForm from '../components/contact/ContactForm';
import { CREATE_CONTACT_MESSAGE } from '../graphql/queries';
import { useAuth } from '../context/AuthContext';
import { useSiteSettings } from '../context/SiteSettingsContext';
import PageSeo from '../components/common/PageSeo';
import { ScrollReveal } from '../components/effects/ScrollReveal';
import { isRealSocialUrl } from '../utils/social';

const ContactPage = () => {
  const { siteSettings } = useSiteSettings();
  const { user } = useAuth();
  const [createMessage, { loading }] = useMutation(CREATE_CONTACT_MESSAGE);

  const handleSubmit = async ({ email, message }: { email: string; message: string }) => {
    await createMessage({
      variables: {
        input: {
          userId: user?.id ?? email,
          message,
        },
      },
    });
  };

  const contactDetails = [
    { icon: Mail, label: 'Email', value: siteSettings.contactEmail || 'letsgoklubn@gmail.com', href: `mailto:${siteSettings.contactEmail || 'letsgoklubn@gmail.com'}` },
    { icon: Phone, label: 'Phone', value: siteSettings.contactPhone || 'N/A', href: siteSettings.contactPhone ? `tel:${siteSettings.contactPhone}` : undefined },
    { icon: MapPin, label: 'Location', value: siteSettings.contactAddress || 'Oslo, Norway', href: undefined },
    { icon: Clock, label: 'Response Time', value: 'Usually within 24 hours', href: undefined },
  ];

  const socialLinks = [
    { label: 'Instagram', url: siteSettings.instagramUrl, icon: Instagram },
    { label: 'Facebook', url: siteSettings.facebookUrl, icon: Facebook },
    { label: 'Twitter', url: siteSettings.twitterUrl, icon: Twitter },
    { label: 'TikTok', url: siteSettings.tikTokUrl, icon: Music },
    { label: 'YouTube', url: siteSettings.youTubeUrl, icon: Music },
    { label: 'SoundCloud', url: siteSettings.soundCloudUrl, icon: Music },
  ].filter((s) => isRealSocialUrl(s.url));

  return (
    <div className="min-h-screen text-white">
      <PageSeo
        title="Contact — Book KlubN & Get In Touch"
        description="Contact KlubN for bookings, DJ inquiries, venue partnerships, and general questions. Oslo's home for club culture."
        canonical="/contact"
      />
      {/* ═══ Hero ═══ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#5D1725]/20 via-transparent to-orange-950/15" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,107,53,0.08),transparent_55%)]" />

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10 py-20 lg:py-28">
          <div className="max-w-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-1 w-10 bg-gradient-to-r from-orange-400 to-transparent rounded-full" />
              <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-bold">Get in Touch</p>
            </div>
            <h1 className="font-display text-5xl lg:text-6xl font-black leading-tight tracking-tight">
              Let's{' '}
              <span className="bg-gradient-to-r from-orange-400 via-orange-300 to-[#FF6B35] bg-clip-text text-transparent">
                Connect
              </span>
            </h1>
            <p className="text-lg text-gray-400 leading-relaxed max-w-xl">
              Whether it's a booking inquiry, event collab, press request, or just good vibes — we'd love to hear from you.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ Main Grid ═══ */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-10">
          {/* ── Contact Form ── */}
          <ScrollReveal>
            <div className="liquid-glass rounded-[32px] border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.02] backdrop-blur-xl p-8 lg:p-10 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-[#FF6B35] flex items-center justify-center">
                  <Send className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Send a Message</h2>
                  <p className="text-xs text-gray-500">We'll get back to you as soon as possible</p>
                </div>
              </div>
              <ContactForm
                onSubmit={handleSubmit}
                submitting={loading}
                initialValues={{ email: user?.email || '' }}
              />
            </div>
          </ScrollReveal>

          {/* ── Sidebar ── */}
          <div className="space-y-6">
            {/* Contact Info Cards */}
            <ScrollReveal delay={0.1}>
              <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 space-y-4">
                <p className="text-[10px] uppercase tracking-[0.4em] text-orange-400 font-semibold">Contact Details</p>
                <div className="space-y-3">
                  {contactDetails.map((detail) => {
                    const Icon = detail.icon;
                    const content = (
                      <div className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/5 transition -mx-3">
                        <div className="w-9 h-9 rounded-lg bg-orange-500/15 border border-orange-400/20 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-[0.65rem] uppercase tracking-wider text-gray-500">{detail.label}</p>
                          <p className="text-sm font-medium text-white">{detail.value}</p>
                        </div>
                      </div>
                    );
                    return detail.href ? (
                      <a key={detail.label} href={detail.href} className="block">{content}</a>
                    ) : (
                      <div key={detail.label}>{content}</div>
                    );
                  })}
                </div>
              </div>
            </ScrollReveal>

            {/* Social Links */}
            {socialLinks.length > 0 && (
              <ScrollReveal delay={0.2}>
                <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 space-y-4">
                  <p className="text-[10px] uppercase tracking-[0.4em] text-orange-400 font-semibold">Follow Us</p>
                  <div className="grid grid-cols-2 gap-2">
                    {socialLinks.map((social) => {
                      const Icon = social.icon;
                      return (
                        <a
                          key={social.label}
                          href={social.url!}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.03] hover:border-orange-400/30 hover:bg-white/[0.06] transition-all"
                        >
                          <Icon className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-300">{social.label}</span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              </ScrollReveal>
            )}

            {/* Quick Links */}
            <ScrollReveal delay={0.3}>
              <div className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 space-y-4">
                <p className="text-[10px] uppercase tracking-[0.4em] text-orange-400 font-semibold">Quick Links</p>
                <div className="space-y-2">
                  {[
                    { label: 'Browse Events', to: '/events' },
                    { label: 'DJ Roster', to: '/djs' },
                    { label: 'Gallery', to: '/gallery' },
                    { label: 'Playlists', to: '/playlists' },
                  ].map((link) => (
                    <Link
                      key={link.label}
                      to={link.to}
                      className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/5 transition -mx-1"
                    >
                      <span className="text-sm text-gray-300 font-medium">{link.label}</span>
                      <span className="text-xs text-orange-400">→</span>
                    </Link>
                  ))}
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ═══ FAQ Section ═══ */}
      <section className="max-w-7xl mx-auto px-6 lg:px-10 pb-20">
        <ScrollReveal>
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-orange-400" />
              <p className="text-xs uppercase tracking-[0.5em] text-orange-400 font-semibold">Common Questions</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {[
                {
                  q: 'How do I book a DJ for my event?',
                  a: `Send us a message through the form above with your event details — date, venue, budget, and preferred genre. We'll connect you with the right artist.`,
                },
                {
                  q: 'Can I apply to be a resident DJ?',
                  a: `Yes! Head over to our DJ Roster page and click "Apply as a DJ". Submit your profile and we'll review your application.`,
                },
                {
                  q: 'How do ticket purchases work?',
                  a: `Browse events, select your show, and purchase tickets securely through our platform. You'll receive a digital ticket instantly.`,
                },
                {
                  q: 'Do you handle private events?',
                  a: `Absolutely. From intimate gatherings to large-scale productions — reach out with your vision and we'll make it happen.`,
                },
              ].map((faq) => (
                <div key={faq.q} className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 space-y-2">
                  <h3 className="text-base font-bold text-white">{faq.q}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </section>
    </div>
  );
};

export default ContactPage;
