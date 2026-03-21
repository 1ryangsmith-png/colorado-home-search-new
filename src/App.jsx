import { useState, useMemo } from 'react';
import { useAuth } from './hooks/useAuth';
import { useProperties } from './hooks/useProperties';
import { useAlerts } from './hooks/useAlerts';
import { TABS, VIEW_MODES } from './lib/constants';
import Layout from './components/Layout';
import Auth from './components/Auth';
import PropertyGrid from './components/PropertyGrid';
import PropertyMap from './components/PropertyMap';
import PropertyDetail from './components/PropertyDetail';
import FilterBar from './components/FilterBar';
import AdminSettings from './components/AdminSettings';
import ManualImport from './components/ManualImport';
import AlertsPanel from './components/AlertsPanel';

export default function App() {
  const { user, profile, loading: authLoading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, isAdmin } = useAuth();
  const {
    properties,
    favorites,
    hidden,
    newListings,
    priceDrops,
    userProperties,
    loading: propsLoading,
    filters,
    setFilters,
    weights,
    setWeights,
    exclusionSettings,
    setExclusionSettings,
    toggleFavorite,
    toggleHidden,
    updateNotes,
    refetch,
  } = useProperties(user?.id);
  const { alerts, unreadCount, markAsRead, markAllAsRead } = useAlerts(user?.id);

  const [activeTab, setActiveTab] = useState(TABS.SEARCH);
  const [viewMode, setViewMode] = useState(VIEW_MODES.GRID);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showImport, setShowImport] = useState(false);

  // Get the right list for the active tab
  const displayProperties = useMemo(() => {
    switch (activeTab) {
      case TABS.FAVORITES:
        return favorites;
      case TABS.NEW:
        return newListings;
      case TABS.PRICE_DROPS:
        return priceDrops;
      case TABS.HIDDEN:
        return hidden;
      default:
        return properties;
    }
  }, [activeTab, properties, favorites, newListings, priceDrops, hidden]);

  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading Colorado Home Search...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <Auth
        onGoogleSignIn={signInWithGoogle}
        onEmailSignIn={signInWithEmail}
        onEmailSignUp={signUpWithEmail}
      />
    );
  }

  return (
    <Layout
      user={user}
      profile={profile}
      activeTab={activeTab}
      onTabChange={(tab) => { setActiveTab(tab); setSelectedProperty(null); }}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      onSignOut={signOut}
      unreadAlerts={unreadCount}
      onToggleAlerts={() => setShowAlerts(!showAlerts)}
      onShowImport={() => setShowImport(true)}
      isAdmin={isAdmin}
      counts={{
        search: properties.length,
        favorites: favorites.length,
        new: newListings.length,
        priceDrops: priceDrops.length,
        hidden: hidden.length,
      }}
    >
      {/* Alerts Panel */}
      {showAlerts && (
        <AlertsPanel
          alerts={alerts}
          onClose={() => setShowAlerts(false)}
          onMarkRead={markAsRead}
          onMarkAllRead={markAllAsRead}
          onViewProperty={(id) => {
            const prop = properties.find((p) => p.id === id);
            if (prop) setSelectedProperty(prop);
            setShowAlerts(false);
          }}
        />
      )}

      {/* Manual Import Modal */}
      {showImport && (
        <ManualImport
          userId={user.id}
          onClose={() => setShowImport(false)}
          onImported={() => {
            setShowImport(false);
            refetch();
          }}
        />
      )}

      {/* Property Detail Modal */}
      {selectedProperty && (
        <PropertyDetail
          property={selectedProperty}
          userProperty={userProperties[selectedProperty.id]}
          onClose={() => setSelectedProperty(null)}
          onToggleFavorite={() => toggleFavorite(selectedProperty.id)}
          onToggleHidden={() => toggleHidden(selectedProperty.id)}
          onUpdateNotes={(notes) => updateNotes(selectedProperty.id, notes)}
        />
      )}

      {/* Admin Settings */}
      {activeTab === TABS.ADMIN ? (
        <AdminSettings
          userId={user.id}
          weights={weights}
          onWeightsChange={(w) => { setWeights(w); }}
          exclusionSettings={exclusionSettings}
          onExclusionChange={setExclusionSettings}
          filters={filters}
          onFiltersChange={setFilters}
          isAdmin={isAdmin}
          onTriggerSync={async () => {
            await fetch('/.netlify/functions/trigger-sync', {
              method: 'POST',
              body: JSON.stringify({ user_id: user.id }),
            });
            refetch();
          }}
        />
      ) : (
        <>
          {/* Filter Bar */}
          <FilterBar
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={displayProperties.length}
            activeTab={activeTab}
          />

          {/* Main Content */}
          {propsLoading ? (
            <div className="loading-container">
              <div className="loading-spinner" />
              <p>Loading properties...</p>
            </div>
          ) : displayProperties.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏠</div>
              <h3>No properties found</h3>
              <p>
                {activeTab === TABS.FAVORITES
                  ? 'Save properties you like by clicking the heart icon.'
                  : activeTab === TABS.HIDDEN
                  ? 'Properties you hide will appear here.'
                  : 'Try adjusting your filters or import a listing manually.'}
              </p>
            </div>
          ) : viewMode === VIEW_MODES.MAP ? (
            <PropertyMap
              properties={displayProperties}
              userProperties={userProperties}
              onSelectProperty={setSelectedProperty}
            />
          ) : (
            <PropertyGrid
              properties={displayProperties}
              userProperties={userProperties}
              viewMode={viewMode}
              onSelectProperty={setSelectedProperty}
              onToggleFavorite={toggleFavorite}
              onToggleHidden={toggleHidden}
            />
          )}
        </>
      )}
    </Layout>
  );
}
