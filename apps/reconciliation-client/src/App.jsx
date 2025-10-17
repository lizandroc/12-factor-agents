import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout.jsx'
import { OverviewPage } from './pages/OverviewPage.jsx'
import { ContractsPage } from './pages/ContractsPage.jsx'
import { PurchaseOrdersPage } from './pages/PurchaseOrdersPage.jsx'
import { InvoicesPage } from './pages/InvoicesPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'

export default function App () {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<OverviewPage />} />
        <Route path="/contracts" element={<ContractsPage />} />
        <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
        <Route path="/invoices" element={<InvoicesPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
      </Routes>
    </Layout>
  )
}
