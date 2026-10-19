export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'muted'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}
