import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as cr from 'aws-cdk-lib/custom-resources'
import * as path from 'path'

interface FrontendStackProps extends cdk.StackProps {
  apiUrl: string
}

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: FrontendStackProps) {
    super(scope, id, props)

    // ─── S3 Bucket ───────────────────────────────────────────────────
    const bucket = new s3.Bucket(this, 'FrontendBucket', {
      autoDeleteObjects: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    })

    // ─── CloudFront Distribution ─────────────────────────────────────
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    })

    // ─── Deploy Frontend Assets ──────────────────────────────────────
    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [s3deploy.Source.asset(path.join(__dirname, '../../dist'))],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    })

    // ─── Runtime Config (solves chicken-and-egg with API URL) ────────
    new cr.AwsCustomResource(this, 'WriteConfigJson', {
      onCreate: {
        service: 'S3',
        action: 'putObject',
        parameters: {
          Bucket: bucket.bucketName,
          Key: 'config.json',
          Body: JSON.stringify({ apiUrl: props.apiUrl }),
          ContentType: 'application/json',
        },
        physicalResourceId: cr.PhysicalResourceId.of('config-json'),
      },
      onUpdate: {
        service: 'S3',
        action: 'putObject',
        parameters: {
          Bucket: bucket.bucketName,
          Key: 'config.json',
          Body: JSON.stringify({ apiUrl: props.apiUrl }),
          ContentType: 'application/json',
        },
        physicalResourceId: cr.PhysicalResourceId.of('config-json'),
      },
      policy: cr.AwsCustomResourcePolicy.fromSdkCalls({
        resources: [`${bucket.bucketArn}/*`],
      }),
    })

    // ─── Outputs ─────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    })
  }
}
