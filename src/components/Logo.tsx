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
        <linearGradient id="flameInner" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#fbbf24" />
          <stop offset="100%" stopColor="#fff7cc" />
        </linearGradient>
        <linearGradient id="viralInk" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#0a0a0b" />
          <stop offset="100%" stopColor="#1f1f23" />
        </linearGradient>
        <radialGradient id="glowQ" cx="0.5" cy="0.32" r="0.6">
          <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
        </radialGradient>
        <filter id="softGlow2" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
          <feOffset dx="0" dy="1.2" result="off" />
          <feFlood floodColor="#f59e0b" floodOpacity="0.35" />
          <feComposite in2="off" operator="in" result="shadow" />
          <feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Ink tile */}
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#viralInk)" />
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#glowQ)" />

      {/* Grid */}
      <g stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1">
        <line x1="10" y1="14" x2="54" y2="14" />
        <line x1="10" y1="26" x2="54" y2="26" />
        <line x1="10" y1="38" x2="54" y2="38" />
        <line x1="10" y1="50" x2="54" y2="50" />
      </g>

      {/* Flame cap */}
      <g transform="translate(32, 9.5)">
        <path d="M 0 -6 C -3.2 -1.2, -4.2 2.2, -2.2 5.2 C -0.8 3.4, 0.1 1.1, 0  -1.5 C 0.6 1.3, 1.6 3.4, 2.9 5.0 C 4.6 2.0, 4.0 -1.5, 0 -6 Z" fill="url(#viralFlame)" stroke="#fde68a" strokeWidth="0.35" strokeLinejoin="round" />
        <path d="M 0 -2.2 C -1.4 0, -1.7 1.6, -0.8 3.0 C -0.2 1.9, 0.15 0.6, 0  -0.6 C 0.3 0.7, 0.7 1.9, 1.2 2.8 C 1.9 1.4, 1.7 -0.2, 0 -2.2 Z" fill="url(#flameInner)" fillOpacity="0.95" />
      </g>

      {/* Proper "?" — traced from Arial Bold */}
      <path d="M34.89264010803511 38.811613774476704H28.694125590817016Q28.669817690749497 37.474679270763 28.669817690749497 37.182984469952736Q28.669817690749497 34.168804861580014 29.666441593517895 32.22417285617826Q30.663065496286293 30.279540850776502 33.652937204591495 27.84875084402431Q36.6428089128967 25.417960837272116 37.22619851451722 24.664415935178933Q38.125590817015535 23.473328831870358 38.125590817015535 22.039162727886566Q38.125590817015535 20.045914922349766 36.53342336259284 18.62390276839973Q34.941255908170156 17.2018906144497 32.24307900067522 17.2018906144497Q29.642133693450376 17.2018906144497 27.891964888588795 18.684672518568537Q26.141796083727215 20.167454422687374 25.48548278190412 23.20594193112762L19.21404456448346 22.428089128966917Q19.4814314652262 18.07697501688049 22.920999324780556 15.038487508440245Q26.36056718433491 12.0 31.951384199864957 12.0Q37.83389601620527 12.0 41.30992572586091 15.074949358541527Q44.78595543551654 18.149898717083055 44.78595543551654 22.23362592842674Q44.78595543551654 24.49426063470628 43.50979068197164 26.511816340310602Q42.23362592842674 28.529372045914922 38.05266711681297 32.00540175557056Q35.889264010803515 33.804186360567186 35.36664415935179 34.89804186360567Q34.84402430790007 35.99189736664416 34.89264010803511 38.811613774476704Z" fill="url(#viralFlame)" filter="url(#softGlow2)" />

      {/* Dot */}
      <circle cx="32.1" cy="44.2" r="3.9" fill="url(#viralFlame)" filter="url(#softGlow2)" />
      <circle cx="32.1" cy="44.2" r="1.35" fill="#fff7cc" fillOpacity="0.92" />

      {/* Sparks */}
      <circle cx="49.5" cy="11.2" r="1.35" fill="#fde68a" />
      <circle cx="52.2" cy="16.6" r="0.95" fill="#fbbf24" fillOpacity="0.85" />
      <circle cx="14.2" cy="13.0" r="0.9" fill="#fbbf24" fillOpacity="0.8" />
      <circle cx="17.4" cy="9.2" r="0.55" fill="#fff7cc" fillOpacity="0.9" />

      {/* Thread */}
      <line x1="32.1" y1="47.9" x2="32.1" y2="56.8" stroke="#f59e0b" strokeWidth="1.15" strokeDasharray="2 1.9" strokeLinecap="round" strokeOpacity="0.55" />
    </svg>
  );
}

export function LogoMark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return <Logo size={size} className={className} />;
}
