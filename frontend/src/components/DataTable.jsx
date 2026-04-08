export default function DataTable({ columns, rows }) {
  return (
    <div className="table-container table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="empty-row">
                No records found.
              </td>
            </tr>
          )}
          {rows.map((row, idx) => (
            <tr key={row.id || idx}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(row, idx) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
