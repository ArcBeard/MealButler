import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as bedrock from 'aws-cdk-lib/aws-bedrock'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as path from 'path'

export class BackendStack extends cdk.Stack {
  public readonly apiUrl: string

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // ─── DynamoDB Table (single-table design) ────────────────────────
    const table = new dynamodb.Table(this, 'MealAppTable', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'ttl',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
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
        MODEL_ID: 'anthropic.claude-sonnet-4-6',
      },
    })
    table.grantReadData(verifyIngredientsFn)
    verifyIngredientsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-sonnet-4-6`,
        ],
      }),
    )

    // ─── Bedrock Agent ───────────────────────────────────────────────
    const agentRole = new iam.Role(this, 'BedrockAgentRole', {
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com'),
      inlinePolicies: {
        BedrockInvoke: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ['bedrock:InvokeModel'],
              resources: [
                `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-sonnet-4-6`,
              ],
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
      foundationModel: 'anthropic.claude-sonnet-4-6',
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

    agentResource.addMethod(
      'POST',
      new apigateway.LambdaIntegration(invokeAgentFn, {
        timeout: cdk.Duration.seconds(29),
      }),
    )

    // ─── Outputs ─────────────────────────────────────────────────────
    this.apiUrl = api.url

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'MealApp API Gateway URL',
    })
  }
}
