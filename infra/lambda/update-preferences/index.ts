import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb'

const lambdaClient = new LambdaClient({})
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TABLE_NAME = process.env.TABLE_NAME!
const GENERATE_FN_NAME = process.env.GENERATE_FN_NAME!

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'PUT,OPTIONS',
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

interface APIGatewayProxyEvent {
  httpMethod: string
  body: string | null
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

    if (!cognitoSub) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing authentication' }),
      }
    }

    const preferences = JSON.parse(event.body || '{}')
    const pk = `USER#${cognitoSub}`

    // Save preferences
    await dynamodb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk,
          sk: 'PREFERENCES',
          ...preferences,
          ttl: ttl90Days(),
        },
      }),
    )

    // Write "generating" placeholder for current week's meal plan
    const weekStart = getCurrentWeekMonday()
    await dynamodb.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          pk,
          sk: `MEALPLAN#${weekStart}`,
          status: 'generating',
          weekStart,
          createdAt: new Date().toISOString(),
          ttl: ttl90Days(),
        },
      }),
    )

    // Fire-and-forget: invoke generate Lambda asynchronously
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: GENERATE_FN_NAME,
        InvocationType: 'Event',
        Payload: new TextEncoder().encode(
          JSON.stringify({ pk, preferences }),
        ),
      }),
    )

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ status: 'saved' }),
    }
  } catch (error) {
    console.error('Error updating preferences:', error)
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}
