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
import { searchRecipes, getRecipeInfoBulk } from '../shared/spoonacular-client'
import { mapSpoonacularToRecipe } from '../shared/recipe-mapper'
import type { Recipe } from '../shared/recipe-mapper'

const bedrock = new BedrockRuntimeClient({})
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TABLE_NAME = process.env.TABLE_NAME!
const MODEL_ID = process.env.MODEL_ID ?? 'us.anthropic.claude-sonnet-4-6'

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

interface Favorite {
  recipeId: string | number
  title: string
  cuisines?: string[]
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
}

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

function buildPrompt(
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

/**
 * Rank Spoonacular search results, boosting matches from user's preferred sources.
 * Returns IDs sorted by relevance (best first).
 */
function rankSearchResults(
  results: Array<{ id: number; title: string }>,
  _mealName: string,
  _preferredSites?: string[],
): number[] {
  // For now, return in original order (Spoonacular relevance)
  // Preferred site boosting will happen after full recipe info is fetched
  return results.map((r) => r.id)
}

async function enrichMealWithRecipe(
  meal: MealEntry,
  preferences: Record<string, unknown>,
  preferredSites?: string[],
): Promise<MealEntry> {
  try {
    const cuisine = preferences.cuisine as string | undefined
    const dietary = preferences.dietary as string | undefined
    const maxTime = meal.prepMinutes || undefined

    const searchResult = await searchRecipes(
      meal.name,
      cuisine,
      dietary,
      maxTime,
    )

    if (searchResult.results.length === 0) {
      console.log(`No Spoonacular results for "${meal.name}"`)
      return meal
    }

    const rankedIds = rankSearchResults(
      searchResult.results,
      meal.name,
      preferredSites,
    )

    // Fetch full info for top results
    const topIds = rankedIds.slice(0, 3)
    const fullRecipes = await getRecipeInfoBulk(topIds)

    if (fullRecipes.length === 0) return meal

    // If user has preferred sites, boost those recipes
    let bestRecipe = fullRecipes[0]!
    if (preferredSites && preferredSites.length > 0) {
      const boosted = fullRecipes.find(
        (r) =>
          r.sourceName &&
          preferredSites.some(
            (site) =>
              r.sourceName!.toLowerCase().includes(site.toLowerCase()),
          ),
      )
      if (boosted) bestRecipe = boosted
    }

    const mapped = mapSpoonacularToRecipe(bestRecipe)
    return { ...meal, recipe: mapped }
  } catch (error) {
    console.warn(
      `Spoonacular enrichment failed for "${meal.name}", saving without recipe:`,
      error,
    )
    return meal
  }
}

export const handler = async (event: GenerateEvent): Promise<void> => {
  console.log('generate-meal-plan-async invoked:', JSON.stringify(event))

  const { pk, preferences } = event
  const weekStart = getCurrentWeekMonday()

  // Fetch user's favorite recipes for prompt enhancement
  const favorites = await fetchUserFavorites(pk)
  console.log(`Found ${favorites.length} favorites for ${pk}`)

  const prompt = buildPrompt(preferences, favorites, weekStart)

  try {
    const response = await bedrock.send(
      new ConverseCommand({
        modelId: MODEL_ID,
        messages: [{ role: 'user', content: [{ text: prompt }] }],
        inferenceConfig: { maxTokens: 4096, temperature: 0.7 },
      }),
    )

    const text = response.output?.message?.content?.[0]?.text ?? '[]'

    // Extract JSON array from response (handle possible markdown wrapping)
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    const mealPlan: DayPlan[] = jsonMatch ? JSON.parse(jsonMatch[0]) : []

    // Enrich each meal with Spoonacular recipe data
    const preferredSites = preferences.preferredSites as
      | string[]
      | undefined

    for (const day of mealPlan) {
      for (const [mealType, meal] of Object.entries(day.meals)) {
        day.meals[mealType] = await enrichMealWithRecipe(
          meal,
          preferences,
          preferredSites,
        )
      }
    }

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
