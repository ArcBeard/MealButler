export interface NavigationItem {
  label: string
  path: string
  icon: string
}

export const navigationItems: NavigationItem[] = [
  { label: 'Meal Agent', path: '/', icon: 'MessageCircle' },
  { label: 'Calendar', path: '/calendar', icon: 'Calendar' },
  { label: 'Recipes', path: '/recipes', icon: 'ChefHat' },
  { label: 'Family Settings', path: '/family-settings', icon: 'Users' },
]
