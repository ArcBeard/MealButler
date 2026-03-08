#!/usr/bin/env node
import { App } from 'aws-cdk-lib';
import { PipelineStack } from '../lib/pipeline-stack';

const app = new App();

new PipelineStack(app, 'MealAppPipeline', {
  env: { account: '289137415596', region: 'us-east-1' },
});

app.synth();
