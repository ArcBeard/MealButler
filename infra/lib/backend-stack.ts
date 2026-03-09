import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as bedrock from 'aws-cdk-lib/aws-bedrock'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as path from 'path'

interface BackendStackProps extends cdk.StackProps {
  userPool?: cognito.IUserPool
}

export class BackendStack extends cdk.Stack {
  public readonly apiUrl: string

  constructor(scope: Construct, id: string, props?: BackendStackProps) {
    super(scope, id, props)

    // ─── DynamoDB Table (single-table design) ────────────────────────
    const table = new dynamodb.Table(this, 'MealAppTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // ─── Recipe DB GSIs ──────────────────────────────────────────────
    table.addGlobalSecondaryIndex({
      indexName: 'gsi1-cuisine-mealtype',
      partitionKey: { name: 'gsi1pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    table.addGlobalSecondaryIndex({
      indexName: 'gsi2-diet-cuisine',
      partitionKey: { name: 'gsi2pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'gsi2sk', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    })

    // ─── Action Group Lambdas ────────────────────────────────────────
    const lambdaDefaults: Partial<ConstructorParameters<typeof NodejsFunction>[2]> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        TABLE_NAME: table.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    }

    const savePreferencesFn = new NodejsFunction(this, 'SavePreferencesFn', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../lambda/action-groups/save-preferences/index.ts'),
      functionName: 'MealApp-SavePreferences',
    })
    table.grantWriteData(savePreferencesFn)

    const generateMealPlanFn = new NodejsFunction(this, 'GenerateMealPlanFn', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../lambda/action-groups/generate-meal-plan/index.ts'),
      functionName: 'MealApp-GenerateMealPlan',
    })
    table.grantReadWriteData(generateMealPlanFn)

    const fetchRecipesFn = new NodejsFunction(this, 'FetchRecipesFn', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../lambda/action-groups/fetch-recipes/index.ts'),
      functionName: 'MealApp-FetchRecipes',
    })

    const fetchGroceryPricesFn = new NodejsFunction(this, 'FetchGroceryPricesFn', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../lambda/action-groups/fetch-grocery-prices/index.ts'),
      functionName: 'MealApp-FetchGroceryPrices',
    })

    const verifyIngredientsFn = new NodejsFunction(this, 'VerifyIngredientsFn', {
      ...lambdaDefaults,
      entry: path.join(__dirname, '../lambda/action-groups/verify-ingredients/index.ts'),
      functionName: 'MealApp-VerifyIngredients',
      environment: {
        TABLE_NAME: table.tableName,
        MODEL_ID: 'us.anthropic.claude-sonnet-4-6',
      },
    })
    table.grantReadData(verifyIngredientsFn)

    // ─── Inference Profile ARN (shared by agent role + verify-ingredients) ──
    const inferenceProfileArn = `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/us.anthropic.claude-sonnet-4-6`
    const foundationModelArns = [
      'arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-sonnet-4-6',
      'arn:aws:bedrock:us-east-2::foundation-model/anthropic.claude-sonnet-4-6',
      'arn:aws:bedrock:us-west-2::foundation-model/anthropic.claude-sonnet-4-6',
    ]

    verifyIngredientsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel*'],
        resources: [inferenceProfileArn],
      }),
    )
    verifyIngredientsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel*'],
        resources: foundationModelArns,
        conditions: {
          StringLike: {
            'bedrock:InferenceProfileArn': inferenceProfileArn,
          },
        },
      }),
    )

    // ─── Bedrock Agent ───────────────────────────────────────────────

    const agentRole = new iam.Role(this, 'BedrockAgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      inlinePolicies: {
        BedrockInvoke: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: 'InvokeInferenceProfile',
              actions: ['bedrock:InvokeModel*'],
              resources: [inferenceProfileArn],
            }),
            new iam.PolicyStatement({
              sid: 'InvokeFoundationModels',
              actions: ['bedrock:InvokeModel*'],
              resources: foundationModelArns,
              conditions: {
                StringLike: {
                  'bedrock:InferenceProfileArn': inferenceProfileArn,
                },
              },
            }),
          ],
        }),
      },
    })

    // Action group Lambda map for permissions
    const actionGroupLambdas = {
      'save-preferences': savePreferencesFn,
      'generate-meal-plan': generateMealPlanFn,
      'fetch-recipes': fetchRecipesFn,
      'fetch-grocery-prices': fetchGroceryPricesFn,
      'verify-ingredients': verifyIngredientsFn,
    }

    const agent = new bedrock.CfnAgent(this, 'MealAppAgent', {
      agentName: 'MealAppJeeves',
      foundationModel: 'us.anthropic.claude-sonnet-4-6',
      instruction: [
        'You are Jeeves, a refined and knowledgeable butler who assists with meal planning.',
        'You operate in two modes:',
        '1) Preference validation - When the user provides free-text answers about household size,',
        '   dietary restrictions, budget, cooking skill, available time, and cuisine preferences,',
        '   normalize and validate those answers into structured values. Use the save-preferences',
        '   action group to persist them.',
        '2) Meal plan generation - Once preferences are saved, generate a 7-day meal plan',
        '   tailored to the household. Use generate-meal-plan to create the plan, fetch-recipes',
        '   to find matching recipes, fetch-grocery-prices for budget estimates, and',
        '   verify-ingredients to confirm ingredient availability and substitutions.',
        'Always maintain a polite, butler-like demeanor. Address the user respectfully.',
      ].join(' '),
      agentResourceRoleArn: agentRole.roleArn,
      idleSessionTtlInSeconds: 3600,
      autoPrepare: true,
      actionGroups: [
        {
          actionGroupName: 'save-preferences',
          description: 'Saves validated user meal preferences to DynamoDB',
          actionGroupExecutor: { lambda: savePreferencesFn.functionArn },
          functionSchema: {
            functions: [{
              name: 'savePreferences',
              description: 'Saves validated user meal preferences to DynamoDB. The preferences parameter is a JSON string with keys: household, dietary (comma-separated), budget, skill, time, cuisine (comma-separated), notes.',
              parameters: {
                sessionId: { description: 'The current session identifier', type: 'string', required: true },
                preferences: { description: 'JSON string containing all preferences: {"household":"2","dietary":"vegetarian,gluten-free","budget":"moderate","skill":"intermediate","time":"30","cuisine":"italian,mexican","notes":"no shellfish"}', type: 'string', required: true },
              },
            }],
          },
        },
        {
          actionGroupName: 'generate-meal-plan',
          description: 'Generates a 7-day meal plan based on saved preferences',
          actionGroupExecutor: { lambda: generateMealPlanFn.functionArn },
          functionSchema: {
            functions: [{
              name: 'generateMealPlan',
              description: 'Generates a 7-day meal plan based on saved preferences',
              parameters: {
                sessionId: { description: 'The current session identifier', type: 'string', required: true },
              },
            }],
          },
        },
        {
          actionGroupName: 'fetch-recipes',
          description: 'Fetches recipes matching cuisine and dietary preferences',
          actionGroupExecutor: { lambda: fetchRecipesFn.functionArn },
          functionSchema: {
            functions: [{
              name: 'fetchRecipes',
              description: 'Fetches recipes matching cuisine and dietary preferences',
              parameters: {
                cuisine: { description: 'Cuisine type to search for', type: 'string', required: true },
                dietary: { description: 'Comma-separated dietary restrictions to filter by', type: 'string', required: false },
                maxTime: { description: 'Maximum preparation time in minutes', type: 'string', required: false },
              },
            }],
          },
        },
        {
          actionGroupName: 'fetch-grocery-prices',
          description: 'Fetches estimated grocery prices for ingredients',
          actionGroupExecutor: { lambda: fetchGroceryPricesFn.functionArn },
          functionSchema: {
            functions: [{
              name: 'fetchGroceryPrices',
              description: 'Fetches estimated grocery prices for ingredients',
              parameters: {
                ingredients: { description: 'Comma-separated list of ingredients to price', type: 'string', required: true },
                servings: { description: 'Number of servings to calculate for', type: 'string', required: false },
              },
            }],
          },
        },
        {
          actionGroupName: 'verify-ingredients',
          description: 'Verifies ingredient availability and suggests substitutions',
          actionGroupExecutor: { lambda: verifyIngredientsFn.functionArn },
          functionSchema: {
            functions: [{
              name: 'verifyIngredients',
              description: 'Verifies ingredient availability and suggests substitutions',
              parameters: {
                ingredients: { description: 'Comma-separated list of ingredients to verify', type: 'string', required: true },
                dietary: { description: 'Comma-separated dietary restrictions for substitution suggestions', type: 'string', required: false },
              },
            }],
          },
        },
      ],
    })

    // Grant Bedrock permission to invoke each action group Lambda
    for (const [name, fn] of Object.entries(actionGroupLambdas)) {
      fn.addPermission(`AllowBedrock-${name}`, {
        principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
        sourceArn: agent.attrAgentArn,
      })
    }

    // Agent alias
    const agentAlias = new bedrock.CfnAgentAlias(this, 'MealAppAgentAlias', {
      agentId: agent.attrAgentId,
      agentAliasName: 'production',
    })

    // ─── Async Meal Plan Generation Lambda ──────────────────────────
    const generateMealPlanAsyncFn = new NodejsFunction(this, 'GenerateMealPlanAsyncFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/generate-meal-plan-async/index.ts'),
      functionName: 'MealApp-GenerateMealPlanAsync',
      timeout: cdk.Duration.seconds(300),
      environment: {
        TABLE_NAME: table.tableName,
        MODEL_ID: 'us.anthropic.claude-sonnet-4-6',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    })

    table.grantReadWriteData(generateMealPlanAsyncFn)

    generateMealPlanAsyncFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel*'],
        resources: [inferenceProfileArn],
      }),
    )
    generateMealPlanAsyncFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel*'],
        resources: foundationModelArns,
        conditions: {
          StringLike: {
            'bedrock:InferenceProfileArn': inferenceProfileArn,
          },
        },
      }),
    )

    // ─── Get Preferences Lambda ──────────────────────────────────────
    const getPreferencesFn = new NodejsFunction(this, 'GetPreferencesFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/get-preferences/index.ts'),
      functionName: 'MealApp-GetPreferences',
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: table.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    })

    table.grantReadData(getPreferencesFn)

    // ─── Update Preferences Lambda ────────────────────────────────────
    const updatePreferencesFn = new NodejsFunction(this, 'UpdatePreferencesFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/update-preferences/index.ts'),
      functionName: 'MealApp-UpdatePreferences',
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: table.tableName,
        GENERATE_FN_NAME: generateMealPlanAsyncFn.functionName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    })

    table.grantReadWriteData(updatePreferencesFn)
    generateMealPlanAsyncFn.grantInvoke(updatePreferencesFn)

    // ─── Regenerate Day Lambda ────────────────────────────────────────
    const regenerateDayFn = new NodejsFunction(this, 'RegenerateDayFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/regenerate-day/index.ts'),
      functionName: 'MealApp-RegenerateDay',
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: table.tableName,
        GENERATE_FN_NAME: generateMealPlanAsyncFn.functionName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    })

    table.grantReadWriteData(regenerateDayFn)
    generateMealPlanAsyncFn.grantInvoke(regenerateDayFn)

    // ─── Get Meal Plan Lambda ─────────────────────────────────────────
    const getMealPlanFn = new NodejsFunction(this, 'GetMealPlanFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/get-meal-plan/index.ts'),
      functionName: 'MealApp-GetMealPlan',
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: table.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    })

    table.grantReadData(getMealPlanFn)

    // ─── Favorites Lambda ───────────────────────────────────────────
    const favoritesFn = new NodejsFunction(this, 'FavoritesFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/favorites/index.ts'),
      functionName: 'MealApp-Favorites',
      timeout: cdk.Duration.seconds(10),
      environment: {
        TABLE_NAME: table.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    })

    table.grantReadWriteData(favoritesFn)

    // ─── Invoke Agent Lambda ─────────────────────────────────────────
    const invokeAgentFn = new NodejsFunction(this, 'InvokeAgentFn', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '../lambda/invoke-agent/index.ts'),
      functionName: 'MealApp-InvokeAgent',
      timeout: cdk.Duration.seconds(29),
      environment: {
        TABLE_NAME: table.tableName,
        AGENT_ID: agent.attrAgentId,
        AGENT_ALIAS_ID: agentAlias.attrAgentAliasId,
        GENERATE_FN_NAME: generateMealPlanAsyncFn.functionName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    })

    table.grantReadWriteData(invokeAgentFn)

    invokeAgentFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeAgent'],
        resources: [
          cdk.Arn.format(
            {
              service: 'bedrock',
              resource: 'agent-alias',
              resourceName: `${agent.attrAgentId}/${agentAlias.attrAgentAliasId}`,
            },
            this,
          ),
        ],
      }),
    )

    // Allow invoke-agent to trigger the async generation Lambda
    generateMealPlanAsyncFn.grantInvoke(invokeAgentFn)

    // ─── API Gateway ─────────────────────────────────────────────────
    const api = new apigateway.RestApi(this, 'MealAppApi', {
      restApiName: 'MealApp API',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    })

    const apiResource = api.root.addResource('api')
    const agentResource = apiResource.addResource('agent')

    // Cognito authorizer (optional — only added when userPool is provided)
    const authorizer = props?.userPool
      ? new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
          cognitoUserPools: [props.userPool],
        })
      : undefined

    agentResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(invokeAgentFn, {
        timeout: cdk.Duration.seconds(29),
      }),
      authorizer
        ? {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
          }
        : undefined,
    )

    // GET /api/meal-plan
    const mealPlanResource = apiResource.addResource('meal-plan')
    mealPlanResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getMealPlanFn),
      authorizer
        ? {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
          }
        : undefined,
    )

    // PUT /api/meal-plan/regenerate-day
    const regenerateDayResource = mealPlanResource.addResource('regenerate-day')
    regenerateDayResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(regenerateDayFn),
      authorizer
        ? {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
          }
        : undefined,
    )

    // GET/PUT /api/preferences
    const preferencesResource = apiResource.addResource('preferences')
    preferencesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getPreferencesFn),
      authorizer
        ? {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
          }
        : undefined,
    )
    preferencesResource.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(updatePreferencesFn),
      authorizer
        ? {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
          }
        : undefined,
    )

    // GET/POST /api/favorites, DELETE /api/favorites/{recipeId}
    const favoritesResource = apiResource.addResource('favorites')
    favoritesResource.addMethod(
      'GET',
      new apigateway.LambdaIntegration(favoritesFn),
      authorizer
        ? {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
          }
        : undefined,
    )
    favoritesResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(favoritesFn),
      authorizer
        ? {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
          }
        : undefined,
    )

    const favoriteByIdResource = favoritesResource.addResource('{recipeId}')
    favoriteByIdResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(favoritesFn),
      authorizer
        ? {
            authorizer,
            authorizationType: apigateway.AuthorizationType.COGNITO,
          }
        : undefined,
    )

    // ─── Outputs ─────────────────────────────────────────────────────
    this.apiUrl = api.url

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'MealApp API Gateway URL',
    })
  }
}
