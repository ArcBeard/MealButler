import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

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

export const handler = async (event: ActionGroupEvent) => {
  console.log('save-preferences event:', JSON.stringify(event))

  try {
    const sessionId = getParam(event.parameters, 'sessionId')
    const household = getParam(event.parameters, 'household')
    const dietaryRaw = getParam(event.parameters, 'dietary')
    const budget = getParam(event.parameters, 'budget')
    const skill = getParam(event.parameters, 'skill')
    const time = getParam(event.parameters, 'time')
    const cuisineRaw = getParam(event.parameters, 'cuisine')
    const notes = getParam(event.parameters, 'notes')

    // Convert comma-separated strings to arrays
    const dietary = dietaryRaw ? dietaryRaw.split(',').map((s) => s.trim()) : []
    const cuisine = cuisineRaw ? cuisineRaw.split(',').map((s) => s.trim()) : []

    await dynamodb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk: `SESSION#${sessionId}`,
          sk: 'PREFERENCES',
          household,
          dietary,
          budget,
          skill,
          time,
          cuisine,
          notes,
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
              body: JSON.stringify({ status: 'saved', sessionId }),
            },
          },
        },
      },
    }
  } catch (error) {
    console.error('Error saving preferences:', error)

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
                message: 'Failed to save preferences',
              }),
            },
          },
        },
      },
    }
  }
}
