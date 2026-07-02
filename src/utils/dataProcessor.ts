
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
  
  let str = String(val).trim();
  
  // If the string has both dot and comma (e.g., "3.090,45" or "3,090.45")
  if (str.includes('.') && str.includes(',')) {
    const lastDotIdx = str.lastIndexOf('.');
    const lastCommaIdx = str.lastIndexOf(',');
    if (lastDotIdx < lastCommaIdx) {
      // "3.090,45" -> dot is thousands, comma is decimal
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // "3,090.45" -> comma is thousands, dot is decimal
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Single separator comma, treat as decimal comma for Chilean context (e.g. "3090,45" or "3,09")
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    // Single separator dot, e.g. "3.090"
    // If the dot is followed by exactly 3 digits, in Spanish context it's thousands (e.g., 3.090 -> 3090)
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      str = str.replace('.', '');
    }
  }
  
  const num = parseFloat(str.replace(/[^-0-9.]/g, ''));
  return isNaN(num) ? 0 : num;
};

export const formatNumberWithDecimals = (val: number, precision: number = 2): string => {
  if (isNaN(val) || val === null || val === undefined) {
    return "0" + (precision > 0 ? "," + "0".repeat(precision) : "");
  }
  // Format with Chilean locale: '.' as thousands, ',' as decimal
  const parts = Number(val).toFixed(precision).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return parts.join(precision > 0 ? ',' : '');
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
    const cleanStr = val.replace(',', '.').replace(/[^-0-9.]/g, '');
    const asNum = parseFloat(cleanStr);
    if (!isNaN(asNum) && asNum > 0) {
      // If it's a number stored as string < 1, it might be an Excel fraction of a day.
      // But typically strings like "1.5" are meant as 1.5 hours. 
      // If it's less than 1 (e.g., "0.0625"), it's likely an excel time fraction exported to string.
      return asNum < 1 ? asNum * 24 : asNum;
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
    "JORQUERA TRANSPORTE S A": "JORQUERA TRANSPORTE S.A.",
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

  // Auto audit log download activity
  try {
    const savedUser = localStorage.getItem('sqm_current_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      import('../services/firebase').then(({ logActivity }) => {
        logActivity(
          parsedUser, 
          'Descargó Respaldo JSON', 
          `Descargó archivo de respaldo local (${link.download}) para resguardar observaciones registradas.`
        );
      }).catch(e => console.error('Error importing logActivity:', e));
    }
  } catch (error) {
    console.error('Error auto-logging download activity:', error);
  }
};
