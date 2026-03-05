import type { GenieQueryResult } from "@/lib/genie-types";

const MAX_VISIBLE_ROWS = 100;

interface ResultTableProps {
  queryResult: GenieQueryResult;
}

function formatCellValue(value: string | number | boolean | null): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value.toLocaleString() : String(value);
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return value;
}

export function ResultTable({ queryResult }: ResultTableProps) {
  const visibleRows = queryResult.rows.slice(0, MAX_VISIBLE_ROWS);
  const rowCount = Math.max(queryResult.rowCount, queryResult.rows.length);

  if (queryResult.columns.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-sm text-[var(--muted)]">
        Query completed, but no tabular result was returned.
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--surface)]">
        <table className="data-table">
          <thead>
            <tr>
              {queryResult.columns.map((column) => (
                <th key={column} className="text-left">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td className="text-[var(--muted)]" colSpan={queryResult.columns.length}>
                  No rows returned.
                </td>
              </tr>
            ) : (
              visibleRows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {queryResult.columns.map((column, columnIndex) => (
                    <td key={`${column}-${columnIndex}`} className="align-top">
                      {formatCellValue(row[columnIndex] ?? null)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {rowCount > visibleRows.length ? (
        <p className="mt-2 text-xs text-[var(--muted)]">
          Showing {visibleRows.length.toLocaleString()} of {rowCount.toLocaleString()} rows.
        </p>
      ) : null}
    </div>
  );
}
