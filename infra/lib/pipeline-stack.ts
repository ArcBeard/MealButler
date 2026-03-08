import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines'
import { MealAppStage } from './mealapp-stage'

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const pipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: 'MealAppPipeline',
      synth: new ShellStep('Synth', {
        // TODO: Replace with actual GitHub repo and CodeStar Connection ARN
        input: CodePipelineSource.connection('OWNER/MealApp', 'main', {
          connectionArn: 'arn:aws:codeconnections:us-east-1:ACCOUNT:connection/PLACEHOLDER',
        }),
        commands: [
          'npm ci',
          'npm run build',
          'cd infra',
          'npm ci',
          'npx cdk synth',
        ],
        primaryOutputDirectory: 'infra/cdk.out',
      }),
    })

    pipeline.addStage(new MealAppStage(this, 'Prod'))
  }
}
