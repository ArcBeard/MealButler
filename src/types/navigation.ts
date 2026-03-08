export interface NavigationItem {
  label: string
  path: string
  icon: string
}

export const navigationItems: NavigationItem[] = [
  { label: 'Calendar', path: '/', icon: 'Calendar' },
  { label: 'Recipes', path: '/recipes', icon: 'ChefHat' },
  { label: 'Recipe List', path: '/recipe-list', icon: 'List' },
  { label: 'Family Settings', path: '/family-settings', icon: 'Users' },
]
