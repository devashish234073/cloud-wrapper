# cloud-wrapper

## UPDATE 18th August 2025

Multi AI section added:

<img width="1267" height="475" alt="image" src="https://github.com/user-attachments/assets/498170d4-acf6-4395-bc21-db90e356e3f1" />

Let's you choose multiple models or multiple instances of same model and interact will then with the same prompt.

<img width="1270" height="788" alt="image" src="https://github.com/user-attachments/assets/f68e8cb1-bb13-4fd5-99a2-502a3cb8be26" />


## UPDATE 15th August 2025

Made the cloud-wrapper application smarter! Earlier the application required all the iam permissions for the resources to be created and attached to the user with which you are logged in to your aws cli. Now that's no longer needed.
Added a permissionFixer.js in the utils folder. That can create a policy and attach it to current user based on the error thrown when a particular operation is invoked. 

Thanks to the uniform error pattern that aws sdk throws that contains all teh details needed for creating a policy. 
In this video you can see I start with just a single policy for the current user , which is iam related to listPolicy, createPolicy and attachPolicy.
Other permissions are added by the application itself when the error occurs. 

See the video in this post for more details:  https://www.linkedin.com/posts/devashish-priyadarshi-96554112b_made-the-cloud-wrapper-application-smarter-activity-7362159731911659520-fhQD?utm_source=share&utm_medium=member_desktop&rcm=ACoAAB_v_B0B3953zoesstM-BJmeuZA94BtFpDI

The only permission the user need now to begin with is :
### Note: This permission should only be used and in this mode if you are sure you can keep your access key safe. As with "iam:AttachUserPolicy" and "iam:CreatePolicy", any unintended person having details of your access key will be able to access almost anything from your aws account. 

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "sts:GetCallerIdentity"
            ],
            "Resource": "*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "iam:AttachUserPolicy",
                "iam:CreatePolicy"
            ],
            "Resource": [
                "arn:aws:iam::<your-account-id>:user/s3readwrite",
                "arn:aws:iam::<your-account-id>:policy/Custom-*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "iam:ListPolicies"
            ],
            "Resource": "*"
        }
    ]
}
```

Please ignore the managed permission and other permission details below as those were before this smartness was added.

To start run

```
git clone https://github.com/devashish234073/cloud-wrapper
cd cloud-rapper
npm install
npm start
```

<img width="1253" height="522" alt="image" src="https://github.com/user-attachments/assets/7a58cc13-e7fb-4d85-bb86-2b098bc01ece" />

Open http://localhost:3000 in browser

<img width="1612" height="851" alt="image" src="https://github.com/user-attachments/assets/6387ec67-76dc-4f29-a768-6f0130a3c22c" />

The nodejs backend used aws sdk to interact with aws services, so it requires aws cli to be configured in the environment where you are runnign it with the following maneged permissions:

<img width="779" height="231" alt="image" src="https://github.com/user-attachments/assets/caa52af5-4d04-4c5d-ad19-ba40768e15c2" />

As well as some custom permissions like the bedrock_titan_lite_access you are seeing above:

which contains this policy:

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": "bedrock:InvokeModel",
            "Resource": "arn:aws:bedrock:ap-south-1::foundation-model/amazon.titan-text-lite-v1"
        }
    ]
}
```

For launching instance using launch template following permission is also needed:

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowRunInstances",
            "Effect": "Allow",
            "Action": "ec2:RunInstances",
            "Resource": "*"
        }
    ]
}
```

