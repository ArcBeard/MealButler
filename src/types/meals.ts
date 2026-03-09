export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Ingredient {
  id: number
  name: string
  amount: number
  unit: string
  original: string
}

export interface RecipeStep {
  number: number
  step: string
}

export interface Recipe {
  recipeId: string
  title: string
  imageUrl?: string
  sourceUrl?: string
  sourceName?: string
  servings: number
  readyInMinutes: number
  prepMinutes?: number
  cookMinutes?: number
  ingredients: Ingredient[]
  steps: RecipeStep[]
  cuisines: string[]
  diets: string[]
}

export interface Meal {
  id: string
  name: string
  prepMinutes: number
  calories: number
  emoji: string
  recipe?: Recipe
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
