const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

/**
 * List all running EC2 instances
 */
router.get('/instances', async (req, res) => {
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
});

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
        res.status(500).json({ error: err.message });
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
        res.status(500).json({ error: err.message });
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
        res.status(500).json({ error: err.message });
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

        const keyPath = path.join(__dirname, '..', 'uploads', req.file.originalname);
        fs.renameSync(req.file.path, keyPath);

        // Set permissions (Linux/Mac only)
        if (process.platform !== 'win32') {
            fs.chmodSync(keyPath, 0o400);
        }

        res.json({
            keyPath: keyPath,
            keyName: req.file.originalname
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;