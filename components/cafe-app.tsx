'use client'

import { useMemo, useState } from 'react'
import {
  BarChart3,
  Bell,
  Check,
  ChevronRight,
  Clock3,
  Coffee,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Search,
  Settings2,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Users,
  X,
  Salad,
  Sandwich,
  Cookie,
  CupSoda
} from 'lucide-react'

type MenuItem = { id: number; name: string; category: string; price: number; icon: React.ReactNode; available: boolean }

const initialItems: MenuItem[] = [
  { id: 1, name: 'Bowl energético', category: 'Almuerzos', price: 14500, icon: <Salad size={36} strokeWidth={1.5} color="#8ca18d" />, available: true },
  { id: 2, name: 'Wrap mediterráneo', category: 'Almuerzos', price: 12000, icon: <Sandwich size={36} strokeWidth={1.5} color="#e2b85b" />, available: true },
  { id: 3, name: 'Café latte', category: 'Bebidas', price: 5500, icon: <Coffee size={36} strokeWidth={1.5} color="#c86f55" />, available: true },
  { id: 4, name: 'Galleta de avena', category: 'Snacks', price: 3500, icon: <Cookie size={36} strokeWidth={1.5} color="#8ca18d" />, available: true },
]

const money = (value: number) => `$${value.toLocaleString('es-CO')}`

function Brand() {
  return <div className="brand"><span className="brand-mark"><Coffee size={19} /></span><span>Café <b>Campus</b></span></div>
}

function StudentView({ userName, email, onLogout }: { userName: string; email: string; onLogout: () => void }) {
  const [items] = useState(initialItems)
  const [cart, setCart] = useState<Record<number, number>>({})
  const [category, setCategory] = useState('Todos')
  const [showAccount, setShowAccount] = useState(false)
  const categories = ['Todos', 'Almuerzos', 'Bebidas', 'Snacks']
  const filtered = items.filter((item) => category === 'Todos' || item.category === category)
  const count = Object.values(cart).reduce((a, b) => a + b, 0)
  const total = items.reduce((sum, item) => sum + (cart[item.id] || 0) * item.price, 0)

  // Obtener iniciales para el avatar
  const initials = userName.substring(0, 2).toUpperCase()
  const firstName = userName.split(' ')[0]

  return <div className="student-shell">
    <header className="topbar">
      <Brand />
      <nav><button className="nav-active">Menú de hoy</button><button>Mis pedidos</button><button>Historial</button></nav>
      <div className="top-actions">
        <button className="icon-button" aria-label="Notificaciones"><Bell size={19} /></button>
        <button className="profile-chip" onClick={() => setShowAccount(!showAccount)}>
          <span>{initials}</span><span className="profile-name">{firstName}</span><ChevronRight size={15} />
        </button>
        {showAccount && <div className="account-popover">
          <strong>{userName}</strong><span>{email}</span>
          <button className="danger-link" onClick={onLogout}><LogOut size={14} /> Cerrar sesión</button>
        </div>}
      </div>
    </header>
    <main className="student-main">
      <section className="welcome-row">
        <div><p className="eyebrow">BIENVENIDO A TU CAFETERÍA</p><h1>Hola, {firstName} <span>●</span></h1><p className="subtext">Pide antes de llegar. Tu almuerzo te estará esperando.</p></div>
        <div className="balance-card"><div className="balance-icon">$</div><div><span>Saldo disponible</span><strong>$48.500</strong></div><button aria-label="Ver saldo"><ChevronRight size={17} /></button></div>
      </section>
      <div className="student-grid">
        <section className="menu-section">
          <div className="section-heading"><div><h2>El menú de hoy</h2><p>Preparado fresco para ti</p></div><div className="search-box"><Search size={17} /><input aria-label="Buscar en el menú" placeholder="Buscar" /></div></div>
          <div className="category-tabs">{categories.map((name) => <button key={name} className={category === name ? 'tab-active' : ''} onClick={() => setCategory(name)}>{name}</button>)}</div>
          <div className="menu-grid">
            {filtered.map((item) => <article className="menu-card" key={item.id}>
              <div className="food-art">{item.icon}<span className="available-dot" /></div>
              <div className="food-copy">
                <span className="food-category">{item.category}</span>
                <h3>{item.name}</h3>
                <div className="food-bottom">
                  <strong>{money(item.price)}</strong>
                  {cart[item.id] ? <div className="quantity"><button onClick={() => setCart({ ...cart, [item.id]: Math.max(0, cart[item.id] - 1) })}>−</button><b>{cart[item.id]}</b><button onClick={() => setCart({ ...cart, [item.id]: cart[item.id] + 1 })}>+</button></div> : <button className="add-button" onClick={() => setCart({ ...cart, [item.id]: 1 })}><Plus size={16} /> Agregar</button>}
                </div>
              </div>
            </article>)}
          </div>
        </section>
        <aside className="order-card">
          <div className="order-heading"><div><h2>Tu pedido</h2><p>{count ? `${count} ${count === 1 ? 'producto' : 'productos'}` : 'Aún no has agregado nada'}</p></div><ShoppingBag size={21} /></div>
          {count === 0 ? <div className="empty-order"><div className="empty-icon"><ShoppingBag size={27} /></div><p>Tu pedido aparecerá aquí</p><span>Explora el menú y agrega tus favoritos.</span></div> : <><div className="order-lines">{items.filter((item) => cart[item.id]).map((item) => <div className="order-line" key={item.id}><span>{cart[item.id]} × {item.name}</span><strong>{money(item.price * cart[item.id])}</strong></div>)}</div><div className="total-line"><span>Total</span><strong>{money(total)}</strong></div><button className="primary-button">Continuar al pago <ChevronRight size={17} /></button><p className="order-note"><Clock3 size={14} /> Puedes cancelar o modificar en los próximos 2 minutos.</p></>}
        </aside>
      </div>
    </main>
  </div>
}

function AdminView({ userName, email, onLogout }: { userName: string; email: string; onLogout: () => void }) {
  const [items, setItems] = useState(initialItems)
  const [selected, setSelected] = useState<'dashboard' | 'menu' | 'reportes'>('dashboard')
  const [editing, setEditing] = useState<MenuItem | null>(null)
  const [newName, setNewName] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  
  const initials = userName.substring(0, 2).toUpperCase()
  const firstName = userName.split(' ')[0]

  const orders = useMemo(() => [{ name: 'Bowl energético', qty: 34, color: 'terracotta' }, { name: 'Café latte', qty: 28, color: 'sage' }, { name: 'Wrap mediterráneo', qty: 22, color: 'gold' }, { name: 'Galleta de avena', qty: 16, color: 'blue' }], [])
  const max = 40
  const removeItem = (id: number) => setItems(items.filter((i) => i.id !== id))
  const addItem = () => { if (!newName.trim()) return; setItems([...items, { id: Date.now(), name: newName, category: 'Snacks', price: 4000, icon: <Sandwich size={36} strokeWidth={1.5} color="#8ca18d" />, available: true }]); setNewName(''); setShowAdd(false) }
  
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Brand />
      <div className="admin-profile"><span className="profile-avatar">{initials}</span><div><strong>{userName}</strong><span>Administrador</span></div></div>
      <nav className="side-nav">
        <span className="side-label">GESTIÓN</span>
        <button className={selected === 'dashboard' ? 'side-active' : ''} onClick={() => setSelected('dashboard')}><LayoutDashboard size={18} /> Dashboard</button>
        <button className={selected === 'menu' ? 'side-active' : ''} onClick={() => setSelected('menu')}><Menu size={18} /> Menú</button>
        <button className={selected === 'reportes' ? 'side-active' : ''} onClick={() => setSelected('reportes')}><BarChart3 size={18} /> Reportes</button>
        <span className="side-label">CUENTA</span>
        <button><Settings2 size={18} /> Configuración</button>
        <button onClick={onLogout} className="danger-link"><LogOut size={18} /> Cerrar sesión</button>
      </nav>
    </aside>
    <main className="admin-main">
      <header className="admin-top">
        <div><p className="eyebrow">PANEL DE CONTROL</p><h1>{selected === 'menu' ? 'Gestionar menú' : selected === 'reportes' ? 'Reportes de operación' : `Buenos días, ${firstName}`}</h1></div>
        <div className="live-pill"><span /> Actualizado hace 12 s <button aria-label="Notificaciones"><Bell size={18} /></button></div>
      </header>
      {selected === 'dashboard' && <><section className="metric-grid"><div className="metric-card"><span className="metric-icon terracotta-bg"><ShoppingBag size={18} /></span><div><p>Pedidos de hoy</p><strong>128</strong><small className="positive"><TrendingUp size={13} /> +12.5% vs. ayer</small></div></div><div className="metric-card"><span className="metric-icon sage-bg"><Clock3 size={18} /></span><div><p>Tiempo promedio</p><strong>08:42 <small>min</small></strong><small className="positive"><TrendingUp size={13} /> 1:18 más rápido</small></div></div><div className="metric-card"><span className="metric-icon gold-bg"><Users size={18} /></span><div><p>Estudiantes atendidos</p><strong>96</strong><small className="neutral">En lo que va del día</small></div></div></section><section className="dashboard-grid"><div className="panel demand-panel"><div className="panel-heading"><div><h2>Demanda confirmada</h2><p>Pedidos por implemento · Hoy</p></div><button className="outline-button">Últimas 24 h <ChevronRight size={15} /></button></div><div className="bars">{orders.map((item) => <div className="bar-row" key={item.name}><span>{item.name}</span><div className="bar-track"><div className={`bar-fill ${item.color}`} style={{ width: `${(item.qty / max) * 100}%` }} /></div><strong>{item.qty}</strong></div>)}</div><div className="chart-footer"><span><i className="legend-dot terracotta" /> Pedidos confirmados</span><span>Meta diaria: 150 pedidos</span></div></div><div className="panel wait-panel"><div className="panel-heading"><div><h2>Tiempo de espera</h2><p>Últimas 6 horas</p></div><FileText size={19} className="muted-icon" /></div><div className="wait-visual"><div className="donut"><strong>08:42</strong><span>min promedio</span></div><div className="wait-legend"><span><i className="legend-dot sage" /> Preparación <b>05:18</b></span><span><i className="legend-dot gold" /> Entrega <b>03:24</b></span><small>Meta del proyecto <b>&lt; 10 min</b></small></div></div><button className="full-outline" onClick={() => setSelected('reportes')}>Ver reporte completo <ChevronRight size={15} /></button></div></section></>}
      {selected === 'menu' && <section className="panel menu-admin-panel"><div className="panel-heading"><div><h2>Implementos del menú</h2><p>Administra lo que tus estudiantes pueden pedir hoy</p></div><button className="primary-button small" onClick={() => setShowAdd(true)}><Plus size={16} /> Agregar implemento</button></div><div className="admin-menu-list">{items.map((item) => <div className="admin-menu-row" key={item.id}><span className="admin-food-emoji">{item.icon}</span><div><strong>{item.name}</strong><span>{item.category} · {money(item.price)}</span></div><span className="availability"><i /> Disponible</span><button onClick={() => setEditing(item)} aria-label={`Editar ${item.name}`}><Pencil size={16} /></button><button onClick={() => removeItem(item.id)} aria-label={`Eliminar ${item.name}`}><Trash2 size={16} /></button></div>)}</div></section>}
      {selected === 'reportes' && <section className="panel report-panel"><div className="panel-heading"><div><h2>Reporte de tiempos de espera</h2><p>Seguimiento al cumplimiento de metas</p></div><button className="outline-button"><FileText size={15} /> Exportar</button></div><div className="report-stat-row"><div><span>Promedio general</span><strong>08:42 <small>min</small></strong></div><div><span>Pedidos bajo meta</span><strong className="green-text">92%</strong></div><div><span>Mejor hora</span><strong>11:00 <small>am</small></strong></div></div><div className="report-chart"><div className="report-line" /><div className="report-axis"><span>8am</span><span>9am</span><span>10am</span><span>11am</span><span>12pm</span><span>1pm</span><span>2pm</span></div></div></section>}
      {(showAdd || editing) && <div className="modal-backdrop"><div className="modal"><button className="modal-close" onClick={() => { setShowAdd(false); setEditing(null) }}><X size={18} /></button><p className="eyebrow">{editing ? 'EDITAR IMPLEMENTO' : 'NUEVO IMPLEMENTO'}</p><h2>{editing ? 'Actualizar menú' : 'Agregar al menú'}</h2><label>Nombre<input value={editing?.name ?? newName} onChange={(e) => editing ? setEditing({ ...editing, name: e.target.value }) : setNewName(e.target.value)} placeholder="Ej. Sándwich de pollo" /></label><label>Precio<input defaultValue={editing ? editing.price : 4000} type="number" /></label><div className="modal-actions"><button className="outline-button" onClick={() => { setShowAdd(false); setEditing(null) }}>Cancelar</button><button className="primary-button" onClick={() => { if (editing) { setItems(items.map((i) => i.id === editing.id ? editing : i)); setEditing(null) } else addItem() }}>{editing ? 'Guardar cambios' : 'Agregar implemento'}</button></div></div></div>}
    </main>
  </div>
}

export default function CafeApp({ role, userName, email, onLogout }: { role: 'admin' | 'student'; userName: string; email: string; onLogout: () => void }) { 
  return role === 'admin' ? <AdminView userName={userName} email={email} onLogout={onLogout} /> : <StudentView userName={userName} email={email} onLogout={onLogout} /> 
}