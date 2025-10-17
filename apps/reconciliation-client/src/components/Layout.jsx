import { NavLink } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/contracts', label: 'Contract Upload' },
  { to: '/purchase-orders', label: 'PO Management' },
  { to: '/invoices', label: 'Invoice Management' },
  { to: '/dashboard', label: 'Admin Dashboard' }
]

export function Layout ({ children }) {
  return (
    <div className="app-container">
      <aside className="sidebar">
        <h1>PO Reconciliation</h1>
        <nav>
          {navItems.map(item => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => isActive ? 'active' : ''}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  )
}
