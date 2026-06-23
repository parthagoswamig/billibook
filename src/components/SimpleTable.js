import React from 'react';

function SimpleTable({ columns, rows, rowIds, onRowClick }) {
  // Check if a cell contains a status badge or regular text to apply proper styling
  const renderCellContent = (cell, cellIndex, columnName) => {
    if (typeof cell === 'string') {
      const lower = cell.toLowerCase();
      // Handle status labels
      if (['paid', 'unpaid', 'partial', 'overdue', 'draft', 'sent', 'pending', 'active'].includes(lower)) {
        return <span className={`status-badge status-${lower}`}>{cell}</span>;
      }
      
      // Highlight Invoice/Document numbers
      if (cellIndex === 0 && (lower.startsWith('inv') || lower.startsWith('pur') || lower.startsWith('quo') || lower.startsWith('est') || lower.startsWith('pi') || lower.startsWith('dc') || lower.startsWith('cn') || lower.startsWith('dn'))) {
        return <span className="invoice-number-cell">{cell}</span>;
      }

      // Format currency fields
      if (cell.includes('₹') || cell.includes('$')) {
        return <span className="amount-cell">{cell}</span>;
      }
    }
    return cell;
  };

  return (
    <div className="simple-table-wrapper">
      <table className="simple-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={rowIds?.[index] || `row-${index}`}
              onClick={onRowClick ? () => onRowClick(rowIds?.[index], index) : undefined}
            >
              {row.map((cell, cellIndex) => (
                <td key={`cell-${index}-${cellIndex}`}>
                  {renderCellContent(cell, cellIndex, columns[cellIndex])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default SimpleTable;
