import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  BatchGetCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb'

const ssm = new SSMClient({})
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const BASE_URL = 'https://api.spoonacular.com'
const CACHE_TTL_DAYS = 30

// Module-level cache for API key
let cachedApiKey: string | null = null

async function getApiKey(): Promise<string> {
  if (cachedApiKey) return cachedApiKey

  const paramName =
    process.env.SPOONACULAR_API_KEY_PARAM ?? '/mealapp/spoonacular-api-key'

  const result = await ssm.send(
    new GetParameterCommand({
      Name: paramName,
      WithDecryption: true,
    }),
  )

  cachedApiKey = result.Parameter?.Value ?? ''
  if (!cachedApiKey) {
    throw new Error('Spoonacular API key not found in SSM')
  }
  return cachedApiKey
}

function getTableName(): string {
  return process.env.TABLE_NAME!
}

function cacheTtl(): number {
  return Math.floor(Date.now() / 1000) + CACHE_TTL_DAYS * 24 * 60 * 60
}

export interface SpoonacularSearchResult {
  id: number
  title: string
  image?: string
  imageType?: string
}

export interface SpoonacularSearchResponse {
  results: SpoonacularSearchResult[]
  offset: number
  number: number
  totalResults: number
}

export interface SpoonacularRecipe {
  id: number
  title: string
  image?: string
  sourceUrl?: string
  sourceName?: string
  servings: number
  readyInMinutes: number
  preparationMinutes?: number
  cookingMinutes?: number
  extendedIngredients?: Array<{
    id: number
    name: string
    amount: number
    unit: string
    original: string
  }>
  analyzedInstructions?: Array<{
    steps: Array<{
      number: number
      step: string
    }>
  }>
  cuisines?: string[]
  diets?: string[]
}

export async function searchRecipes(
  query: string,
  cuisine?: string,
  diet?: string,
  maxReadyTime?: number,
): Promise<SpoonacularSearchResponse> {
  const apiKey = await getApiKey()

  const params = new URLSearchParams({
    apiKey,
    query,
    number: '5',
    addRecipeInformation: 'false',
  })

  if (cuisine) params.set('cuisine', cuisine)
  if (diet) params.set('diet', diet)
  if (maxReadyTime) params.set('maxReadyTime', String(maxReadyTime))

  const url = `${BASE_URL}/recipes/complexSearch?${params.toString()}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Spoonacular search failed: ${response.status} ${response.statusText}`,
    )
  }

  return (await response.json()) as SpoonacularSearchResponse
}

export async function getRecipeInfoBulk(
  ids: number[],
): Promise<SpoonacularRecipe[]> {
  if (ids.length === 0) return []

  const tableName = getTableName()

  // Check DynamoDB cache first
  const keys = ids.map((id) => ({ pk: `RECIPE#${id}`, sk: 'RECIPE' }))

  // BatchGet supports max 100 keys
  const cached: SpoonacularRecipe[] = []
  const missingIds: number[] = []

  // Process in chunks of 100
  for (let i = 0; i < keys.length; i += 100) {
    const chunk = keys.slice(i, i + 100)

    const batchResult = await dynamodb.send(
      new BatchGetCommand({
        RequestItems: {
          [tableName]: { Keys: chunk },
        },
      }),
    )

    const items = batchResult.Responses?.[tableName] ?? []
    const foundIds = new Set(
      items.map((item) => Number(String(item.pk).replace('RECIPE#', ''))),
    )

    for (const item of items) {
      cached.push(item.data as SpoonacularRecipe)
    }

    // Determine which IDs from this chunk were missing
    const chunkIds = ids.slice(i, i + 100)
    for (const id of chunkIds) {
      if (!foundIds.has(id)) {
        missingIds.push(id)
      }
    }
  }

  if (missingIds.length === 0) return cached

  // Fetch missing from Spoonacular API
  const apiKey = await getApiKey()
  const url = `${BASE_URL}/recipes/informationBulk?apiKey=${apiKey}&ids=${missingIds.join(',')}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(
      `Spoonacular bulk info failed: ${response.status} ${response.statusText}`,
    )
  }

  const fetched = (await response.json()) as SpoonacularRecipe[]

  // Cache fetched recipes in DynamoDB (BatchWrite max 25 items)
  for (let i = 0; i < fetched.length; i += 25) {
    const chunk = fetched.slice(i, i + 25)
    await dynamodb.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: chunk.map((recipe) => ({
            PutRequest: {
              Item: {
                pk: `RECIPE#${recipe.id}`,
                sk: 'RECIPE',
                data: recipe,
                ttl: cacheTtl(),
              },
            },
          })),
        },
      }),
    )
  }

  return [...cached, ...fetched]
}
