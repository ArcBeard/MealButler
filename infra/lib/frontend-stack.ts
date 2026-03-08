import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront'
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins'
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment'
import * as path from 'path'

interface FrontendStackProps extends cdk.StackProps {
  apiUrl: string
  cognitoUserPoolId?: string
  cognitoClientId?: string
  cognitoDomain?: string
  cognitoRegion?: string
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

    // ─── Runtime Config + Frontend Assets (deployed together) ────────
    const configData: Record<string, unknown> = { apiUrl: props.apiUrl }
    if (props.cognitoUserPoolId) {
      configData.cognito = {
        userPoolId: props.cognitoUserPoolId,
        clientId: props.cognitoClientId,
        domain: props.cognitoDomain,
        region: props.cognitoRegion,
      }
    }

    new s3deploy.BucketDeployment(this, 'DeployFrontend', {
      sources: [
        s3deploy.Source.asset(path.join(__dirname, '../../dist')),
        s3deploy.Source.jsonData('config.json', configData),
      ],
      destinationBucket: bucket,
      distribution,
      distributionPaths: ['/*'],
    })

    // ─── Outputs ─────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      description: 'CloudFront distribution domain name',
    })
  }
}
