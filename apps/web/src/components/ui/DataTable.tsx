export type Column<T> = {
  header: string;
  render: (row: T) => React.ReactNode;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage = "Nothing here yet.",
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]">
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-b border-[color:var(--color-border)] text-[color:var(--color-text-secondary)]">
            {columns.map((col) => (
              <th key={col.header} className="px-4 py-3 font-medium">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-[color:var(--color-text-secondary)]"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-[color:var(--color-border)] last:border-0"
              >
                {columns.map((col) => (
                  <td key={col.header} className="px-4 py-3">
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
