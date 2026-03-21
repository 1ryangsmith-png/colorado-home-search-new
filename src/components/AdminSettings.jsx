import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DEFAULT_WEIGHTS, SOURCES, TARGET_CITIES } from '../lib/constants';

export default function AdminSettings({
  userId,
  weights,
  onWeightsChange,
  exclusionSettings,
  onExclusionChange,
  isAdmin,
  onTriggerSync,
}) {
  const [localWeights, setLocalWeights] = useState(weights);
  const [localExclusions, setLocalExclusions] = useState(exclusionSettings);
  const [syncLog, setSyncLog] = useState([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchSyncLog();
  }, []);

  async function fetchSyncLog() {
    const { data } = await supabase
      .from('sync_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setSyncLog(data || []);
  }

  function updateWeight(key, value) {
    setLocalWeights((w) => ({ ...w, [key]: Number(value) }));
  }

  function updateExclusion(key, value) {
    setLocalExclusions((e) => ({ ...e, [key]: value }));
  }

  async function saveSettings() {
    setSaving(true);
    setMessage('');

    try {
      // Upsert scoring weights
      const { error } = await supabase
        .from('scoring_weights')
        .upsert({
          user_id: userId,
          weights: localWeights,
          ...localExclusions,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      onWeightsChange(localWeights);
      onExclusionChange(localExclusions);
      setMessage('Settings saved successfully!');
    } catch (err) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleTriggerSync() {
    setSyncing(true);
    try {
      await onTriggerSync();
      setMessage('Sync triggered! Refresh in a moment to see new listings.');
      fetchSyncLog();
    } catch (err) {
      setMessage(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  }

  const weightLabels = {
    dogs_allowed: 'Dogs Allowed',
    backyard: 'Backyard',
    garage: 'Garage',
    bedrooms: 'Bedrooms (3+)',
    lot_size: 'Lot Size',
    property_type: 'Property Type',
    privacy_proxy: 'Privacy / Spacing',
    value_score: 'Price Value',
    density: 'Low Density',
  };

  const totalWeight = Object.values(localWeights).reduce((sum, w) => sum + w, 0);

  return (
    <div className="admin-settings">
      <div className="admin-section">
        <h2>Scoring Weights</h2>
        <p className="admin-desc">
          Adjust how much each factor matters in the match score.
          Total weight: <strong>{totalWeight}</strong> (higher = more influence)
        </p>

        <div className="weights-grid">
          {Object.entries(weightLabels).map(([key, label]) => (
            <div key={key} className="weight-item">
              <label>{label}</label>
              <div className="weight-control">
                <input
                  type="range"
                  min="0"
                  max="25"
                  value={localWeights[key] || 0}
                  onChange={(e) => updateWeight(key, e.target.value)}
                />
                <span className="weight-value">{localWeights[key] || 0}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          className="btn-text"
          onClick={() => setLocalWeights(DEFAULT_WEIGHTS)}
        >
          Reset to defaults
        </button>
      </div>

      <div className="admin-section">
        <h2>Exclusion Rules</h2>
        <p className="admin-desc">
          Properties that fail these requirements will be excluded from results entirely.
        </p>

        <div className="exclusion-toggles">
          {[
            { key: 'exclude_no_dogs', label: 'Exclude homes that don\'t allow dogs' },
            { key: 'exclude_no_backyard', label: 'Exclude homes without a backyard' },
            { key: 'exclude_no_garage', label: 'Exclude homes without a garage' },
            { key: 'exclude_under_3br', label: 'Exclude homes with fewer than 3 bedrooms' },
          ].map(({ key, label }) => (
            <label key={key} className="toggle-row">
              <input
                type="checkbox"
                checked={localExclusions[key]}
                onChange={(e) => updateExclusion(key, e.target.checked)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="admin-actions">
        <button className="btn-primary" onClick={saveSettings} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        {message && <span className="admin-message">{message}</span>}
      </div>

      {/* Sync controls (admin only) */}
      {isAdmin && (
        <div className="admin-section">
          <h2>Data Sync</h2>
          <p className="admin-desc">
            Listings are automatically synced every hour. You can trigger a manual sync below.
          </p>
          <button
            className="btn-secondary"
            onClick={handleTriggerSync}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Trigger Manual Sync'}
          </button>

          {syncLog.length > 0 && (
            <div className="sync-log">
              <h3>Recent Sync History</h3>
              <table className="sync-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Source</th>
                    <th>Status</th>
                    <th>New</th>
                    <th>Updated</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {syncLog.map((log) => (
                    <tr key={log.id}>
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                      <td>{log.source}</td>
                      <td className={`status-${log.status}`}>{log.status}</td>
                      <td>{log.listings_new}</td>
                      <td>{log.listings_updated}</td>
                      <td>{log.duration_ms ? `${(log.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Source Information */}
      <div className="admin-section">
        <h2>Data Sources</h2>
        <p className="admin-desc">
          Overview of supported listing sources and their ingestion method.
        </p>
        <div className="sources-list">
          {Object.entries(SOURCES).map(([key, source]) => (
            <div key={key} className="source-item">
              <div className="source-color" style={{ backgroundColor: source.color }} />
              <div className="source-info">
                <span className="source-name">{source.name}</span>
                <span className={`source-type ${source.automated ? 'automated' : 'manual'}`}>
                  {source.automated ? 'Automated' : 'Manual Import'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
