# cloud-wrapper

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

