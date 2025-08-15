const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { exec } = require('child_process');

const upload = multer({ dest: 'uploads/' });
const { addMissingPermissionFromError } = require('./utils/permissionFixer');

/**
 * List all running EC2 instances
 */
router.get('/instances', async (req, res) => {
    try {
        const ec2 = new AWS.EC2({
            region: AWS.config.region || process.env.AWS_REGION || 'us-east-1'
        });

        const params = {
            Filters: [{ Name: 'instance-state-name', Values: ['running'] }]
        };

        const data = await ec2.describeInstances(params).promise();

        const instances = await Promise.all(data.Reservations.flatMap(async reservation => {
            return Promise.all(reservation.Instances.map(async instance => {
                let username = 'unknown';
                try {
                    const imageData = await ec2.describeImages({ ImageIds: [instance.ImageId] }).promise();
                    const imageName = imageData.Images[0]?.Name?.toLowerCase() || '';

                    if (imageName.includes('ubuntu')) username = 'ubuntu';
                    else if (imageName.includes('amzn') || imageName.includes('amazon linux')) username = 'ec2-user';
                    else if (imageName.includes('centos')) username = 'centos';
                    else if (imageName.includes('debian')) username = 'admin';
                    else if (imageName.includes('rhel') || imageName.includes('red hat')) username = 'ec2-user';
                    else if (imageName.includes('suse')) username = 'ec2-user';
                } catch (e) {
                    console.error(`Error getting username for ${instance.InstanceId}`, e);
                }

                return {
                    id: instance.InstanceId,
                    type: instance.InstanceType,
                    state: instance.State.Name,
                    publicIp: instance.PublicIpAddress,
                    keyName: instance.KeyName,
                    launchTime: instance.LaunchTime,
                    imageId: instance.ImageId,
                    username
                };
            }));
        }));

        res.json(instances.flat());
    } catch (err) {
        let status = await addMissingPermissionFromError(err.message);
        console.error(err);
        res.status(500).json({ error: err.message, status: status || 'error' });
    }
});
/*router.get('/instances', async (req, res) => {
    try {
        const params = {
            Filters: [{ Name: 'instance-state-name', Values: ['running'] }]
        };
        const ec2 = new AWS.EC2({
            region: AWS.config.region || process.env.AWS_REGION || 'us-east-1'
        });
        const data = await ec2.describeInstances(params).promise();

        const instances = data.Reservations.flatMap(reservation =>
            reservation.Instances.map(instance => ({
                id: instance.InstanceId,
                type: instance.InstanceType,
                state: instance.State.Name,
                publicIp: instance.PublicIpAddress,
                keyName: instance.KeyName,
                launchTime: instance.LaunchTime
            }))
        );

        res.json(instances);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});*/

/**
 * List all launch templates
 */
router.get('/templates', async (req, res) => {
    try {
        const ec2 = new AWS.EC2({
            region: AWS.config.region || process.env.AWS_REGION || 'us-east-1'
        });
        const data = await ec2.describeLaunchTemplates({}).promise();

        const templates = data.LaunchTemplates.map(template => ({
            id: template.LaunchTemplateId,
            name: template.LaunchTemplateName,
            created: template.CreateTime
        }));

        res.json(templates);
    } catch (err) {
        let status = await addMissingPermissionFromError(err.message);
        console.error(err);
        res.status(500).json({ error: err.message, status: status || 'error' });
    }
});

/**
 * Launch new instance from template
 */
router.post('/launch', async (req, res) => {
    try {
        const { templateId } = req.body;
        
        const params = {
            LaunchTemplate: {  // Changed from LaunchTemplateId to LaunchTemplate
                LaunchTemplateId: templateId,
                Version: '$Default'  // Specify the version to use
            },
            MinCount: 1,
            MaxCount: 1
        };
        const ec2 = new AWS.EC2({
            region: AWS.config.region || process.env.AWS_REGION || 'us-east-1'
        });
        const data = await ec2.runInstances(params).promise();
        const instanceId = data.Instances[0].InstanceId;
        
        res.json({ 
            instanceId,
            status: 'pending'
        });
    } catch (err) {
        let status = await addMissingPermissionFromError(err.message);
        console.error(err);
        res.status(500).json({ error: err.message, status: status || 'error' });
    }
});

/**
 * Launch new instance from template

router.post('/launch', async (req, res) => {
    try {
        const { templateId } = req.body;

        const params = {
            LaunchTemplateId: templateId,
            MinCount: 1,
            MaxCount: 1
        };
        const ec2 = new AWS.EC2({
            region: AWS.config.region || process.env.AWS_REGION || 'us-east-1'
        });

        const data = await ec2.runInstances(params).promise();
        const instanceId = data.Instances[0].InstanceId;

        res.json({
            instanceId,
            status: 'pending'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
 */

/**
 * Get instance status
 */
router.get('/status/:instanceId', async (req, res) => {
    try {
        const params = {
            InstanceIds: [req.params.instanceId]
        };
        const ec2 = new AWS.EC2({
            region: AWS.config.region || process.env.AWS_REGION || 'us-east-1'
        });

        const data = await ec2.describeInstanceStatus(params).promise();

        if (data.InstanceStatuses.length === 0) {
            return res.json({ status: 'pending' });
        }

        res.json({
            status: data.InstanceStatuses[0].InstanceState.Name,
            publicIp: data.InstanceStatuses[0].PublicIpAddress
        });
    } catch (err) {
        let status = await addMissingPermissionFromError(err.message);
        console.error(err);
        res.status(500).json({ error: err.message, status: status || 'error' });
    }
});

/**
 * Upload SSH key
 */
router.post('/upload-key', upload.single('keyFile'), async (req, res) => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }

        const keyPath = path.join(__dirname, 'uploads', req.file.originalname);
        // If file already exists, return success without replacing it
        if (fs.existsSync(keyPath)) {
            console.log(`Key file already exists: ${keyPath}`);
            // Remove the temporary uploaded file since we won't use it
            fs.unlinkSync(req.file.path);

            return res.json({
                keyPath: keyPath,
                keyName: req.file.originalname,
                message: 'File already exists, using existing key.'
            });
        }

        fs.renameSync(req.file.path, keyPath);

        if (process.platform === 'win32') {
            // Windows: Restrict to current user read-only
            const { execSync } = require('child_process');
            try {
                execSync(`icacls "${keyPath}" /inheritance:r /grant:r "%USERNAME%:R"`);
                console.log('Set Windows private key permissions successfully');
            } catch (err) {
                console.error('Failed to set Windows permissions:', err);
                throw new Error('Could not set key file permissions on Windows');
            }
        } else {
            // Linux / macOS: Owner read-only
            fs.chmodSync(keyPath, 0o400);
            console.log('Set Unix private key permissions to 400');
        }

        res.json({
            keyPath: keyPath,
            keyName: req.file.originalname
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;