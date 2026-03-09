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

// ---------------------------------------------------------------------------
// Recipe site registry & scraping
// ---------------------------------------------------------------------------

interface RecipeSite {
  domain: string
  searchUrl: (query: string) => string
  recipePattern: RegExp
}

const SITE_REGISTRY: Record<string, RecipeSite> = {
  'allrecipes': {
    domain: 'allrecipes.com',
    searchUrl: (q) => `https://www.allrecipes.com/search?q=${encodeURIComponent(q)}`,
    recipePattern: /https?:\/\/www\.allrecipes\.com\/recipe\/\d+\/[\w-]+\/?/,
  },
  'budget bytes': {
    domain: 'budgetbytes.com',
    searchUrl: (q) => `https://www.budgetbytes.com/?s=${encodeURIComponent(q)}`,
    recipePattern: /https?:\/\/www\.budgetbytes\.com\/[\w][\w-]*[\w]\/?/,
  },
  'taste of home': {
    domain: 'tasteofhome.com',
    searchUrl: (q) => `https://www.tasteofhome.com/search/?q=${encodeURIComponent(q)}`,
    recipePattern: /https?:\/\/www\.tasteofhome\.com\/recipes\/[\w-]+\/?/,
  },
}

const DEFAULT_SITES = ['allrecipes', 'budget bytes', 'taste of home']

const DEFAULT_SCRAPE_TYPES = ['dinner']
const VALID_MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner', 'snack'])

function resolveScrapeTypes(scrapeMealTypes?: unknown): Set<string> {
  if (Array.isArray(scrapeMealTypes) && scrapeMealTypes.length > 0) {
    const types = scrapeMealTypes
      .map((t) => String(t).toLowerCase().trim())
      .filter((t) => VALID_MEAL_TYPES.has(t))
    if (types.length > 0) return new Set(types)
  }
  return new Set(DEFAULT_SCRAPE_TYPES)
}

const FETCH_TIMEOUT_MS = 5_000
const FETCH_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
}

function resolveSites(preferredSites?: unknown): RecipeSite[] {
  const keys: string[] = []
  if (Array.isArray(preferredSites)) {
    for (const s of preferredSites) {
      const key = String(s).toLowerCase().trim()
      if (SITE_REGISTRY[key]) {
        keys.push(key)
      } else {
        console.warn(`Unrecognized recipe site "${s}", skipping`)
      }
    }
  }
  if (keys.length === 0) {
    keys.push(...DEFAULT_SITES)
  }
  return keys.map((k) => SITE_REGISTRY[k]!)
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: FETCH_HEADERS,
      signal: controller.signal,
      redirect: 'follow',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(timer)
  }
}

function isRecipeType(type: unknown): boolean {
  if (type === 'Recipe') return true
  if (Array.isArray(type)) return type.includes('Recipe')
  return false
}

function extractJsonLdRecipe(html: string): Record<string, unknown> | null {
  const scriptPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]!)
      // Direct Recipe (string or array @type)
      if (isRecipeType(data['@type'])) return data
      // @graph array
      if (Array.isArray(data['@graph'])) {
        const recipe = data['@graph'].find(
          (item: Record<string, unknown>) => isRecipeType(item['@type']),
        )
        if (recipe) return recipe
      }
      // Array of objects
      if (Array.isArray(data)) {
        const recipe = data.find(
          (item: Record<string, unknown>) => isRecipeType(item['@type']),
        )
        if (recipe) return recipe
      }
    } catch {
      // invalid JSON, try next block
    }
  }
  return null
}

function parseIsoDuration(s: unknown): number | undefined {
  if (typeof s !== 'string') return undefined
  const m = s.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
  if (!m) return undefined
  return (parseInt(m[1] ?? '0', 10) * 60) + parseInt(m[2] ?? '0', 10)
}

function parseIngredientString(s: string, id: number): Ingredient {
  const m = s.match(/^([\d./½¼¾⅓⅔]+(?:\s*[\d./½¼¾⅓⅔]+)?)\s+(\w+)\s+(.+)$/)
  if (m) {
    const fractionMap: Record<string, number> = {
      '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 0.333, '⅔': 0.667,
    }
    let amount = fractionMap[m[1]!] ?? parseFloat(m[1]!)
    if (isNaN(amount)) amount = 0
    return { id, name: m[3]!.trim(), amount, unit: m[2]!, original: s }
  }
  return { id, name: s, amount: 0, unit: '', original: s }
}

function extractImageUrl(image: unknown): string | undefined {
  if (typeof image === 'string') return image
  if (Array.isArray(image)) {
    const first = image[0]
    if (typeof first === 'string') return first
    if (first && typeof first === 'object' && 'url' in first) return String((first as Record<string, unknown>).url)
  }
  if (image && typeof image === 'object' && 'url' in image) return String((image as Record<string, unknown>).url)
  return undefined
}

function mapJsonLdToRecipe(
  ld: Record<string, unknown>,
  sourceUrl: string,
  sourceDomain: string,
): Recipe {
  const title = String(ld.name ?? 'Untitled')
  const recipeId = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

  const prepMinutes = parseIsoDuration(ld.prepTime)
  const cookMinutes = parseIsoDuration(ld.cookTime)
  const totalMinutes = parseIsoDuration(ld.totalTime)
  const readyInMinutes = totalMinutes ?? (((prepMinutes ?? 0) + (cookMinutes ?? 0)) || 30)

  let servings = 4
  if (typeof ld.recipeYield === 'string') {
    const n = parseInt(ld.recipeYield, 10)
    if (!isNaN(n) && n > 0) servings = n
  } else if (Array.isArray(ld.recipeYield) && ld.recipeYield.length > 0) {
    const n = parseInt(String(ld.recipeYield[0]), 10)
    if (!isNaN(n) && n > 0) servings = n
  } else if (typeof ld.recipeYield === 'number') {
    servings = ld.recipeYield
  }

  const ingredients: Ingredient[] = Array.isArray(ld.recipeIngredient)
    ? ld.recipeIngredient.map((s: unknown, i: number) => parseIngredientString(String(s), i + 1))
    : []

  const steps: RecipeStep[] = []
  if (Array.isArray(ld.recipeInstructions)) {
    for (let i = 0; i < ld.recipeInstructions.length; i++) {
      const instr = ld.recipeInstructions[i]
      if (typeof instr === 'string') {
        steps.push({ number: i + 1, step: instr })
      } else if (instr && typeof instr === 'object') {
        const obj = instr as Record<string, unknown>
        // HowToStep or HowToSection
        if (obj.text) {
          steps.push({ number: steps.length + 1, step: String(obj.text) })
        } else if (Array.isArray(obj.itemListElement)) {
          for (const sub of obj.itemListElement) {
            const subObj = sub as Record<string, unknown>
            if (subObj.text) {
              steps.push({ number: steps.length + 1, step: String(subObj.text) })
            }
          }
        }
      }
    }
  }

  let cuisines: string[] = []
  if (typeof ld.recipeCuisine === 'string') cuisines = [ld.recipeCuisine]
  else if (Array.isArray(ld.recipeCuisine)) cuisines = ld.recipeCuisine.map(String)

  let diets: string[] = []
  if (typeof ld.suitableForDiet === 'string') diets = [ld.suitableForDiet]
  else if (Array.isArray(ld.suitableForDiet)) diets = ld.suitableForDiet.map(String)

  // Pretty-print domain as source name
  const sourceName = sourceDomain
    .replace(/^www\./, '')
    .replace(/\.com$/, '')
    .split(/[.-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

  return {
    recipeId,
    title,
    imageUrl: extractImageUrl(ld.image),
    sourceUrl,
    sourceName,
    servings,
    readyInMinutes,
    prepMinutes,
    cookMinutes,
    ingredients,
    steps,
    cuisines,
    diets,
  }
}

async function searchAndScrapeRecipe(
  mealName: string,
  sites: RecipeSite[],
): Promise<Recipe | null> {
  for (const site of sites) {
    try {
      // Step 1: Fetch search results page
      const searchHtml = await fetchWithTimeout(site.searchUrl(mealName), FETCH_TIMEOUT_MS)

      // Step 2: Find first recipe URL in search results
      const urlMatch = searchHtml.match(site.recipePattern)
      if (!urlMatch) {
        console.log(`No recipe URL found on ${site.domain} for "${mealName}"`)
        continue
      }
      const recipeUrl = urlMatch[0]

      // Step 3: Fetch recipe page
      const recipeHtml = await fetchWithTimeout(recipeUrl, FETCH_TIMEOUT_MS)

      // Step 4: Extract JSON-LD
      const jsonLd = extractJsonLdRecipe(recipeHtml)
      if (!jsonLd) {
        console.log(`No JSON-LD Recipe found at ${recipeUrl}`)
        continue
      }

      // Step 5: Map to our Recipe type
      const recipe = mapJsonLdToRecipe(jsonLd, recipeUrl, site.domain)
      console.log(`Scraped recipe from ${site.domain}: "${recipe.title}"`)
      return recipe
    } catch (err) {
      console.log(`Scrape failed on ${site.domain} for "${mealName}":`, err)
    }
  }
  return null
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

    // Determine which meal types to scrape vs generate with Claude
    const sites = resolveSites(preferences.preferredSites)
    const scrapeTypes = resolveScrapeTypes(preferences.scrapeMealTypes)
    console.log(`Phase 2: Scraping [${[...scrapeTypes].join(', ')}] from ${sites.map((s) => s.domain).join(', ')}...`)

    // Phase 2a: Scrape configured meal types in parallel
    interface ScrapeResult {
      dayIndex: number
      mealType: string
      recipe: Recipe | null
    }

    const scrapePromises: Promise<ScrapeResult>[] = mealPlan.flatMap((day, dayIndex) =>
      Object.entries(day.meals)
        .filter(([mealType]) => scrapeTypes.has(mealType))
        .map(([mealType, meal]) =>
          searchAndScrapeRecipe(meal.name, sites)
            .then((recipe) => ({ dayIndex, mealType, recipe }))
            .catch(() => ({ dayIndex, mealType, recipe: null })),
        ),
    )

    const scrapeResults = await Promise.all(scrapePromises)

    // Merge scraped recipes into meal plan
    let scrapedCount = 0
    for (const { dayIndex, mealType, recipe } of scrapeResults) {
      if (recipe) {
        mealPlan[dayIndex]!.meals[mealType] = {
          ...mealPlan[dayIndex]!.meals[mealType]!,
          recipe,
        }
        scrapedCount++
      }
    }

    const totalScrapeable = scrapePromises.length
    console.log(`Phase 2 complete: ${scrapedCount}/${totalScrapeable} meals scraped successfully`)

    // Phase 3: Claude generation for non-scraped types + failed scrapes
    const claudeByDay = new Map<number, string[]>()

    // Add meal types that were never scraped (Claude-only)
    for (let dayIndex = 0; dayIndex < mealPlan.length; dayIndex++) {
      for (const mealType of Object.keys(mealPlan[dayIndex]!.meals)) {
        if (!scrapeTypes.has(mealType)) {
          const list = claudeByDay.get(dayIndex) ?? []
          list.push(mealType)
          claudeByDay.set(dayIndex, list)
        }
      }
    }

    // Add scraped types that failed
    for (const { dayIndex, mealType, recipe } of scrapeResults) {
      if (!recipe) {
        const list = claudeByDay.get(dayIndex) ?? []
        list.push(mealType)
        claudeByDay.set(dayIndex, list)
      }
    }

    if (claudeByDay.size > 0) {
      const totalClaude = Array.from(claudeByDay.values()).reduce((sum, v) => sum + v.length, 0)
      console.log(`Phase 3: Generating Claude recipes for ${totalClaude} meals across ${claudeByDay.size} days...`)

      const fallbackPromises = Array.from(claudeByDay.entries()).map(
        async ([dayIndex, mealTypes]) => {
          const day = mealPlan[dayIndex]!
          const dayName = DAY_NAMES[dayIndex] ?? `Day${dayIndex + 1}`

          const partialDay: DayPlan = {
            date: day.date,
            meals: Object.fromEntries(
              mealTypes.map((t) => [t, day.meals[t]!]),
            ),
          }

          try {
            const prompt = buildRecipePrompt(partialDay, dayName, preferences)
            const text = await callBedrock(prompt, 8192)
            const match = text.match(/\{[\s\S]*\}/)
            if (!match) {
              console.warn(`No JSON in Claude response for ${dayName}`)
              return
            }
            const recipes = JSON.parse(match[0]) as Record<string, Recipe>
            for (const mealType of mealTypes) {
              const recipe = recipes[mealType]
              if (recipe) {
                mealPlan[dayIndex]!.meals[mealType] = {
                  ...mealPlan[dayIndex]!.meals[mealType]!,
                  recipe,
                }
              }
            }
            console.log(`Claude generated ${Object.keys(recipes).length} recipes for ${dayName}`)
          } catch (err) {
            console.warn(`Claude generation failed for ${dayName}:`, err)
          }
        },
      )

      await Promise.all(fallbackPromises)
    } else {
      console.log('Phase 3: Skipped — all recipes scraped successfully')
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
