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

interface APIGatewayProxyEvent {
  httpMethod: string
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

    const result = await dynamodb.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { pk: `USER#${cognitoSub}`, sk: 'PREFERENCES' },
      }),
    )

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'No preferences found' }),
      }
    }

    const { pk, sk, ttl, ...preferences } = result.Item

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(preferences),
    }
  } catch (error) {
    console.error('Error fetching preferences:', error)
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}
