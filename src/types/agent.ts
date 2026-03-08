export interface QuickReply {
  label: string
  value: string
}

export interface ChatMessage {
  id: string
  role: 'agent' | 'user'
  content: string
  timestamp: Date
  quickReplies?: QuickReply[]
  widget?: 'household'
}

export interface MealPreferences {
  household: string
  dietary: string[]
  budget: string
  skill: string
  time: string
  cuisine: string[]
  notes: string
}

export type ConversationStep =
  | 'greeting'
  | 'household'
  | 'dietary'
  | 'budget'
  | 'skill'
  | 'time'
  | 'cuisine'
  | 'additional'
  | 'summary'
  | 'complete'

export interface AgentResponse {
  content: string
  quickReplies?: QuickReply[]
  nextStep: ConversationStep
  multiSelect?: boolean
  widget?: 'household'
}

export interface AgentAdapter {
  getGreeting(): Promise<AgentResponse>
  sendMessage(message: string, step: ConversationStep): Promise<AgentResponse>
}
