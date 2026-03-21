import PropertyCard from './PropertyCard';

export default function PropertyGrid({
  properties,
  userProperties,
  viewMode,
  onSelectProperty,
  onToggleFavorite,
  onToggleHidden,
}) {
  return (
    <div className={`property-grid ${viewMode}`}>
      {properties.map((property) => (
        <PropertyCard
          key={property.id}
          property={property}
          userProperty={userProperties[property.id]}
          onSelect={onSelectProperty}
          onToggleFavorite={onToggleFavorite}
          onToggleHidden={onToggleHidden}
          viewMode={viewMode}
        />
      ))}
    </div>
  );
}
