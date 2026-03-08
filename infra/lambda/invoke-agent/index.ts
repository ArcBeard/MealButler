import {
  BedrockAgentRuntimeClient,
  InvokeAgentCommand,
} from '@aws-sdk/client-bedrock-agent-runtime'
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb'
import { mapAgentResponse } from './response-mapper'
import { STEP_CONFIG, buildSummaryMessage } from './step-config'
import type { MealPreferences } from './step-config'

const bedrockAgent = new BedrockAgentRuntimeClient({})
const lambdaClient = new LambdaClient({})
const dynamodb = DynamoDBDocumentClient.from(new DynamoDBClient({}))

const TABLE_NAME = process.env.TABLE_NAME!
const AGENT_ID = process.env.AGENT_ID!
const AGENT_ALIAS_ID = process.env.AGENT_ALIAS_ID!
const GENERATE_FN_NAME = process.env.GENERATE_FN_NAME!

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
}

/** 90 days in seconds, added to current epoch for DynamoDB TTL */
function ttl90Days(): number {
  return Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60
}

/** Collect streamed response chunks from Bedrock Agent into a single string */
async function collectAgentResponse(response: any): Promise<string> {
  let result = ''
  if (response.completion) {
    for await (const event of response.completion) {
      if (event.chunk?.bytes) {
        result += new TextDecoder().decode(event.chunk.bytes)
      }
    }
  }
  return result
}

interface RequestBody {
  sessionId: string
  inputText: string
  step: string
  preferences?: MealPreferences
}

interface APIGatewayProxyEvent {
  httpMethod: string
  body: string | null
  headers: Record<string, string | undefined>
  pathParameters: Record<string, string | undefined> | null
  queryStringParameters: Record<string, string | undefined> | null
  requestContext: {
    authorizer?: {
      claims?: {
        sub?: string
        email?: string
        [key: string]: string | undefined
      }
    }
    [key: string]: any
  }
  resource: string
  path: string
  isBase64Encoded: boolean
}

interface APIGatewayProxyResult {
  statusCode: number
  headers: Record<string, string>
  body: string
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    }
  }

  try {
    const body: RequestBody = JSON.parse(event.body || '{}')
    const { sessionId, inputText, step, preferences } = body

    if (!sessionId || !step) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Missing required fields: sessionId, step' }),
      }
    }

    // Use Cognito sub for authenticated users, fall back to session ID
    const cognitoSub = event.requestContext?.authorizer?.claims?.sub
    const pk = cognitoSub ? `USER#${cognitoSub}` : `SESSION#${sessionId}`

    // Greeting step: return the first step config directly, no agent call
    if (step === 'greeting') {
      const householdConfig = STEP_CONFIG['household']
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          content: householdConfig.question,
          quickReplies: householdConfig.quickReplies.length > 0 ? householdConfig.quickReplies : undefined,
          nextStep: 'household',
          multiSelect: householdConfig.multiSelect || undefined,
          widget: householdConfig.widget,
        }),
      }
    }

    // Summary step: handle "start over" or confirmation
    if (step === 'summary') {
      if (inputText && inputText.toLowerCase().includes('start over')) {
        const householdConfig = STEP_CONFIG['household']
        return {
          statusCode: 200,
          headers: CORS_HEADERS,
          body: JSON.stringify({
            content: householdConfig.question,
            quickReplies: householdConfig.quickReplies.length > 0 ? householdConfig.quickReplies : undefined,
            nextStep: 'household',
            multiSelect: householdConfig.multiSelect || undefined,
            widget: householdConfig.widget,
          }),
        }
      }

      // Confirmation: save preferences and trigger async meal plan generation
      if (preferences) {
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

        // Fire-and-forget: invoke generate Lambda asynchronously
        if (GENERATE_FN_NAME) {
          await lambdaClient.send(
            new InvokeCommand({
              FunctionName: GENERATE_FN_NAME,
              InvocationType: 'Event',
              Payload: new TextEncoder().encode(
                JSON.stringify({ pk, preferences }),
              ),
            }),
          )
        }
      }

      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          content:
            "Preferences saved! I'm generating your personalized meal plan now. " +
            "Head over to the calendar to see it once it's ready! 🎩",
          nextStep: 'complete',
        }),
      }
    }

    // Normal conversation steps: invoke Bedrock Agent
    const command = new InvokeAgentCommand({
      agentId: AGENT_ID,
      agentAliasId: AGENT_ALIAS_ID,
      sessionId,
      inputText: `Step: ${step}. User says: ${inputText}`,
    })

    const response = await bedrockAgent.send(command)
    const agentText = await collectAgentResponse(response)
    const agentResponse = mapAgentResponse(agentText, step)

    // If the next step is summary, build the summary message from preferences
    if (agentResponse.nextStep === 'summary' && preferences) {
      const summaryContent = buildSummaryMessage(preferences)
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          content: summaryContent,
          quickReplies: [
            { label: 'Looks good!', value: 'confirm' },
            { label: 'Start over', value: 'start over' },
          ],
          nextStep: 'summary',
        }),
      }
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(agentResponse),
    }
  } catch (error) {
    console.error('Error processing request:', error)

    const body: RequestBody = (() => {
      try {
        return JSON.parse(event.body || '{}')
      } catch {
        return { sessionId: '', inputText: '', step: 'greeting' }
      }
    })()

    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        error: 'Internal server error',
        content: 'Sorry, something went wrong. Please try again.',
        nextStep: body.step || 'greeting',
      }),
    }
  }
}
