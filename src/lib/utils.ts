import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency: string) {
  if (['VIRTUEL', 'MOBILE_MONEY'].includes(currency)) {
    return `${amount.toLocaleString('fr-CD', { minimumFractionDigits: 2 })} ${currency.replace('_', ' ')}`;
  }
  
  try {
    return new Intl.NumberFormat('fr-CD', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(amount);
  } catch (e) {
    return `${amount.toLocaleString('fr-CD', { minimumFractionDigits: 2 })} ${currency}`;
  }
}

export function formatDate(date: Date | string | number) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(date));
}
