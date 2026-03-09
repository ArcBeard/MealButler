import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb'

const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))
const TABLE_NAME = process.env.TABLE_NAME!

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
}

function ttl90Days(): number {
  return Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60
}

interface APIGatewayProxyEvent {
  httpMethod: string
  body: string | null
  pathParameters: Record<string, string | undefined> | null
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

export const handler = async (
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS_HEADERS, body: '' }
  }

  try {
    const cognitoSub = event.requestContext?.authorizer?.claims?.sub

    if (!cognitoSub) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing authentication' }),
      }
    }

    const pk = `USER#${cognitoSub}`

    switch (event.httpMethod) {
      case 'GET':
        return handleGet(pk)
      case 'POST':
        return handlePost(pk, event.body)
      case 'DELETE':
        return handleDelete(pk, event.pathParameters?.recipeId)
      default:
        return {
          statusCode: 405,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: 'Method not allowed' }),
        }
    }
  } catch (error) {
    console.error('Error in favorites handler:', error)
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Internal server error' }),
    }
  }
}

async function handleGet(pk: string): Promise<APIGatewayProxyResult> {
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

  const favorites = (result.Items ?? []).map((item) => ({
    recipeId: item.recipeId,
    title: item.title,
    imageUrl: item.imageUrl,
    cuisines: item.cuisines,
    createdAt: item.createdAt,
  }))

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify(favorites),
  }
}

async function handlePost(
  pk: string,
  body: string | null,
): Promise<APIGatewayProxyResult> {
  const data = JSON.parse(body || '{}')
  const { recipeId, title, imageUrl, cuisines } = data

  if (!recipeId || !title) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'recipeId and title are required' }),
    }
  }

  await dynamodb.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        pk,
        sk: `FAVORITE#${recipeId}`,
        recipeId,
        title,
        imageUrl,
        cuisines: cuisines ?? [],
        createdAt: new Date().toISOString(),
        ttl: ttl90Days(),
      },
    }),
  )

  return {
    statusCode: 201,
    headers: CORS_HEADERS,
    body: JSON.stringify({ status: 'saved' }),
  }
}

async function handleDelete(
  pk: string,
  recipeId: string | undefined,
): Promise<APIGatewayProxyResult> {
  if (!recipeId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'recipeId is required' }),
    }
  }

  await dynamodb.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: {
        pk,
        sk: `FAVORITE#${recipeId}`,
      },
    }),
  )

  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ status: 'deleted' }),
  }
}
