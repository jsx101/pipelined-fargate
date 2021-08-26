import * as cdk from '@aws-cdk/core';
import { Service } from './service';
import { ServicePipeline } from './service-pipeline';

export class PipelinedFargateStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fargateService = new Service(this, "FargateService");
    new ServicePipeline(this, "UpdateFargateServicePipeline", fargateService.service, fargateService.repo);
  }
}

