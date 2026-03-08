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

interface MockRecipe {
  name: string
  prepTime: number
  ingredients: string[]
  cuisine: string
}

/**
 * Generate mock recipe data based on cuisine and dietary filters.
 *
 * TODO: Replace with actual API integration (Spoonacular or Edamam).
 * - Spoonacular: https://spoonacular.com/food-api
 * - Edamam: https://developer.edamam.com/edamam-recipe-api
 */
function getMockRecipes(
  cuisine: string,
  dietary: string[],
  maxPrepTime: number,
  count: number,
): MockRecipe[] {
  const allRecipes: MockRecipe[] = [
    {
      name: 'Grilled Chicken Salad',
      prepTime: 20,
      ingredients: ['chicken breast', 'mixed greens', 'cherry tomatoes', 'cucumber', 'olive oil', 'lemon'],
      cuisine: 'american',
    },
    {
      name: 'Spaghetti Marinara',
      prepTime: 25,
      ingredients: ['spaghetti', 'canned tomatoes', 'garlic', 'basil', 'olive oil', 'parmesan'],
      cuisine: 'italian',
    },
    {
      name: 'Chicken Tacos',
      prepTime: 30,
      ingredients: ['chicken thighs', 'corn tortillas', 'avocado', 'salsa', 'lime', 'cilantro'],
      cuisine: 'mexican',
    },
    {
      name: 'Vegetable Stir Fry',
      prepTime: 15,
      ingredients: ['broccoli', 'bell pepper', 'carrots', 'soy sauce', 'ginger', 'garlic', 'rice'],
      cuisine: 'asian',
    },
    {
      name: 'Greek Salad with Quinoa',
      prepTime: 15,
      ingredients: ['quinoa', 'cucumber', 'tomatoes', 'feta cheese', 'olives', 'red onion', 'olive oil'],
      cuisine: 'mediterranean',
    },
    {
      name: 'Chickpea Curry',
      prepTime: 30,
      ingredients: ['chickpeas', 'coconut milk', 'tomatoes', 'onion', 'garam masala', 'turmeric', 'rice'],
      cuisine: 'indian',
    },
    {
      name: 'Turkey Burger',
      prepTime: 25,
      ingredients: ['ground turkey', 'burger buns', 'lettuce', 'tomato', 'onion', 'cheddar cheese'],
      cuisine: 'american',
    },
    {
      name: 'Pasta Primavera',
      prepTime: 30,
      ingredients: ['penne', 'zucchini', 'bell pepper', 'cherry tomatoes', 'garlic', 'olive oil', 'parmesan'],
      cuisine: 'italian',
    },
    {
      name: 'Bean and Cheese Quesadilla',
      prepTime: 15,
      ingredients: ['flour tortillas', 'black beans', 'cheddar cheese', 'salsa', 'sour cream'],
      cuisine: 'mexican',
    },
    {
      name: 'Pad Thai',
      prepTime: 30,
      ingredients: ['rice noodles', 'shrimp', 'bean sprouts', 'peanuts', 'lime', 'fish sauce', 'eggs'],
      cuisine: 'asian',
    },
    {
      name: 'Hummus and Veggie Wrap',
      prepTime: 10,
      ingredients: ['pita bread', 'hummus', 'cucumber', 'tomatoes', 'spinach', 'red onion'],
      cuisine: 'mediterranean',
    },
    {
      name: 'Palak Paneer',
      prepTime: 35,
      ingredients: ['spinach', 'paneer', 'onion', 'garlic', 'ginger', 'cream', 'garam masala'],
      cuisine: 'indian',
    },
  ]

  // Filter by cuisine if specified
  let filtered = cuisine && cuisine !== 'any'
    ? allRecipes.filter((r) => r.cuisine === cuisine.toLowerCase())
    : allRecipes

  // Filter by max prep time
  if (maxPrepTime > 0) {
    filtered = filtered.filter((r) => r.prepTime <= maxPrepTime)
  }

  // Return requested count (capped at available recipes)
  const resultCount = Math.min(count || 5, filtered.length)
  return filtered.slice(0, resultCount)
}

export const handler = async (event: ActionGroupEvent) => {
  console.log('fetch-recipes event:', JSON.stringify(event))

  try {
    const cuisine = getParam(event.parameters, 'cuisine')
    const dietaryRaw = getParam(event.parameters, 'dietary')
    const maxPrepTimeRaw = getParam(event.parameters, 'maxPrepTime')
    const countRaw = getParam(event.parameters, 'count')

    const dietary = dietaryRaw ? dietaryRaw.split(',').map((s) => s.trim()) : []
    const maxPrepTime = parseInt(maxPrepTimeRaw, 10) || 0
    const count = parseInt(countRaw, 10) || 5

    const recipes = getMockRecipes(cuisine, dietary, maxPrepTime, count)

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
                recipes,
                count: recipes.length,
              }),
            },
          },
        },
      },
    }
  } catch (error) {
    console.error('Error fetching recipes:', error)

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
                message: 'Failed to fetch recipes',
              }),
            },
          },
        },
      },
    }
  }
}
