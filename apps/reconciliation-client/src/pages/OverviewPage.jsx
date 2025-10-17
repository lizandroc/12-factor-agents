import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApiClient } from '../hooks/useApiClient.js'
import { PortalCard } from '../components/PortalCard.jsx'

export function OverviewPage () {
  const api = useApiClient()
  const [metrics, setMetrics] = useState({ contracts: 0, purchaseOrders: 0, invoices: 0 })
  const [authMessage, setAuthMessage] = useState(null)
  const [authError, setAuthError] = useState(null)
  const [emailForm, setEmailForm] = useState({ email: '', name: '' })
  const [googleForm, setGoogleForm] = useState({ email: '', name: '' })

  useEffect(() => {
    async function loadCounts () {
      const [contractsRes, poRes, invoicesRes] = await Promise.all([
        api.get('/contracts'),
        api.get('/purchase-orders'),
        api.get('/invoices')
      ])
      setMetrics({
        contracts: contractsRes.data.data.length,
        purchaseOrders: poRes.data.data.length,
        invoices: invoicesRes.data.data.length
      })
    }
    loadCounts()
  }, [api])

  async function handleAuth (path, payload) {
    try {
      setAuthError(null)
      const { data } = await api.post(path, payload)
      setAuthMessage(`Authenticated ${data.email} via ${data.auth_method}. Token expires in ${data.expires_in}s.`)
    } catch (error) {
      setAuthMessage(null)
      setAuthError(error.response?.data?.errors?.join(', ') ?? error.message)
    }
  }

  return (
    <div className="portal-grid">
      <PortalCard
        title="Authentication Sandbox"
        description="Use temporary Google or email flows to simulate user access. Tokens are issued for development only."
      >
        {authMessage && <div className="alert success">{authMessage}</div>}
        {authError && <div className="alert error">{authError}</div>}
        <div className="form-grid">
          <div>
            <h3>Email Login</h3>
            <input
              placeholder="Email"
              value={emailForm.email}
              onChange={event => setEmailForm(prev => ({ ...prev, email: event.target.value }))}
            />
            <input
              placeholder="Name"
              value={emailForm.name}
              onChange={event => setEmailForm(prev => ({ ...prev, name: event.target.value }))}
              style={{ marginTop: '0.5rem' }}
            />
            <button className="button" style={{ marginTop: '0.75rem' }} onClick={() => handleAuth('/auth/email', emailForm)}>Login with Email</button>
          </div>
          <div>
            <h3>Google Login</h3>
            <input
              placeholder="Google Email"
              value={googleForm.email}
              onChange={event => setGoogleForm(prev => ({ ...prev, email: event.target.value }))}
            />
            <input
              placeholder="Name"
              value={googleForm.name}
              onChange={event => setGoogleForm(prev => ({ ...prev, name: event.target.value }))}
              style={{ marginTop: '0.5rem' }}
            />
            <button className="button secondary" style={{ marginTop: '0.75rem' }} onClick={() => handleAuth('/auth/google', googleForm)}>Login with Google</button>
          </div>
        </div>
      </PortalCard>

      <PortalCard
        title="Portal Summary"
        description="Quick insight into how many records exist across each workspace."
      >
        <div className="dashboard-grid">
          <div className="metric-card">
            <h3>Contracts</h3>
            <p>{metrics.contracts}</p>
          </div>
          <div className="metric-card">
            <h3>Purchase Orders</h3>
            <p>{metrics.purchaseOrders}</p>
          </div>
          <div className="metric-card">
            <h3>Invoices</h3>
            <p>{metrics.invoices}</p>
          </div>
        </div>
      </PortalCard>

      <PortalCard
        title="Workflow Shortcuts"
        description="Jump into each portal to upload contracts, manage POs, reconcile invoices, and review discrepancies."
        actions={[
          <Link key="contracts" to="/contracts" className="button">Contracts Portal</Link>,
          <Link key="po" to="/purchase-orders" className="button secondary">PO Portal</Link>,
          <Link key="invoices" to="/invoices" className="button">Invoice Portal</Link>,
          <Link key="dashboard" to="/dashboard" className="button secondary">Admin Dashboard</Link>
        ]}
      />
    </div>
  )
}
