const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();

// Configure AWS SDK
AWS.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION || 'us-east-1'
});

const s3 = new AWS.S3();

/**
 * List all buckets (object storage containers)
 */
router.get('/buckets', async (req, res) => {
    try {
        const data = await s3.listBuckets().promise();
        res.json(data.Buckets.map(bucket => ({
            name: bucket.Name,
            creationDate: bucket.CreationDate
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * List contents of a bucket or folder
 */
router.get('/buckets/:bucketName', async (req, res) => {
    const bucketName = req.params.bucketName;
    const prefix = req.params[0] ? `${req.params[0]}/` : '';
    
    try {
        const params = {
            Bucket: bucketName,
            Delimiter: '/'
        };

        const data = await s3.listObjectsV2(params).promise();
        
        const folders = data.CommonPrefixes ? data.CommonPrefixes.map(p => ({
            name: p.Prefix.replace(prefix, '').replace('/', ''),
            type: 'folder',
            path: `${bucketName}/${p.Prefix}`
        })) : [];

        const files = data.Contents ? data.Contents
            .filter(item => item.Key !== prefix)
            .map(item => ({
                name: item.Key.replace(prefix, ''),
                type: 'file',
                size: item.Size,
                lastModified: item.LastModified,
                path: `${bucketName}/${item.Key}`
            })) : [];

        res.json({
            path: `${bucketName}/${prefix}`,
            items: [...folders, ...files]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Download a file
 */
router.get('/download/:bucketName/*', async (req, res) => {
    const bucketName = req.params.bucketName;
    const key = req.params[0];
    
    try {
        const params = {
            Bucket: bucketName,
            Key: key
        };

        const data = await s3.getObject(params).promise();
        
        res.set({
            'Content-Type': data.ContentType,
            'Content-Length': data.ContentLength,
            'Content-Disposition': `attachment; filename="${key.split('/').pop()}"`
        });
        
        res.send(data.Body);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Create a folder
 */
router.post('/folders', async (req, res) => {
    const { bucketName, folderPath } = req.body;
    
    if (!bucketName || !folderPath) {
        return res.status(400).json({ error: 'Bucket name and folder path are required' });
    }

    try {
        const params = {
            Bucket: bucketName,
            Key: folderPath.endsWith('/') ? folderPath : `${folderPath}/`,
            Body: ''
        };

        await s3.putObject(params).promise();
        res.json({ message: 'Folder created successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Upload a file
 */
router.post('/upload', async (req, res) => {
    const { bucketName, filePath, fileContent, contentType } = req.body;
    
    if (!bucketName || !filePath || !fileContent) {
        return res.status(400).json({ error: 'Bucket name, file path, and content are required' });
    }

    try {
        const params = {
            Bucket: bucketName,
            Key: filePath,
            Body: Buffer.from(fileContent, 'base64'),
            ContentType: contentType || 'application/octet-stream'
        };

        await s3.putObject(params).promise();
        res.json({ message: 'File uploaded successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * Create a new bucket
 */
router.post('/buckets', async (req, res) => {
    const { bucketName } = req.body;
    
    if (!bucketName) {
        return res.status(400).json({ error: 'Bucket name is required' });
    }

    try {
        const params = {
            Bucket: bucketName,
            ACL: 'private' // or whatever default ACL you prefer
        };

        await s3.createBucket(params).promise();
        res.json({ message: 'Bucket created successfully', bucket: { name: bucketName } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = {
    router
};