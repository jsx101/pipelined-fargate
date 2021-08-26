import * as cdk from '@aws-cdk/core';
import { FargateService } from '@aws-cdk/aws-ecs';
import { Repository, AuthorizationToken } from "@aws-cdk/aws-ecr";
import { Pipeline, Artifact } from '@aws-cdk/aws-codepipeline';
import { DataResourceType, ReadWriteType, Trail } from "@aws-cdk/aws-cloudtrail";
import { CodeBuildAction, EcrSourceAction, EcsDeployAction } from '@aws-cdk/aws-codepipeline-actions';
import { BuildSpec, Project } from '@aws-cdk/aws-codebuild';

export class UpdateFargatePipelineStack extends cdk.Stack {

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
    }

    public buildPipeline(service: FargateService, repoName: string){
        
        const repo = new Repository(this, repoName+"PipelinedFargateEcr", { 
            repositoryName: repoName
        });

        // CloudTrail 
        const trail = new Trail(this, "ecrRepoCloudTrail", {
            managementEvents: ReadWriteType.WRITE_ONLY
        });
    
    
        Trail.onEvent(this, "ecrRepoPushEventListener", {
            description: `Logs events for the ECR repository ${repo.repositoryName}`,
            eventPattern: {
                //resources: [repo.repositoryArn]
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
                        `printf '[{\"name\":\"${service.serviceName}PipelinedFargateContainer\", \"imageUri\":\"${repo.repositoryUriForTag()}:latest\"}]' > imagedefinitions.json`,
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