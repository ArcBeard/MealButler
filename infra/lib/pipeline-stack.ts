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
        input: CodePipelineSource.connection('ArcBeard/MealButler', 'main', {
          connectionArn: 'arn:aws:codeconnections:us-east-1:289137415596:connection/347dc364-653b-4d10-a862-0204aeac1cb9',
        }),
        installCommands: [
          'n 22',
        ],
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
