import { Construct } from "constructs";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as cloudtrail from "aws-cdk-lib/aws-cloudtrail";
import * as s3 from "aws-cdk-lib/aws-s3";
import { PlatformConfig, resourceName } from "./naming";

export interface AuditTrailProps {
  config: PlatformConfig;
}

/**
 * Account-wide CloudTrail trail (management events, every region) writing to a private,
 * encrypted S3 bucket. Without it the account only has CloudTrail's 90-day event history,
 * so anything older (e.g. who read a secret) cannot be investigated.
 *
 * The first trail's management events are free; the cost is S3 storage, capped by the
 * 365-day expiry below. Both resources are retained if the stack is ever destroyed so the
 * audit record outlives the infrastructure it describes.
 */
export class AuditTrail extends Construct {

  public readonly bucket: s3.Bucket;
  public readonly trail: cloudtrail.Trail;

  public constructor(scope: Construct, id: string, props: AuditTrailProps) {
    super(scope, id);
    const { config } = props;

    this.bucket = new s3.Bucket(this, "LogBucket", {
      bucketName: resourceName(config, "cloudtrail-logs"),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: true,
      objectOwnership: s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
      lifecycleRules: [
        { expiration: Duration.days(365), noncurrentVersionExpiration: Duration.days(30) },
      ],
      removalPolicy: RemovalPolicy.RETAIN,
    });

    this.trail = new cloudtrail.Trail(this, "Trail", {
      trailName: resourceName(config, "cloudtrail"),
      bucket: this.bucket,
      isMultiRegionTrail: true,
      includeGlobalServiceEvents: true,
      enableFileValidation: true,
      managementEvents: cloudtrail.ReadWriteType.ALL,
    });
    this.trail.applyRemovalPolicy(RemovalPolicy.RETAIN);
  }
}
