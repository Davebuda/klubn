import { useRef, useMemo } from 'react';
import { useInView } from 'framer-motion';

/* ═══════════════════════════════════════════
   1. EQUALIZER DIVIDER
   Full-width animated bar visualizer with
   responsive bar count and glow backdrop
   ═══════════════════════════════════════════ */
export const EqualizerDivider = ({
  theme = 'orange',
  intensity = 'medium',
}: {
  theme?: 'orange' | 'magenta' | 'cool';
  intensity?: 'low' | 'medium' | 'high';
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });

  const barCount = 32;
  const bars = useMemo(
    () =>
      Array.from({ length: barCount }, (_, i) => {
        const center = barCount / 2;
        const dist = Math.abs(i - center) / center;
        const envelope = 1 - dist * dist; // parabolic — tallest in center
        return {
          id: i,
          maxH: 6 + envelope * 44, // 6–50px
          delay: Math.random() * 2.5,
          speed: 1 + Math.random() * 2,
        };
      }),
    [],
  );

  const themes = {
    orange: { bar: 'from-orange-500 to-orange-400/30', glow: 'rgba(255,107,53,0.12)', accent: 'bg-orange-500/20' },
    magenta: { bar: 'from-pink-500 to-purple-500/30', glow: 'rgba(236,72,153,0.10)', accent: 'bg-pink-500/20' },
    cool: { bar: 'from-cyan-400 to-blue-500/30', glow: 'rgba(34,211,238,0.08)', accent: 'bg-cyan-400/15' },
  };
  const t = themes[theme];

  const heights = { low: 0.5, medium: 0.75, high: 1 };
  const scale = heights[intensity];

  return (
    <div ref={ref} className="relative w-full py-8 md:py-10 overflow-hidden">
      {/* Glow backdrop */}
      <div
        className="absolute inset-0 blur-3xl opacity-60 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 100% at 50% 50%, ${t.glow}, transparent)`,
        }}
      />

      {/* Reflection line */}
      <div className={`absolute left-1/4 right-1/4 bottom-3 h-px ${t.accent} blur-sm`} />

      <div className="relative flex items-end justify-center gap-[2px] sm:gap-[3px] h-14 md:h-16">
        {bars.map((bar) => (
          <div
            key={bar.id}
            className={`rounded-full bg-gradient-to-t ${t.bar} flex-shrink-0`}
            style={{
              width: 'clamp(1.5px, 0.15vw, 3px)',
              height: inView ? `${bar.maxH * scale}px` : '2px',
              opacity: inView ? 1 : 0,
              transition: 'height 0.6s ease-out, opacity 0.4s ease-out',
              animation: inView
                ? `eq-pulse ${bar.speed}s ease-in-out ${bar.delay}s infinite alternate`
                : 'none',
              transformOrigin: 'bottom',
            }}
          />
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   2. SOUND WAVE DIVIDER
   Multi-layer sine wave with parallax depths
   and color theming
   ═══════════════════════════════════════════ */
export const SoundWaveDivider = ({
  theme = 'orange',
}: {
  theme?: 'orange' | 'white';
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });

  const id = useMemo(() => `wave-${Math.random().toString(36).slice(2, 8)}`, []);

  const colors =
    theme === 'orange'
      ? { main: 'rgba(255,107,53,0.55)', secondary: 'rgba(255,140,80,0.25)', bg: 'rgba(255,107,53,0.04)' }
      : { main: 'rgba(255,255,255,0.3)', secondary: 'rgba(255,255,255,0.1)', bg: 'rgba(255,255,255,0.02)' };

  return (
    <div ref={ref} className="relative w-full py-6 md:py-8 overflow-hidden">
      {/* Subtle horizontal glow behind the wave */}
      <div
        className="absolute inset-y-0 left-[10%] right-[10%] blur-2xl pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent, ${colors.bg}, transparent)` }}
      />

      <svg
        viewBox="0 0 1200 80"
        fill="none"
        preserveAspectRatio="none"
        className="relative w-full h-8 sm:h-10 md:h-12"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${id}-main`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="15%" stopColor={colors.main} />
            <stop offset="50%" stopColor={colors.main} />
            <stop offset="85%" stopColor={colors.main} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id={`${id}-sec`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="20%" stopColor={colors.secondary} />
            <stop offset="80%" stopColor={colors.secondary} />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        {/* Background wave — wider, slower */}
        <path
          d="M0,40 Q75,60 150,40 Q225,20 300,40 Q375,60 450,40 Q525,20 600,40 Q675,60 750,40 Q825,20 900,40 Q975,60 1050,40 Q1125,20 1200,40"
          stroke={`url(#${id}-sec)`}
          strokeWidth="1"
          strokeLinecap="round"
          style={{
            strokeDasharray: 2400,
            strokeDashoffset: inView ? 0 : 2400,
            transition: 'stroke-dashoffset 2s ease-out',
            animation: inView ? 'wave-flow 10s linear infinite' : 'none',
          }}
        />
        {/* Mid wave */}
        <path
          d="M0,40 Q50,15 100,40 Q150,65 200,40 Q250,15 300,40 Q350,65 400,40 Q450,15 500,40 Q550,65 600,40 Q650,15 700,40 Q750,65 800,40 Q850,15 900,40 Q950,65 1000,40 Q1050,15 1100,40 Q1150,65 1200,40"
          stroke={`url(#${id}-main)`}
          strokeWidth="1.5"
          strokeLinecap="round"
          style={{
            strokeDasharray: 2400,
            strokeDashoffset: inView ? 0 : 2400,
            transition: 'stroke-dashoffset 1.5s ease-out 0.2s',
            animation: inView ? 'wave-flow 6s linear infinite' : 'none',
          }}
        />
        {/* Tight wave — fastest, faintest */}
        <path
          d="M0,40 Q30,28 60,40 Q90,52 120,40 Q150,28 180,40 Q210,52 240,40 Q270,28 300,40 Q330,52 360,40 Q390,28 420,40 Q450,52 480,40 Q510,28 540,40 Q570,52 600,40 Q630,28 660,40 Q690,52 720,40 Q750,28 780,40 Q810,52 840,40 Q870,28 900,40 Q930,52 960,40 Q990,28 1020,40 Q1050,52 1080,40 Q1110,28 1140,40 Q1170,52 1200,40"
          stroke={`url(#${id}-sec)`}
          strokeWidth="0.8"
          strokeLinecap="round"
          style={{
            strokeDasharray: 2400,
            strokeDashoffset: inView ? 0 : 2400,
            transition: 'stroke-dashoffset 2.5s ease-out 0.5s',
            animation: inView ? 'wave-flow 4s linear infinite reverse' : 'none',
          }}
        />
      </svg>
    </div>
  );
};

/* ═══════════════════════════════════════════
   3. MARQUEE STRIP
   Infinite scrolling text with outlined +
   filled words, responsive sizing,
   and optional accent stripe
   ═══════════════════════════════════════════ */
export const MarqueeStrip = ({
  words = ['BASS', 'GROOVE', 'RHYTHM', 'DROP', 'BEAT', 'PULSE', 'FLOW', 'VIBE', 'ENERGY', 'SOUND'],
  speed = 30,
  variant = 'ghost',
}: {
  words?: string[];
  speed?: number;
  variant?: 'ghost' | 'outlined' | 'mixed';
}) => {
  const doubled = [...words, ...words];

  return (
    <div className="relative w-full overflow-hidden select-none py-8 md:py-10" aria-hidden="true">
      {/* Top & bottom edge lines */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.15] to-transparent" />

      <div
        className="flex whitespace-nowrap"
        style={{ animation: `marquee-scroll ${speed}s linear infinite` }}
      >
        {doubled.map((word, i) => {
          const isAccent = variant === 'mixed' && i % 3 === 0;
          return (
            <span key={`${word}-${i}`} className="flex items-center gap-3 sm:gap-4 md:gap-6">
              {variant === 'outlined' || (variant === 'mixed' && !isAccent) ? (
                <span
                  className="text-3xl sm:text-5xl md:text-7xl font-bold uppercase tracking-[0.08em] px-2 sm:px-4"
                  style={{
                    WebkitTextStroke: '1px rgba(255,255,255,0.22)',
                    color: 'transparent',
                  }}
                >
                  {word}
                </span>
              ) : (
                <span
                  className={`text-3xl sm:text-5xl md:text-7xl font-bold uppercase tracking-[0.08em] px-2 sm:px-4 ${
                    isAccent
                      ? 'bg-gradient-to-b from-orange-500/[0.25] to-orange-500/[0.10] bg-clip-text text-transparent'
                      : 'text-white/[0.12]'
                  }`}
                >
                  {word}
                </span>
              )}
              <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-orange-500/15 flex-shrink-0" />
            </span>
          );
        })}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════
   4. BEAT PULSE LINE
   Heartbeat / bass-drop monitor with
   glowing accent and responsive width
   ═══════════════════════════════════════════ */
export const BeatPulseLine = ({
  theme = 'orange',
}: {
  theme?: 'orange' | 'red';
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });
  const id = useMemo(() => `beat-${Math.random().toString(36).slice(2, 8)}`, []);

  const colors =
    theme === 'orange'
      ? { mid: 'rgba(255,107,53,0.6)', edge: 'rgba(255,107,53,0)', glow: 'rgba(255,107,53,0.15)' }
      : { mid: 'rgba(239,68,68,0.6)', edge: 'rgba(239,68,68,0)', glow: 'rgba(239,68,68,0.12)' };

  return (
    <div ref={ref} className="relative w-full py-6 md:py-8 overflow-hidden">
      {/* Glow spot behind the spikes */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-12 rounded-full blur-2xl pointer-events-none"
        style={{
          background: colors.glow,
          opacity: inView ? 1 : 0,
          transition: 'opacity 1s ease-out',
        }}
      />

      <svg
        viewBox="0 0 800 50"
        fill="none"
        className="relative w-full h-8 sm:h-10 md:h-12 max-w-5xl mx-auto"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${id}-g`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={colors.edge} />
            <stop offset="25%" stopColor={colors.mid} />
            <stop offset="50%" stopColor={colors.mid} />
            <stop offset="75%" stopColor={colors.mid} />
            <stop offset="100%" stopColor={colors.edge} />
          </linearGradient>
        </defs>

        {/* Baseline */}
        <line x1="0" y1="25" x2="800" y2="25" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />

        {/* Main beat trace — two spike clusters */}
        <path
          d="M0,25 L220,25 L250,25 L270,8 L285,42 L295,15 L308,35 L320,25 L380,25 L420,25 L440,6 L458,44 L468,12 L480,38 L495,20 L510,25 L800,25"
          stroke={`url(#${id}-g)`}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            strokeDasharray: 1000,
            strokeDashoffset: inView ? 0 : 1000,
            transition: 'stroke-dashoffset 1.8s ease-out',
            animation: inView ? 'beat-glow 3s ease-in-out infinite' : 'none',
          }}
        />

        {/* Ghost duplicate — offset for depth */}
        <path
          d="M0,25 L220,25 L250,25 L270,8 L285,42 L295,15 L308,35 L320,25 L380,25 L420,25 L440,6 L458,44 L468,12 L480,38 L495,20 L510,25 L800,25"
          stroke={`url(#${id}-g)`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.15"
          style={{
            filter: 'blur(4px)',
            strokeDasharray: 1000,
            strokeDashoffset: inView ? 0 : 1000,
            transition: 'stroke-dashoffset 1.8s ease-out',
          }}
        />
      </svg>
    </div>
  );
};

/* ═══════════════════════════════════════════
   5. VINYL SPINNER
   Spinning record with groove detail,
   responsive size, and color label
   ═══════════════════════════════════════════ */
export const VinylSpinner = ({
  size = 56,
  theme = 'orange',
}: {
  size?: number;
  theme?: 'orange' | 'magenta';
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });

  const label =
    theme === 'orange'
      ? { fill: 'rgba(255,107,53,0.15)', stroke: 'rgba(255,107,53,0.3)' }
      : { fill: 'rgba(236,72,153,0.15)', stroke: 'rgba(236,72,153,0.3)' };

  return (
    <div
      ref={ref}
      className="inline-flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 80 80"
        className="w-full h-full drop-shadow-[0_0_12px_rgba(255,107,53,0.1)]"
        style={{ animation: inView ? 'vinyl-spin 3s linear infinite' : 'none' }}
        aria-hidden="true"
      >
        {/* Disc body */}
        <circle cx="40" cy="40" r="39" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
        {/* Grooves — concentric rings */}
        {[34, 30, 26, 22].map((r) => (
          <circle key={r} cx="40" cy="40" r={r} stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" fill="none" />
        ))}
        {/* Sheen highlight arc */}
        <path d="M40,6 A34,34 0 0,1 74,40" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" fill="none" />
        {/* Label circle */}
        <circle cx="40" cy="40" r="15" fill={label.fill} stroke={label.stroke} strokeWidth="0.8" />
        {/* Label text arc — decorative */}
        <path d="M30,35 Q40,30 50,35" stroke="rgba(255,255,255,0.1)" strokeWidth="0.4" fill="none" />
        <path d="M32,40 Q40,44 48,40" stroke="rgba(255,255,255,0.08)" strokeWidth="0.4" fill="none" />
        {/* Spindle */}
        <circle cx="40" cy="40" r="3" fill="#09090b" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" />
      </svg>
    </div>
  );
};

/* ═══════════════════════════════════════════
   6. FREQUENCY SPECTRUM
   A wider, more detailed visualizer with
   grouped bar clusters — sits as a
   standalone section break
   ═══════════════════════════════════════════ */
export const FrequencySpectrum = ({
  theme = 'gradient',
  intensity = 'medium',
}: {
  theme?: 'gradient' | 'orange' | 'cool';
  intensity?: 'low' | 'medium' | 'high';
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-30px' });

  const scale = { low: 0.4, medium: 1, high: 1.3 }[intensity];
  const opacityMax = { low: 0.35, medium: 0.85, high: 1 }[intensity];

  const clusters = useMemo(() => {
    const c = [];
    for (let g = 0; g < 7; g++) {
      const barsInGroup = 5 + Math.floor(Math.random() * 4);
      const groupBars = [];
      for (let b = 0; b < barsInGroup; b++) {
        const pos = b / (barsInGroup - 1);
        const envelope = 1 - (2 * pos - 1) ** 2;
        groupBars.push({
          maxH: 8 + envelope * 52,
          delay: g * 0.3 + Math.random() * 0.8,
          speed: 0.8 + Math.random() * 1.8,
        });
      }
      c.push(groupBars);
    }
    return c;
  }, []);

  const barColors = {
    gradient: (gi: number) => {
      const hues = ['from-orange-500 to-yellow-500/30', 'from-pink-500 to-orange-500/30', 'from-purple-500 to-pink-500/30', 'from-blue-400 to-purple-500/30', 'from-cyan-400 to-blue-500/30', 'from-orange-400 to-red-500/30', 'from-yellow-400 to-orange-500/30'];
      return hues[gi % hues.length];
    },
    orange: () => 'from-orange-500 to-orange-400/30',
    cool: () => 'from-cyan-400 to-blue-500/30',
  };

  const pyClass = intensity === 'low' ? 'py-4 md:py-6' : 'py-10 md:py-14';
  const hClass = intensity === 'low' ? 'h-8 sm:h-10 md:h-12' : 'h-16 sm:h-20 md:h-24';

  return (
    <div ref={ref} className={`relative w-full ${pyClass} overflow-hidden`}>
      {/* Subtle ambient backdrop */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 80% 100% at 50% 80%, rgba(255,107,53,0.04), transparent)', opacity: scale }} />

      {/* Top rule */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

      <div className={`relative flex items-end justify-center gap-[6px] sm:gap-[8px] md:gap-[10px] ${hClass} px-4`}>
        {clusters.map((group, gi) => (
          <div key={gi} className="flex items-end gap-[2px] sm:gap-[3px]">
            {group.map((bar, bi) => (
              <div
                key={bi}
                className={`rounded-full bg-gradient-to-t ${barColors[theme](gi)}`}
                style={{
                  width: 'clamp(2px, 0.25vw, 4px)',
                  height: inView ? `${bar.maxH * scale}px` : '2px',
                  opacity: inView ? opacityMax : 0,
                  transition: `height 0.5s ease-out ${bar.delay * 0.15}s, opacity 0.4s ease-out`,
                  animation: inView ? `eq-pulse ${bar.speed}s ease-in-out ${bar.delay}s infinite alternate` : 'none',
                  transformOrigin: 'bottom',
                }}
              />
            ))}
          </div>
        ))}
      </div>

      {/* Bottom rule */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />
    </div>
  );
};
