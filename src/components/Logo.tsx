export function Logo({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="WhyViral logo by Manish Tiwari"
      className={className}
    >
      <defs>
        <linearGradient id="viralFlame" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="55%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#fde68a" />
        </linearGradient>
        <linearGradient id="viralInk" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0a0a0b" />
          <stop offset="100%" stopColor="#1f1f23" />
        </linearGradient>
      </defs>

      {/* Rounded ink tile */}
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#viralInk)" />

      {/* Faint string-board lines */}
      <g stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1">
        <line x1="10" y1="14" x2="54" y2="14" />
        <line x1="10" y1="26" x2="54" y2="26" />
        <line x1="10" y1="38" x2="54" y2="38" />
        <line x1="10" y1="50" x2="54" y2="50" />
      </g>

      {/* Question mark stem shaped like a flame */}
      <path
        d="M 22 22 C 22 14, 30 10, 36 14 C 42 18, 42 26, 36 30 C 32 32, 30 34, 30 38 L 30 40"
        fill="none"
        stroke="url(#viralFlame)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Question mark dot — the amber pin */}
      <circle cx="30" cy="48" r="3.6" fill="url(#viralFlame)" />

      {/* Viral sparks */}
      <circle cx="46" cy="16" r="1.4" fill="#fde68a" />
      <circle cx="50" cy="22" r="1" fill="#fbbf24" fillOpacity="0.7" />
      <circle cx="18" cy="18" r="1" fill="#fbbf24" fillOpacity="0.7" />

      {/* Thread to the wall */}
      <line
        x1="30"
        y1="48"
        x2="30"
        y2="56"
        stroke="#f59e0b"
        strokeWidth="1.2"
        strokeDasharray="2 2"
        strokeOpacity="0.6"
      />
    </svg>
  );
}

export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return <Logo size={size} className={className} />;
}
