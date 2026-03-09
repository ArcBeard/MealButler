import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  BatchGetCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
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
  mode?: 'full' | 'single-day'
  targetDate?: string
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

function buildSingleDaySkeletonPrompt(
  targetDate: string,
  preferences: Record<string, unknown>,
  existingPlan: DayPlan[],
  favorites: Favorite[],
): string {
  const dayIndex = existingPlan.findIndex((d) => d.date === targetDate)
  const dayName = dayIndex >= 0 ? DAY_NAMES[dayIndex] ?? 'Day' : 'Day'

  const otherDaysSummary = existingPlan
    .filter((d) => d.date !== targetDate)
    .map((d) => {
      const meals = Object.entries(d.meals)
        .map(([type, meal]) => `${type}: ${meal.name}`)
        .join(', ')
      return `  ${d.date}: ${meals}`
    })
    .join('\n')

  let favoritesHint = ''
  if (favorites.length > 0) {
    const favList = favorites
      .map((f) => `- ${f.title}${f.cuisines?.length ? ` (${f.cuisines.join(', ')})` : ''}`)
      .join('\n')
    favoritesHint = `\n\nThe user has these preferred/favorite recipes — try to incorporate some when appropriate:\n${favList}\n`
  }

  return `Generate a single day meal plan for ${dayName} (${targetDate}) based on these preferences:
${JSON.stringify(preferences, null, 2)}
${favoritesHint}
The rest of the week already has these meals — generate DIFFERENT, complementary meals:
${otherDaysSummary}

Return ONLY valid JSON — a single object in this exact format:
{
  "date": "${targetDate}",
  "meals": {
    "breakfast": { "id": "unique-id", "name": "Meal Name", "prepMinutes": 20, "calories": 350, "emoji": "..." },
    "lunch": { ... },
    "dinner": { ... },
    "snack": { ... }
  }
}

Each meal must have: id (unique string), name, prepMinutes (number), calories (number), emoji (single food emoji).
Include breakfast, lunch, dinner, and snack. No markdown, no explanation — only the JSON object.`
}

async function callBedrock(prompt: string, maxTokens = 4096): Promise<string> {
  const response = await bedrock.send(
    new ConverseCommand({
      modelId: MODEL_ID,
      messages: [{ role: 'user', content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens, temperature: 0.7 },
    }),
  )
  return response.output?.message?.content?.[0]?.text ?? ''
}

// ─── Recipe DB helpers ────────────────────────────────────────────

interface RecipeCandidate {
  recipeId: string
  title: string
  estimatedCalories: number
  readyInMinutes: number
  imageUrl?: string
  cuisines?: string[]
}

const DEFAULT_CUISINES = ['American', 'Italian', 'Mexican', 'Asian', 'Mediterranean', 'Indian']

function parsePrefArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return value.split(',').map((s) => s.trim())
  return []
}

async function queryRecipeCandidates(
  preferences: Record<string, unknown>,
  limit = 55,
): Promise<RecipeCandidate[]> {
  let cuisinePrefs = parsePrefArray(preferences.cuisine)
  const dietaryPrefs = parsePrefArray(preferences.dietary).filter((d) => d && d !== 'none')
  const maxTime = parseInt(preferences.time as string, 10) || 60

  // "any" or empty → use a broad set of popular cuisines
  if (cuisinePrefs.length === 0 || cuisinePrefs.some((c) => c.toLowerCase() === 'any')) {
    cuisinePrefs = DEFAULT_CUISINES
  }

  const candidates: RecipeCandidate[] = []
  const seenIds = new Set<string>()

  // If dietary restrictions exist, query GSI2 first
  for (const diet of dietaryPrefs) {
    if (candidates.length >= limit) break
    for (const cuisine of cuisinePrefs) {
      if (candidates.length >= limit) break
      try {
        const result = await dynamodb.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'gsi2-diet-cuisine',
            KeyConditionExpression: 'gsi2pk = :diet AND begins_with(gsi2sk, :cuisine)',
            ExpressionAttributeValues: {
              ':diet': `DIET#${diet}`,
              ':cuisine': `CUISINE#${cuisine}`,
            },
            Limit: 20,
          }),
        )
        for (const item of result.Items ?? []) {
          const id = item.recipeId as string
          if (!seenIds.has(id) && (item.readyInMinutes as number) <= maxTime) {
            seenIds.add(id)
            candidates.push({
              recipeId: id,
              title: item.title as string,
              estimatedCalories: item.estimatedCalories as number,
              readyInMinutes: item.readyInMinutes as number,
            })
          }
        }
      } catch (err) {
        console.warn(`GSI2 query failed for ${diet}/${cuisine}:`, err)
      }
    }
  }

  // Query GSI1 for cuisine + meal type combinations
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snack']
  for (const cuisine of cuisinePrefs) {
    if (candidates.length >= limit) break
    for (const mealType of mealTypes) {
      if (candidates.length >= limit) break
      try {
        const paddedMaxTime = String(maxTime).padStart(4, '0')
        const result = await dynamodb.send(
          new QueryCommand({
            TableName: TABLE_NAME,
            IndexName: 'gsi1-cuisine-mealtype',
            KeyConditionExpression: 'gsi1pk = :cuisine AND begins_with(gsi1sk, :prefix)',
            ExpressionAttributeValues: {
              ':cuisine': `CUISINE#${cuisine}`,
              ':prefix': `MEALTYPE#${mealType}#`,
            },
            Limit: 15,
          }),
        )
        for (const item of result.Items ?? []) {
          const id = item.recipeId as string
          if (!seenIds.has(id) && (item.readyInMinutes as number) <= maxTime) {
            seenIds.add(id)
            candidates.push({
              recipeId: id,
              title: item.title as string,
              estimatedCalories: item.estimatedCalories as number,
              readyInMinutes: item.readyInMinutes as number,
              imageUrl: item.imageUrl as string | undefined,
            })
          }
        }
      } catch (err) {
        console.warn(`GSI1 query failed for ${cuisine}/${mealType}:`, err)
      }
    }
  }

  console.log(`Recipe DB: found ${candidates.length} candidates`)
  return candidates
}

function buildSelectionPrompt(
  candidates: RecipeCandidate[],
  preferences: Record<string, unknown>,
  favorites: Favorite[],
  weekStart: string,
): string {
  const candidateList = candidates
    .map((c) => `- id:"${c.recipeId}" "${c.title}" (~${c.readyInMinutes}min, ~${c.estimatedCalories}cal)`)
    .join('\n')

  let favoritesHint = ''
  if (favorites.length > 0) {
    const favList = favorites.map((f) => `- ${f.title}`).join('\n')
    favoritesHint = `\nUser's favorites (prefer these when matching):\n${favList}\n`
  }

  return `Select 28 recipes (4 per day × 7 days) from the candidate list below to build a balanced, varied week of meals.

User preferences:
${JSON.stringify(preferences, null, 2)}
${favoritesHint}
Available recipes:
${candidateList}

Rules:
- Each day needs: breakfast, lunch, dinner, snack
- Maximize variety — avoid repeating the same recipe
- Match meal types appropriately (e.g., oatmeal for breakfast, not dinner)
- Balance calories across the day
- If the candidate list doesn't have enough variety for a meal type, you may reuse recipes across different days

Return ONLY valid JSON — an array of 7 objects:
[
  {
    "date": "${weekStart}",
    "meals": {
      "breakfast": { "recipeId": "...", "emoji": "..." },
      "lunch": { "recipeId": "...", "emoji": "..." },
      "dinner": { "recipeId": "...", "emoji": "..." },
      "snack": { "recipeId": "...", "emoji": "..." }
    }
  }
]

Dates: ${weekStart} (Monday) through ${addDays(weekStart, 6)} (Sunday).
Each meal needs: recipeId (from the candidate list) and emoji (single food emoji).
No markdown, no explanation — only the JSON array.`
}

async function fetchFullRecipes(recipeIds: string[]): Promise<Map<string, Record<string, unknown>>> {
  const uniqueIds = [...new Set(recipeIds)]
  const recipeMap = new Map<string, Record<string, unknown>>()

  // BatchGetItem supports max 100 keys per call
  for (let i = 0; i < uniqueIds.length; i += 100) {
    const batch = uniqueIds.slice(i, i + 100)
    const result = await dynamodb.send(
      new BatchGetCommand({
        RequestItems: {
          [TABLE_NAME]: {
            Keys: batch.map((id) => ({ pk: `RECIPE#${id}`, sk: 'META' })),
          },
        },
      }),
    )

    for (const item of result.Responses?.[TABLE_NAME] ?? []) {
      const id = (item.pk as string).replace('RECIPE#', '')
      recipeMap.set(id, item as Record<string, unknown>)
    }
  }

  return recipeMap
}

interface SelectionMeal {
  recipeId: string
  emoji: string
}

interface SelectionDay {
  date: string
  meals: Record<string, SelectionMeal>
}

async function generateFromRecipeDB(
  pk: string,
  preferences: Record<string, unknown>,
  favorites: Favorite[],
  weekStart: string,
): Promise<DayPlan[] | null> {
  // Step 1: Query candidates
  const candidates = await queryRecipeCandidates(preferences)
  if (candidates.length < 20) {
    console.log(`Only ${candidates.length} candidates — falling back to Claude generation`)
    return null
  }

  // Step 2: Claude selects 28 recipes
  console.log('Recipe DB: Claude selecting from candidates...')
  const selectionPrompt = buildSelectionPrompt(candidates, preferences, favorites, weekStart)
  const selectionText = await callBedrock(selectionPrompt)

  const jsonMatch = selectionText.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    console.warn('Recipe DB: Claude selection returned no JSON — falling back')
    return null
  }

  const selection: SelectionDay[] = JSON.parse(jsonMatch[0])
  if (selection.length !== 7) {
    console.warn(`Recipe DB: Expected 7 days, got ${selection.length} — falling back`)
    return null
  }

  // Step 3: Collect all recipe IDs and batch-fetch full details
  const allRecipeIds = selection.flatMap((day) =>
    Object.values(day.meals).map((m) => m.recipeId),
  )
  console.log(`Recipe DB: fetching ${new Set(allRecipeIds).size} unique recipes...`)
  const recipeMap = await fetchFullRecipes(allRecipeIds)

  // Step 4: Assemble DayPlan array
  const mealPlan: DayPlan[] = selection.map((day) => {
    const meals: Record<string, MealEntry> = {}
    for (const [mealType, sel] of Object.entries(day.meals)) {
      const full = recipeMap.get(sel.recipeId)
      if (full) {
        const recipe: Recipe = {
          recipeId: sel.recipeId,
          title: full.title as string,
          imageUrl: full.imageUrl as string | undefined,
          sourceUrl: full.sourceUrl as string | undefined,
          sourceName: full.sourceName as string | undefined,
          servings: full.servings as number,
          readyInMinutes: full.readyInMinutes as number,
          prepMinutes: full.prepMinutes as number | undefined,
          cookMinutes: full.cookMinutes as number | undefined,
          ingredients: full.ingredients as Ingredient[],
          steps: full.steps as RecipeStep[],
          cuisines: full.cuisines as string[],
          diets: full.diets as string[],
        }
        meals[mealType] = {
          id: `${day.date}-${mealType}`,
          name: recipe.title,
          prepMinutes: recipe.readyInMinutes,
          calories: full.estimatedCalories as number ?? 400,
          emoji: sel.emoji,
          recipe,
        }
      } else {
        // Recipe not found in DB — create placeholder
        meals[mealType] = {
          id: `${day.date}-${mealType}`,
          name: 'Recipe unavailable',
          prepMinutes: 0,
          calories: 0,
          emoji: sel.emoji,
        }
      }
    }
    return { date: day.date, meals }
  })

  return mealPlan
}

export const handler = async (event: GenerateEvent): Promise<void> => {
  console.log('generate-meal-plan-async invoked:', JSON.stringify(event))

  const { pk, preferences } = event
  const weekStart = event.weekStart ?? getCurrentWeekMonday()

  // Fetch user's favorite recipes for prompt enhancement
  const favorites = await fetchUserFavorites(pk)
  console.log(`Found ${favorites.length} favorites for ${pk}`)

  // ─── Single-day regeneration mode ───────────────────────────────
  if (event.mode === 'single-day' && event.targetDate) {
    const { targetDate } = event
    console.log(`Single-day mode: regenerating ${targetDate} for ${pk}`)

    try {
      // Read existing plan for context
      const existing = await dynamodb.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { pk, sk: `MEALPLAN#${weekStart}` },
        }),
      )

      const existingPlan: DayPlan[] = existing.Item?.mealPlan ?? []
      if (existingPlan.length === 0) {
        throw new Error('No existing meal plan found for single-day regeneration')
      }

      // Generate skeleton for single day
      console.log('Single-day: generating skeleton...')
      const skeletonPrompt = buildSingleDaySkeletonPrompt(targetDate, preferences, existingPlan, favorites)
      const skeletonText = await callBedrock(skeletonPrompt)

      const jsonMatch = skeletonText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Single-day skeleton returned no JSON')
      const newDay: DayPlan = JSON.parse(jsonMatch[0])

      // Generate recipes for the single day
      const dayIndex = existingPlan.findIndex((d) => d.date === targetDate)
      const dayName = dayIndex >= 0 ? DAY_NAMES[dayIndex] ?? 'Day' : 'Day'

      console.log('Single-day: generating recipes...')
      const recipePrompt = buildRecipePrompt(newDay, dayName, preferences)
      const recipeText = await callBedrock(recipePrompt, 8192)

      const recipeMatch = recipeText.match(/\{[\s\S]*\}/)
      if (recipeMatch) {
        const recipes = JSON.parse(recipeMatch[0]) as Record<string, Recipe>
        for (const [mealType, meal] of Object.entries(newDay.meals)) {
          const recipe = recipes[mealType]
          if (recipe) {
            newDay.meals[mealType as keyof typeof newDay.meals] = { ...meal, recipe }
          }
        }
      }

      // Replace the target day in the existing plan
      const updatedPlan = existingPlan.map((day) =>
        day.date === targetDate ? newDay : day,
      )

      // Save with dayRegenerating cleared
      await dynamodb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { pk, sk: `MEALPLAN#${weekStart}` },
          UpdateExpression: 'SET mealPlan = :plan, #s = :status, createdAt = :ts REMOVE dayRegenerating',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':plan': updatedPlan,
            ':status': 'ready',
            ':ts': new Date().toISOString(),
          },
        }),
      )

      console.log(`Single-day regeneration complete for ${targetDate}`)
      return
    } catch (error) {
      console.error('Single-day regeneration failed:', error)
      // Clear the dayRegenerating flag so the UI doesn't show spinner forever
      await dynamodb.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { pk, sk: `MEALPLAN#${weekStart}` },
          UpdateExpression: 'REMOVE dayRegenerating',
        }),
      ).catch(() => {}) // best-effort cleanup
      throw error
    }
  }

  try {
    // ─── Try Recipe DB first ────────────────────────────────────────
    let mealPlan: DayPlan[] | null = null

    try {
      console.log('Attempting recipe DB generation...')
      mealPlan = await generateFromRecipeDB(pk, preferences, favorites, weekStart)
      if (mealPlan) {
        console.log('Recipe DB generation successful')
      }
    } catch (err) {
      console.warn('Recipe DB generation failed, falling back to Claude:', err)
    }

    // ─── Fallback: Claude-generated recipes ─────────────────────────
    if (!mealPlan) {
      console.log('Fallback: Generating skeleton meal plan with Claude...')
      const skeletonPrompt = buildSkeletonPrompt(preferences, favorites, weekStart)
      const skeletonText = await callBedrock(skeletonPrompt)

      const jsonMatch = skeletonText.match(/\[[\s\S]*\]/)
      mealPlan = jsonMatch ? JSON.parse(jsonMatch[0]) : []

      if (!mealPlan || mealPlan.length === 0) {
        throw new Error('Skeleton generation returned empty meal plan')
      }

      console.log(`Skeleton complete: ${mealPlan.length} days generated`)

      console.log('Generating recipes for all days in parallel...')
      const recipePromises = mealPlan.map((day, i) => {
        const dayName = DAY_NAMES[i] ?? `Day${i + 1}`
        const prompt = buildRecipePrompt(day, dayName, preferences)
        return callBedrock(prompt, 8192).then((text) => {
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
      console.log(`Claude fallback complete: ${recipesFound}/${mealPlan.length} days enriched`)
    }

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
