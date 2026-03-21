import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useAlerts(userId) {
  const [alerts, setAlerts] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchAlerts = useCallback(async () => {
    if (!userId) return;

    const { data } = await supabase
      .from('alerts')
      .select('*, properties(address, city, price, thumbnail_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    setAlerts(data || []);
    setUnreadCount((data || []).filter((a) => !a.is_read).length);
  }, [userId]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const markAsRead = useCallback(
    async (alertId) => {
      await supabase.from('alerts').update({ is_read: true }).eq('id', alertId);
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, is_read: true } : a))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    },
    []
  );

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from('alerts')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false);
    setAlerts((prev) => prev.map((a) => ({ ...a, is_read: true })));
    setUnreadCount(0);
  }, [userId]);

  return { alerts, unreadCount, markAsRead, markAllAsRead, refetch: fetchAlerts };
}
