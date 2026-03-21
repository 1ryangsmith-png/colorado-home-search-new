import { TARGET_CITIES, PROPERTY_TYPES, SOURCES } from '../lib/constants';

export default function FilterBar({ filters, onFiltersChange, resultCount, activeTab }) {
  const updateFilter = (key, value) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleCity = (city) => {
    const cities = filters.cities || [];
    const updated = cities.includes(city)
      ? cities.filter((c) => c !== city)
      : [...cities, city];
    updateFilter('cities', updated);
  };

  const togglePropertyType = (type) => {
    const types = filters.propertyTypes || [];
    const updated = types.includes(type)
      ? types.filter((t) => t !== type)
      : [...types, type];
    updateFilter('propertyTypes', updated);
  };

  return (
    <div className="filter-bar">
      <div className="filter-row">
        {/* Search */}
        <div className="filter-group search-group">
          <input
            type="text"
            placeholder="Search address, city, neighborhood..."
            value={filters.search || ''}
            onChange={(e) => updateFilter('search', e.target.value)}
            className="filter-search"
          />
        </div>

        {/* Price range */}
        <div className="filter-group">
          <label>Price</label>
          <div className="price-inputs">
            <input
              type="number"
              placeholder="Min"
              value={filters.minPrice || ''}
              onChange={(e) => updateFilter('minPrice', e.target.value ? Number(e.target.value) : null)}
              className="filter-input small"
            />
            <span className="price-separator">–</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.maxPrice || ''}
              onChange={(e) => updateFilter('maxPrice', e.target.value ? Number(e.target.value) : null)}
              className="filter-input small"
            />
          </div>
        </div>

        {/* Min Bedrooms */}
        <div className="filter-group">
          <label>Min Beds</label>
          <select
            value={filters.minBeds || ''}
            onChange={(e) => updateFilter('minBeds', e.target.value ? Number(e.target.value) : null)}
            className="filter-select"
          >
            <option value="">Any</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="5">5+</option>
          </select>
        </div>

        {/* Source filter */}
        <div className="filter-group">
          <label>Source</label>
          <select
            value={filters.source || ''}
            onChange={(e) => updateFilter('source', e.target.value || null)}
            className="filter-select"
          >
            <option value="">All Sources</option>
            {Object.entries(SOURCES).map(([key, src]) => (
              <option key={key} value={key}>{src.name}</option>
            ))}
          </select>
        </div>

        {/* Result count */}
        <div className="filter-results">
          <span className="result-count">{resultCount}</span>
          <span className="result-label">
            {activeTab === 'favorites' ? 'favorites' : 'listings'}
          </span>
        </div>
      </div>

      {/* City and type chips */}
      <div className="filter-chips-row">
        <div className="filter-chips">
          <span className="chips-label">Cities:</span>
          {TARGET_CITIES.map((city) => (
            <button
              key={city}
              className={`filter-chip ${(filters.cities || []).includes(city) ? 'active' : ''}`}
              onClick={() => toggleCity(city)}
            >
              {city}
            </button>
          ))}
        </div>
        <div className="filter-chips">
          <span className="chips-label">Type:</span>
          {Object.entries(PROPERTY_TYPES).map(([key, label]) => (
            <button
              key={key}
              className={`filter-chip ${(filters.propertyTypes || []).includes(key) ? 'active' : ''}`}
              onClick={() => togglePropertyType(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
