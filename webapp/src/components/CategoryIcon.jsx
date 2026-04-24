export const CATEGORY_CONFIG = {
  alimentation: { color: '#34D399', bg: 'rgba(52,211,153,0.14)' },
  restauration:  { color: '#FB923C', bg: 'rgba(251,146,60,0.14)'  },
  transport:     { color: '#60A5FA', bg: 'rgba(96,165,250,0.14)'  },
  logement:      { color: '#A78BFA', bg: 'rgba(167,139,250,0.14)' },
  sante:         { color: '#F87171', bg: 'rgba(248,113,113,0.14)' },
  loisirs:       { color: '#FBBF24', bg: 'rgba(251,191,36,0.14)'  },
  habillement:   { color: '#F472B6', bg: 'rgba(244,114,182,0.14)' },
  education:     { color: '#2DD4BF', bg: 'rgba(45,212,191,0.14)'  },
  services:      { color: '#818CF8', bg: 'rgba(129,140,248,0.14)' },
  autre:         { color: '#94A3B8', bg: 'rgba(148,163,184,0.14)' },
}

function IconPaths({ name }) {
  switch (name) {
    case 'alimentation': return <>
      <circle cx="9" cy="21" r="1"/>
      <circle cx="20" cy="21" r="1"/>
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
    </>
    case 'restauration': return <>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
      <path d="M7 2v20"/>
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3v7"/>
    </>
    case 'transport': return <>
      <rect x="2" y="9" width="20" height="8" rx="2"/>
      <path d="M16 9 14 3H10L8 9"/>
      <circle cx="6.5" cy="17" r="2"/>
      <circle cx="17.5" cy="17" r="2"/>
    </>
    case 'logement': return <>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </>
    case 'sante': return <>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </>
    case 'loisirs': return <>
      <rect x="2" y="2" width="20" height="20" rx="2.18"/>
      <line x1="7" y1="2" x2="7" y2="22"/>
      <line x1="17" y1="2" x2="17" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="2" y1="7" x2="7" y2="7"/>
      <line x1="2" y1="17" x2="7" y2="17"/>
      <line x1="17" y1="17" x2="22" y2="17"/>
      <line x1="17" y1="7" x2="22" y2="7"/>
    </>
    case 'habillement': return <>
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
    </>
    case 'education': return <>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
    </>
    case 'services': return <>
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
      <line x1="12" y1="18" x2="12.01" y2="18"/>
    </>
    default: return <>
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
    </>
  }
}

export function CategoryIcon({ category, size = 42 }) {
  const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.autre
  const iconSize = Math.round(size * 0.48)
  return (
    <div style={{
      width: size, height: size,
      borderRadius: Math.round(size * 0.3),
      background: cfg.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24"
           fill="none" stroke={cfg.color} strokeWidth="2"
           strokeLinecap="round" strokeLinejoin="round">
        <IconPaths name={category} />
      </svg>
    </div>
  )
}
