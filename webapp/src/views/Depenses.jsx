import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { monthRange } from '../lib/dates'

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

const CATEGORIES = Object.keys(ICONS)
const EMPTY_FORM = { description: '', amount: '', category: 'alimentation', date: new Date().toISOString().slice(0, 10), paid_by: 'brahim' }

export default function Depenses({ month, expenses, loading, refresh }) {
  const [cat_filter, set_cat_filter] = useState('tous')
  const [modal, set_modal] = useState(null)
  const [form, set_form] = useState(EMPTY_FORM)
  const [saving, set_saving] = useState(false)
  const [confirm, set_confirm] = useState(null)
  const [working, set_working] = useState(false)

  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date))

  const filtered = cat_filter === 'tous' ? sorted : sorted.filter(e => e.category === cat_filter)

  const open_add = () => {
    set_form(EMPTY_FORM)
    set_modal('add')
  }

  const open_edit = (e) => {
    set_form({ description: e.description || '', amount: String(e.amount), category: e.category, date: e.date, paid_by: e.paid_by, id: e.id })
    set_modal('edit')
  }

  const close_modal = () => { set_modal(null); set_form(EMPTY_FORM) }

  const handle_submit = async (ev) => {
    ev.preventDefault()
    set_saving(true)
    const payload = { description: form.description || form.category, amount: parseFloat(form.amount), category: form.category, date: form.date, paid_by: form.paid_by }
    let error
    if (modal === 'edit') {
      const res = await supabase.from('expenses').update(payload).eq('id', form.id)
      error = res.error
    } else {
      const res = await supabase.from('expenses').insert([payload])
      error = res.error
    }
    set_saving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    close_modal()
    refresh()
  }

  const handle_confirm = async () => {
    if (!confirm) return
    set_working(true)
    if (confirm.type === 'delete') {
      await supabase.from('expenses').delete().eq('id', confirm.id)
    } else if (confirm.type === 'reset') {
      const { from, to } = monthRange(month)
      await supabase.from('expenses').delete().gte('date', from).lte('date', to)
    }
    set_working(false)
    set_confirm(null)
    refresh()
  }

  if (loading) return <div className="loading">Chargement…</div>

  return (
    <>
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
        {['tous', ...CATEGORIES].map(c => (
          <button key={c} className={`filter-pill${cat_filter === c ? ' active' : ''}`} style={{ flexShrink: 0 }} onClick={() => set_cat_filter(c)}>
            {c === 'tous' ? 'Tous' : (ICONS[c]?.emoji + ' ' + c)}
          </button>
        ))}
      </div>

      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="card-title" style={{ margin: 0 }}>{filtered.length} dépense{filtered.length !== 1 ? 's' : ''}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          {sorted.length > 0 && (
            <button className="btn btn-danger-outline" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => set_confirm({ type: 'reset' })}>
              Remettre à zéro
            </button>
          )}
          <button className="btn btn-primary" style={{ padding: '6px 14px', fontSize: '0.8rem' }} onClick={open_add}>
            + Ajouter
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">💸</div>
          <div className="empty-state-text">Aucune dépense</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((e) => {
            const icon = ICONS[e.category] || ICONS.autre
            return (
              <div key={e.id} className="expense-item">
                <div className="expense-icon" style={{ background: icon.bg }}>{icon.emoji}</div>
                <div className="expense-body">
                  <div className="expense-desc">{e.description || e.category}</div>
                  <div className="expense-meta">{e.date} {e.created_at ? new Date(e.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' }) : ''} · {e.category} · {e.paid_by === 'brahim' ? 'Moi' : 'Femme'}</div>
                </div>
                <div className="expense-right">
                  <div className="expense-amount">{Number(e.amount).toFixed(0)} MAD</div>
                  <div className="expense-actions">
                    <button className="icon-btn" onClick={() => open_edit(e)} title="Modifier">✏️</button>
                    <button className="icon-btn danger" onClick={() => set_confirm({ type: 'delete', id: e.id })} title="Supprimer">🗑</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal ajout / édition */}
      {modal && (
        <div className="modal-overlay" onClick={close_modal}>
          <div className="modal" onClick={ev => ev.stopPropagation()}>
            <div className="modal-handle" />
            <div className="modal-title">{modal === 'edit' ? 'Modifier la dépense' : 'Nouvelle dépense'}</div>
            <form onSubmit={handle_submit}>
              <div className="form-group">
                <label className="form-label">Description</label>
                <input className="form-input" value={form.description} onChange={e => set_form(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Carrefour" />
              </div>
              <div className="form-group">
                <label className="form-label">Montant (MAD)</label>
                <input className="form-input" type="number" required min="0" step="0.01" value={form.amount} onChange={e => set_form(f => ({ ...f, amount: e.target.value }))} placeholder="0" />
              </div>
              <div className="form-group">
                <label className="form-label">Catégorie</label>
                <select className="form-select" value={form.category} onChange={e => set_form(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{ICONS[c].emoji} {c}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" type="date" required value={form.date} onChange={e => set_form(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Payé par</label>
                <select className="form-select" value={form.paid_by} onChange={e => set_form(f => ({ ...f, paid_by: e.target.value }))}>
                  <option value="brahim">Moi</option>
                  <option value="wife">Femme</option>
                </select>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={close_modal}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '…' : modal === 'edit' ? 'Enregistrer' : 'Ajouter'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal confirmation suppression / reset */}
      {confirm && (
        <div className="modal-overlay" onClick={() => set_confirm(null)}>
          <div className="modal" onClick={ev => ev.stopPropagation()} style={{ gap: 16 }}>
            <div className="modal-handle" />
            <div className="modal-title">
              {confirm.type === 'reset' ? '⚠️ Remettre à zéro ?' : 'Supprimer cette dépense ?'}
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '0.875rem', margin: 0 }}>
              {confirm.type === 'reset'
                ? `Toutes les dépenses de ${month} seront supprimées définitivement.`
                : 'Cette action est irréversible.'}
            </p>
            <div className="form-actions">
              <button className="btn btn-secondary" onClick={() => set_confirm(null)}>Annuler</button>
              <button className="btn btn-danger" onClick={handle_confirm} disabled={working}>
                {working ? '…' : confirm.type === 'reset' ? 'Tout supprimer' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
