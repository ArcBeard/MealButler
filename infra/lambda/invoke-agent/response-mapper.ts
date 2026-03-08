import { STEP_CONFIG } from './step-config'

export interface AgentResponse {
  content: string
  quickReplies?: { label: string; value: string }[]
  nextStep: string
  multiSelect?: boolean
  widget?: string
}

/**
 * Maps raw Bedrock Agent text output and the current conversation step
 * into a structured AgentResponse that the frontend can render.
 */
export function mapAgentResponse(agentText: string, currentStep: string): AgentResponse {
  const stepConfig = STEP_CONFIG[currentStep]
  if (!stepConfig) {
    return { content: agentText, nextStep: currentStep }
  }

  const nextStep = stepConfig.nextStep
  const nextConfig = STEP_CONFIG[nextStep]

  if (nextStep === 'summary') {
    // Summary case handled by caller
    return { content: agentText, nextStep: 'summary' }
  }

  if (!nextConfig) {
    return { content: agentText, nextStep: nextStep }
  }

  return {
    content: agentText || nextConfig.question,
    quickReplies: nextConfig.quickReplies.length > 0 ? nextConfig.quickReplies : undefined,
    nextStep: nextStep,
    multiSelect: nextConfig.multiSelect || undefined,
    widget: nextConfig.widget as AgentResponse['widget'],
  }
}
