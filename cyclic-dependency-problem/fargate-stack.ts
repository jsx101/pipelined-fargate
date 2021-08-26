import * as cdk from "@aws-cdk/core";
import { Vpc, SecurityGroup, Port, Peer } from "@aws-cdk/aws-ec2";
import { Repository } from "@aws-cdk/aws-ecr";
import * as ecs from "@aws-cdk/aws-ecs";
import { Effect, PolicyStatement } from '@aws-cdk/aws-iam';

export interface FargateServiceAndRepo {
    service: ecs.FargateService,
    repo: Repository
}

export class FargateStack extends cdk.Stack {

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
    }

    public buildFargateService(clusterName: string, serviceName: string, repoName: string, port?: number, memoryLimitMiB?: number, cpu?: number): FargateServiceAndRepo {
        port = port || 80;
        memoryLimitMiB = memoryLimitMiB || 1024;
        cpu = cpu || 256;

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
        resources: [repo.repositoryArn]
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

        return {
            service: service,
            repo: repo
        }
    }
  }