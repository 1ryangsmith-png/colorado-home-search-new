import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { calculateScore, checkExclusions } from '../lib/scoring';
import { DEFAULT_WEIGHTS } from '../lib/constants';

export function useProperties(userId) {
  const [properties, setProperties] = useState([]);
  const [userProperties, setUserProperties] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    minPrice: null,
    maxPrice: null,
    minBeds: 3,
    cities: [],
    propertyTypes: [],
    source: null,
    search: '',
  });
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [exclusionSettings, setExclusionSettings] = useState({
    exclude_no_dogs: true,
    exclude_no_backyard: true,
    exclude_no_garage: true,
    exclude_under_3br: true,
  });

  // Fetch properties using direct REST API (bypasses Supabase JS client issues)
  const fetchProperties = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Safety timeout — never spin forever
    const timeout = setTimeout(() => setLoading(false), 8000);

    try {
      const SUPABASE_URL = 'https://cxaalqecxhqkxpgmqgdb.supabase.co';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN4YWFscWVjeGhxa3hwZ21xZ2RiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMzcxOTIsImV4cCI6MjA4OTYxMzE5Mn0.9c3ccAmYfisueGRlmiK8RXCCPV_phOK46cqmJiWrIQk';

      // Build query string
      let params = 'status=eq.active&order=created_at.desc&limit=500';
      if (filters.minPrice) params += `&price=gte.${filters.minPrice}`;
      if (filters.maxPrice) params += `&price=lte.${filters.maxPrice}`;
      if (filters.minBeds) params += `&bedrooms=gte.${filters.minBeds}`;
      if (filters.cities?.length > 0) params += `&city=in.(${filters.cities.join(',')})`;
      if (filters.source) params += `&source=eq.${filters.source}`;

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/properties?select=*&${params}`,
        {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const fetchError = null;

      if (fetchError) throw fetchError;

      // Calculate scores client-side and sort
      const scored = (data || []).map((p) => {
        const exclusion = checkExclusions(p, exclusionSettings);
        const scoring = calculateScore(p, weights);
        return {
          ...p,
          match_score: exclusion.excluded ? 0 : scoring.score,
          score_breakdown: scoring.breakdown,
          inferred_fields: scoring.inferred,
          _excluded: exclusion.excluded,
          _exclusion_reasons: exclusion.reasons,
        };
      });

      // Apply text search filter client-side
      let filtered = scored;
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filtered = scored.filter(
          (p) =>
            p.address?.toLowerCase().includes(searchLower) ||
            p.city?.toLowerCase().includes(searchLower) ||
            p.neighborhood?.toLowerCase().includes(searchLower)
        );
      }

      // Sort: non-excluded first, by score descending
      filtered.sort((a, b) => {
        if (a._excluded && !b._excluded) return 1;
        if (!a._excluded && b._excluded) return -1;
        return b.match_score - a.match_score;
      });

      setProperties(filtered);
    } catch (err) {
      console.error('Error fetching properties:', err);
      setError(err.message);
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }, [filters, weights, exclusionSettings]);

  // Fetch user-property relationships (favorites, hidden, notes)
  const fetchUserProperties = useCallback(async () => {
    if (!userId) return;

    try {
      const { data } = await supabase
        .from('user_properties')
        .select('*')
        .eq('user_id', userId);

      const map = {};
      (data || []).forEach((up) => {
        map[up.property_id] = up;
      });
      setUserProperties(map);
    } catch (err) {
      console.warn('Error fetching user properties:', err);
    }
  }, [userId]);

  // Fetch scoring weights
  const fetchWeights = useCallback(async () => {
    if (!userId) return;

    try {
      const { data } = await supabase
        .from('scoring_weights')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (data) {
        setWeights(data.weights || DEFAULT_WEIGHTS);
        setExclusionSettings({
          exclude_no_dogs: data.exclude_no_dogs ?? true,
          exclude_no_backyard: data.exclude_no_backyard ?? true,
          exclude_no_garage: data.exclude_no_garage ?? true,
          exclude_under_3br: data.exclude_under_3br ?? true,
        });
        if (data.max_price) {
          setFilters((f) => ({ ...f, maxPrice: data.max_price }));
        }
      }
    } catch (err) {
      // No weights configured yet — use defaults
    }
  }, [userId]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    fetchUserProperties();
    fetchWeights();
  }, [fetchUserProperties, fetchWeights]);

  // Toggle favorite
  const toggleFavorite = useCallback(
    async (propertyId) => {
      if (!userId) return;

      const existing = userProperties[propertyId];
      if (existing) {
        const newVal = !existing.is_favorite;
        await supabase
          .from('user_properties')
          .update({ is_favorite: newVal })
          .eq('id', existing.id);
        setUserProperties((prev) => ({
          ...prev,
          [propertyId]: { ...existing, is_favorite: newVal },
        }));
      } else {
        const { data } = await supabase
          .from('user_properties')
          .insert({ user_id: userId, property_id: propertyId, is_favorite: true })
          .select()
          .single();
        if (data) {
          setUserProperties((prev) => ({ ...prev, [propertyId]: data }));
        }
      }
    },
    [userId, userProperties]
  );

  // Toggle hidden
  const toggleHidden = useCallback(
    async (propertyId) => {
      if (!userId) return;

      const existing = userProperties[propertyId];
      if (existing) {
        const newVal = !existing.is_hidden;
        await supabase
          .from('user_properties')
          .update({ is_hidden: newVal })
          .eq('id', existing.id);
        setUserProperties((prev) => ({
          ...prev,
          [propertyId]: { ...existing, is_hidden: newVal },
        }));
      } else {
        const { data } = await supabase
          .from('user_properties')
          .insert({ user_id: userId, property_id: propertyId, is_hidden: true })
          .select()
          .single();
        if (data) {
          setUserProperties((prev) => ({ ...prev, [propertyId]: data }));
        }
      }
    },
    [userId, userProperties]
  );

  // Update notes
  const updateNotes = useCallback(
    async (propertyId, notes) => {
      if (!userId) return;

      const existing = userProperties[propertyId];
      if (existing) {
        await supabase
          .from('user_properties')
          .update({ notes })
          .eq('id', existing.id);
        setUserProperties((prev) => ({
          ...prev,
          [propertyId]: { ...existing, notes },
        }));
      } else {
        const { data } = await supabase
          .from('user_properties')
          .insert({ user_id: userId, property_id: propertyId, notes })
          .select()
          .single();
        if (data) {
          setUserProperties((prev) => ({ ...prev, [propertyId]: data }));
        }
      }
    },
    [userId, userProperties]
  );

  // Derived lists
  const favorites = properties.filter(
    (p) => userProperties[p.id]?.is_favorite
  );
  const hidden = properties.filter(
    (p) => userProperties[p.id]?.is_hidden
  );
  const newListings = properties.filter((p) => {
    const posted = new Date(p.created_at);
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    return posted >= twoDaysAgo;
  });
  const priceDrops = properties.filter((p) => p.is_price_drop);

  // Active properties (not hidden)
  const activeProperties = properties.filter(
    (p) => !userProperties[p.id]?.is_hidden
  );

  return {
    properties: activeProperties,
    allProperties: properties,
    favorites,
    hidden,
    newListings,
    priceDrops,
    userProperties,
    loading,
    error,
    filters,
    setFilters,
    weights,
    setWeights,
    exclusionSettings,
    setExclusionSettings,
    toggleFavorite,
    toggleHidden,
    updateNotes,
    refetch: fetchProperties,
  };
}
