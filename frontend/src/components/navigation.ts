import { AlertTriangle, LayoutDashboard, Server, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

/** Main navigation in the app shell (docs/frontend/README.md section 5, PULSE-101). */
export const NAV_ITEMS: readonly NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/monitors', label: 'Monitors', icon: Server },
  { to: '/incidents', label: 'Incidents', icon: AlertTriangle },
]
