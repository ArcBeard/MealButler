import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TABLE_NAME = process.env.TABLE_NAME!

interface ActionGroupEvent {
  actionGroup: string
  apiPath?: string
  function: string
  parameters: { name: string; type: string; value: string }[]
  sessionAttributes?: Record<string, string>
  promptSessionAttributes?: Record<string, string>
  messageVersion: string
}

/** 90 days in seconds, added to current epoch for DynamoDB TTL */
function ttl90Days(): number {
  return Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60
}

/** Extract a parameter value by name, returning empty string if not found */
function getParam(parameters: ActionGroupEvent['parameters'], name: string): string {
  const param = parameters.find((p) => p.name === name)
  return param?.value ?? ''
}

/** Get the ISO date string (YYYY-MM-DD) for the Monday of the current week */
function getCurrentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay()
  // Adjust: Sunday (0) -> offset 6, Monday (1) -> offset 0, etc.
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  return monday.toISOString().split('T')[0]
}

export const handler = async (event: ActionGroupEvent) => {
  console.log('generate-meal-plan event:', JSON.stringify(event))

  try {
    const sessionId = getParam(event.parameters, 'sessionId')
    const userId = getParam(event.parameters, 'userId')
    const mealPlan = getParam(event.parameters, 'mealPlan')

    // Use USER# key when userId is provided, fall back to SESSION#
    const pk = userId ? `USER#${userId}` : `SESSION#${sessionId}`

    // If a meal plan is provided, store it in DynamoDB
    if (mealPlan) {
      const weekStart = getCurrentWeekMonday()

      await dynamodb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            pk,
            sk: `MEALPLAN#${weekStart}`,
            mealPlan: JSON.parse(mealPlan),
            weekStart,
            createdAt: new Date().toISOString(),
            ttl: ttl90Days(),
          },
        }),
      )

      return {
        messageVersion: '1.0',
        response: {
          actionGroup: event.actionGroup,
          function: event.function,
          functionResponse: {
            responseBody: {
              TEXT: {
                body: JSON.stringify({
                  status: 'saved',
                  sessionId,
                  weekStart,
                }),
              },
            },
          },
        },
      }
    }

    // No meal plan provided: read preferences and return them as context
    const result = await dynamodb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          pk,
          sk: 'PREFERENCES',
        },
      }),
    )

    if (!result.Item) {
      return {
        messageVersion: '1.0',
        response: {
          actionGroup: event.actionGroup,
          function: event.function,
          functionResponse: {
            responseBody: {
              TEXT: {
                body: JSON.stringify({
                  status: 'error',
                  message: 'No preferences found for this session',
                }),
              },
            },
          },
        },
      }
    }

    const { pk: _pk, sk, ttl, ...preferences } = result.Item

    return {
      messageVersion: '1.0',
      response: {
        actionGroup: event.actionGroup,
        function: event.function,
        functionResponse: {
          responseBody: {
            TEXT: {
              body: JSON.stringify({
                status: 'success',
                preferences,
                instruction:
                  'Use these preferences to generate a personalized weekly meal plan with breakfast, lunch, and dinner for 7 days.',
              }),
            },
          },
        },
      },
    }
  } catch (error) {
    console.error('Error in generate-meal-plan:', error)

    return {
      messageVersion: '1.0',
      response: {
        actionGroup: event.actionGroup,
        function: event.function,
        functionResponse: {
          responseBody: {
            TEXT: {
              body: JSON.stringify({
                status: 'error',
                message: 'Failed to process meal plan request',
              }),
            },
          },
        },
      },
    }
  }
}
