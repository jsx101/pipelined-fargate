import * as cdk from '@aws-cdk/core';
import { IRepository } from '@aws-cdk/aws-ecr';
import { IBaseService } from '@aws-cdk/aws-ecs';
import { Pipeline, Artifact } from '@aws-cdk/aws-codepipeline';
import { EcrSourceAction, EcsDeployAction } from '@aws-cdk/aws-codepipeline-actions';

export interface PipelineStackProps {
  ecrRepository: IRepository;
  service: IBaseService;
}

export class PipelinedStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: PipelineStackProps) {
    super(scope, id);

    // The code that defines your stack goes here
    const pipeline = new Pipeline(this, "fargatePipeline");

    // Source stage
    const sourceArtifact = new Artifact();
    const sourceAction = new EcrSourceAction({
      actionName: 'EcrSourceAction',
      repository: props.ecrRepository,
      output: sourceArtifact
    });

    pipeline.addStage({
      stageName: 'EcrSource',
      actions: [sourceAction]
    });

    // Deploy stage
    const deployAction = new EcsDeployAction({
      actionName: 'EcsDeployAction',
      service: props.service,
      input: sourceArtifact,
      deploymentTimeout: cdk.Duration.minutes(60)
    });

    pipeline.addStage({
      stageName: 'EcsDeploy',
      actions: [deployAction]
    });
  }
}
