import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb'

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const TABLE_NAME = process.env.TABLE_NAME!

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
}

function getCurrentWeekMonday(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 6 : day - 1
  const monday = new Date(now)
  monday.setDate(now.getDate() - diff)
  return monday.toISOString().split('T')[0]!
}

interface APIGatewayProxyEvent {
  httpMethod: string
  queryStringParameters: Record<string, string | undefined> | null
  requestContext: {
    authorizer?: {
      claims?: {
        sub?: string
        [key: string]: string | undefined
      }
    }
  }
}

interface APIGatewayProxyResult {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }

  try {
    const cognitoSub = event.requestContext?.authorizer?.claims?.sub
    const sessionId = event.queryStringParameters?.sessionId

    if (!cognitoSub && !sessionId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing authentication or sessionId' }),
      }
    }

    const pk = cognitoSub ? `USER#${cognitoSub}` : `SESSION#${sessionId}`
    const week = event.queryStringParameters?.week ?? getCurrentWeekMonday()

    const result = await dynamodb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk, sk: `MEALPLAN#${week}` },
      }),
    )

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'No meal plan found', week }),
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        week: result.Item.weekStart,
        mealPlan: result.Item.mealPlan,
        createdAt: result.Item.createdAt,
      }),
    }
  } catch (error) {
    console.error('Error fetching meal plan:', error)
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}
