
export const normalizeHeader = (h: any): string => {
  return String(h || '')
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^A-Z0-9%]/g, ' ')      // Replace symbols with spaces (keep %)
    .replace(/\s+/g, ' ')            // Collapse spaces
    .trim();
};

export const cleanNumeric = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  const cleanStr = String(val).replace(',', '.').replace(/[^-0-9.]/g, '');
  const num = parseFloat(cleanStr);
  return isNaN(num) ? 0 : num;
};

export const parseExcelTime = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val * 24;
  if (val instanceof Date) {
    const hours = val.getHours();
    const minutes = val.getMinutes();
    const seconds = val.getSeconds();
    return hours + (minutes / 60) + (seconds / 3600);
  }
  if (typeof val === 'string') {
    const parts = val.trim().split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0]) || 0;
      const m = parseInt(parts[1]) || 0;
      const s = parts.length > 2 ? parseInt(parts[2]) || 0 : 0;
      return h + (m / 60) + (s / 3600);
    }
  }
  return 0;
};

export const formatHoursToTime = (hours: number): string => {
  if (isNaN(hours) || hours <= 0) return "0:00";
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}:${String(m).padStart(2, '0')}`;
};

export const normalizeCompanyName = (name: any): string => {
  let cleanName = String(name || '').trim().toUpperCase();
  cleanName = cleanName.replace(/\./g, '').replace(/&/g, 'AND');
  cleanName = cleanName.replace(/\s+/g, ' '); 

  const equivalencias: Record<string, string> = {
    "JORQUERA TRANSPORTE S A": "JORQUERA TRANSPORTE S. A.",
    "MINING SERVICES AND DERIVATES": "M S & D SPA",
    "MINING SERVICES AND DERIVATES SPA": "M S & D SPA",
    "M S AND D": "M S & D SPA",
    "M S AND D SPA": "M S & D SPA",
    "MSANDD SPA": "M S & D SPA",
    "M S D": "M S & D SPA",
    "M S D SPA": "M S & D SPA",
    "M S & D": "M S & D SPA",
    "M S & D SPA": "M S & D SPA",
    "MS&D SPA": "M S & D SPA",
    "M AND Q SPA": "M&Q SPA",
    "M AND Q": "M&Q SPA",
    "M Q SPA": "M&Q SPA",
    "MQ SPA": "M&Q SPA",
    "M&Q SPA": "M&Q SPA",
    "MANDQ SPA": "M&Q SPA",
    "MINING AND QUARRYING SPA": "M&Q SPA",
    "MINING AND QUARRYNG SPA": "M&Q SPA",
    "AG SERVICE SPA": "AG SERVICES SPA",
    "AG SERVICES SPA": "AG SERVICES SPA",
    "COSEDUCAM S A": "COSEDUCAM S A"
  };

  return equivalencias[cleanName] || cleanName;
};

export const formatDateToCL = (dateStr: string): string => {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
};

/**
 * Realiza una descarga del backup actual del localStorage (claves sqm_).
 */
export const downloadBackupJSON = (selectedDate?: string) => {
  const backup: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('sqm_')) {
      backup[key] = localStorage.getItem(key) || '';
    }
  }
  
  let dateStr = selectedDate;
  if (!dateStr) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    dateStr = yesterday.toISOString().split('T')[0];
  }
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Memoria_SQM_Respaldo_${dateStr}.json`;
  link.click();
  URL.revokeObjectURL(url);
};
