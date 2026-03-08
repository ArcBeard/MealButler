import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AuthStack } from './auth-stack';
import { BackendStack } from './backend-stack';
import { FrontendStack } from './frontend-stack';

export class MealAppStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const auth = new AuthStack(this, 'Auth');

    const backend = new BackendStack(this, 'Backend', {
      userPool: auth.userPool,
    });

    new FrontendStack(this, 'Frontend', {
      apiUrl: backend.apiUrl,
      cognitoUserPoolId: auth.userPool.userPoolId,
      cognitoClientId: auth.userPoolClient.userPoolClientId,
      cognitoDomain: auth.userPoolDomain.domainName,
      cognitoRegion: auth.region,
    });
  }
}
