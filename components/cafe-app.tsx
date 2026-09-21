'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import {
  BarChart3, Bell, ChevronRight, Clock3, Coffee, FileText,
  LayoutDashboard, LogOut, Menu, Pencil, Plus, Search,
  Settings2, ShoppingBag, Trash2, TrendingUp, Users, X,
  Salad, Sandwich, Cookie, CupSoda, RefreshCw, AlertCircle,
} from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────────
type MenuItem = {
  id: number; name: string; category: string; price: number
  iconKey: string; available: boolean
}

type OrderItem = { name: string; quantity: number }

type RecentOrder = {
  id: number; userName: string; total: number
  status: string; createdAt: string; items: OrderItem[]
}

type DemandItem  = { name: string; qty: number }

type Stats = {
  totalOrders: number
  uniqueStudents: number
  revenueToday: number
  ordersGrowth: string | null
  demand: DemandItem[]
  recentOrders: RecentOrder[]
  totalUsers: number
  totalMenuItems: number
  availableItems: number
}

// ── Helpers ──────────────────────────────────────────────────────
const money = (v: number) => `$${v.toLocaleString('es-CO')}`

const ICON_MAP: Record<string, React.ReactNode> = {
  salad:    <Salad    size={36} strokeWidth={1.5} color="#8ca18d" />,
  sandwich: <Sandwich size={36} strokeWidth={1.5} color="#e2b85b" />,
  coffee:   <Coffee   size={36} strokeWidth={1.5} color="#c86f55" />,
  cookie:   <Cookie   size={36} strokeWidth={1.5} color="#8ca18d" />,
  cupsoda:  <CupSoda  size={36} strokeWidth={1.5} color="#8da6b0" />,
}
const iconNode = (key: string) => ICON_MAP[key] ?? ICON_MAP['sandwich']

const STATUS_LABEL: Record<string, string> = {
  pending:   'Pendiente',
  preparing: 'Preparando',
  ready:     'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}
const STATUS_CLASS: Record<string, string> = {
  pending:   'status-prep',
  preparing: 'status-prep',
  ready:     'status-ready',
  delivered: 'status-ready',
  cancelled: 'status-cancelled',
}

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark"><Coffee size={19} /></span>
      <span>Café <b>Campus</b></span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// STUDENT VIEW
// ══════════════════════════════════════════════════════════════════
function StudentView({ userName, email, onLogout }: { userName: string; email: string; onLogout: () => void }) {
  const [items, setItems]     = useState<MenuItem[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart]       = useState<Record<number, number>>({})
  const [category, setCategory] = useState('Todos')
  const [showAccount, setShowAccount] = useState(false)

  useEffect(() => {
    fetch('/api/menu')
      .then((r) => r.json())
      .then((data) => { setItems(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const categories = ['Todos', 'Almuerzos', 'Bebidas', 'Snacks']
  const filtered   = items.filter((item) => (category === 'Todos' || item.category === category) && item.available)
  const count      = Object.values(cart).reduce((a, b) => a + b, 0)
  const total      = items.reduce((sum, item) => sum + (cart[item.id] || 0) * item.price, 0)
  const initials   = userName.substring(0, 2).toUpperCase()
  const firstName  = userName.split(' ')[0]

  return (
    <div className="student-shell">
      <header className="topbar">
        <Brand />
        <nav>
          <button className="nav-active">Menú de hoy</button>
          <button>Mis pedidos</button>
          <button>Historial</button>
        </nav>
        <div className="top-actions">
          <button className="icon-button" aria-label="Notificaciones"><Bell size={19} /></button>
          <button className="profile-chip" onClick={() => setShowAccount(!showAccount)}>
            <span>{initials}</span><span className="profile-name">{firstName}</span><ChevronRight size={15} />
          </button>
          {showAccount && (
            <div className="account-popover">
              <strong>{userName}</strong><span>{email}</span>
              <button className="danger-link" onClick={onLogout}><LogOut size={14} /> Cerrar sesión</button>
            </div>
          )}
        </div>
      </header>

      <main className="student-main">
        <section className="welcome-row">
          <div>
            <p className="eyebrow">BIENVENIDO A TU CAFETERÍA</p>
            <h1>Hola, {firstName} <span>●</span></h1>
            <p className="subtext">Pide antes de llegar. Tu almuerzo te estará esperando.</p>
          </div>
          <div className="balance-card">
            <div className="balance-icon">$</div>
            <div><span>Saldo disponible</span><strong>$48.500</strong></div>
            <button aria-label="Ver saldo"><ChevronRight size={17} /></button>
          </div>
        </section>

        <div className="student-grid">
          <section className="menu-section">
            <div className="section-heading">
              <div><h2>El menú de hoy</h2><p>Preparado fresco para ti</p></div>
              <div className="search-box"><Search size={17} /><input aria-label="Buscar en el menú" placeholder="Buscar" /></div>
            </div>
            <div className="category-tabs">
              {categories.map((name) => (
                <button key={name} className={category === name ? 'tab-active' : ''} onClick={() => setCategory(name)}>{name}</button>
              ))}
            </div>

            {loading ? (
              <div className="loading-state"><RefreshCw size={20} className="spin" /><span>Cargando menú...</span></div>
            ) : (
              <div className="menu-grid">
                {filtered.map((item) => (
                  <article className="menu-card" key={item.id}>
                    <div className="food-art">
                      {iconNode(item.iconKey)}
                      <span className="available-dot" />
                    </div>
                    <div className="food-copy">
                      <span className="food-category">{item.category}</span>
                      <h3>{item.name}</h3>
                      <div className="food-bottom">
                        <strong>{money(item.price)}</strong>
                        {cart[item.id]
                          ? (
                            <div className="quantity">
                              <button onClick={() => setCart({ ...cart, [item.id]: Math.max(0, cart[item.id] - 1) })}>−</button>
                              <b>{cart[item.id]}</b>
                              <button onClick={() => setCart({ ...cart, [item.id]: cart[item.id] + 1 })}>+</button>
                            </div>
                          )
                          : (
                            <button className="add-button" onClick={() => setCart({ ...cart, [item.id]: 1 })}>
                              <Plus size={16} /> Agregar
                            </button>
                          )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className="order-card">
            <div className="order-heading">
              <div>
                <h2>Tu pedido</h2>
                <p>{count ? `${count} ${count === 1 ? 'producto' : 'productos'}` : 'Aún no has agregado nada'}</p>
              </div>
              <ShoppingBag size={21} />
            </div>
            {count === 0
              ? (
                <div className="empty-order">
                  <div className="empty-icon"><ShoppingBag size={27} /></div>
                  <p>Tu pedido aparecerá aquí</p>
                  <span>Explora el menú y agrega tus favoritos.</span>
                </div>
              )
              : (
                <>
                  <div className="order-lines">
                    {items.filter((item) => cart[item.id]).map((item) => (
                      <div className="order-line" key={item.id}>
                        <span>{cart[item.id]} × {item.name}</span>
                        <strong>{money(item.price * cart[item.id])}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="total-line"><span>Total</span><strong>{money(total)}</strong></div>
                  <button className="primary-button">Continuar al pago <ChevronRight size={17} /></button>
                  <p className="order-note"><Clock3 size={14} /> Puedes cancelar o modificar en los próximos 2 minutos.</p>
                </>
              )}
          </aside>
        </div>
      </main>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// ADMIN VIEW
// ══════════════════════════════════════════════════════════════════
function AdminView({ userName, email, onLogout }: { userName: string; email: string; onLogout: () => void }) {
  const [selected, setSelected] = useState<'dashboard' | 'menu' | 'pedidos' | 'reportes'>('dashboard')

  // ── Menú ──────────────────────────────────────────────────────
  const [items, setItems]         = useState<MenuItem[]>([])
  const [menuLoading, setMenuLoading] = useState(false)

  // ── Stats ─────────────────────────────────────────────────────
  const [stats, setStats]         = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError]     = useState(false)

  // ── Modales ───────────────────────────────────────────────────
  const [editing, setEditing]     = useState<MenuItem | null>(null)
  const [showAdd, setShowAdd]     = useState(false)
  const [newItem, setNewItem]     = useState({ name: '', category: 'Almuerzos', price: 4000, iconKey: 'sandwich' })
  const [saving, setSaving]       = useState(false)

  const initials  = userName.substring(0, 2).toUpperCase()
  const firstName = userName.split(' ')[0]

  // ── Fetch stats ───────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true); setStatsError(false)
    try {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error()
      setStats(await res.json())
    } catch {
      setStatsError(true)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  // ── Fetch menú ────────────────────────────────────────────────
  const fetchMenu = useCallback(async () => {
    setMenuLoading(true)
    try {
      const res = await fetch('/api/menu')
      setItems(await res.json())
    } finally {
      setMenuLoading(false)
    }
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])
  useEffect(() => {
    if (selected === 'menu') fetchMenu()
  }, [selected, fetchMenu])

  // ── Guardar item (nuevo o edición) ────────────────────────────
  const saveItem = async () => {
    setSaving(true)
    if (editing) {
      await fetch(`/api/menu/${editing.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(editing),
      })
    } else {
      await fetch('/api/menu', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(newItem),
      })
    }
    setSaving(false)
    setEditing(null); setShowAdd(false)
    setNewItem({ name: '', category: 'Almuerzos', price: 4000, iconKey: 'sandwich' })
    fetchMenu()
  }

  // ── Eliminar item ─────────────────────────────────────────────
  const removeItem = async (id: number) => {
    await fetch(`/api/menu/${id}`, { method: 'DELETE' })
    fetchMenu()
  }

  // ── Cambiar estado de pedido ──────────────────────────────────
  const updateOrderStatus = async (orderId: number, status: string) => {
    await fetch(`/api/orders/${orderId}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status }),
    })
    fetchStats()
  }

  // ── Barra máxima para el gráfico ──────────────────────────────
  const demandMax = useMemo(() => {
    if (!stats?.demand?.length) return 1
    return Math.max(...stats.demand.map((d) => d.qty), 1)
  }, [stats])

  const barColors = ['terracotta', 'sage', 'gold', 'blue', 'sage', 'terracotta']

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Brand />
        <div className="admin-profile">
          <span className="profile-avatar">{initials}</span>
          <div><strong>{userName}</strong><span>Administrador</span></div>
        </div>
        <nav className="side-nav">
          <span className="side-label">GESTIÓN</span>
          <button className={selected === 'dashboard' ? 'side-active' : ''} onClick={() => setSelected('dashboard')}>
            <LayoutDashboard size={18} /> Dashboard
          </button>
          <button className={selected === 'menu' ? 'side-active' : ''} onClick={() => setSelected('menu')}>
            <Menu size={18} /> Menú
          </button>
          <button className={selected === 'pedidos' ? 'side-active' : ''} onClick={() => setSelected('pedidos')}>
            <ShoppingBag size={18} /> Pedidos de hoy
          </button>
          <button className={selected === 'reportes' ? 'side-active' : ''} onClick={() => setSelected('reportes')}>
            <BarChart3 size={18} /> Reportes
          </button>
          <span className="side-label">CUENTA</span>
          <button><Settings2 size={18} /> Configuración</button>
          <button onClick={onLogout} className="danger-link"><LogOut size={18} /> Cerrar sesión</button>
        </nav>
      </aside>

      <main className="admin-main">
        <header className="admin-top">
          <div>
            <p className="eyebrow">PANEL DE CONTROL</p>
            <h1>
              {selected === 'menu'     && 'Gestionar menú'}
              {selected === 'pedidos'  && 'Pedidos de hoy'}
              {selected === 'reportes' && 'Reportes de operación'}
              {selected === 'dashboard' && `Buenos días, ${firstName}`}
            </h1>
          </div>
          <div className="live-pill">
            <span />
            {statsLoading ? 'Actualizando...' : 'En vivo'}
            <button aria-label="Refrescar" onClick={fetchStats} title="Refrescar datos">
              <RefreshCw size={16} className={statsLoading ? 'spin' : ''} />
            </button>
          </div>
        </header>

        {/* ── DASHBOARD ── */}
        {selected === 'dashboard' && (
          <>
            {statsError && (
              <div className="admin-error">
                <AlertCircle size={15} /> Error cargando datos.{' '}
                <button onClick={fetchStats}>Reintentar</button>
              </div>
            )}

            <section className="metric-grid">
              <div className="metric-card">
                <span className="metric-icon terracotta-bg"><ShoppingBag size={18} /></span>
                <div>
                  <p>Pedidos de hoy</p>
                  <strong>{statsLoading ? '—' : (stats?.totalOrders ?? 0)}</strong>
                  {stats?.ordersGrowth != null
                    ? <small className="positive"><TrendingUp size={13} /> +{stats.ordersGrowth}% vs. ayer</small>
                    : <small className="neutral">Sin datos de ayer</small>
                  }
                </div>
              </div>
              <div className="metric-card">
                <span className="metric-icon sage-bg"><Users size={18} /></span>
                <div>
                  <p>Estudiantes hoy</p>
                  <strong>{statsLoading ? '—' : (stats?.uniqueStudents ?? 0)}</strong>
                  <small className="neutral">De {stats?.totalUsers ?? '—'} registrados</small>
                </div>
              </div>
              <div className="metric-card">
                <span className="metric-icon gold-bg"><BarChart3 size={18} /></span>
                <div>
                  <p>Ingresos de hoy</p>
                  <strong style={{ fontSize: 18 }}>{statsLoading ? '—' : money(stats?.revenueToday ?? 0)}</strong>
                  <small className="neutral">{stats?.availableItems ?? '—'} items disponibles</small>
                </div>
              </div>
            </section>

            <section className="dashboard-grid">
              {/* Gráfico de demanda */}
              <div className="panel demand-panel">
                <div className="panel-heading">
                  <div><h2>Demanda acumulada</h2><p>Items más pedidos · Histórico</p></div>
                </div>
                {statsLoading
                  ? <div className="loading-state"><RefreshCw size={18} className="spin" /><span>Cargando...</span></div>
                  : stats?.demand?.length
                    ? (
                      <>
                        <div className="bars">
                          {stats.demand.map((item, i) => (
                            <div className="bar-row" key={item.name}>
                              <span>{item.name}</span>
                              <div className="bar-track">
                                <div className={`bar-fill ${barColors[i % barColors.length]}`}
                                  style={{ width: `${(item.qty / demandMax) * 100}%` }} />
                              </div>
                              <strong>{item.qty}</strong>
                            </div>
                          ))}
                        </div>
                        <div className="chart-footer">
                          <span><i className="legend-dot terracotta" /> Unidades pedidas</span>
                          <span>Total: {stats.demand.reduce((s, d) => s + d.qty, 0)} uds.</span>
                        </div>
                      </>
                    )
                    : <p className="empty-chart">Aún no hay pedidos registrados.</p>
                }
              </div>

              {/* Pedidos recientes */}
              <div className="panel wait-panel">
                <div className="panel-heading">
                  <div><h2>Pedidos recientes</h2><p>Últimos de hoy</p></div>
                  <FileText size={19} className="muted-icon" />
                </div>
                {statsLoading
                  ? <div className="loading-state"><RefreshCw size={18} className="spin" /><span>Cargando...</span></div>
                  : stats?.recentOrders?.length
                    ? (
                      <div className="recent-orders-list">
                        {stats.recentOrders.slice(0, 5).map((o) => (
                          <div className="recent-order-row" key={o.id}>
                            <div className="recent-order-info">
                              <strong>{o.userName}</strong>
                              <span>{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</span>
                            </div>
                            <div className="recent-order-right">
                              <span className={STATUS_CLASS[o.status] ?? 'status-prep'}>
                                {STATUS_LABEL[o.status] ?? o.status}
                              </span>
                              <strong>{money(o.total)}</strong>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                    : <p className="empty-chart">No hay pedidos hoy.</p>
                }
                <button className="full-outline" onClick={() => setSelected('pedidos')}>
                  Ver todos los pedidos <ChevronRight size={15} />
                </button>
              </div>
            </section>
          </>
        )}

        {/* ── MENÚ ── */}
        {selected === 'menu' && (
          <section className="panel menu-admin-panel">
            <div className="panel-heading">
              <div><h2>Implementos del menú</h2><p>Administra lo que tus estudiantes pueden pedir hoy</p></div>
              <button className="primary-button small" onClick={() => setShowAdd(true)}>
                <Plus size={16} /> Agregar implemento
              </button>
            </div>
            {menuLoading
              ? <div className="loading-state"><RefreshCw size={18} className="spin" /><span>Cargando menú...</span></div>
              : (
                <div className="admin-menu-list">
                  {items.map((item) => (
                    <div className="admin-menu-row" key={item.id}>
                      <span className="admin-food-emoji">{iconNode(item.iconKey)}</span>
                      <div>
                        <strong>{item.name}</strong>
                        <span>{item.category} · {money(item.price)}</span>
                      </div>
                      <span className="availability">
                        <i style={{ background: item.available ? '#82a485' : '#c86f55' }} />
                        {item.available ? 'Disponible' : 'No disponible'}
                      </span>
                      <button onClick={() => setEditing({ ...item })} aria-label={`Editar ${item.name}`}>
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => removeItem(item.id)} aria-label={`Eliminar ${item.name}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
          </section>
        )}

        {/* ── PEDIDOS ── */}
        {selected === 'pedidos' && (
          <section className="panel orders-panel">
            <div className="panel-heading">
              <div><h2>Pedidos de hoy</h2><p>{stats?.totalOrders ?? 0} pedidos · {stats?.uniqueStudents ?? 0} estudiantes</p></div>
              <button className="outline-button" onClick={fetchStats}>
                <RefreshCw size={14} className={statsLoading ? 'spin' : ''} /> Actualizar
              </button>
            </div>
            {statsLoading
              ? <div className="loading-state"><RefreshCw size={18} className="spin" /><span>Cargando...</span></div>
              : !stats?.recentOrders?.length
                ? <p className="empty-chart">No hay pedidos hoy.</p>
                : (
                  <div className="order-table">
                    <div className="table-head">
                      <span>ESTUDIANTE</span>
                      <span>ITEMS</span>
                      <span>TOTAL</span>
                      <span>ESTADO</span>
                    </div>
                    {stats.recentOrders.map((o) => (
                      <div className="table-row" key={o.id}>
                        <span>{o.userName}</span>
                        <span>{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</span>
                        <span>{money(o.total)}</span>
                        <span>
                          <select
                            className={`status-select ${STATUS_CLASS[o.status] ?? 'status-prep'}`}
                            value={o.status}
                            onChange={(e) => updateOrderStatus(o.id, e.target.value)}
                          >
                            <option value="pending">Pendiente</option>
                            <option value="preparing">Preparando</option>
                            <option value="ready">Listo</option>
                            <option value="delivered">Entregado</option>
                            <option value="cancelled">Cancelado</option>
                          </select>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
          </section>
        )}

        {/* ── REPORTES ── */}
        {selected === 'reportes' && (
          <section className="panel report-panel">
            <div className="panel-heading">
              <div><h2>Reporte de operación</h2><p>Resumen general de actividad</p></div>
              <button className="outline-button"><FileText size={15} /> Exportar</button>
            </div>
            <div className="report-stat-row">
              <div>
                <span>Pedidos hoy</span>
                <strong>{stats?.totalOrders ?? '—'}</strong>
              </div>
              <div>
                <span>Ingresos hoy</span>
                <strong style={{ fontSize: 18 }}>{money(stats?.revenueToday ?? 0)}</strong>
              </div>
              <div>
                <span>Estudiantes registrados</span>
                <strong>{stats?.totalUsers ?? '—'}</strong>
              </div>
              <div>
                <span>Items en menú</span>
                <strong>{stats?.totalMenuItems ?? '—'} <small>({stats?.availableItems ?? '—'} activos)</small></strong>
              </div>
            </div>
            <div className="panel-heading" style={{ marginTop: 24 }}>
              <div><h2>Demanda histórica</h2><p>Por item</p></div>
            </div>
            {stats?.demand?.length
              ? (
                <div className="bars" style={{ marginTop: 20 }}>
                  {stats.demand.map((item, i) => (
                    <div className="bar-row" key={item.name}>
                      <span>{item.name}</span>
                      <div className="bar-track">
                        <div className={`bar-fill ${barColors[i % barColors.length]}`}
                          style={{ width: `${(item.qty / demandMax) * 100}%` }} />
                      </div>
                      <strong>{item.qty}</strong>
                    </div>
                  ))}
                </div>
              )
              : <p className="empty-chart">Aún no hay pedidos registrados.</p>
            }
          </section>
        )}

        {/* ── MODAL agregar / editar ── */}
        {(showAdd || editing) && (
          <div className="modal-backdrop">
            <div className="modal">
              <button className="modal-close" onClick={() => { setShowAdd(false); setEditing(null) }}>
                <X size={18} />
              </button>
              <p className="eyebrow">{editing ? 'EDITAR IMPLEMENTO' : 'NUEVO IMPLEMENTO'}</p>
              <h2>{editing ? 'Actualizar menú' : 'Agregar al menú'}</h2>

              <label>
                Nombre
                <input
                  value={editing ? editing.name : newItem.name}
                  onChange={(e) => editing
                    ? setEditing({ ...editing, name: e.target.value })
                    : setNewItem({ ...newItem, name: e.target.value })}
                  placeholder="Ej. Sándwich de pollo"
                />
              </label>

              <label>
                Categoría
                <select
                  value={editing ? editing.category : newItem.category}
                  onChange={(e) => editing
                    ? setEditing({ ...editing, category: e.target.value })
                    : setNewItem({ ...newItem, category: e.target.value })}
                  style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13 }}
                >
                  <option>Almuerzos</option>
                  <option>Bebidas</option>
                  <option>Snacks</option>
                </select>
              </label>

              <label>
                Precio
                <input
                  type="number"
                  value={editing ? editing.price : newItem.price}
                  onChange={(e) => editing
                    ? setEditing({ ...editing, price: Number(e.target.value) })
                    : setNewItem({ ...newItem, price: Number(e.target.value) })}
                />
              </label>

              <label>
                Ícono
                <select
                  value={editing ? editing.iconKey : newItem.iconKey}
                  onChange={(e) => editing
                    ? setEditing({ ...editing, iconKey: e.target.value })
                    : setNewItem({ ...newItem, iconKey: e.target.value })}
                  style={{ padding: '10px', border: '1px solid var(--border)', borderRadius: 7, fontSize: 13 }}
                >
                  <option value="salad">🥗 Bowl / Ensalada</option>
                  <option value="sandwich">🥪 Sándwich / Wrap</option>
                  <option value="coffee">☕ Café</option>
                  <option value="cookie">🍪 Snack / Galleta</option>
                  <option value="cupsoda">🥤 Bebida fría</option>
                </select>
              </label>

              {editing && (
                <label style={{ flexDirection: 'row', alignItems: 'center', gap: 10, display: 'flex' }}>
                  <input
                    type="checkbox"
                    checked={editing.available}
                    onChange={(e) => setEditing({ ...editing, available: e.target.checked })}
                    style={{ width: 16, height: 16 }}
                  />
                  Disponible en el menú
                </label>
              )}

              <div className="modal-actions">
                <button className="outline-button" onClick={() => { setShowAdd(false); setEditing(null) }}>
                  Cancelar
                </button>
                <button className="primary-button" onClick={saveItem} disabled={saving}>
                  {saving ? 'Guardando...' : editing ? 'Guardar cambios' : 'Agregar implemento'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════════════
export default function CafeApp({
  role, userName, email, onLogout,
}: {
  role: 'admin' | 'student'; userName: string; email: string; onLogout: () => void
}) {
  return role === 'admin'
    ? <AdminView userName={userName} email={email} onLogout={onLogout} />
    : <StudentView userName={userName} email={email} onLogout={onLogout} />
}
