import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { monthRange } from '../lib/dates'

const ICONS = {
  alimentation: '🛒', restauration: '🍽️', transport: '🚗', logement: '🏠',
  sante: '💊', loisirs: '🎬', habillement: '👗', education: '📚',
  services: '📱', autre: '💰',
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

export default function Calendrier({ month, filter }) {
  const [expenses, set_expenses] = useState([])
  const [loading, set_loading] = useState(true)
  const [selected_day, set_selected_day] = useState(null)

  useEffect(() => {
    set_loading(true)
    const fetch_data = async () => {
      const { from, to } = monthRange(month)
      let q = supabase.from('expenses').select('*').gte('date', from).lte('date', to)
      if (filter !== 'tous') q = q.eq('paid_by', filter)
      const { data } = await q
      set_expenses(data || [])
      set_loading(false)
    }
    fetch_data()
    const interval = setInterval(fetch_data, 10000)
    return () => clearInterval(interval)
  }, [month, filter])

  const [year, mon] = month.split('-').map(Number)
  const first_day = new Date(year, mon - 1, 1)
  const days_in_month = new Date(year, mon, 0).getDate()
  // Monday-based: 0=Mon … 6=Sun
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

  if (loading) return <div className="loading">Chargement…</div>

  return (
    <>
      <div className="card">
        <div className="calendar-grid">
          {DAYS.map(d => (
            <div key={d} className="cal-header">{d}</div>
          ))}
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
                {total > 0 && <span className="cal-day-amt">{total.toFixed(0)}</span>}
              </div>
            )
          })}
        </div>
      </div>

      {selected_day && (
        <div className="card">
          <div className="card-title">
            {selected_day} {month} · {day_total.toFixed(0)} MAD
          </div>
          {day_expenses.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '0.85rem', padding: '8px 0' }}>Aucune dépense</div>
          ) : (
            <div className="cal-day-detail">
              {day_expenses.map(e => (
                <div key={e.id} className="expense-item" style={{ paddingLeft: 0, paddingRight: 0 }}>
                  <span style={{ fontSize: '1.2rem' }}>{ICONS[e.category] || '💰'}</span>
                  <div className="expense-body">
                    <div className="expense-desc">{e.description || e.category}</div>
                    <div className="expense-meta">{e.category} · {e.paid_by === 'brahim' ? 'Moi' : 'Femme'}</div>
                  </div>
                  <div className="expense-amount">{Number(e.amount).toFixed(0)} MAD</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="card">
        <div className="card-title">Légende</div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--muted)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(34,197,94,0.3)', display: 'inline-block' }} />
            Raisonnable
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(249,115,22,0.35)', display: 'inline-block' }} />
            Élevé
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(239,68,68,0.4)', display: 'inline-block' }} />
            Excessif
          </span>
        </div>
      </div>
    </>
  )
}
