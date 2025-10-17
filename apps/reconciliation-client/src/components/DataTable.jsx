export function DataTable ({ columns, data }) {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            {columns.map(column => (
              <th key={column.accessor}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '2rem' }}>
                No records found.
              </td>
            </tr>
          )}
          {data.map(row => (
            <tr key={row.id ?? row[columns[0].accessor]}>
              {columns.map(column => (
                <td key={column.accessor}>
                  {typeof column.cell === 'function' ? column.cell(row[column.accessor], row) : row[column.accessor]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
