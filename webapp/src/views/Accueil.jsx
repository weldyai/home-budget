import { useEffect, useRef, useState } from 'react'
import { Chart, ArcElement, Tooltip, Legend, DoughnutController } from 'chart.js'

Chart.register(ArcElement, Tooltip, Legend, DoughnutController)

const DEFAULT_BUDGET = 5000
const BUDGET_KEY = 'home_budget_monthly'

const ICONS = {
  alimentation: { emoji: '🛒', bg: '#14532d' },
  restauration: { emoji: '🍽️', bg: '#7c2d12' },
  transport:    { emoji: '🚗', bg: '#1e3a5f' },
  logement:     { emoji: '🏠', bg: '#3b1f6e' },
  sante:        { emoji: '💊', bg: '#7f1d1d' },
  loisirs:      { emoji: '🎬', bg: '#713f12' },
  habillement:  { emoji: '👗', bg: '#831843' },
  education:    { emoji: '📚', bg: '#064e3b' },
  services:     { emoji: '📱', bg: '#1e3a5f' },
  autre:        { emoji: '💰', bg: '#1e293b' },
}

const COLORS = ['#3b82f6','#f97316','#22c55e','#a855f7','#ef4444','#eab308','#ec4899','#14b8a6','#64748b','#94a3b8']
const CATEGORIES = ['alimentation','restauration','transport','logement','sante','loisirs','habillement','education','services','autre']

export default function Accueil({ expenses, loading }) {
  const [budget, set_budget] = useState(() => Number(localStorage.getItem(BUDGET_KEY)) || DEFAULT_BUDGET)
  const [editing_budget, set_editing_budget] = useState(false)
  const [budget_input, set_budget_input] = useState('')
  const chart_ref = useRef(null)
  const chart_instance = useRef(null)

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0)
  const nb = expenses.length
  const savings = budget - total
  const pct = Math.min((total / budget) * 100, 100)

  const by_cat = CATEGORIES.map(cat => ({
    cat,
    sum: expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
  })).filter(x => x.sum > 0).sort((a, b) => b.sum - a.sum)

  const top3 = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount)).slice(0, 3)

  useEffect(() => {
    if (!chart_ref.current || by_cat.length === 0) return
    if (chart_instance.current) chart_instance.current.destroy()

    chart_instance.current = new Chart(chart_ref.current, {
      type: 'doughnut',
      data: {
        labels: by_cat.map(x => x.cat),
        datasets: [{
          data: by_cat.map(x => x.sum),
          backgroundColor: COLORS.slice(0, by_cat.length),
          borderWidth: 0,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.raw.toFixed(0)} MAD`,
            },
          },
        },
      },
    })

    return () => { if (chart_instance.current) chart_instance.current.destroy() }
  }, [by_cat.map(x => x.cat + x.sum).join()])

  if (loading) return <div className="loading">Chargement…</div>

  const progress_color = pct < 60 ? 'var(--green)' : pct < 85 ? 'var(--orange)' : 'var(--red)'

  return (
    <>
<div className="stats-row">
        <div className="stat-card">
          <span className="stat-label">Total</span>
          <span className="stat-value blue">{total.toFixed(0)}<br /><small style={{fontSize:'0.6rem',fontWeight:500}}>MAD</small></span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Dépenses</span>
          <span className="stat-value">{nb}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Économies</span>
          <span className={`stat-value ${savings >= 0 ? 'green' : 'red'}`}>
            {savings.toFixed(0)}<br /><small style={{fontSize:'0.6rem',fontWeight:500}}>MAD</small>
          </span>
        </div>
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div className="card-title" style={{ margin: 0 }}>Budget mensuel</div>
          <button className="icon-btn" style={{ fontSize: '0.8rem', padding: '4px 8px' }} onClick={() => { set_budget_input(String(budget)); set_editing_budget(true) }}>✏️</button>
        </div>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${pct}%`, background: progress_color }} />
        </div>
        <div className="progress-label">
          <span>{total.toFixed(0)} MAD</span>
          <span>{pct.toFixed(0)}% de {budget} MAD</span>
        </div>
      </div>

      {editing_budget && (
        <div className="modal-overlay" onClick={() => set_editing_budget(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Budget mensuel</div>
            <div className="form-group">
              <label className="form-label">Montant (MAD)</label>
              <input className="form-input" type="number" min="0" value={budget_input} onChange={e => set_budget_input(e.target.value)} autoFocus />
            </div>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => set_editing_budget(false)}>Annuler</button>
              <button className="btn btn-primary" onClick={() => {
                const val = Number(budget_input)
                if (val > 0) { set_budget(val); localStorage.setItem(BUDGET_KEY, val) }
                set_editing_budget(false)
              }}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}

      {by_cat.length > 0 && (
        <div className="card">
          <div className="card-title">Par catégorie</div>
          <div className="donut-wrap">
            <canvas ref={chart_ref} />
          </div>
          <ul className="legend-list">
            {by_cat.map((x, i) => (
              <li key={x.cat} className="legend-item">
                <span className="legend-dot" style={{ background: COLORS[i] }} />
                <span className="legend-label">{x.cat}</span>
                <span className="legend-val">{x.sum.toFixed(0)} MAD</span>
                <span className="legend-pct">{total > 0 ? ((x.sum / total) * 100).toFixed(0) : 0}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {top3.length > 0 && (
        <div className="card">
          <div className="card-title">Top dépenses</div>
          {top3.map((e, i) => {
            const icon = ICONS[e.category] || ICONS.autre
            return (
              <div key={e.id} className="top-expense">
                <span className="top-rank">#{i + 1}</span>
                <div className="expense-icon" style={{ background: icon.bg }}>
                  {icon.emoji}
                </div>
                <div className="expense-body">
                  <div className="expense-desc">{e.description || e.category}</div>
                  <div className="expense-meta">{e.date} · {e.paid_by}</div>
                </div>
                <div className="expense-amount">{Number(e.amount).toFixed(0)} MAD</div>
              </div>
            )
          })}
        </div>
      )}

      {expenses.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">💸</div>
          <div className="empty-state-text">Aucune dépense ce mois</div>
        </div>
      )}
    </>
  )
}
