import { useState } from 'react';
import { TARGET_CITIES, PROPERTY_TYPES, DOG_POLICIES } from '../lib/constants';

export default function ManualImport({ userId, onClose, onImported }) {
  const [mode, setMode] = useState('url'); // 'url' or 'manual'
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [partialData, setPartialData] = useState(null);

  // Manual entry form state
  const [form, setForm] = useState({
    address: '',
    city: 'Parker',
    state: 'CO',
    zip: '',
    price: '',
    bedrooms: 3,
    bathrooms: 2,
    sqft: '',
    lot_size_acres: '',
    property_type: 'single_family',
    dogs_policy: 'unknown',
    has_backyard: null,
    has_garage: null,
    garage_spaces: '',
    source_url: '',
    thumbnail_url: '',
  });

  const updateForm = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  async function handleURLImport(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPartialData(null);

    try {
      const res = await fetch('/.netlify/functions/manual-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, user_id: userId }),
      });

      const data = await res.json();

      if (res.status === 422 && data.partial) {
        // Partial data — switch to manual mode with prefilled data
        setPartialData(data.partial);
        setForm((f) => ({ ...f, ...data.partial, source_url: url }));
        setMode('manual');
        setError('Could not fully parse this URL. Please fill in the missing fields below.');
      } else if (res.status === 409) {
        setError('This property already exists in your database.');
      } else if (!res.ok) {
        setError(data.error || 'Import failed');
      } else {
        onImported();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleManualSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const property = {
        ...form,
        price: form.price ? Number(form.price) : null,
        bedrooms: form.bedrooms ? Number(form.bedrooms) : null,
        bathrooms: form.bathrooms ? Number(form.bathrooms) : null,
        sqft: form.sqft ? Number(form.sqft) : null,
        lot_size_acres: form.lot_size_acres ? Number(form.lot_size_acres) : null,
        garage_spaces: form.garage_spaces ? Number(form.garage_spaces) : null,
        has_backyard: form.has_backyard === 'true' ? true : form.has_backyard === 'false' ? false : null,
        has_garage: form.has_garage === 'true' ? true : form.has_garage === 'false' ? false : null,
        dogs_allowed: form.dogs_policy === 'allowed',
        source: 'manual',
        images: form.thumbnail_url ? [{ url: form.thumbnail_url, source: 'manual' }] : [],
      };

      const res = await fetch('/.netlify/functions/manual-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property, user_id: userId }),
      });

      const data = await res.json();

      if (res.status === 409) {
        setError('This property already exists.');
      } else if (!res.ok) {
        setError(data.error || 'Import failed');
      } else {
        onImported();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add Listing</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Mode toggle */}
        <div className="import-mode-toggle">
          <button
            className={`mode-btn ${mode === 'url' ? 'active' : ''}`}
            onClick={() => setMode('url')}
          >
            Paste URL
          </button>
          <button
            className={`mode-btn ${mode === 'manual' ? 'active' : ''}`}
            onClick={() => setMode('manual')}
          >
            Enter Manually
          </button>
        </div>

        {error && <div className="auth-error">{error}</div>}

        {mode === 'url' ? (
          <form onSubmit={handleURLImport} className="import-form">
            <p className="import-help">
              Paste a listing URL from Zillow, Redfin, Apartments.com, or any supported source.
              We'll extract what we can from public metadata.
            </p>
            <div className="form-group">
              <label>Listing URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.zillow.com/homedetails/..."
                required
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Importing...' : 'Import Listing'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleManualSubmit} className="import-form manual-form">
            <div className="form-row">
              <div className="form-group flex-2">
                <label>Address *</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => updateForm('address', e.target.value)}
                  placeholder="123 Main St"
                  required
                />
              </div>
              <div className="form-group">
                <label>City *</label>
                <select value={form.city} onChange={(e) => updateForm('city', e.target.value)}>
                  {TARGET_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  <option value="">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>ZIP</label>
                <input
                  type="text"
                  value={form.zip}
                  onChange={(e) => updateForm('zip', e.target.value)}
                  placeholder="80134"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Price ($/mo)</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => updateForm('price', e.target.value)}
                  placeholder="2500"
                />
              </div>
              <div className="form-group">
                <label>Beds</label>
                <input
                  type="number"
                  value={form.bedrooms}
                  onChange={(e) => updateForm('bedrooms', e.target.value)}
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>Baths</label>
                <input
                  type="number"
                  step="0.5"
                  value={form.bathrooms}
                  onChange={(e) => updateForm('bathrooms', e.target.value)}
                  min="0"
                />
              </div>
              <div className="form-group">
                <label>Sq Ft</label>
                <input
                  type="number"
                  value={form.sqft}
                  onChange={(e) => updateForm('sqft', e.target.value)}
                  placeholder="1800"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Lot Size (acres)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.lot_size_acres}
                  onChange={(e) => updateForm('lot_size_acres', e.target.value)}
                  placeholder="0.25"
                />
              </div>
              <div className="form-group">
                <label>Property Type</label>
                <select value={form.property_type} onChange={(e) => updateForm('property_type', e.target.value)}>
                  {Object.entries(PROPERTY_TYPES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Dog Policy</label>
                <select value={form.dogs_policy} onChange={(e) => updateForm('dogs_policy', e.target.value)}>
                  {Object.entries(DOG_POLICIES).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Backyard?</label>
                <select value={String(form.has_backyard)} onChange={(e) => updateForm('has_backyard', e.target.value)}>
                  <option value="null">Unknown</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div className="form-group">
                <label>Garage?</label>
                <select value={String(form.has_garage)} onChange={(e) => updateForm('has_garage', e.target.value)}>
                  <option value="null">Unknown</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>
              <div className="form-group">
                <label>Garage Spaces</label>
                <input
                  type="number"
                  value={form.garage_spaces}
                  onChange={(e) => updateForm('garage_spaces', e.target.value)}
                  min="0"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Listing URL (optional)</label>
              <input
                type="url"
                value={form.source_url}
                onChange={(e) => updateForm('source_url', e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="form-group">
              <label>Image URL (optional)</label>
              <input
                type="url"
                value={form.thumbnail_url}
                onChange={(e) => updateForm('thumbnail_url', e.target.value)}
                placeholder="https://photos.example.com/image.jpg"
              />
            </div>

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Listing'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
