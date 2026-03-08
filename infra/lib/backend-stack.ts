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
        MODEL_ID: 'anthropic.claude-3-haiku-20240307-v1:0',
      },
    })
    table.grantReadData(verifyIngredientsFn)
    verifyIngredientsFn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel'],
        resources: [
          `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
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
                `arn:aws:bedrock:${this.region}::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
              ],
            }),
          ],
        }),
      },
    })

    const agent = new bedrock.CfnAgent(this, 'MealAppAgent', {
      agentName: 'MealAppJeeves',
      foundationModel: 'anthropic.claude-3-haiku-20240307-v1:0',
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
    })

    // Helper to build action group Lambda ARNs and grant invoke
    const createActionGroup = (
      actionGroupName: string,
      description: string,
      fn: NodejsFunction,
      parameters: Record<string, {
        description: string
        type: string
        required: boolean
      }>,
    ) => {
      fn.addPermission(`AllowBedrock-${actionGroupName}`, {
        principal: new iam.ServicePrincipal('bedrock.amazonaws.com'),
        sourceArn: agent.attrAgentArn,
      })

      return new bedrock.CfnAgentActionGroup(this, `${actionGroupName}ActionGroup`, {
        agentId: agent.attrAgentId,
        agentVersion: 'DRAFT',
        actionGroupName,
        description,
        actionGroupExecutor: {
          lambda: fn.functionArn,
        },
        functionSchema: {
          functions: [
            {
              name: actionGroupName,
              description,
              parameters: Object.fromEntries(
                Object.entries(parameters).map(([key, val]) => [
                  key,
                  { description: val.description, type: val.type, required: val.required },
                ]),
              ),
            },
          ],
        },
      })
    }

    createActionGroup('save-preferences', 'Saves validated user meal preferences to DynamoDB', savePreferencesFn, {
      sessionId: { description: 'The current session identifier', type: 'string', required: true },
      household: { description: 'Number of people in the household', type: 'string', required: true },
      dietary: { description: 'Comma-separated dietary restrictions', type: 'string', required: false },
      budget: { description: 'Budget level (budget, moderate, premium)', type: 'string', required: true },
      skill: { description: 'Cooking skill level (beginner, intermediate, advanced)', type: 'string', required: true },
      time: { description: 'Available cooking time (15min, 30min, 1hr, unlimited)', type: 'string', required: true },
      cuisine: { description: 'Comma-separated cuisine preferences', type: 'string', required: false },
      notes: { description: 'Additional notes or preferences', type: 'string', required: false },
    })

    createActionGroup('generate-meal-plan', 'Generates a 7-day meal plan based on saved preferences', generateMealPlanFn, {
      sessionId: { description: 'The current session identifier', type: 'string', required: true },
    })

    createActionGroup('fetch-recipes', 'Fetches recipes matching cuisine and dietary preferences', fetchRecipesFn, {
      cuisine: { description: 'Cuisine type to search for', type: 'string', required: true },
      dietary: { description: 'Comma-separated dietary restrictions to filter by', type: 'string', required: false },
      maxTime: { description: 'Maximum preparation time in minutes', type: 'string', required: false },
    })

    createActionGroup('fetch-grocery-prices', 'Fetches estimated grocery prices for ingredients', fetchGroceryPricesFn, {
      ingredients: { description: 'Comma-separated list of ingredients to price', type: 'string', required: true },
      servings: { description: 'Number of servings to calculate for', type: 'string', required: false },
    })

    createActionGroup('verify-ingredients', 'Verifies ingredient availability and suggests substitutions', verifyIngredientsFn, {
      ingredients: { description: 'Comma-separated list of ingredients to verify', type: 'string', required: true },
      dietary: { description: 'Comma-separated dietary restrictions for substitution suggestions', type: 'string', required: false },
    })

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
