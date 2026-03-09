import * as cdk from 'aws-cdk-lib'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'
import * as s3 from 'aws-cdk-lib/aws-s3'
import { Construct } from 'constructs'
import { CodePipeline, CodePipelineSource, ShellStep } from 'aws-cdk-lib/pipelines'
import { MealAppStage } from './mealapp-stage'

export class PipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const cacheBucket = new s3.Bucket(this, 'PipelineCacheBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      lifecycleRules: [{ expiration: cdk.Duration.days(7) }],
    })

    const pipeline = new CodePipeline(this, 'Pipeline', {
      pipelineName: 'MealAppPipeline',
      synth: new ShellStep('Synth', {
        input: CodePipelineSource.connection('ArcBeard/MealButler', 'develop', {
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
      synthCodeBuildDefaults: {
        cache: codebuild.Cache.bucket(cacheBucket),
        partialBuildSpec: codebuild.BuildSpec.fromObject({
          cache: {
            paths: [
              'node_modules/**/*',
              'infra/node_modules/**/*',
              'node_modules/.tmp/**/*',
            ],
          },
        }),
      },
    })

    pipeline.addStage(new MealAppStage(this, 'Prod'))
  }
}
