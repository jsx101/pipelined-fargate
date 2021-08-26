import * as cdk from "@aws-cdk/core";
import { Vpc, SecurityGroup, Port, Peer } from "@aws-cdk/aws-ec2";
import { IRepository, Repository } from "@aws-cdk/aws-ecr";
import * as ecs from "@aws-cdk/aws-ecs";
import { IBaseService } from "@aws-cdk/aws-ecs";

export class FargateStack extends cdk.Stack {
    public service: IBaseService;
    public repo: IRepository

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

        this.repo = new Repository(this, repoName+"PipelinedFargateEcr", {
            repositoryName: repoName
        });
    
        const taskDef = new ecs.FargateTaskDefinition(this, "pipelinedFargateTaskDef", {
            memoryLimitMiB: memoryLimitMiB,
            cpu: cpu
        });
    
        taskDef.addContainer("pipelinedFargateContainer", {
            image: ecs.ContainerImage.fromEcrRepository(this.repo, 'latest')
        });
    
        const securityGroup = new SecurityGroup(this, 'pipelinedFargateSecurityGroup', {
            vpc,
            description: 'Allow port connection to ec2 instances',
            allowAllOutbound: true,   // Can be set to false
        });
        securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(port), `Allows the Internet to send requests to the app via port ${port}`);
    
      // Fargate service
        this.service = new ecs.FargateService(this, serviceName+"PipelinedFargateService", {
            cluster: cluster,
            serviceName: serviceName,
            assignPublicIp: true,
            desiredCount: 1,
            taskDefinition: taskDef,
            securityGroups: [securityGroup]
        });
  
    }
  }