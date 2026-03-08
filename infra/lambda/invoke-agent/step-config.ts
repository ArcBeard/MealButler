export interface MealPreferences {
  household: string
  dietary: string[]
  budget: string
  skill: string
  time: string
  cuisine: string[]
  notes: string
}

export interface StepConfig {
  question: string
  quickReplies: { label: string; value: string }[]
  multiSelect: boolean
  nextStep: string
  widget?: string
}

export const STEP_CONFIG: Record<string, StepConfig> = {
  household: {
    question: "Let's start planning your meals! \u{1F37D}\uFE0F\n\nHow many people are you cooking for?",
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
      { label: 'Moderate ($75\u2013150)', value: 'moderate' },
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

export function buildSummaryMessage(prefs: MealPreferences): string {
  const lines = [
    "Here's what I've gathered:\n",
    `\u{1F465} Household: ${prefs.household}`,
    `\u{1F957} Dietary: ${prefs.dietary.length ? prefs.dietary.join(', ') : 'No restrictions'}`,
    `\u{1F4B0} Budget: ${prefs.budget}`,
    `\u{1F468}\u200D\u{1F373} Skill level: ${prefs.skill}`,
    `\u23F1\uFE0F Cooking time: ${prefs.time} min`,
    `\u{1F30D} Cuisines: ${prefs.cuisine.length ? prefs.cuisine.join(', ') : 'No preference'}`,
  ]

  if (prefs.notes && prefs.notes !== 'none') {
    lines.push(`\u{1F4DD} Notes: ${prefs.notes}`)
  }

  lines.push('\nDoes everything look right?')

  return lines.join('\n')
}
