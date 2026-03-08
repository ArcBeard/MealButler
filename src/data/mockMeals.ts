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
      breakfast: { id: '1', name: 'Overnight Oats', prepMinutes: 10, calories: 350, emoji: '🥣' },
      lunch: { id: '2', name: 'Chicken Caesar Salad', prepMinutes: 15, calories: 480, emoji: '🥗' },
      dinner: { id: '3', name: 'Salmon & Asparagus', prepMinutes: 25, calories: 520, emoji: '🐟' },
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
