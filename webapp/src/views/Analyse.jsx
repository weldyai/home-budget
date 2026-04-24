import { useEffect, useRef, useState } from 'react'
import { Chart, BarElement, CategoryScale, LinearScale, Tooltip, BarController } from 'chart.js'
import { supabase } from '../lib/supabase'
import { monthRange } from '../lib/dates'
import { CATEGORY_CONFIG } from '../components/CategoryIcon'

Chart.register(BarElement, CategoryScale, LinearScale, Tooltip, BarController)

const DEFAULT_BUDGET = 5000
const BUDGET_KEY = 'home_budget_monthly'
const CATEGORIES = Object.keys(CATEGORY_CONFIG)
const COLORS = Object.values(CATEGORY_CONFIG).map(c => c.color)

const fmt = n => new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(Number(n))

function prev_months(month, n) {
  const months = []
  let [y, m] = month.split('-').map(Number)
  for (let i = 0; i < n; i++) {
    const d = new Date(y, m - 1 - i, 1)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    months.unshift(`${d.getFullYear()}-${mm}`)
  }
  return months
}

export default function Analyse({ month, filter, expenses, loading: expenses_loading }) {
  const [history, set_history] = useState([])
  const [loading, set_loading] = useState(true)
  const budget = Number(localStorage.getItem(BUDGET_KEY)) || DEFAULT_BUDGET
  const bar_ref = useRef(null)
  const bar_instance = useRef(null)

  useEffect(() => {
    set_loading(true)
    const fetch_history = async () => {
      const months_list = prev_months(month, 4)
      const hist = await Promise.all(months_list.map(async m => {
        const { from: f, to: t } = monthRange(m)
        let hq = supabase.from('expenses').select('amount').gte('date', f).lte('date', t)
        if (filter !== 'tous') hq = hq.eq('paid_by', filter)
        const { data } = await hq
        return { month: m, total: (data || []).reduce((s, e) => s + Number(e.amount), 0) }
      }))
      set_history(hist)
      set_loading(false)
    }
    fetch_history()
  }, [month, filter])

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const by_cat = CATEGORIES.map((cat, i) => ({
    cat,
    sum: expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
    color: COLORS[i],
  })).filter(x => x.sum > 0).sort((a, b) => b.sum - a.sum)

  const brahim_total = expenses.filter(e => e.paid_by === 'brahim').reduce((s, e) => s + Number(e.amount), 0)
  const wife_total = expenses.filter(e => e.paid_by === 'wife').reduce((s, e) => s + Number(e.amount), 0)

  useEffect(() => {
    if (!bar_ref.current || history.length === 0) return
    if (bar_instance.current) bar_instance.current.destroy()
    bar_instance.current = new Chart(bar_ref.current, {
      type: 'bar',
      data: {
        labels: history.map(h => h.month.slice(5)),
        datasets: [{
          data: history.map(h => h.total),
          backgroundColor: history.map(h => h.month === month ? '#7B3FE4' : '#1A1A30'),
          borderRadius: 7,
          borderSkipped: false,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)} MAD` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#525A80' }, border: { display: false } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#525A80', callback: v => fmt(v) }, border: { display: false } },
        },
      },
    })
    return () => { if (bar_instance.current) bar_instance.current.destroy() }
  }, [history.map(h => h.month + h.total).join(), month])

  if (expenses_loading || loading) return <div className="loading" />

  const avg_history = history.length > 0 ? history.reduce((s, h) => s + h.total, 0) / history.length : 0

  return (
    <>
      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Moi</span>
          <span className="stat-value blue">{fmt(brahim_total)}<br /><small style={{ fontSize: '0.6rem', fontWeight: 500, WebkitTextFillColor: 'inherit' }}>MAD</small></span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Femme</span>
          <span className="stat-value">{fmt(wife_total)}<br /><small style={{ fontSize: '0.6rem', fontWeight: 500 }}>MAD</small></span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Moyenne</span>
          <span className={`stat-value ${avg_history <= budget ? 'green' : 'red'}`}>
            {fmt(avg_history)}<br /><small style={{ fontSize: '0.6rem', fontWeight: 500, WebkitTextFillColor: 'inherit' }}>MAD</small>
          </span>
        </div>
      </div>

      {history.length > 0 && (
        <div className="card">
          <div className="card-title">Évolution 4 mois</div>
          <div className="chart-wrap" style={{ height: 155 }}>
            <canvas ref={bar_ref} />
          </div>
        </div>
      )}

      {by_cat.length > 0 && (
        <div className="card">
          <div className="card-title">Répartition par catégorie</div>
          {by_cat.map(x => (
            <div key={x.cat} className="hbar-wrap">
              <div className="hbar-label">
                <span className="hbar-name" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: x.color, display: 'inline-block', flexShrink: 0 }} />
                  {x.cat}
                </span>
                <span className="hbar-val">{fmt(x.sum)} MAD · {total > 0 ? ((x.sum / total) * 100).toFixed(0) : 0}%</span>
              </div>
              <div className="hbar-track">
                <div className="hbar-fill" style={{ width: `${total > 0 ? (x.sum / total) * 100 : 0}%`, background: x.color }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {filter === 'tous' && total > 0 && (
        <div className="card">
          <div className="card-title">Répartition Moi / Femme</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="stat-card" style={{ flex: 1 }}>
              <span className="stat-label">Moi</span>
              <span className="stat-value blue">{total > 0 ? ((brahim_total / total) * 100).toFixed(0) : 0}%</span>
            </div>
            <div className="stat-card" style={{ flex: 1 }}>
              <span className="stat-label">Femme</span>
              <span className="stat-value">{total > 0 ? ((wife_total / total) * 100).toFixed(0) : 0}%</span>
            </div>
          </div>
        </div>
      )}

      {expenses.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </div>
          <div className="empty-state-text">Pas de données ce mois</div>
        </div>
      )}
    </>
  )
}
