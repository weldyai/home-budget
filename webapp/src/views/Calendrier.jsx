import { useState } from 'react'
import { CATEGORY_CONFIG } from '../components/CategoryIcon'

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const fmt = n => new Intl.NumberFormat('fr-MA', { maximumFractionDigits: 0 }).format(Number(n))

export default function Calendrier({ month, expenses, loading }) {
  const [selected_day, set_selected_day] = useState(null)

  const [year, mon] = month.split('-').map(Number)
  const first_day = new Date(year, mon - 1, 1)
  const days_in_month = new Date(year, mon, 0).getDate()
  const start_offset = (first_day.getDay() + 6) % 7
  const today = new Date()
  const is_current_month = today.getFullYear() === year && today.getMonth() + 1 === mon

  const by_day = {}
  expenses.forEach(e => {
    const d = e.date.slice(8, 10)
    if (!by_day[d]) by_day[d] = []
    by_day[d].push(e)
  })

  const BUDGET_PER_DAY = 5000 / days_in_month
  const cells = []
  for (let i = 0; i < start_offset; i++) cells.push(null)
  for (let d = 1; d <= days_in_month; d++) cells.push(d)

  const day_str = selected_day ? String(selected_day).padStart(2, '0') : null
  const day_expenses = day_str ? (by_day[day_str] || []) : []
  const day_total = day_expenses.reduce((s, e) => s + Number(e.amount), 0)

  if (loading) return <div className="loading" />

  return (
    <>
      <div className="card">
        <div className="calendar-grid">
          {DAYS.map(d => <div key={d} className="cal-header">{d}</div>)}
          {cells.map((d, i) => {
            if (!d) return <div key={`e-${i}`} className="cal-day empty" />
            const ds = String(d).padStart(2, '0')
            const exps = by_day[ds] || []
            const total = exps.reduce((s, e) => s + Number(e.amount), 0)
            const is_today = is_current_month && today.getDate() === d
            let heat = ''
            if (total > 0) {
              if (total < BUDGET_PER_DAY * 0.75) heat = 'has-expenses-low'
              else if (total < BUDGET_PER_DAY * 1.5) heat = 'has-expenses-mid'
              else heat = 'has-expenses-high'
            }
            return (
              <div
                key={d}
                className={`cal-day${is_today ? ' today' : ''}${heat ? ' ' + heat : ''}${selected_day === d ? ' selected' : ''}`}
                onClick={() => set_selected_day(selected_day === d ? null : d)}
              >
                <span className="cal-day-num">{d}</span>
                {total > 0 && <span className="cal-day-amt">{fmt(total)}</span>}
              </div>
            )
          })}
        </div>
      </div>

      {selected_day && (
        <div className="card">
          <div className="card-title">{selected_day} {month} · {fmt(day_total)} MAD</div>
          {day_expenses.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '8px 0' }}>Aucune dépense</div>
          ) : (
            <div className="cal-day-detail">
              {day_expenses.map(e => {
                const cfg = CATEGORY_CONFIG[e.category] || CATEGORY_CONFIG.autre
                return (
                  <div key={e.id} className="expense-item" style={{ paddingLeft: 0, paddingRight: 0 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: cfg.color, flexShrink: 0, display: 'inline-block',
                    }} />
                    <div className="expense-body">
                      <div className="expense-desc">{e.description || e.category}</div>
                      <div className="expense-meta">{e.category} · {e.paid_by === 'brahim' ? 'Moi' : 'Femme'}</div>
                    </div>
                    <div className="expense-amount">{fmt(e.amount)} MAD</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-title">Légende</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.78rem', color: 'var(--muted)' }}>
          {[
            { label: 'Raisonnable', bg: 'rgba(0,201,123,0.2)' },
            { label: 'Élevé',       bg: 'rgba(255,159,0,0.25)' },
            { label: 'Excessif',    bg: 'rgba(255,59,92,0.25)' },
          ].map(({ label, bg }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: bg, display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </>
  )
}
