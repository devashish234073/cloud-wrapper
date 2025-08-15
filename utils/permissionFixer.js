const AWS = require('aws-sdk');


exports.addMissingPermissionFromError = async (errorMessage) => {
    AWS.config.update({ region: AWS.config.region || process.env.AWS_REGION || 'us-east-1' }); // Change to your region
    const iam = new AWS.IAM();
    try {
        // Parse the error message to extract service and action
        const match = errorMessage.match(/is not authorized to perform: ([^ ]+):([^ ]+)/i);
        if (!match) {
            console.error("Could not parse permission from error message", errorMessage);
        }
        console.log(`Adding missing permission for: ${match[0]}`);

        const service = match[1]; // e.g., "ec2"
        const action = match[2];  // e.g., "DescribeLaunchTemplates"
        const policyName = `Custom-${service}-${action}-Permission`;

        // Get current user
        const sts = new AWS.STS();
        const identity = await sts.getCallerIdentity().promise();
        const userName = identity.Arn.split('/').pop();

        // Create custom policy document
        const policyDocument = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Action": [`${service}:${action}`],
                    "Resource": ["*"]
                }
            ]
        };

        let policyArn;

        try {
            // Check if policy already exists
            const listPoliciesResponse = await iam.listPolicies({ Scope: 'Local' }).promise();
            const existingPolicy = listPoliciesResponse.Policies.find(
                policy => policy.PolicyName === policyName
            );

            if (existingPolicy) {
                console.log(`Policy ${policyName} already exists, using existing policy`);
                policyArn = existingPolicy.Arn;
            } else {
                // Create the policy if it doesn't exist
                const createPolicyResponse = await iam.createPolicy({
                    PolicyName: policyName,
                    PolicyDocument: JSON.stringify(policyDocument),
                    Description: `Auto-generated policy for ${service}:${action}`
                }).promise();
                policyArn = createPolicyResponse.Policy.Arn;
                console.log(`Successfully created policy ${policyName}`);
            }

            // Attach policy to user
            await iam.attachUserPolicy({
                UserName: userName,
                PolicyArn: policyArn
            }).promise();

            console.log(`Successfully attached policy ${policyName} to user ${userName}`);
            return `Permission added: ${service}:${action} for user ${userName}`;
            //return policyArn;

        } catch (error) {
            if (error.code === 'EntityAlreadyExists') {
                // Policy already exists, get its ARN and attach
                const listPoliciesResponse = await iam.listPolicies({ Scope: 'Local' }).promise();
                const existingPolicy = listPoliciesResponse.Policies.find(
                    policy => policy.PolicyName === policyName
                );

                if (existingPolicy) {
                    policyArn = existingPolicy.Arn;
                    await iam.attachUserPolicy({
                        UserName: userName,
                        PolicyArn: policyArn
                    }).promise();
                    console.log(`Successfully attached existing policy ${policyName} to user ${userName}`);
                    return `Permission added: ${service}:${action} for user ${userName}`;
                    //return policyArn;
                }
            }
            throw error;
        }

    } catch (error) {
        console.error('Error adding permission:', error);
        throw error;
    }
}

// Example usage with your error message
const errorMsg = "You are not authorized to perform this operation. User: arn:aws:iam::111111111:user/s3readwrite is not authorized to perform: ec2:DescribeLaunchTemplates because no identity-based policy allows the ec2:DescribeLaunchTemplates action";