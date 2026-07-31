export type Column<T> = {
  header: string;
  render: (row: T) => React.ReactNode;
};

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  emptyMessage = "Nothing here yet.",
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}) {
  return (
    /* Double-Bezel outer shell */
    <div className="rounded-[1.375rem] border border-[color:var(--color-border)] bg-[color:var(--color-surface-sunken)] p-1 shadow-sm">
      <div
        className="overflow-x-auto rounded-[1rem] bg-[color:var(--color-surface)]"
        style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9)" }}
      >
        <table className="w-full min-w-max text-left text-sm">
          <thead>
            <tr className="border-b border-[color:var(--color-border)] text-[color:var(--color-text-secondary)]">
              {columns.map((col) => (
                <th key={col.header} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide">
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
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={`border-b border-[color:var(--color-border)] last:border-0 transition-colors duration-200 hover:bg-[color:var(--color-surface-sunken)] ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
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
    </div>
  );
}
