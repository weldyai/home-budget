import { useEffect, useState } from 'react'
import Accueil from './views/Accueil'
import Depenses from './views/Depenses'
import Calendrier from './views/Calendrier'
import Analyse from './views/Analyse'
import { supabase } from './lib/supabase'
import { monthRange } from './lib/dates'
import './index.css'

const today_date = new Date()
const pad = n => String(n).padStart(2, '0')
const current_month = `${today_date.getFullYear()}-${pad(today_date.getMonth() + 1)}`

function prev_month(m) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

function next_month(m) {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

const MONTH_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']
const format_month = m => { const [y, mo] = m.split('-').map(Number); return `${MONTH_FR[mo - 1]} ${y}` }

// ── THEMES ─────────────────────────────────────────────────────────────────
const THEMES = [
  {
    id: 'nebula',
    name: 'Nebula',
    sub: 'Violet cosmique',
    accent: '#7B3FE4',
    accent2: '#9B6BFF',
    bg: '#06060F',
    card_grad: 'linear-gradient(145deg, #130D2A, #07070F)',
  },
  {
    id: 'arctic',
    name: 'Arctic',
    sub: 'Bleu océan profond',
    accent: '#0284C7',
    accent2: '#38BDF8',
    bg: '#04080F',
    card_grad: 'linear-gradient(145deg, #091D30, #04080F)',
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    sub: 'Noir & or',
    accent: '#C9A227',
    accent2: '#F0C040',
    bg: '#070707',
    card_grad: 'linear-gradient(145deg, #1A1406, #070707)',
  },
]

// ── NAV ICONS ───────────────────────────────────────────────────────────────
const VIEWS = [
  {
    id: 'accueil',
    label: 'Accueil',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    id: 'depenses',
    label: 'Dépenses',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
    ),
  },
  {
    id: 'calendrier',
    label: 'Calendrier',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    id: 'analyse',
    label: 'Analyse',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    ),
  },
]

// ── THEME PICKER MODAL ──────────────────────────────────────────────────────
function ThemePicker({ current, on_select, on_close }) {
  return (
    <div className="modal-overlay" onClick={on_close}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="modal-handle" />
        <div className="modal-title" style={{ marginBottom: '1rem' }}>Thème</div>
        <div className="theme-cards">
          {THEMES.map(t => (
            <div
              key={t.id}
              className={`theme-card${current === t.id ? ' active' : ''}`}
              style={{ background: t.card_grad, borderColor: current === t.id ? t.accent2 : 'rgba(255,255,255,0.06)' }}
              onClick={() => { on_select(t.id); on_close() }}
            >
              {current === t.id && (
                <div className="theme-check">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              )}
              {/* Mini preview */}
              <div className="theme-preview" style={{ background: t.bg }}>
                <div className="theme-preview-ring" style={{
                  background: `conic-gradient(${t.accent} 0% 65%, rgba(255,255,255,0.08) 65% 100%)`,
                  boxShadow: `0 0 10px ${t.accent}55`,
                }} />
              </div>
              <div>
                <div className="theme-name">{t.name}</div>
                <div className="theme-sub">{t.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── APP ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, set_view] = useState('accueil')
  const [month, set_month] = useState(current_month)
  const [filter, set_filter] = useState('tous')
  const [expenses, set_expenses] = useState([])
  const [loading, set_loading] = useState(true)
  const [theme, set_theme] = useState(() => localStorage.getItem('home_budget_theme') || 'nebula')
  const [theme_open, set_theme_open] = useState(false)

  const apply_theme = (t) => {
    set_theme(t)
    localStorage.setItem('home_budget_theme', t)
  }

  const fetch_data = async () => {
    const { from, to } = monthRange(month)
    let q = supabase.from('expenses').select('*').gte('date', from).lte('date', to)
    if (filter !== 'tous') q = q.eq('paid_by', filter)
    const { data } = await q
    set_expenses(data || [])
    set_loading(false)
  }

  useEffect(() => {
    set_loading(true)
    fetch_data()
    const interval = setInterval(fetch_data, 10000)
    return () => clearInterval(interval)
  }, [month, filter])

  const render_view = () => {
    const props = { month, filter, expenses, loading, refresh: fetch_data }
    switch (view) {
      case 'accueil':    return <Accueil {...props} />
      case 'depenses':   return <Depenses {...props} />
      case 'calendrier': return <Calendrier {...props} />
      case 'analyse':    return <Analyse {...props} />
      default:           return null
    }
  }

  return (
    <div className="app" data-theme={theme}>
      <header className="header">
        <div className="header-top">
          <div className="header-logo">
            <div className="header-logo-icon">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
              </svg>
            </div>
            <span className="header-title">Budget</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="live-badge">
              <span className="live-dot" />
              Live
            </div>
            <button className="theme-trigger" onClick={() => set_theme_open(true)} title="Changer de thème">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
        <div className="month-nav">
          <button onClick={() => set_month(prev_month(month))}>‹</button>
          <span className="month-label">{format_month(month)}</span>
          <button onClick={() => set_month(next_month(month))}>›</button>
        </div>
        <div className="filter-bar">
          {['tous', 'brahim', 'wife'].map(f => (
            <button
              key={f}
              className={`filter-pill${filter === f ? ' active' : ''}`}
              onClick={() => set_filter(f)}
            >
              {f === 'tous' ? 'Tous' : f === 'brahim' ? 'Moi' : 'Femme'}
            </button>
          ))}
        </div>
      </header>

      <main className="main-content">
        {render_view()}
      </main>

      <nav className="nav-bottom">
        {VIEWS.map(v => (
          <button
            key={v.id}
            className={`nav-btn${view === v.id ? ' active' : ''}`}
            onClick={() => set_view(v.id)}
          >
            {v.icon}
            {v.label}
          </button>
        ))}
      </nav>

      {theme_open && (
        <ThemePicker
          current={theme}
          on_select={apply_theme}
          on_close={() => set_theme_open(false)}
        />
      )}
    </div>
  )
}
