/**
 * Formatters - Utility functions for data presentation.
 */
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(value);
};

export const formatDate = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
};

export const formatTime = (date) => {
  if (!date) return '-';
  const d = new Date(date);
  return d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Truncates text with ellipsis
 */
export const truncate = (text, length = 20) => {
  if (!text) return '';
  return text.length > length ? text.substring(0, length) + '...' : text;
};
