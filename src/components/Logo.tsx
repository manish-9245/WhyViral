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

      {/* Question mark — filled path, scales cleanly at 16px+ */}
      <path
        d="M 22 18
           C 19 21, 18 27, 22 33
           C 25 37, 29 38, 30 39
           L 30 42
           C 30 42, 29 42, 29 44
           C 29 47, 30 49, 32 49
           C 34 49, 35 47, 35 44
           C 35 42, 34 42, 34 42
           L 34 39
           C 36 37, 39 36, 41 33
           C 46 27, 45 21, 42 18
           C 40 16, 37 14, 32 13
           C 28 12, 24 14, 22 18 Z"
        fill="url(#viralFlame)"
      />

      {/* Amber dot — the pin */}
      <circle cx="32" cy="52" r="3.6" fill="url(#viralFlame)" />

      {/* Viral sparks */}
      <circle cx="48" cy="12" r="1.4" fill="#fde68a" />
      <circle cx="52" cy="18" r="1" fill="#fbbf24" fillOpacity="0.7" />
      <circle cx="16" cy="14" r="1" fill="#fbbf24" fillOpacity="0.7" />

      {/* Thread to the wall */}
      <line
        x1="32"
        y1="52"
        x2="32"
        y2="57"
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
