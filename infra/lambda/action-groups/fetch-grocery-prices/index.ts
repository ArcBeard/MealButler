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

interface IngredientPrice {
  ingredient: string
  estimatedPrice: number
  unit: string
  notes: string
}

/**
 * Generate mock grocery pricing data for a list of ingredients.
 *
 * TODO: Replace with actual grocery price API integration.
 * Potential APIs:
 * - Kroger API: https://developer.kroger.com/
 * - Instacart API (partner access)
 * - USDA FoodData Central: https://fdc.nal.usda.gov/api-guide.html
 * - Custom web scraping solution
 */
function getMockPricing(ingredients: string[], region: string): IngredientPrice[] {
  // Base prices per common ingredient (rough national averages in USD)
  const priceMap: Record<string, { price: number; unit: string }> = {
    'chicken breast': { price: 5.99, unit: 'lb' },
    'chicken thighs': { price: 4.49, unit: 'lb' },
    'ground turkey': { price: 5.49, unit: 'lb' },
    'ground beef': { price: 6.99, unit: 'lb' },
    'shrimp': { price: 9.99, unit: 'lb' },
    'salmon': { price: 11.99, unit: 'lb' },
    'rice': { price: 3.49, unit: '2 lb bag' },
    'pasta': { price: 1.79, unit: 'box' },
    'spaghetti': { price: 1.79, unit: 'box' },
    'penne': { price: 1.79, unit: 'box' },
    'rice noodles': { price: 2.99, unit: 'package' },
    'bread': { price: 3.49, unit: 'loaf' },
    'tortillas': { price: 3.29, unit: 'package' },
    'corn tortillas': { price: 2.99, unit: 'package' },
    'flour tortillas': { price: 3.29, unit: 'package' },
    'pita bread': { price: 3.49, unit: 'package' },
    'burger buns': { price: 3.29, unit: 'package' },
    'eggs': { price: 3.99, unit: 'dozen' },
    'milk': { price: 4.29, unit: 'gallon' },
    'butter': { price: 4.99, unit: 'lb' },
    'cheddar cheese': { price: 4.49, unit: '8 oz' },
    'parmesan': { price: 5.99, unit: '5 oz' },
    'feta cheese': { price: 4.99, unit: '6 oz' },
    'cream': { price: 3.99, unit: 'pint' },
    'sour cream': { price: 2.49, unit: '16 oz' },
    'paneer': { price: 5.99, unit: '12 oz' },
    'olive oil': { price: 7.99, unit: '16 oz' },
    'canned tomatoes': { price: 1.49, unit: 'can' },
    'tomatoes': { price: 2.99, unit: 'lb' },
    'cherry tomatoes': { price: 3.49, unit: 'pint' },
    'onion': { price: 1.29, unit: 'each' },
    'red onion': { price: 1.49, unit: 'each' },
    'garlic': { price: 0.79, unit: 'head' },
    'ginger': { price: 1.99, unit: 'piece' },
    'broccoli': { price: 2.49, unit: 'bunch' },
    'bell pepper': { price: 1.49, unit: 'each' },
    'carrots': { price: 1.99, unit: 'lb' },
    'cucumber': { price: 1.29, unit: 'each' },
    'spinach': { price: 3.49, unit: 'bag' },
    'mixed greens': { price: 4.49, unit: 'bag' },
    'lettuce': { price: 2.49, unit: 'head' },
    'zucchini': { price: 1.49, unit: 'each' },
    'avocado': { price: 1.99, unit: 'each' },
    'lemon': { price: 0.79, unit: 'each' },
    'lime': { price: 0.59, unit: 'each' },
    'cilantro': { price: 0.99, unit: 'bunch' },
    'basil': { price: 2.49, unit: 'bunch' },
    'bean sprouts': { price: 1.99, unit: 'bag' },
    'black beans': { price: 1.29, unit: 'can' },
    'chickpeas': { price: 1.49, unit: 'can' },
    'coconut milk': { price: 2.49, unit: 'can' },
    'soy sauce': { price: 3.49, unit: 'bottle' },
    'fish sauce': { price: 3.99, unit: 'bottle' },
    'salsa': { price: 3.49, unit: 'jar' },
    'hummus': { price: 3.99, unit: '10 oz' },
    'olives': { price: 3.99, unit: 'jar' },
    'peanuts': { price: 3.99, unit: 'bag' },
    'quinoa': { price: 5.99, unit: 'box' },
    'garam masala': { price: 4.99, unit: 'jar' },
    'turmeric': { price: 3.99, unit: 'jar' },
  }

  // Regional price multiplier (rough approximations)
  const regionMultipliers: Record<string, number> = {
    northeast: 1.15,
    southeast: 0.95,
    midwest: 0.90,
    southwest: 1.00,
    west: 1.20,
    northwest: 1.10,
  }

  const multiplier = region ? (regionMultipliers[region.toLowerCase()] ?? 1.0) : 1.0

  return ingredients.map((ingredient) => {
    const normalizedName = ingredient.toLowerCase().trim()
    const known = priceMap[normalizedName]

    if (known) {
      return {
        ingredient: normalizedName,
        estimatedPrice: parseFloat((known.price * multiplier).toFixed(2)),
        unit: known.unit,
        notes: region ? `Adjusted for ${region} region` : 'National average estimate',
      }
    }

    // Default pricing for unknown ingredients
    return {
      ingredient: normalizedName,
      estimatedPrice: parseFloat((3.99 * multiplier).toFixed(2)),
      unit: 'each',
      notes: 'Estimated price - ingredient not in database',
    }
  })
}

export const handler = async (event: ActionGroupEvent) => {
  console.log('fetch-grocery-prices event:', JSON.stringify(event))

  try {
    const ingredientsRaw = getParam(event.parameters, 'ingredients')
    const region = getParam(event.parameters, 'region')

    const ingredients = ingredientsRaw
      ? ingredientsRaw.split(',').map((s) => s.trim())
      : []

    if (ingredients.length === 0) {
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
                  message: 'No ingredients provided',
                }),
              },
            },
          },
        },
      }
    }

    const pricing = getMockPricing(ingredients, region)
    const totalEstimate = pricing.reduce((sum, item) => sum + item.estimatedPrice, 0)

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
                ingredients: pricing,
                totalEstimate: parseFloat(totalEstimate.toFixed(2)),
                currency: 'USD',
                region: region || 'national',
              }),
            },
          },
        },
      },
    }
  } catch (error) {
    console.error('Error fetching grocery prices:', error)

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
                message: 'Failed to fetch grocery prices',
              }),
            },
          },
        },
      },
    }
  }
}
