import { useEffect, useState } from 'react'
import { useApiClient } from '../hooks/useApiClient.js'
import { PortalCard } from '../components/PortalCard.jsx'
import { DataTable } from '../components/DataTable.jsx'

export function DashboardPage () {
  const api = useApiClient()
  const [discrepancies, setDiscrepancies] = useState([])
  const [rules, setRules] = useState([])
  const [errors, setErrors] = useState([])
  const [analyses, setAnalyses] = useState([])

  useEffect(() => {
    async function loadDashboard () {
      const [discRes, ruleRes, errorRes, analysisRes] = await Promise.all([
        api.get('/dashboard'),
        api.get('/rules'),
        api.get('/errors'),
        api.get('/llm-analyses')
      ])
      setDiscrepancies(discRes.data.data)
      setRules(ruleRes.data.data)
      setErrors(errorRes.data.data)
      setAnalyses(analysisRes.data.data)
    }
    loadDashboard()
  }, [api])

  const metrics = {
    totalDiscrepancies: discrepancies.length,
    critical: discrepancies.filter(item => item.severity === 'critical').length,
    pendingReview: discrepancies.filter(item => !item.reviewed).length,
    llmAnalyses: analyses.length
  }

  return (
    <div className="portal-grid">
      <PortalCard
        title="Reconciliation Health"
        description="Track discrepancies, validation errors, and AI output to prioritise vendor follow-up."
      >
        <div className="dashboard-grid">
          <div className="metric-card">
            <h3>Total Discrepancies</h3>
            <p>{metrics.totalDiscrepancies}</p>
          </div>
          <div className="metric-card">
            <h3>Critical Issues</h3>
            <p>{metrics.critical}</p>
          </div>
          <div className="metric-card">
            <h3>Pending Review</h3>
            <p>{metrics.pendingReview}</p>
          </div>
          <div className="metric-card">
            <h3>LLM Analyses</h3>
            <p>{metrics.llmAnalyses}</p>
          </div>
        </div>
      </PortalCard>

      <PortalCard
        title="Discrepancy Register"
        description="Centralised log of every mismatch discovered during reconciliation."
      >
        <DataTable
          columns={[
            { header: 'ID', accessor: 'discrepancy_id' },
            { header: 'Invoice', accessor: 'linked_invoice_id' },
            { header: 'PO', accessor: 'linked_po_id' },
            { header: 'Issue Type', accessor: 'issue_type' },
            { header: 'Severity', accessor: 'severity', cell: value => <span className={`status-chip ${value}`}>{value}</span> },
            { header: 'Summary', accessor: 'summary' },
            { header: 'Detected By', accessor: 'detected_by' },
            { header: 'Reviewed', accessor: 'reviewed', cell: value => value ? 'Yes' : 'No' }
          ]}
          data={discrepancies.map(record => ({ ...record }))}
        />
      </PortalCard>

      <PortalCard
        title="Rule Validation"
        description="Outcome of deterministic controls comparing invoices against contractual obligations."
      >
        <DataTable
          columns={[
            { header: 'Rule', accessor: 'rule_id' },
            { header: 'Description', accessor: 'description' },
            { header: 'Status', accessor: 'passed', cell: value => value ? <span className="status-chip success">Passed</span> : <span className="status-chip warning">Failed</span> },
            { header: 'Details', accessor: 'details' }
          ]}
          data={rules.map(rule => ({ ...rule }))}
        />
      </PortalCard>

      <PortalCard
        title="System Errors"
        description="Operational issues logged while parsing files or executing reconciliation steps."
      >
        <DataTable
          columns={[
            { header: 'Error ID', accessor: 'error_id' },
            { header: 'Step', accessor: 'step' },
            { header: 'Message', accessor: 'message' },
            { header: 'Timestamp', accessor: 'timestamp' }
          ]}
          data={errors.map(err => ({ ...err }))}
        />
      </PortalCard>

      <PortalCard
        title="LLM Insights"
        description="Recommendations provided by the OpenAI-powered analysis layer."
      >
        <DataTable
          columns={[
            { header: 'Analysis ID', accessor: 'analysis_id' },
            { header: 'PO', accessor: 'linked_po_id' },
            { header: 'Invoice', accessor: 'linked_invoice_id' },
            { header: 'Summary', accessor: 'summary' },
            { header: 'Flagged Issues', accessor: 'flagged_issues', cell: value => value?.join(', ') },
            { header: 'Recommendations', accessor: 'recommendations', cell: value => value?.join(', ') }
          ]}
          data={analyses.map(entry => ({ ...entry }))}
        />
      </PortalCard>
    </div>
  )
}
