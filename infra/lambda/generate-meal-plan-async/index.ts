import {
  BedrockRuntimeClient,
  ConverseCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

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

interface GenerateEvent {
  pk: string
  preferences: Record<string, unknown>
}

export const handler = async (event: GenerateEvent): Promise<void> => {
  console.log('generate-meal-plan-async invoked:', JSON.stringify(event))

  const { pk, preferences } = event
  const weekStart = getCurrentWeekMonday()

  const prompt = `Generate a 7-day meal plan (Monday through Sunday) based on these preferences:
${JSON.stringify(preferences, null, 2)}

Return ONLY valid JSON — an array of 7 objects, one per day, in this exact format:
[
  {
    "date": "YYYY-MM-DD",
    "meals": {
      "breakfast": { "id": "unique-id", "name": "Meal Name", "prepMinutes": 20, "calories": 350, "emoji": "🥣" },
      "lunch": { ... },
      "dinner": { ... },
      "snack": { ... }
    }
  }
]

The dates should start from ${weekStart} (Monday) through ${addDays(weekStart, 6)} (Sunday).
Each meal must have: id (unique string), name, prepMinutes (number), calories (number), emoji (single food emoji).
Include breakfast, lunch, dinner, and snack for each day. No markdown, no explanation — only the JSON array.`

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
    const mealPlan = jsonMatch ? JSON.parse(jsonMatch[0]) : []

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
