import { useEffect, useState } from 'react'
import Accueil from './views/Accueil'
import Depenses from './views/Depenses'
import Calendrier from './views/Calendrier'
import Analyse from './views/Analyse'
import { supabase } from './lib/supabase'
import { monthRange } from './lib/dates'
import './index.css'

const today = new Date()
const pad = n => String(n).padStart(2, '0')
const current_month = `${today.getFullYear()}-${pad(today.getMonth() + 1)}`

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

export default function App() {
  const [view, set_view] = useState('accueil')
  const [month, set_month] = useState(current_month)
  const [filter, set_filter] = useState('tous')
  const [expenses, set_expenses] = useState([])
  const [loading, set_loading] = useState(true)

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
      case 'accueil': return <Accueil {...props} />
      case 'depenses': return <Depenses {...props} />
      case 'calendrier': return <Calendrier {...props} />
      case 'analyse': return <Analyse {...props} />
      default: return null
    }
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="header-title">💰 Budget</div>
          <div className="live-badge">
            <span className="live-dot" />
            Live
          </div>
        </div>
        <div className="month-nav">
          <button onClick={() => set_month(prev_month(month))}>‹</button>
          <span className="month-label">{month}</span>
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
    </div>
  )
}
