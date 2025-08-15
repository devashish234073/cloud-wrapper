const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();
const { addMissingPermissionFromError } = require('./utils/permissionFixer');

/**
 * Get current AWS user information
 */
router.get('/', async (req, res) => {
    try {
        const sts = new AWS.STS();
        const data = await sts.getCallerIdentity({}).promise();
        
        const iam = new AWS.IAM();
        let userDetail = {};
        
        // Try to get more details if it's an IAM user
        if (data.Arn.includes(':user/')) {
            const userName = data.Arn.split('/').pop();
            const userData = await iam.getUser({ UserName: userName }).promise();
            userDetail = {
                userName: userData.User.UserName,
                userId: userData.User.UserId,
                arn: userData.User.Arn,
                createDate: userData.User.CreateDate,
                path: userData.User.Path
            };
        }
        
        res.json({
            account: data.Account,
            arn: data.Arn,
            userId: data.UserId,
            ...userDetail
        });
    } catch (err) {
        let status = await addMissingPermissionFromError(err.message);
        //res.status(500).json({ error: err.message });
        res.status(500).json({ error: err.message, status: status || 'error' });
    }
});

module.exports = router;