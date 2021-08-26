import * as cdk from '@aws-cdk/core';
import { UpdateFargatePipelineStack } from './update-fargate-pipeline-stack';
import { FargateStack } from './fargate-stack';

export class PipelinedFargateStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const fargateService = new FargateStack(this, "FargateService");
    const updateFargatePipeline = new UpdateFargatePipelineStack(this, "UpdateFargatePipeline");

    // CLI context input
    const clusterName: string = this.node.tryGetContext('clusterName');
    const serviceName: string = this.node.tryGetContext('serviceName');
    const repoName: string = this.node.tryGetContext('repoName');

    const port: number = parseInt(this.node.tryGetContext('port'));
    const memoryLimitMiB: number = parseInt(this.node.tryGetContext('memoryLimitMiB'));
    const cpu: number = parseInt(this.node.tryGetContext('cpu'));

     const {service,repo} = fargateService.buildFargateService(clusterName, serviceName, repoName, port, memoryLimitMiB, cpu);

    // updateFargatePipeline.addFargateService(service);
    // updateFargatePipeline.addEcrRepository(repo);
    updateFargatePipeline.build(service, repo);
  }
}
