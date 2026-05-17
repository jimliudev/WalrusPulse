import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function shortAddress(address: string, chars = 6): string {
  if (!address) return ''
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Character limits ─────────────────────────────────────────────────────────

export const LIMITS = {
  formTitle: 120,
  formDescription: 500,
  fieldLabel: 150,
  fieldHelperText: 300,
  fieldPlaceholder: 200,
  optionText: 100,
  maxOptions: 20,
  answerText: 500,
  answerTextarea: 3000,
  answerUrl: 2048,
  uploadImageMb: 10,
  uploadVideoMb: 100,
} as const
