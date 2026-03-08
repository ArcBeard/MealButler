import type { QuickReply, ConversationStep, MealPreferences } from '@/types/agent'

export interface ConversationStepConfig {
  question: string
  quickReplies: QuickReply[]
  multiSelect: boolean
  nextStep: ConversationStep
  widget?: string
}

export const conversationSteps: Record<string, ConversationStepConfig> = {
  household: {
    question: "Let's start planning your meals! 🍽️\n\nHow many people are you cooking for?",
    quickReplies: [],
    multiSelect: false,
    nextStep: 'dietary',
    widget: 'household',
  },
  dietary: {
    question: 'Any dietary restrictions or preferences? Select all that apply, then tap Done.',
    quickReplies: [
      { label: 'No restrictions', value: 'none' },
      { label: 'Vegetarian', value: 'vegetarian' },
      { label: 'Vegan', value: 'vegan' },
      { label: 'Gluten-free', value: 'gluten-free' },
      { label: 'Dairy-free', value: 'dairy-free' },
      { label: 'Nut-free', value: 'nut-free' },
    ],
    multiSelect: true,
    nextStep: 'budget',
  },
  budget: {
    question: "What's your weekly grocery budget?",
    quickReplies: [
      { label: 'Budget-friendly (<$75)', value: 'budget' },
      { label: 'Moderate ($75–150)', value: 'moderate' },
      { label: 'Premium ($150+)', value: 'premium' },
    ],
    multiSelect: false,
    nextStep: 'skill',
  },
  skill: {
    question: 'How would you rate your cooking skill level?',
    quickReplies: [
      { label: 'Beginner', value: 'beginner' },
      { label: 'Intermediate', value: 'intermediate' },
      { label: 'Advanced', value: 'advanced' },
    ],
    multiSelect: false,
    nextStep: 'time',
  },
  time: {
    question: 'How much time do you have for weeknight cooking?',
    quickReplies: [
      { label: '15 min', value: '15' },
      { label: '30 min', value: '30' },
      { label: '45 min', value: '45' },
      { label: '1 hour+', value: '60+' },
    ],
    multiSelect: false,
    nextStep: 'cuisine',
  },
  cuisine: {
    question: 'What cuisines do you enjoy? Select all that apply, then tap Done.',
    quickReplies: [
      { label: 'No preference', value: 'any' },
      { label: 'American', value: 'american' },
      { label: 'Italian', value: 'italian' },
      { label: 'Mexican', value: 'mexican' },
      { label: 'Asian', value: 'asian' },
      { label: 'Mediterranean', value: 'mediterranean' },
      { label: 'Indian', value: 'indian' },
    ],
    multiSelect: true,
    nextStep: 'additional',
  },
  additional: {
    question: 'Anything else I should know? (allergies, favorites, dislikes, etc.)',
    quickReplies: [{ label: "No, that's everything!", value: 'none' }],
    multiSelect: false,
    nextStep: 'summary',
  },
}

export const STEP_ORDER: ConversationStep[] = [
  'greeting',
  'household',
  'dietary',
  'budget',
  'skill',
  'time',
  'cuisine',
  'additional',
  'summary',
  'complete',
]

export function buildSummaryMessage(prefs: MealPreferences): string {
  const lines = [
    "Here's what I've gathered:\n",
    `👥 Household: ${prefs.household}`,
    `🥗 Dietary: ${prefs.dietary.length ? prefs.dietary.join(', ') : 'No restrictions'}`,
    `💰 Budget: ${prefs.budget}`,
    `👨‍🍳 Skill level: ${prefs.skill}`,
    `⏱️ Cooking time: ${prefs.time} min`,
    `🌍 Cuisines: ${prefs.cuisine.length ? prefs.cuisine.join(', ') : 'No preference'}`,
  ]

  if (prefs.notes && prefs.notes !== 'none') {
    lines.push(`📝 Notes: ${prefs.notes}`)
  }

  lines.push('\nDoes everything look right?')

  return lines.join('\n')
}
