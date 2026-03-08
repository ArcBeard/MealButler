import { Stage, StageProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { BackendStack } from './backend-stack';
import { FrontendStack } from './frontend-stack';

export class MealAppStage extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    const backend = new BackendStack(this, 'Backend');

    new FrontendStack(this, 'Frontend', {
      apiUrl: backend.apiUrl,
    });
  }
}
