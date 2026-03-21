import { useState, useCallback, useEffect, useRef } from 'react';
import { DEFAULT_MAP_CENTER, DEFAULT_MAP_ZOOM, getScoreColor, PLACEHOLDER_IMAGE } from '../lib/constants';

export default function PropertyMap({ properties, userProperties, onSelectProperty }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);

  // Load Google Maps script
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn('Google Maps API key not configured');
      return;
    }

    if (window.google?.maps) {
      setMapLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    script.onerror = () => console.error('Failed to load Google Maps');
    document.head.appendChild(script);

    return () => {
      // Don't remove the script on cleanup, it's shared
    };
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return;

    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
      mapTypeControl: true,
      streetViewControl: true,
      fullscreenControl: true,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'simplified' }] },
      ],
    });
  }, [mapLoaded]);

  // Update markers when properties change
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.google.maps.LatLngBounds();
    let hasValidCoords = false;

    properties.forEach((property) => {
      if (!property.latitude || !property.longitude) return;

      hasValidCoords = true;
      const position = { lat: property.latitude, lng: property.longitude };
      bounds.extend(position);

      const scoreInfo = getScoreColor(property.match_score || 0);
      const isFavorite = userProperties[property.id]?.is_favorite;

      const marker = new window.google.maps.Marker({
        position,
        map: mapInstanceRef.current,
        title: `${property.address} — $${Number(property.price || 0).toLocaleString()}/mo`,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: isFavorite ? '#ef4444' : scoreInfo.color,
          fillOpacity: 0.9,
          strokeColor: '#ffffff',
          strokeWeight: 2,
        },
        label: {
          text: String(property.match_score || 0),
          color: '#ffffff',
          fontSize: '10px',
          fontWeight: 'bold',
        },
      });

      // Info window
      const infoContent = `
        <div style="max-width:280px;font-family:Inter,sans-serif;">
          ${property.thumbnail_url ? `<img src="${property.thumbnail_url}" style="width:100%;height:140px;object-fit:cover;border-radius:6px;margin-bottom:8px;" alt="${property.address}"/>` : ''}
          <div style="font-size:18px;font-weight:700;color:#111;">$${Number(property.price || 0).toLocaleString()}/mo</div>
          <div style="font-size:13px;color:#555;margin-top:2px;">${property.address}</div>
          <div style="font-size:12px;color:#888;">${property.city}, ${property.state}</div>
          <div style="font-size:12px;margin-top:6px;color:#555;">
            ${property.bedrooms ? property.bedrooms + ' bd' : ''}
            ${property.bathrooms ? ' · ' + property.bathrooms + ' ba' : ''}
            ${property.sqft ? ' · ' + property.sqft.toLocaleString() + ' sqft' : ''}
          </div>
          <div style="margin-top:8px;font-size:12px;color:${scoreInfo.color};font-weight:600;">
            Score: ${property.match_score}/100 — ${scoreInfo.label}
          </div>
        </div>
      `;

      const infoWindow = new window.google.maps.InfoWindow({ content: infoContent });

      marker.addListener('click', () => {
        onSelectProperty(property);
      });

      marker.addListener('mouseover', () => {
        infoWindow.open(mapInstanceRef.current, marker);
        setHoveredId(property.id);
      });

      marker.addListener('mouseout', () => {
        infoWindow.close();
        setHoveredId(null);
      });

      markersRef.current.push(marker);
    });

    // Fit bounds if we have coordinates
    if (hasValidCoords && markersRef.current.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, 60);
    }
  }, [properties, userProperties, mapLoaded, onSelectProperty]);

  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="map-placeholder">
        <div className="empty-state">
          <div className="empty-icon">🗺️</div>
          <h3>Google Maps API Key Required</h3>
          <p>
            Add your Google Maps API key to the <code>VITE_GOOGLE_MAPS_API_KEY</code> environment
            variable to enable the map view.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="map-container">
      <div ref={mapRef} className="google-map" />
      {!mapLoaded && (
        <div className="map-loading">
          <div className="loading-spinner" />
          <p>Loading map...</p>
        </div>
      )}
    </div>
  );
}
