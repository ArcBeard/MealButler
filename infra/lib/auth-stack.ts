import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as cognito from 'aws-cdk-lib/aws-cognito'
import * as ssm from 'aws-cdk-lib/aws-ssm'

export class AuthStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool
  public readonly userPoolClient: cognito.UserPoolClient
  public readonly userPoolDomain: cognito.UserPoolDomain

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    // Read Google OAuth credentials from SSM Parameter Store
    const googleClientId = ssm.StringParameter.valueForStringParameter(
      this, '/mealapp/google-client-id',
    )
    const googleClientSecret = ssm.StringParameter.valueForStringParameter(
      this, '/mealapp/google-client-secret',
    )

    const callbackUrls = [
      'http://localhost:5173/',
      'https://d1zscrqujczfg.cloudfront.net/',
    ]
    const logoutUrls = [
      'http://localhost:5173/',
      'https://d1zscrqujczfg.cloudfront.net/',
    ]

    // ─── Cognito User Pool ─────────────────────────────────────────
    this.userPool = new cognito.UserPool(this, 'MealAppUserPool', {
      userPoolName: 'MealAppUserPool',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: {
        email: { required: true, mutable: true },
        givenName: { required: false, mutable: true },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    // ─── Google Identity Provider ──────────────────────────────────
    const googleIdp = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleIdP', {
      userPool: this.userPool,
      clientId: googleClientId,
      clientSecretValue: cdk.SecretValue.unsafePlainText(googleClientSecret),
      scopes: ['profile', 'email', 'openid'],
      attributeMapping: {
        email: cognito.ProviderAttribute.GOOGLE_EMAIL,
        givenName: cognito.ProviderAttribute.GOOGLE_GIVEN_NAME,
        profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
      },
    })

    // ─── Hosted UI Domain ──────────────────────────────────────────
    this.userPoolDomain = this.userPool.addDomain('MealAppDomain', {
      cognitoDomain: { domainPrefix: 'mealapp-auth' },
    })

    // ─── App Client (SPA — no secret) ─────────────────────────────
    this.userPoolClient = this.userPool.addClient('MealAppWebClient', {
      userPoolClientName: 'MealAppWebClient',
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls,
        logoutUrls,
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      authFlows: {
        userSrp: true,
      },
    })

    // Ensure the IdP is created before the client
    this.userPoolClient.node.addDependency(googleIdp)

    // ─── Outputs ───────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      description: 'Cognito User Pool ID',
    })

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      description: 'Cognito App Client ID',
    })

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: this.userPoolDomain.domainName,
      description: 'Cognito Hosted UI domain prefix',
    })
  }
}
