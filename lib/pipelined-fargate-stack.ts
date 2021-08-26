import * as cdk from '@aws-cdk/core';
import { UpdateFargatePipelineStack } from './update-fargate-pipeline-stack';
import { FargateStack } from './fargate-stack';
import { Repository } from '@aws-cdk/aws-ecr';

export class PipelinedFargateStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CLI context input
    const clusterName: string = this.node.tryGetContext('clusterName');
    const serviceName: string = this.node.tryGetContext('serviceName');
    const repoName: string = this.node.tryGetContext('repoName');
    const port: number = parseInt(this.node.tryGetContext('port'));
    const memoryLimitMiB: number = parseInt(this.node.tryGetContext('memoryLimitMiB'));
    const cpu: number = parseInt(this.node.tryGetContext('cpu'));

    const fargateService = new FargateStack(this, "FargateService", { env: props?.env });
    const updateFargatePipeline = new UpdateFargatePipelineStack(this, "UpdateFargatePipeline", { env: props?.env });
    
    const service = fargateService.buildFargateService(clusterName, serviceName, port, memoryLimitMiB, cpu);
    updateFargatePipeline.buildPipeline(service, repoName);
  }
}
