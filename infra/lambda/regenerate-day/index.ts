import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb'

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

    const body = JSON.parse(event.body || '{}')
    const { weekStart, date } = body

    if (!weekStart || !date) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing weekStart or date' }),
      }
    }

    const pk = `USER#${cognitoSub}`

    // Verify the meal plan exists
    const existing = await dynamodb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk, sk: `MEALPLAN#${weekStart}` },
      }),
    )

    if (!existing.Item) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'No meal plan found for this week' }),
      }
    }

    // Read preferences
    const prefsResult = await dynamodb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk, sk: 'PREFERENCES' },
      }),
    )

    const preferences = prefsResult.Item ?? {}

    // Mark the day as regenerating (keeps other 6 days visible)
    await dynamodb.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { pk, sk: `MEALPLAN#${weekStart}` },
        UpdateExpression: 'SET dayRegenerating = :date',
        ExpressionAttributeValues: { ':date': date },
      }),
    )

    // Fire-and-forget: invoke generate Lambda in single-day mode
    await lambdaClient.send(
      new InvokeCommand({
        FunctionName: GENERATE_FN_NAME,
        InvocationType: 'Event',
        Payload: new TextEncoder().encode(
          JSON.stringify({
            pk,
            preferences,
            weekStart,
            mode: 'single-day',
            targetDate: date,
          }),
        ),
      }),
    )

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ status: 'regenerating-day', date }),
    }
  } catch (error) {
    console.error('Error regenerating day:', error)
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}
