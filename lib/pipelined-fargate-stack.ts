import * as cdk from '@aws-cdk/core';
import { Vpc, SecurityGroup, Port, Peer } from "@aws-cdk/aws-ec2";
import { Repository, AuthorizationToken } from "@aws-cdk/aws-ecr";
import * as ecs from "@aws-cdk/aws-ecs";
import { Pipeline, Artifact } from '@aws-cdk/aws-codepipeline';
import { DataResourceType, ReadWriteType, Trail } from "@aws-cdk/aws-cloudtrail";
import { CodeBuildAction, EcrSourceAction, EcsDeployAction } from '@aws-cdk/aws-codepipeline-actions';
import { BuildSpec, Project } from '@aws-cdk/aws-codebuild';
import { Effect, ManagedPolicy, PolicyStatement } from '@aws-cdk/aws-iam';
// import { FargateStack } from './fargate-stack';
// import { PipelinedStack } from './pipeline-stack';

export class PipelinedFargateStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // CLI context input
    const clusterName: string = this.node.tryGetContext('clusterName');
    const serviceName: string = this.node.tryGetContext('serviceName');
    const repoName: string = this.node.tryGetContext('repoName');

    const port: number = parseInt(this.node.tryGetContext('port')) || 80;
    const memoryLimitMiB: number = parseInt(this.node.tryGetContext('memoryLimitMiB')) || 1024;
    const cpu: number = parseInt(this.node.tryGetContext('cpu')) || 256;

    // VPC
    const vpc = new Vpc(this, "infrastructureVpcId", {
        maxAzs: 2,
        natGateways: 1
    });

    // Cluster
    const cluster = new ecs.Cluster(this, clusterName+"PipelinedFargateCluster", {
        clusterName: clusterName,
        vpc: vpc as any,
    });

    const repo = new Repository(this, repoName+"PipelinedFargateEcr", {
        repositoryName: repoName
    });

    const taskDef = new ecs.FargateTaskDefinition(this, "pipelinedFargateTaskDef", {
        memoryLimitMiB: memoryLimitMiB,
        cpu: cpu
    });

    taskDef.addToExecutionRolePolicy(new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        "ecr:*"
      ],
      resources: [`arn:aws:ecr:${process.env.CDK_DEFAULT_REGION}:${process.env.CDK_DEFAULT_ACCOUNT}:repository/${repoName}`]
    }));
    taskDef.addContainer("pipelinedFargateContainer", {
        containerName: serviceName + "PipelinedFargateContainer",
        image: ecs.ContainerImage.fromRegistry("okaycloud/dummywebserver:latest")
    });

    const securityGroup = new SecurityGroup(this, 'pipelinedFargateSecurityGroup', {
        vpc,
        description: 'Allow port connection to ec2 instances',
        allowAllOutbound: true,   // Can be set to false
    });
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(port), `Allows the Internet to send requests to the app via port ${port}`);

  // Fargate service
    const service = new ecs.FargateService(this, serviceName+"PipelinedFargateService", {
        cluster: cluster,
        serviceName: serviceName,
        assignPublicIp: true,
        desiredCount: 1,
        taskDefinition: taskDef,
        securityGroups: [securityGroup]
    });


    /*
    * Pipeline
    */

    // CloudTrail 
    const trail = new Trail(this, repoName + "EcrCloudTrail", {
      trailName: repoName + "EcrCloudTrail",
      managementEvents: ReadWriteType.WRITE_ONLY
    });


    Trail.onEvent(this, repoName + "PushEventListener", {
      description: `Logs events for the ECR repository ${repoName}`,
      eventPattern: {
        resources: [repo.repositoryArn]
      }
    });

    // Source stage
    const sourceOutput = new Artifact("sourceOutput");
    const sourceAction = new EcrSourceAction({
      actionName: 'SourceAction',
      repository: repo,
      output: sourceOutput,
    });
    
    // Build stage
    const pipelineProject = new Project(this, "codeBuildProject", {
      buildSpec: BuildSpec.fromObject({
        version: '0.2',
        phases: {
          build: {
            commands: [
              "echo Displaying content",
              `printf '[{\"name\":\"pipelined-fargate-container\", \"imageUri\":\"${repo.repositoryUriForTag()}:latest\"}]'`,
              "echo Creating imagedefinitions.json",
              `printf '[{\"name\":\"${serviceName}PipelinedFargateContainer\", \"imageUri\":\"${repo.repositoryUriForTag()}:latest\"}]' > imagedefinitions.json`,
              "echo Displaying content of imagedefinitions.json",
              "cat imagedefinitions.json",
              "echo Build completed on `date`"
            ]
          }
        },
        artifacts: {
          files: [
            "imagedefinitions.json"
          ]
        }
      })
    });
    //pipelineProject.role?.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser'));
    const buildOutput = new Artifact("buildOutput");
    const buildAction = new CodeBuildAction({
      actionName: "BuildAction",
      project: pipelineProject,
      input: sourceOutput,
      outputs: [buildOutput]
    });

    // Deploy stage
    const deployAction = new EcsDeployAction({
      actionName: 'DeployAction',
      service: service,
      input: buildOutput,
      deploymentTimeout: cdk.Duration.minutes(60)
    });

    const pipeline = new Pipeline(this, "fargatePipeline", {
      stages:[
        {
          stageName: 'Source',
          actions: [sourceAction]
        },
        {
          stageName: 'Build',
          actions: [buildAction]
        },
        {
          stageName: 'Deploy',
          actions: [deployAction]
        }
      ]
    });
    AuthorizationToken.grantRead(pipeline.role);
  }
}
