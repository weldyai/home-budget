import { useEffect, useRef, useState } from 'react'
import { Chart, ArcElement, Tooltip, DoughnutController } from 'chart.js'
import { CategoryIcon, CATEGORY_CONFIG } from '../components/CategoryIcon'

Chart.register(ArcElement, Tooltip, DoughnutController)

const DEFAULT_BUDGET = 5000
const BUDGET_KEY = 'home_budget_monthly'

const CATEGORIES = ['alimentation','restauration','transport','logement','sante','loisirs','habillement','education','services','autre']
const COLORS = Object.values(CATEGORY_CONFIG).map(c => c.color)

const fmt = n => new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(Number(n))

function RingProgress({ pct, color, size = 150 }) {
  const r = (size - 16) / 2
  const circ = 2 * Math.PI * r
  const dash = circ * Math.min(pct / 100, 1)
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={8} />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: 'stroke-dasharray 1.1s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 6px ${color})` }}
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
  const ring_color = pct < 60 ? '#00C97B' : pct < 85 ? '#FF9F00' : '#FF3B5C'

  const by_cat = CATEGORIES.map((cat, i) => ({
    cat,
    sum: expenses.filter(e => e.category === cat).reduce((s, e) => s + Number(e.amount), 0),
    color: COLORS[i],
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
          backgroundColor: by_cat.map(x => x.color),
          borderWidth: 0,
          hoverOffset: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)} MAD` } },
        },
      },
    })
    return () => { if (chart_instance.current) chart_instance.current.destroy() }
  }, [by_cat.map(x => x.cat + x.sum).join()])

  if (loading) return <div className="loading" />

  return (
    <>
      {/* HERO CARD */}
      <div className="hero-card">
        <div className="hero-top">
          <div className="hero-ring-wrap">
            <RingProgress pct={pct} color={ring_color} />
            <div className="hero-center">
              <div className="hero-amount">{fmt(total)}</div>
              <div className="hero-unit">MAD</div>
              <div className="hero-pct" style={{ color: ring_color }}>{pct.toFixed(0)}%</div>
            </div>
          </div>
          <div className="hero-meta">
            <div className="hero-meta-item">
              <span className="hero-meta-label">Budget</span>
              <span className="hero-meta-val">{fmt(budget)} MAD</span>
            </div>
            <div className="hero-meta-item">
              <span className="hero-meta-label">Restant</span>
              <span className="hero-meta-val" style={{ color: savings >= 0 ? '#00C97B' : '#FF3B5C' }}>
                {fmt(savings)} MAD
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

      {/* MODAL BUDGET */}
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

      {/* PAR CATÉGORIE */}
      {by_cat.length > 0 && (
        <div className="card">
          <div className="card-title">Par catégorie</div>
          <div className="donut-wrap"><canvas ref={chart_ref} /></div>
          <ul className="legend-list">
            {by_cat.map(x => (
              <li key={x.cat} className="legend-item">
                <span className="legend-dot" style={{ background: x.color }} />
                <span className="legend-label">{x.cat}</span>
                <span className="legend-val">{fmt(x.sum)} MAD</span>
                <span className="legend-pct">{total > 0 ? ((x.sum / total) * 100).toFixed(0) : 0}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* TOP DÉPENSES */}
      {top3.length > 0 && (
        <div className="card">
          <div className="card-title">Top dépenses</div>
          {top3.map((e, i) => (
            <div key={e.id} className="top-expense">
              <span className="top-rank">#{i + 1}</span>
              <CategoryIcon category={e.category} size={40} />
              <div className="expense-body">
                <div className="expense-desc">{e.description || e.category}</div>
                <div className="expense-meta">{e.date} · {e.paid_by === 'brahim' ? 'Moi' : 'Femme'}</div>
              </div>
              <div className="expense-amount">{fmt(e.amount)} MAD</div>
            </div>
          ))}
        </div>
      )}

      {expenses.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
              <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
            </svg>
          </div>
          <div className="empty-state-text">Aucune dépense ce mois</div>
        </div>
      )}
    </>
  )
}
