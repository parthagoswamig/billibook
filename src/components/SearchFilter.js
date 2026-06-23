import React, { useState } from 'react';

function SearchFilter({ onSearch, onFilter, filters = [], searchPlaceholder = 'Search...' }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilters, setActiveFilters] = useState({});
  const [showFilters, setShowFilters] = useState(false);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (onSearch) onSearch(value);
  };

  const handleFilterChange = (filterKey, value) => {
    const newFilters = { ...activeFilters, [filterKey]: value };
    setActiveFilters(newFilters);
    if (onFilter) onFilter(newFilters);
  };

  const clearFilters = () => {
    setActiveFilters({});
    setSearchTerm('');
    if (onSearch) onSearch('');
    if (onFilter) onFilter({});
  };

  const hasActiveFilters = Object.values(activeFilters).some(value => value !== '' && value !== null && value !== undefined);

  return (
    <div className="search-filter-container">
      <div className="search-bar">
        <span className="search-icon">🔍</span>
        <input 
          type="text" 
          className="search-input"
          placeholder={searchPlaceholder}
          value={searchTerm}
          onChange={handleSearchChange}
        />
        {hasActiveFilters && (
          <button 
            className="clear-filters-btn"
            onClick={clearFilters}
            type="button"
          >
            Clear
          </button>
        )}
        {filters.length > 0 && (
          <button 
            className="toggle-filters-btn"
            onClick={() => setShowFilters(!showFilters)}
            type="button"
          >
            {showFilters ? '▲' : '▼'} Filters
          </button>
        )}
      </div>

      {showFilters && filters.length > 0 && (
        <div className="filters-panel">
          {filters.map((filter) => (
            <div key={filter.key} className="filter-item">
              <label className="filter-label">{filter.label}</label>
              {filter.type === 'select' ? (
                <select 
                  className="filter-select"
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                >
                  <option value="">All</option>
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : filter.type === 'date' ? (
                <input 
                  type="date" 
                  className="filter-input"
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                />
              ) : filter.type === 'date-range' ? (
                <div className="date-range-filter">
                  <input 
                    type="date" 
                    className="filter-input"
                    placeholder="From"
                    value={activeFilters[`${filter.key}_from`] || ''}
                    onChange={(e) => handleFilterChange(`${filter.key}_from`, e.target.value)}
                  />
                  <span className="date-separator">to</span>
                  <input 
                    type="date" 
                    className="filter-input"
                    placeholder="To"
                    value={activeFilters[`${filter.key}_to`] || ''}
                    onChange={(e) => handleFilterChange(`${filter.key}_to`, e.target.value)}
                  />
                </div>
              ) : filter.type === 'number-range' ? (
                <div className="number-range-filter">
                  <input 
                    type="number" 
                    className="filter-input"
                    placeholder="Min"
                    value={activeFilters[`${filter.key}_min`] || ''}
                    onChange={(e) => handleFilterChange(`${filter.key}_min`, e.target.value)}
                  />
                  <span className="range-separator">-</span>
                  <input 
                    type="number" 
                    className="filter-input"
                    placeholder="Max"
                    value={activeFilters[`${filter.key}_max`] || ''}
                    onChange={(e) => handleFilterChange(`${filter.key}_max`, e.target.value)}
                  />
                </div>
              ) : (
                <input 
                  type="text" 
                  className="filter-input"
                  value={activeFilters[filter.key] || ''}
                  onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                  placeholder={filter.placeholder || 'Filter...'}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {hasActiveFilters && (
        <div className="active-filters">
          {Object.entries(activeFilters).map(([key, value]) => {
            if (!value || value === '') return null;
            const filter = filters.find(f => f.key === key || key.startsWith(f.key));
            if (!filter) return null;
            
            let displayValue = value;
            if (key.includes('_from') || key.includes('_min')) {
              displayValue = `${filter.label} ≥ ${value}`;
            } else if (key.includes('_to') || key.includes('_max')) {
              displayValue = `${filter.label} ≤ ${value}`;
            } else {
              const option = filter.options?.find(opt => opt.value === value);
              displayValue = option ? option.label : value;
            }

            return (
              <span key={key} className="active-filter-tag">
                {displayValue}
                <button 
                  className="remove-filter-btn"
                  onClick={() => handleFilterChange(key, '')}
                  type="button"
                >
                  ✕
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SearchFilter;
