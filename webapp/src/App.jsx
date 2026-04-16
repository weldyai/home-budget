import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { monthRange } from './lib/dates'
import ExpenseList from './components/ExpenseList'
import CategoryChart from './components/CategoryChart'
import MonthlyBar from './components/MonthlyBar'
import './index.css'

function getMonthRange(offset = 0) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().slice(0, 7)
}

export default function App() {
  const [offset, setOffset] = useState(0)
  const [tab, setTab] = useState('liste')
  const [stats, setStats] = useState({ total: 0, count: 0, top: '-' })

  const month = getMonthRange(offset)

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [month])

  async function fetchStats() {
    const { data } = await supabase
      .from('expenses')
      .select('amount, category')
      .gte('date', monthRange(month).from)
      .lte('date', monthRange(month).to)

    if (!data?.length) return setStats({ total: 0, count: 0, top: '-' })

    const total = data.reduce((s, r) => s + parseFloat(r.amount), 0)
    const cats = {}
    data.forEach(r => cats[r.category] = (cats[r.category] || 0) + parseFloat(r.amount))
    const top = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'
    setStats({ total, count: data.length, top })
  }

  const isCurrentMonth = offset === 0

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
          <h1>💰 Budget Famille</h1>
          <span className="live-badge">
            <span className="live-dot" />
            live
          </span>
        </div>
        <div className="header-row" style={{ marginTop: '.6rem' }}>
          <div className="month-nav">
            <button onClick={() => setOffset(o => o - 1)}>‹</button>
            <span className="month-label">{month}</span>
            <button onClick={() => setOffset(o => Math.min(o + 1, 0))} disabled={isCurrentMonth} style={{ opacity: isCurrentMonth ? .3 : 1 }}>›</button>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
            {stats.total.toFixed(0)} <span style={{ fontSize: '.8rem', color: 'var(--muted)' }}>MAD</span>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">Dépenses</span>
            <span className="stat-value blue">{stats.count}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Total</span>
            <span className="stat-value green">{stats.total.toFixed(0)}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Top</span>
            <span className="stat-value purple" style={{ fontSize: '.85rem' }}>{stats.top}</span>
          </div>
        </div>

        <div className="tabs">
          {['liste', 'catégories', 'historique'].map(t => (
            <button key={t} className={`tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'liste' ? '📋' : t === 'catégories' ? '🥧' : '📊'} {t}
            </button>
          ))}
        </div>

        {tab === 'liste' && <ExpenseList month={month} />}
        {tab === 'catégories' && <CategoryChart month={month} />}
        {tab === 'historique' && <MonthlyBar />}
      </main>
    </div>
  )
}
