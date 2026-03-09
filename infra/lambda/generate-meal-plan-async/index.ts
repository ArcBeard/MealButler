import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb'

const bedrock = new BedrockRuntimeClient({})
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TABLE_NAME = process.env.TABLE_NAME!
const MODEL_ID = process.env.MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6'

interface Ingredient {
  id: number
  name: string
  amount: number
  unit: string
  original: string
}

interface RecipeStep {
  number: number
  step: string
}

interface Recipe {
  recipeId: string
  title: string
  servings: number
  readyInMinutes: number
  prepMinutes?: number
  cookMinutes?: number
  ingredients: Ingredient[]
  steps: RecipeStep[]
  cuisines: string[]
  diets: string[]
}

interface MealEntry {
  id: string
  name: string
  prepMinutes: number
  calories: number
  emoji: string
  recipe?: Recipe
}

interface DayPlan {
  date: string
  meals: Record<string, MealEntry>
}

interface GenerateEvent {
  pk: string
  preferences: Record<string, unknown>
  weekStart?: string
}

interface Favorite {
  recipeId: string | number
  title: string
  cuisines?: string[]
}

function ttl90Days(): number {
  return Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60
}

function getCurrentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  return monday.toISOString().split('T')[0]!
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]!
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

async function fetchUserFavorites(pk: string): Promise<Favorite[]> {
  try {
    const result = await dynamodb.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'pk = :pk AND begins_with(sk, :prefix)',
        ExpressionAttributeValues: {
          ':pk': pk,
          ':prefix': 'FAVORITE#',
        },
      }),
    )

    return (result.Items ?? []).map((item) => ({
      recipeId: item.recipeId as string | number,
      title: item.title as string,
      cuisines: item.cuisines as string[] | undefined,
    }))
  } catch (error) {
    console.warn('Failed to fetch favorites, continuing without them:', error)
    return []
  }
}

function buildSkeletonPrompt(
  preferences: Record<string, unknown>,
  favorites: Favorite[],
  weekStart: string,
): string {
  let favoritesHint = ''
  if (favorites.length > 0) {
    const favList = favorites
      .map((f) => `- ${f.title}${f.cuisines?.length ? ` (${f.cuisines.join(', ')})` : ''}`)
      .join('\n')
    favoritesHint = `\n\nThe user has these preferred/favorite recipes — try to incorporate some of them into the meal plan when appropriate:\n${favList}\n`
  }

  return `Generate a 7-day meal plan (Monday through Sunday) based on these preferences:
${JSON.stringify(preferences, null, 2)}
${favoritesHint}
Return ONLY valid JSON — an array of 7 objects, one per day, in this exact format:
[
  {
    "date": "YYYY-MM-DD",
    "meals": {
      "breakfast": { "id": "unique-id", "name": "Meal Name", "prepMinutes": 20, "calories": 350, "emoji": "..." },
      "lunch": { ... },
      "dinner": { ... },
      "snack": { ... }
    }
  }
]

The dates should start from ${weekStart} (Monday) through ${addDays(weekStart, 6)} (Sunday).
Each meal must have: id (unique string), name, prepMinutes (number), calories (number), emoji (single food emoji).
Include breakfast, lunch, dinner, and snack for each day. No markdown, no explanation — only the JSON array.`
}

function buildRecipePrompt(
  day: DayPlan,
  dayName: string,
  preferences: Record<string, unknown>,
): string {
  const preferredSites = preferences.preferredSites as string[] | undefined
  const styleHint = preferredSites?.length
    ? `\nThe user enjoys recipes in the style of: ${preferredSites.join(', ')}.`
    : ''

  const household = preferences.household as string | undefined
  const servingsHint = household
    ? `\nDefault servings: ${household} (match the household size).`
    : ''

  const mealList = Object.entries(day.meals)
    .map(([type, meal]) => `- ${type}: "${meal.name}" (~${meal.prepMinutes} min prep, ~${meal.calories} cal)`)
    .join('\n')

  return `Generate full recipe details for these ${dayName} meals:
${mealList}
${styleHint}${servingsHint}

Return ONLY valid JSON — an object with meal types as keys, each containing a full recipe:
{
  "breakfast": {
    "recipeId": "${dayName.toLowerCase().slice(0, 3)}-kebab-case-short-name",
    "title": "Full Recipe Title",
    "servings": 4,
    "readyInMinutes": 30,
    "prepMinutes": 10,
    "cookMinutes": 20,
    "ingredients": [
      { "id": 1, "name": "ingredient name", "amount": 2, "unit": "cups", "original": "2 cups ingredient name" }
    ],
    "steps": [
      { "number": 1, "step": "Step description." }
    ],
    "cuisines": ["Italian"],
    "diets": ["vegetarian"]
  },
  "lunch": { ... },
  "dinner": { ... },
  "snack": { ... }
}

Rules:
- recipeId must be a unique kebab-case string like "${dayName.toLowerCase().slice(0, 3)}-overnight-oats"
- Include realistic ingredient amounts and clear step-by-step instructions
- ingredients id should be sequential starting from 1 within each recipe
- cuisines and diets should reflect the actual recipe
- No markdown, no explanation — only the JSON object.`
}

async function callBedrock(prompt: string): Promise<string> {
  const response = await bedrock.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens: 4096, temperature: 0.7 },
    }),
  )
  return response.output?.message?.content?.[0]?.text ?? ''
}

export const handler = async (event: GenerateEvent): Promise<void> => {
  console.log('generate-meal-plan-async invoked:', JSON.stringify(event))

  const { pk, preferences } = event
  const weekStart = event.weekStart ?? getCurrentWeekMonday()

  // Fetch user's favorite recipes for prompt enhancement
  const favorites = await fetchUserFavorites(pk)
  console.log(`Found ${favorites.length} favorites for ${pk}`)

  try {
    // Phase 1: Generate skeleton meal plan
    console.log('Phase 1: Generating skeleton meal plan...')
    const skeletonPrompt = buildSkeletonPrompt(preferences, favorites, weekStart)
    const skeletonText = await callBedrock(skeletonPrompt)

    const jsonMatch = skeletonText.match(/\[[\s\S]*\]/)
    const mealPlan: DayPlan[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    if (mealPlan.length === 0) {
      throw new Error('Skeleton generation returned empty meal plan')
    }

    console.log(`Phase 1 complete: ${mealPlan.length} days generated`)

    // Phase 2: Generate full recipes for each day in parallel
    console.log('Phase 2: Generating recipes for all days in parallel...')
    const recipePromises = mealPlan.map((day, i) => {
      const dayName = DAY_NAMES[i] ?? `Day${i + 1}`
      const prompt = buildRecipePrompt(day, dayName, preferences)
      return callBedrock(prompt).then((text) => {
        const match = text.match(/\{[\s\S]*\}/)
        if (!match) {
          console.warn(`No JSON found in recipe response for ${dayName}`)
          return null
        }
        return JSON.parse(match[0]) as Record<string, Recipe>
      }).catch((err) => {
        console.warn(`Recipe generation failed for ${dayName}:`, err)
        return null
      })
    })

    const recipeResults = await Promise.all(recipePromises)

    // Merge recipes into meal plan
    for (let i = 0; i < mealPlan.length; i++) {
      const recipes = recipeResults[i]
      if (!recipes) continue

      for (const [mealType, meal] of Object.entries(mealPlan[i]!.meals)) {
        const recipe = recipes[mealType]
        if (recipe) {
          mealPlan[i]!.meals[mealType] = { ...meal, recipe }
        }
      }
    }

    const recipesFound = recipeResults.filter(Boolean).length
    console.log(`Phase 2 complete: ${recipesFound}/${mealPlan.length} days enriched with recipes`)

    // Save to DynamoDB
    await dynamodb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk,
          sk: `MEALPLAN#${weekStart}`,
          status: 'ready',
          mealPlan,
          weekStart,
          createdAt: new Date().toISOString(),
          ttl: ttl90Days(),
        },
      }),
    )

    console.log(`Meal plan saved for ${pk}, week ${weekStart}`)
  } catch (error) {
    console.error('Failed to generate meal plan:', error)
    throw error
  }
}
