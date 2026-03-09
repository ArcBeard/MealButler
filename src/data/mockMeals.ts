import type { DayPlan } from '@/types/meals'

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d
}

function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function generateMockWeek(referenceDate: Date): DayPlan[] {
  const monday = getMonday(referenceDate)
  const plans: DayPlan[] = []

  const weekMeals: DayPlan['meals'][] = [
    // Monday
    {
      breakfast: { id: '1', name: 'Overnight Oats', prepMinutes: 10, calories: 350, emoji: '🥣', recipe: {
        spoonacularId: 649931,
        title: 'Overnight Oats with Berries',
        imageUrl: 'https://img.spoonacular.com/recipes/649931-312x231.jpg',
        sourceUrl: 'https://www.budgetbytes.com/overnight-oats/',
        sourceName: 'Budget Bytes',
        servings: 2,
        readyInMinutes: 10,
        prepMinutes: 10,
        ingredients: [
          { id: 1, name: 'rolled oats', amount: 1, unit: 'cup', original: '1 cup rolled oats' },
          { id: 2, name: 'milk', amount: 1, unit: 'cup', original: '1 cup milk' },
          { id: 3, name: 'greek yogurt', amount: 0.25, unit: 'cup', original: '1/4 cup Greek yogurt' },
          { id: 4, name: 'honey', amount: 1, unit: 'tbsp', original: '1 tbsp honey' },
          { id: 5, name: 'mixed berries', amount: 0.5, unit: 'cup', original: '1/2 cup mixed berries' },
        ],
        steps: [
          { number: 1, step: 'Combine oats, milk, yogurt, and honey in a jar or container.' },
          { number: 2, step: 'Stir well, cover, and refrigerate overnight (or at least 4 hours).' },
          { number: 3, step: 'Top with mixed berries before serving.' },
        ],
        cuisines: ['American'],
        diets: ['vegetarian'],
      }},
      lunch: { id: '2', name: 'Chicken Caesar Salad', prepMinutes: 15, calories: 480, emoji: '🥗', recipe: {
        spoonacularId: 782585,
        title: 'Classic Chicken Caesar Salad',
        imageUrl: 'https://img.spoonacular.com/recipes/782585-312x231.jpg',
        sourceUrl: 'https://www.simplyrecipes.com/recipes/chicken_caesar_salad/',
        sourceName: 'Simply Recipes',
        servings: 4,
        readyInMinutes: 25,
        prepMinutes: 15,
        cookMinutes: 10,
        ingredients: [
          { id: 6, name: 'chicken breast', amount: 2, unit: '', original: '2 chicken breasts' },
          { id: 7, name: 'romaine lettuce', amount: 1, unit: 'head', original: '1 head romaine lettuce' },
          { id: 8, name: 'parmesan cheese', amount: 0.5, unit: 'cup', original: '1/2 cup shaved parmesan' },
          { id: 9, name: 'caesar dressing', amount: 0.25, unit: 'cup', original: '1/4 cup Caesar dressing' },
          { id: 10, name: 'croutons', amount: 1, unit: 'cup', original: '1 cup croutons' },
        ],
        steps: [
          { number: 1, step: 'Season chicken breasts with salt and pepper. Grill or pan-sear until cooked through, about 6 minutes per side.' },
          { number: 2, step: 'Let chicken rest for 5 minutes, then slice.' },
          { number: 3, step: 'Chop romaine lettuce and place in a large bowl.' },
          { number: 4, step: 'Add sliced chicken, parmesan, and croutons.' },
          { number: 5, step: 'Toss with Caesar dressing and serve immediately.' },
        ],
        cuisines: ['American', 'Italian'],
        diets: [],
      }},
      dinner: { id: '3', name: 'Salmon & Asparagus', prepMinutes: 25, calories: 520, emoji: '🐟', recipe: {
        spoonacularId: 511728,
        title: 'Baked Salmon with Roasted Asparagus',
        imageUrl: 'https://img.spoonacular.com/recipes/511728-312x231.jpg',
        sourceUrl: 'https://www.halfbakedharvest.com/baked-salmon/',
        sourceName: 'Half Baked Harvest',
        servings: 2,
        readyInMinutes: 30,
        prepMinutes: 10,
        cookMinutes: 20,
        ingredients: [
          { id: 11, name: 'salmon fillets', amount: 2, unit: '', original: '2 salmon fillets (6 oz each)' },
          { id: 12, name: 'asparagus', amount: 1, unit: 'bunch', original: '1 bunch asparagus, trimmed' },
          { id: 13, name: 'olive oil', amount: 2, unit: 'tbsp', original: '2 tbsp olive oil' },
          { id: 14, name: 'lemon', amount: 1, unit: '', original: '1 lemon' },
          { id: 15, name: 'garlic', amount: 3, unit: 'cloves', original: '3 cloves garlic, minced' },
        ],
        steps: [
          { number: 1, step: 'Preheat oven to 400°F (200°C). Line a baking sheet with parchment paper.' },
          { number: 2, step: 'Place salmon fillets and asparagus on the baking sheet. Drizzle with olive oil.' },
          { number: 3, step: 'Season with minced garlic, salt, pepper, and lemon juice.' },
          { number: 4, step: 'Bake for 15-20 minutes until salmon flakes easily with a fork.' },
          { number: 5, step: 'Serve with lemon wedges.' },
        ],
        cuisines: ['American'],
        diets: ['gluten free', 'dairy free'],
      }},
      snack: { id: '4', name: 'Apple & Almond Butter', prepMinutes: 3, calories: 200, emoji: '🍎' },
    },
    // Tuesday
    {
      breakfast: { id: '5', name: 'Avocado Toast', prepMinutes: 8, calories: 320, emoji: '🥑' },
      lunch: { id: '6', name: 'Turkey Wrap', prepMinutes: 10, calories: 450, emoji: '🌯' },
      snack: { id: '7', name: 'Greek Yogurt & Berries', prepMinutes: 3, calories: 180, emoji: '🫐' },
    },
    // Wednesday
    {
      breakfast: { id: '8', name: 'Smoothie Bowl', prepMinutes: 10, calories: 380, emoji: '🥤' },
      lunch: { id: '9', name: 'Veggie Stir-Fry', prepMinutes: 20, calories: 400, emoji: '🥘' },
      dinner: { id: '10', name: 'Pasta Primavera', prepMinutes: 30, calories: 550, emoji: '🍝' },
    },
    // Thursday
    {
      breakfast: { id: '11', name: 'Eggs & Toast', prepMinutes: 12, calories: 400, emoji: '🍳' },
      dinner: { id: '12', name: 'Grilled Chicken Thighs', prepMinutes: 25, calories: 480, emoji: '🍗' },
      snack: { id: '13', name: 'Trail Mix', prepMinutes: 1, calories: 220, emoji: '🥜' },
    },
    // Friday
    {
      breakfast: { id: '14', name: 'Pancakes', prepMinutes: 20, calories: 450, emoji: '🥞' },
      lunch: { id: '15', name: 'Poke Bowl', prepMinutes: 15, calories: 520, emoji: '🍣' },
      dinner: { id: '16', name: 'Homemade Pizza', prepMinutes: 40, calories: 600, emoji: '🍕' },
      snack: { id: '17', name: 'Dark Chocolate', prepMinutes: 0, calories: 150, emoji: '🍫' },
    },
    // Saturday
    {
      breakfast: { id: '18', name: 'French Toast', prepMinutes: 15, calories: 420, emoji: '🍞' },
      lunch: { id: '19', name: 'BLT Sandwich', prepMinutes: 10, calories: 380, emoji: '🥪' },
      dinner: { id: '20', name: 'Beef Tacos', prepMinutes: 30, calories: 560, emoji: '🌮' },
    },
    // Sunday
    {
      breakfast: { id: '21', name: 'Eggs Benedict', prepMinutes: 25, calories: 500, emoji: '🥚' },
      lunch: { id: '22', name: 'Tomato Soup & Grilled Cheese', prepMinutes: 20, calories: 440, emoji: '🍲' },
      dinner: { id: '23', name: 'Roast Chicken & Veggies', prepMinutes: 45, calories: 580, emoji: '🍗' },
      snack: { id: '24', name: 'Fruit Salad', prepMinutes: 10, calories: 160, emoji: '🍓' },
    },
  ]

  for (let i = 0; i < 7; i++) {
    plans.push({
      date: formatDate(addDays(monday, i)),
      meals: weekMeals[i] ?? {},
    })
  }

  return plans
}
