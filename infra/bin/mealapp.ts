#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';
import { MealAppStage } from '../lib/mealapp-stage';

const app = new App();

const env = { account: '289137415596', region: 'us-east-1' };

// Pipeline (deploys from GitHub main)
new PipelineStack(app, 'MealAppPipeline', { env });

// Direct deploy: `cdk deploy "Prod/*" -c googleClientId=XXX -c googleClientSecret=XXX`
new MealAppStage(app, 'Prod', { env });

app.synth();
