const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();
const fs = require('fs');
const os = require('os');
const path = require('path');

/**
 * Get current AWS region information
 */
router.get('/', async (req, res) => {
    try {
        const configPath = path.join(os.homedir(), '.aws', 'config');
        if (fs.existsSync(configPath)) {
            const configFile = fs.readFileSync(configPath, 'utf-8');
            let configFileSplt = configFile.split('\n');
            for (let i = 0; i < configFileSplt.length; i++) {
                if (configFileSplt[i].trim().startsWith('region')) {
                    const regionLine = configFileSplt[i].trim();
                    const region = regionLine.split('=')[1].trim();
                    process.env.AWS_REGION = region;
                    AWS.config.update({ region: region });
                    //console.log(`AWS Region set to: ${region}`);
                    //console.log(`AWS config.region: ${AWS.config.region}`);
                    //console.log(`process.env.AWS_REGION: ${process.env.AWS_REGION}`);
                    res.json({
                        region: region,
                        isDefault: !AWS.config.region && !process.env.AWS_REGION
                    });
                }
            }
        } else {
            // Get the region from the AWS config
            const region = AWS.config.region || process.env.AWS_REGION || 'us-east-1';

            res.json({
                region: region,
                isDefault: !AWS.config.region && !process.env.AWS_REGION
            });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;