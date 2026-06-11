// Official Vipps icon (app tile: orange rounded square + white smile), extracted
// verbatim from Vipps MobilePay's own site asset (vippsmobilepay.com
// _next/static/media/logo.*.svg, 2026-06-11) — NOT a recreation; brand rules
// forbid redrawing the logo. Colors are fixed by the brand (#FF5B24 tile, white
// mark) — never recolor. Size via className (square aspect).
interface VippsIconProps {
  className?: string;
}

const VippsIcon = ({ className = 'h-5 w-5' }: VippsIconProps) => (
  <svg
    className={className}
    role="img"
    aria-label="Vipps"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 32 32"
  >
    <title>Vipps</title>
    <rect width="32" height="32" rx="5.05263" fill="#FF5B24" />
    <path
      fill="#fff"
      d="M16.3059 20.4025C19.1802 20.4025 20.8115 19.0062 22.3652 16.9892C23.2197 15.9031 24.3073 15.6704 25.0841 16.291C25.861 16.9116 25.9386 18.0753 25.0841 19.1613C22.8313 22.1092 19.957 23.8934 16.3059 23.8934C12.344 23.8934 8.84827 21.7213 6.44008 17.9201C5.74093 16.9116 5.89629 15.8256 6.67313 15.2825C7.44996 14.7395 8.61522 14.9722 9.31437 16.0583C11.0234 18.6183 13.3539 20.4025 16.3059 20.4025ZM21.666 10.8607C21.666 12.2571 20.5785 13.188 19.3355 13.188C18.0926 13.188 17.005 12.2571 17.005 10.8607C17.005 9.46436 18.0926 8.53345 19.3355 8.53345C20.5785 8.53345 21.666 9.54193 21.666 10.8607Z"
    />
  </svg>
);

export default VippsIcon;
