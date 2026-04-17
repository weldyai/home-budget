import { useEffect, useRef, useState } from 'react'
import { Chart, ArcElement, Tooltip, Legend, DoughnutController } from 'chart.js'

Chart.register(ArcElement, Tooltip, Legend, DoughnutController)

const DEFAULT_BUDGET = 5000
const BUDGET_KEY = 'home_budget_monthly'

const ICONS = {
  alimentation: { emoji: '🛒', bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
  restauration: { emoji: '🍽️', bg: 'rgba(251,146,60,0.15)', color: '#fb923c' },
  transport:    { emoji: '🚗', bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
  logement:     { emoji: '🏠', bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6' },
  sante:        { emoji: '💊', bg: 'rgba(244,63,94,0.15)',  color: '#f43f5e' },
  loisirs:      { emoji: '🎬', bg: 'rgba(234,179,8,0.15)',  color: '#eab308' },
  habillement:  { emoji: '👗', bg: 'rgba(236,72,153,0.15)', color: '#ec4899' },
  education:    { emoji: '📚', bg: 'rgba(20,184,166,0.15)', color: '#14b8a6' },
  services:     { emoji: '📱', bg: 'rgba(99,102,241,0.15)', color: '#6366f1' },
  autre:        { emoji: '💰', bg: 'rgba(148,163,184,0.15)',color: '#94a3b8' },
}

const COLORS = ['#6366f1','#f97316','#10d9a0','#a855f7','#f43f5e','#eab308','#ec4899','#14b8a6','#64748b','#94a3b8']
const CATEGORIES = ['alimentation','restauration','transport','logement','sante','loisirs','habillement','education','services','autre']

function RingProgress({ pct, color, size = 170 }) {
  const r = (size - 18) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * Math.min(pct / 100, 1)
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={9} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={9}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 8px ${color})` }}
      />
    </svg>
  )
}

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
  const ring_color = pct < 60 ? '#10d9a0' : pct < 85 ? '#fb923c' : '#f43f5e'

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
        datasets: [{ data: by_cat.map(x => x.sum), backgroundColor: COLORS.slice(0, by_cat.length), borderWidth: 0, hoverOffset: 4 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '70%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.raw.toFixed(0)} MAD` } },
        },
      },
    })
    return () => { if (chart_instance.current) chart_instance.current.destroy() }
  }, [by_cat.map(x => x.cat + x.sum).join()])

  if (loading) return <div className="loading" />

  return (
    <>
      {/* ── HERO CARD ── */}
      <div className="hero-card">
        <div className="hero-glow" style={{ background: `radial-gradient(circle, ${ring_color}22 0%, transparent 70%)` }} />
        <div className="hero-top">
          <div className="hero-ring-wrap">
            <RingProgress pct={pct} color={ring_color} />
            <div className="hero-center">
              <div className="hero-amount">{total.toFixed(0)}</div>
              <div className="hero-unit">MAD</div>
              <div className="hero-pct" style={{ color: ring_color }}>{pct.toFixed(0)}%</div>
            </div>
          </div>
          <div className="hero-meta">
            <div className="hero-meta-item">
              <span className="hero-meta-label">Budget</span>
              <span className="hero-meta-val">{budget.toLocaleString()} MAD</span>
            </div>
            <div className="hero-meta-item">
              <span className="hero-meta-label">Restant</span>
              <span className="hero-meta-val" style={{ color: savings >= 0 ? '#10d9a0' : '#f43f5e' }}>
                {savings.toFixed(0)} MAD
              </span>
            </div>
            <div className="hero-meta-item">
              <span className="hero-meta-label">Dépenses</span>
              <span className="hero-meta-val">{nb}</span>
            </div>
            <button
              className="hero-edit-btn"
              onClick={() => { set_budget_input(String(budget)); set_editing_budget(true) }}
            >
              Modifier budget
            </button>
          </div>
        </div>
      </div>

      {/* ── MODAL BUDGET ── */}
      {editing_budget && (
        <div className="modal-overlay" onClick={() => set_editing_budget(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">Budget mensuel</div>
            <div className="form-group">
              <label className="form-label">Montant (MAD)</label>
              <input className="form-input" type="number" min="0" value={budget_input}
                onChange={e => set_budget_input(e.target.value)} autoFocus />
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

      {/* ── PAR CATÉGORIE ── */}
      {by_cat.length > 0 && (
        <div className="card">
          <div className="card-title">Par catégorie</div>
          <div className="donut-wrap"><canvas ref={chart_ref} /></div>
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

      {/* ── TOP DÉPENSES ── */}
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
