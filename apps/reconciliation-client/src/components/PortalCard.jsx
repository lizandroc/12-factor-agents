export function PortalCard ({ title, description, actions, children }) {
  return (
    <section className="portal-card">
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
      {actions && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {actions}
        </div>
      )}
    </section>
  )
}
