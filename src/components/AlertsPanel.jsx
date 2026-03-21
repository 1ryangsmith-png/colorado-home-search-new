export default function AlertsPanel({ alerts, onClose, onMarkRead, onMarkAllRead, onViewProperty }) {
  return (
    <div className="alerts-panel">
      <div className="alerts-header">
        <h3>Notifications</h3>
        <div className="alerts-actions">
          {alerts.some((a) => !a.is_read) && (
            <button className="btn-text" onClick={onMarkAllRead}>
              Mark all read
            </button>
          )}
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
      </div>

      <div className="alerts-list">
        {alerts.length === 0 ? (
          <div className="alerts-empty">No notifications yet</div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={`alert-item ${alert.is_read ? 'read' : 'unread'}`}
              onClick={() => {
                if (!alert.is_read) onMarkRead(alert.id);
                if (alert.property_id) onViewProperty(alert.property_id);
              }}
            >
              <div className="alert-icon">
                {alert.alert_type === 'new_listing' && '✨'}
                {alert.alert_type === 'price_drop' && '📉'}
                {alert.alert_type === 'status_change' && '🔄'}
              </div>
              <div className="alert-content">
                <p className="alert-message">{alert.message}</p>
                <span className="alert-time">
                  {new Date(alert.created_at).toLocaleString()}
                </span>
              </div>
              {!alert.is_read && <div className="alert-dot" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
