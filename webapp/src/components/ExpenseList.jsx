import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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

export default function ExpenseList({ month }) {
  const [expenses, setExpenses] = useState([])

  useEffect(() => {
    fetchExpenses()
    const ch = supabase.channel(`expenses-${month}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'expenses' }, (payload) => {
        setExpenses(prev => [payload.new, ...prev].slice(0, 30))
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [month])

  async function fetchExpenses() {
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .gte('date', `${month}-01`)
      .lte('date', `${month}-31`)
      .order('created_at', { ascending: false })
      .limit(30)
    if (data) setExpenses(data)
  }

  if (!expenses.length) return (
    <div className="card"><p className="empty">Aucune dépense ce mois.</p></div>
  )

  return (
    <div className="card">
      <div className="card-title">📋 {expenses.length} dépense{expenses.length > 1 ? 's' : ''}</div>
      <div className="expense-list">
        {expenses.map(exp => {
          const { emoji, bg } = ICONS[exp.category] || ICONS.autre
          return (
            <div key={exp.id} className="expense-item">
              <div className="expense-icon" style={{ background: bg }}>{emoji}</div>
              <div className="expense-body">
                <div className="expense-desc">{exp.description}</div>
                <div className="expense-meta">{exp.category} · {exp.date}</div>
              </div>
              <div className="expense-right">
                <div className="expense-amount">{parseFloat(exp.amount).toFixed(0)} {exp.currency}</div>
                <div className="expense-who">{exp.paid_by}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
