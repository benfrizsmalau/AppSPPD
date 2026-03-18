import { format, parseISO, addDays, differenceInDays, isAfter, isBefore, isValid } from 'date-fns';
import { id } from 'date-fns/locale';
import type { DocumentStatus } from '../types';

// =================================================================
// DATE UTILITIES
// =================================================================
export function formatDate(date: string | Date | null | undefined, fmt = 'dd MMMM yyyy'): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return '-';
    return format(d, fmt, { locale: id });
  } catch {
    return '-';
  }
}

export function formatDateShort(date: string | Date | null | undefined): string {
  return formatDate(date, 'dd/MM/yyyy');
}

export function formatDatetime(date: string | Date | null | undefined): string {
  return formatDate(date, 'dd MMM yyyy, HH:mm');
}

export function formatDateIndonesian(date: string | Date | null | undefined): string {
  return formatDate(date, 'd MMMM yyyy');
}

/** Compute tanggal_kembali = tanggal_berangkat + (lama_perjalanan - 1) */
export function computeTanggalKembali(tanggalBerangkat: string, lamaPerjalanan: number): string {
  if (!tanggalBerangkat || lamaPerjalanan < 1) return '';
  try {
    const start = parseISO(tanggalBerangkat);
    if (!isValid(start)) return '';
    const end = addDays(start, lamaPerjalanan - 1);
    return format(end, 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

export function getDaysDifference(start: string, end: string): number {
  try {
    return differenceInDays(parseISO(end), parseISO(start));
  } catch {
    return 0;
  }
}

export function isDateAfterToday(date: string): boolean {
  try {
    return isAfter(parseISO(date), new Date());
  } catch {
    return false;
  }
}

export function isDateBeforeToday(date: string): boolean {
  try {
    return isBefore(parseISO(date), new Date());
  } catch {
    return false;
  }
}

export function isDateExpired(date: string): boolean {
  try {
    const d = parseISO(date);
    return isBefore(d, new Date());
  } catch {
    return false;
  }
}

export function toISODateString(date: Date | null | undefined): string {
  if (!date || !isValid(date)) return '';
  return format(date, 'yyyy-MM-dd');
}

/** Get month name in Indonesian */
export const ROMAN_MONTHS = ['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];
export function getRomanMonth(month: number): string {
  return ROMAN_MONTHS[month - 1] || '';
}

export function getMonthName(month: number): string {
  const names = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
  return names[month - 1] || '';
}

// =================================================================
// NUMBER UTILITIES
// =================================================================
export function formatRupiah(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '0';
  return new Intl.NumberFormat('id-ID').format(n);
}

export function padNumber(n: number, digits = 3): string {
  return String(n).padStart(digits, '0');
}

// =================================================================
// STRING UTILITIES
// =================================================================
export function truncate(str: string | null | undefined, maxLen = 50): string {
  if (!str) return '-';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export function validateNIP(nip: string): boolean {
  return /^\d{18}$/.test(nip.trim());
}

export function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// =================================================================
// STATUS UTILITIES
// =================================================================
export function getStatusLabel(status: DocumentStatus | string): string {
  const labels: Record<string, string> = {
    'Draft': 'Draft',
    'Menunggu Persetujuan': 'Menunggu Persetujuan',
    'Final': 'Final',
    'Printed': 'Dicetak',
    'Completed': 'Selesai',
    'Cancelled': 'Dibatalkan',
    'Expired': 'Kadaluarsa',
  };
  return labels[status] || status;
}

export function getStatusClass(status: DocumentStatus | string): string {
  const classes: Record<string, string> = {
    'Draft': 'status-draft',
    'Menunggu Persetujuan': 'status-pending',
    'Final': 'status-final',
    'Printed': 'status-printed',
    'Completed': 'status-completed',
    'Cancelled': 'status-cancelled',
    'Expired': 'status-expired',
  };
  return classes[status] || 'badge badge-slate';
}

export function canEdit(status: DocumentStatus | string): boolean {
  return ['Draft'].includes(status);
}

export function canFinalize(status: DocumentStatus | string): boolean {
  return status === 'Draft';
}

export function canCancel(status: DocumentStatus | string): boolean {
  return ['Draft', 'Final', 'Printed'].includes(status);
}

export function canCreateRevision(status: DocumentStatus | string): boolean {
  return ['Final', 'Printed', 'Completed', 'Cancelled'].includes(status);
}

export function canCreateSPPD(status: DocumentStatus | string): boolean {
  return ['Final', 'Printed', 'Completed'].includes(status);
}

export function canPrint(status: DocumentStatus | string): boolean {
  return ['Final', 'Printed', 'Completed'].includes(status);
}

// =================================================================
// ARRAY UTILITIES
// =================================================================
export function unique<T>(arr: T[], key?: keyof T): T[] {
  if (!key) return [...new Set(arr)];
  const seen = new Set();
  return arr.filter(item => {
    const k = item[key];
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function reorder<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  const result = [...arr];
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

export function sortByKey<T>(arr: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc'): T[] {
  return [...arr].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

// =================================================================
// EMPLOYEE NAME WITH TITLE
// =================================================================
export function formatNamaLengkap(pegawai: {
  gelar_depan?: string;
  nama_lengkap: string;
  gelar_belakang?: string;
} | null | undefined): string {
  if (!pegawai) return '-';
  const parts = [
    pegawai.gelar_depan,
    pegawai.nama_lengkap,
    pegawai.gelar_belakang,
  ].filter(Boolean);
  return parts.join(' ');
}

// =================================================================
// DOCUMENT NUMBER PREVIEW
// =================================================================
export function previewDocumentNumber(pattern: string, params: {
  counter: number;
  digitCount: number;
  kodeOrg?: string;
  jenis?: string;
}): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthRoman = ROMAN_MONTHS[month - 1];
  const padded = padNumber(params.counter || 1, params.digitCount || 3);

  return pattern
    .replace('{num}', padded)
    .replace('{year}', String(year))
    .replace('{month}', String(month).padStart(2, '0'))
    .replace('{month_roman}', monthRoman)
    .replace('{org}', params.kodeOrg || 'ORG')
    .replace('{jenis}', params.jenis || 'SPT');
}

// =================================================================
// DEBOUNCE
// =================================================================
export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return function(...args: Parameters<T>) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// =================================================================
// EXCEL UTILITIES
// =================================================================
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =================================================================
// PAGINATION
// =================================================================
export function getPaginationRange(current: number, total: number, delta = 2): (number | '...')[] {
  const range: (number | '...')[] = [];
  const left = current - delta;
  const right = current + delta;

  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= left && i <= right)) {
      range.push(i);
    } else if (range[range.length - 1] !== '...') {
      range.push('...');
    }
  }
  return range;
}
