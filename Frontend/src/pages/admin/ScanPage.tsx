import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation } from '@apollo/client';
import { Link } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { CheckCircle2, XCircle, Camera, Keyboard, Minus, Plus, ScanLine } from 'lucide-react';
import { REDEEM_TICKET } from '../../graphql/ticketing';
import PageSeo from '../../components/common/PageSeo';

// Door-scan console ("bouncer console"): full-dark UI, verdicts sized to be read
// at arm's length in a dark doorway. Admin/CoAdmin-gated by the /scan route.
// Camera scanning via html5-qrcode with a manual-paste fallback for desktops
// without a webcam or when the camera is denied.

type Verdict =
  | { kind: 'admit'; ticketNumber: string; eventTitle: string; holderName?: string | null; admittedNow: number; admitsRemaining: number }
  | { kind: 'deny'; reason: string };

const READER_ID = 'qr-reader-viewport';

const ScanPage = () => {
  const [mode, setMode] = useState<'camera' | 'manual'>('camera');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  // null = redeem ALL remaining admits in one scan (the default door behavior);
  // a number = wave entry for group tickets ("2 of the table arrived").
  const [admits, setAdmits] = useState<number | null>(null);
  const [manualToken, setManualToken] = useState('');

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const busyRef = useRef(false);

  const [redeemTicket] = useMutation(REDEEM_TICKET);

  const redeem = useCallback(
    async (token: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const { data } = await redeemTicket({
          variables: { token: token.trim(), admits },
        });
        const r = data?.redeemTicket;
        setVerdict({
          kind: 'admit',
          ticketNumber: r.ticketNumber,
          eventTitle: r.eventTitle,
          holderName: r.holderName,
          admittedNow: r.admittedNow,
          admitsRemaining: r.admitsRemaining,
        });
      } catch (err) {
        setVerdict({
          kind: 'deny',
          reason: err instanceof Error ? err.message : 'Could not validate the ticket.',
        });
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [redeemTicket, admits],
  );

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    setScanning(false);
    if (s) {
      try {
        await s.stop();
        s.clear();
      } catch {
        // already stopped — fine
      }
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (scannerRef.current) return;
    setCameraError(null);
    try {
      const scanner = new Html5Qrcode(READER_ID);
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decoded) => {
          // One verdict per scan: freeze the camera, redeem, show the result.
          void stopScanner().then(() => redeem(decoded));
        },
        () => {
          /* per-frame decode misses are expected noise */
        },
      );
      setScanning(true);
    } catch (err) {
      scannerRef.current = null;
      setCameraError(
        err instanceof Error && /NotAllowed|Permission/i.test(err.message)
          ? 'Camera permission denied — allow camera access or use manual entry.'
          : 'No usable camera found — use manual entry.',
      );
      setMode('manual');
    }
  }, [redeem, stopScanner]);

  // Start/stop the camera with the mode; always release it on unmount.
  useEffect(() => {
    if (mode === 'camera' && !verdict) void startScanner();
    return () => {
      void stopScanner();
    };
  }, [mode, verdict, startScanner, stopScanner]);

  const nextScan = () => {
    setVerdict(null);
    setManualToken('');
    // camera restarts via the effect when verdict clears
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <PageSeo title="Door Scan — KlubN" description="KlubN door staff ticket scanner." canonical="/scan" />

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <ScanLine className="w-5 h-5 text-orange-400" aria-hidden="true" />
          <h1 className="text-sm font-black uppercase tracking-[0.4em]">Door Scan</h1>
        </div>
        <Link to="/admin" className="text-xs uppercase tracking-[0.3em] text-gray-400 hover:text-orange-300 transition">
          Exit
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-6 gap-6 max-w-md w-full mx-auto">
        {verdict ? (
          /* ── VERDICT ── */
          verdict.kind === 'admit' ? (
            <div
              role="status"
              className="w-full rounded-[28px] bg-green-500/15 border-2 border-green-400 px-6 py-10 text-center space-y-4"
            >
              <CheckCircle2 className="w-20 h-20 text-green-400 mx-auto" aria-hidden="true" />
              <p className="text-4xl font-black tracking-tight text-green-300">
                ADMIT {verdict.admittedNow > 1 ? verdict.admittedNow : ''}
              </p>
              <div className="space-y-1 text-sm">
                {verdict.holderName && <p className="text-xl font-semibold text-white">{verdict.holderName}</p>}
                <p className="text-gray-300">{verdict.eventTitle}</p>
                <p className="font-mono text-xs text-gray-500">{verdict.ticketNumber}</p>
              </div>
              {verdict.admitsRemaining > 0 ? (
                <p className="inline-block px-4 py-2 rounded-full bg-amber-400/15 border border-amber-400/40 text-amber-300 text-sm font-bold">
                  {verdict.admitsRemaining} admit{verdict.admitsRemaining === 1 ? '' : 's'} still on this ticket
                </p>
              ) : (
                <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Ticket fully redeemed</p>
              )}
            </div>
          ) : (
            <div
              role="alert"
              className="w-full rounded-[28px] bg-red-500/15 border-2 border-red-500 px-6 py-10 text-center space-y-4"
            >
              <XCircle className="w-20 h-20 text-red-400 mx-auto" aria-hidden="true" />
              <p className="text-4xl font-black tracking-tight text-red-300">DENIED</p>
              <p className="text-base text-white">{verdict.reason}</p>
            </div>
          )
        ) : mode === 'camera' ? (
          /* ── CAMERA ── */
          <div className="w-full space-y-3">
            <div
              id={READER_ID}
              className="w-full overflow-hidden rounded-[28px] border border-white/15 bg-white/[0.03] min-h-[280px]"
            />
            <p className="text-center text-xs uppercase tracking-[0.35em] text-gray-500">
              {scanning ? 'Point at the ticket QR' : 'Starting camera…'}
            </p>
          </div>
        ) : (
          /* ── MANUAL ── */
          <div className="w-full space-y-3">
            {cameraError && (
              <p className="text-xs text-amber-300 bg-amber-400/10 border border-amber-400/25 rounded-xl px-4 py-3">
                {cameraError}
              </p>
            )}
            <label htmlFor="manual-token" className="block text-xs uppercase tracking-[0.35em] text-gray-400">
              Paste ticket token
            </label>
            <textarea
              id="manual-token"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              rows={4}
              placeholder="eyJ0Ijoi…"
              className="w-full rounded-2xl bg-white/[0.05] border border-white/15 px-4 py-3 font-mono text-sm text-white placeholder-gray-600 focus:border-orange-400 focus:outline-none"
            />
            <button
              type="button"
              disabled={busy || !manualToken.trim()}
              onClick={() => redeem(manualToken)}
              className="w-full py-4 rounded-full bg-gradient-to-r from-orange-400 to-[#FF6B35] text-black text-base font-black uppercase tracking-[0.2em] disabled:opacity-50 hover:from-orange-300 hover:to-orange-400 transition-all"
            >
              {busy ? 'Checking…' : 'Validate'}
            </button>
          </div>
        )}

        {/* ── Admits control (wave entry for group tickets) ── */}
        {!verdict && (
          <div className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Admit</p>
              <p className="text-sm text-gray-500">
                {admits === null ? 'Whole ticket in one scan' : 'Part of a group ticket'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Fewer admits"
                onClick={() => setAdmits((a) => (a === null ? 1 : Math.max(1, a - 1)))}
                className="w-11 h-11 rounded-full border border-white/20 flex items-center justify-center hover:border-orange-400 transition"
              >
                <Minus className="w-4 h-4" aria-hidden="true" />
              </button>
              <span className="min-w-[3.5rem] text-center text-xl font-black">
                {admits === null ? 'ALL' : admits}
              </span>
              <button
                type="button"
                aria-label="More admits"
                onClick={() => setAdmits((a) => (a === null ? 1 : a + 1))}
                className="w-11 h-11 rounded-full border border-white/20 flex items-center justify-center hover:border-orange-400 transition"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>
              {admits !== null && (
                <button
                  type="button"
                  onClick={() => setAdmits(null)}
                  className="ml-1 text-xs uppercase tracking-[0.2em] text-orange-300 underline"
                >
                  All
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Footer actions */}
      <footer className="px-5 pb-8 max-w-md w-full mx-auto space-y-3">
        {verdict ? (
          <button
            type="button"
            onClick={nextScan}
            className="w-full py-4 rounded-full bg-white text-black text-base font-black uppercase tracking-[0.2em] hover:bg-gray-200 transition"
          >
            Scan next
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setCameraError(null);
              setMode((m) => (m === 'camera' ? 'manual' : 'camera'));
            }}
            className="w-full py-3 rounded-full border border-white/20 text-sm uppercase tracking-[0.3em] text-gray-300 hover:border-orange-400 transition inline-flex items-center justify-center gap-2"
          >
            {mode === 'camera' ? (
              <>
                <Keyboard className="w-4 h-4" aria-hidden="true" /> Manual entry
              </>
            ) : (
              <>
                <Camera className="w-4 h-4" aria-hidden="true" /> Use camera
              </>
            )}
          </button>
        )}
      </footer>
    </div>
  );
};

export default ScanPage;
