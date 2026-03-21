import { TABS, VIEW_MODES } from '../lib/constants';

export default function Layout({
  children,
  user,
  profile,
  activeTab,
  onTabChange,
  viewMode,
  onViewModeChange,
  onSignOut,
  unreadAlerts,
  onToggleAlerts,
  onShowImport,
  isAdmin,
  counts,
}) {
  const tabs = [
    { id: TABS.SEARCH, label: 'Search', icon: '🔍', count: counts.search },
    { id: TABS.FAVORITES, label: 'Favorites', icon: '❤️', count: counts.favorites },
    { id: TABS.NEW, label: 'New', icon: '✨', count: counts.new },
    { id: TABS.PRICE_DROPS, label: 'Price Drops', icon: '📉', count: counts.priceDrops },
    { id: TABS.HIDDEN, label: 'Hidden', icon: '👁️‍🗨️', count: counts.hidden },
    { id: TABS.ADMIN, label: 'Settings', icon: '⚙️' },
  ];

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <svg viewBox="0 0 32 32" width="28" height="28" className="header-logo">
            <rect width="32" height="32" rx="6" fill="var(--color-primary)" />
            <path d="M16 7L6 15h3v10h14V15h3L16 7z" fill="white" />
            <rect x="13" y="18" width="6" height="7" rx="1" fill="var(--color-primary)" />
          </svg>
          <h1 className="header-title">Colorado Home Search</h1>
        </div>

        <div className="header-actions">
          <button className="btn-icon" onClick={onShowImport} title="Add listing manually">
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
          </button>

          <button
            className="btn-icon alerts-btn"
            onClick={onToggleAlerts}
            title="Notifications"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" fill="currentColor">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
            {unreadAlerts > 0 && <span className="alert-badge">{unreadAlerts}</span>}
          </button>

          <div className="user-menu">
            <span className="user-name">{profile?.display_name || user.email}</span>
            <button className="btn-text" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="tab-nav">
        <div className="tab-list">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
              {tab.count != null && tab.count > 0 && (
                <span className="tab-count">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {activeTab !== TABS.ADMIN && (
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === VIEW_MODES.GRID ? 'active' : ''}`}
              onClick={() => onViewModeChange(VIEW_MODES.GRID)}
              title="Grid view"
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM11 13a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button
              className={`view-btn ${viewMode === VIEW_MODES.LIST ? 'active' : ''}`}
              onClick={() => onViewModeChange(VIEW_MODES.LIST)}
              title="List view"
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              className={`view-btn ${viewMode === VIEW_MODES.MAP ? 'active' : ''}`}
              onClick={() => onViewModeChange(VIEW_MODES.MAP)}
              title="Map view"
            >
              <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor">
                <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM14 5.586v12.828l2.293-2.293A1 1 0 0017 16V6a1 1 0 00-.293-.707L14 2.586v3z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="app-main">{children}</main>
    </div>
  );
}
