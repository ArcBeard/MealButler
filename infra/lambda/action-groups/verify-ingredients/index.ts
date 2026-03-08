import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime'

const bedrockRuntime = new BedrockRuntimeClient({})

const MODEL_ID = process.env.MODEL_ID || 'us.anthropic.claude-sonnet-4-6'

interface ActionGroupEvent {
  actionGroup: string
  apiPath?: string
  function: string
  parameters: { name: string; type: string; value: string }[]
  sessionAttributes?: Record<string, string>
  promptSessionAttributes?: Record<string, string>
  messageVersion: string
}

/** Extract a parameter value by name, returning empty string if not found */
function getParam(parameters: ActionGroupEvent['parameters'], name: string): string {
  const param = parameters.find((p) => p.name === name)
  return param?.value ?? ''
}

interface VerificationResult {
  passed: boolean
  flaggedItems: {
    meal: string
    ingredient: string
    restriction: string
    reason: string
  }[]
  summary: string
}

export const handler = async (event: ActionGroupEvent) => {
  console.log('verify-ingredients event:', JSON.stringify(event))

  try {
    const mealPlanRaw = getParam(event.parameters, 'mealPlan')
    const dietaryRestrictionsRaw = getParam(event.parameters, 'dietaryRestrictions')

    if (!mealPlanRaw || !dietaryRestrictionsRaw) {
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
                  message: 'Both mealPlan and dietaryRestrictions parameters are required',
                }),
              },
            },
          },
        },
      }
    }

    const dietaryRestrictions = dietaryRestrictionsRaw.split(',').map((s) => s.trim())

    // Build verification prompt for Claude (LLM-as-judge pattern)
    const verificationPrompt = `You are a dietary restriction verification expert. Analyze the following meal plan and check each meal's ingredients against the specified dietary restrictions.

Dietary Restrictions: ${dietaryRestrictions.join(', ')}

Meal Plan:
${mealPlanRaw}

For each meal, check if any ingredient violates the dietary restrictions listed above. Be thorough and consider hidden ingredients (e.g., parmesan contains animal rennet for vegetarians, Worcestershire sauce contains anchovies, etc.).

Respond ONLY with valid JSON in this exact format, no other text:
{
  "passed": true/false,
  "flaggedItems": [
    {
      "meal": "name of the meal",
      "ingredient": "the problematic ingredient",
      "restriction": "which restriction it violates",
      "reason": "brief explanation"
    }
  ],
  "summary": "A brief overall summary of the verification results"
}

If all meals pass the dietary restriction check, set "passed" to true and leave "flaggedItems" as an empty array.`

    const requestBody = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: verificationPrompt,
        },
      ],
    }

    const command = new InvokeModelCommand({
      modelId: MODEL_ID,
      body: new TextEncoder().encode(JSON.stringify(requestBody)),
      contentType: 'application/json',
      accept: 'application/json',
    })

    const response = await bedrockRuntime.send(command)
    const responseBody = JSON.parse(new TextDecoder().decode(response.body))

    // Extract the text content from Claude's response
    const responseText = responseBody.content?.[0]?.text || ''

    // Parse the JSON from the model's response
    let verificationResult: VerificationResult
    try {
      // Try to extract JSON from the response (handle potential markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        verificationResult = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('No JSON found in model response')
      }
    } catch (parseError) {
      console.error('Failed to parse model response:', responseText)
      verificationResult = {
        passed: false,
        flaggedItems: [],
        summary: 'Unable to parse verification results. Manual review recommended.',
      }
    }

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
                verification: verificationResult,
              }),
            },
          },
        },
      },
    }
  } catch (error) {
    console.error('Error verifying ingredients:', error)

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
                message: 'Failed to verify ingredients against dietary restrictions',
              }),
            },
          },
        },
      },
    }
  }
}
