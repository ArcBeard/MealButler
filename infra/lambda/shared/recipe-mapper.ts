import type { SpoonacularRecipe } from './spoonacular-client'

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
  spoonacularId: number
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

export function mapSpoonacularToRecipe(raw: SpoonacularRecipe): Recipe {
  const ingredients: Ingredient[] = (raw.extendedIngredients ?? []).map(
    (ing) => ({
      id: ing.id,
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      original: ing.original,
    }),
  )

  const steps: RecipeStep[] = []
  for (const instruction of raw.analyzedInstructions ?? []) {
    for (const step of instruction.steps) {
      steps.push({ number: step.number, step: step.step })
    }
  }

  return {
    spoonacularId: raw.id,
    title: raw.title,
    imageUrl: raw.image,
    sourceUrl: raw.sourceUrl,
    sourceName: raw.sourceName,
    servings: raw.servings,
    readyInMinutes: raw.readyInMinutes,
    prepMinutes: raw.preparationMinutes,
    cookMinutes: raw.cookingMinutes,
    ingredients,
    steps,
    cuisines: raw.cuisines ?? [],
    diets: raw.diets ?? [],
  }
}
