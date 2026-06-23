import React from 'react';

function Pagination({ page, limit, totalCount, onChangePage }) {
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const startEntry = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endEntry = Math.min(page * limit, totalCount);

  // Generate page numbers to show (e.g. current page, +/- 2 pages, first, last)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      let start = Math.max(1, page - 2);
      let end = Math.min(totalPages, page + 2);
      
      if (start === 1) {
        end = 5;
      } else if (end === totalPages) {
        start = totalPages - 4;
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    return pages;
  };

  if (totalPages <= 1 && totalCount === 0) return null;

  return (
    <div className="pagination-container">
      <div className="pagination-info">
        Showing <span className="highlight">{startEntry}</span> to <span className="highlight">{endEntry}</span> of <span className="highlight">{totalCount}</span> entries
      </div>
      
      <div className="pagination-buttons">
        <button 
          className="pagination-btn"
          disabled={page === 1} 
          onClick={() => onChangePage(1)}
          title="First Page"
        >
          «
        </button>
        <button 
          className="pagination-btn"
          disabled={page === 1} 
          onClick={() => onChangePage(page - 1)}
          title="Previous Page"
        >
          ‹
        </button>
        
        {getPageNumbers().map(p => (
          <button 
            key={p} 
            className={`pagination-btn page-num-btn ${page === p ? 'active' : ''}`}
            onClick={() => onChangePage(p)}
          >
            {p}
          </button>
        ))}

        <button 
          className="pagination-btn"
          disabled={page === totalPages} 
          onClick={() => onChangePage(page + 1)}
          title="Next Page"
        >
          ›
        </button>
        <button 
          className="pagination-btn"
          disabled={page === totalPages} 
          onClick={() => onChangePage(totalPages)}
          title="Last Page"
        >
          »
        </button>
      </div>

      <style jsx="true">{`
        .pagination-container {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 24px;
          background: #ffffff;
          border-top: 1px solid var(--border, #e2e8f0);
          border-bottom-left-radius: var(--radius-md, 8px);
          border-bottom-right-radius: var(--radius-md, 8px);
          font-family: inherit;
          margin-top: -1px;
        }
        .pagination-info {
          font-size: 13.5px;
          color: var(--text-secondary, #64748b);
        }
        .pagination-info .highlight {
          font-weight: 600;
          color: var(--text-primary, #1e293b);
        }
        .pagination-buttons {
          display: flex;
          gap: 6px;
          align-items: center;
        }
        .pagination-btn {
          min-width: 32px;
          height: 32px;
          padding: 0 6px;
          display: flex;
          justify-content: center;
          align-items: center;
          border: 1px solid var(--border, #e2e8f0);
          background: #ffffff;
          border-radius: var(--radius-sm, 6px);
          font-size: 13.5px;
          font-weight: 500;
          color: var(--text-primary, #1e293b);
          cursor: pointer;
          transition: all 0.15s ease;
          outline: none;
          user-select: none;
        }
        .pagination-btn:hover:not(:disabled) {
          border-color: var(--accent, #4f46e5);
          color: var(--accent, #4f46e5);
          background: #faf5ff;
        }
        .pagination-btn:disabled {
          color: #cbd5e1;
          border-color: #f1f5f9;
          background: #f8fafc;
          cursor: not-allowed;
        }
        .pagination-btn.active {
          background: var(--accent, #4f46e5);
          color: #ffffff;
          border-color: var(--accent, #4f46e5);
          font-weight: 700;
          box-shadow: 0 2px 4px rgba(99, 102, 241, 0.2);
        }
      `}</style>
    </div>
  );
}

export default Pagination;
