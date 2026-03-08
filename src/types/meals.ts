export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Meal {
  id: string
  name: string
  prepMinutes: number
  calories: number
  emoji: string
}

export interface DayPlan {
  date: string // ISO date string YYYY-MM-DD
  meals: Partial<Record<MealType, Meal>>
}

export const mealTypeConfig: Record<MealType, { label: string; icon: string; time: string }> = {
  breakfast: { label: 'Breakfast', icon: 'Sunrise', time: '7:00 AM' },
  lunch: { label: 'Lunch', icon: 'Sun', time: '12:00 PM' },
  dinner: { label: 'Dinner', icon: 'Sunset', time: '6:00 PM' },
  snack: { label: 'Snack', icon: 'Cookie', time: 'Anytime' },
}
