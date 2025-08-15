const express = require('express');
const AWS = require('aws-sdk');
const router = express.Router();
let bedrock, bedrockRuntime;
const { addMissingPermissionFromError } = require('./utils/permissionFixer');

function getBedrockClient() {
    if (!bedrock) {
        bedrock = new AWS.Bedrock({
            apiVersion: '2023-09-30',
            region: AWS.config.region || process.env.AWS_REGION || 'us-east-1'
        });
    }
    return bedrock;
}

function getBedrockRuntimeClient() {
    if (!bedrockRuntime) {
        bedrockRuntime = new AWS.BedrockRuntime({
            apiVersion: '2023-09-30',
            region: AWS.config.region || process.env.AWS_REGION || 'us-east-1'
        });
    }
    return bedrockRuntime;
}

/**
 * List all available Bedrock models
 */
router.get('/models', async (req, res) => {
    try {
        const params = {
            byProvider: 'Amazon' // Can also filter by 'Anthropic', 'AI21', etc.
        };
        
        const data = await getBedrockClient().listFoundationModels(params).promise();
        res.json(data.modelSummaries);
    } catch (err) {
        let status = await addMissingPermissionFromError(err.message);
        console.error(err);
        res.status(500).json({ error: err.message, status: status || 'error' });
    }
});

/**
 * Get model details
 */
router.get('/models/:modelId', async (req, res) => {
    try {
        const params = {
            modelIdentifier: req.params.modelId
        };
        
        const data = await getBedrockClient().getFoundationModel(params).promise();
        res.json(data.modelDetails);
    } catch (err) {
        let status = await addMissingPermissionFromError(err.message);
        console.error(err);
        res.status(500).json({ error: err.message, status: status || 'error' });
    }
});

/**
 * Invoke model with prompt
 */
router.post('/invoke', async (req, res) => {
    try {
        const { modelId, prompt, temperature, topP } = req.body;
        
        let requestBody;
        if (modelId.includes('anthropic')) {
            requestBody = JSON.stringify({
                prompt: `\n\nHuman: ${prompt}\n\nAssistant:`,
                max_tokens_to_sample: 300,
                temperature: temperature || 0.5,
                top_p: topP || 0.9
            });
        } else if (modelId.includes('amazon')) {
            requestBody = JSON.stringify({
                inputText: prompt,
                textGenerationConfig: {
                    temperature: temperature || 0.5,
                    topP: topP || 0.9,
                    maxTokenCount: 300
                }
            });
        } else {
            throw new Error('Unsupported model type');
        }
        
        const params = {
            modelId,
            body: requestBody,
            contentType: 'application/json',
            accept: 'application/json'
        };
        
        const data = await getBedrockRuntimeClient().invokeModel(params).promise();
        const responseBody = JSON.parse(data.body.toString());
        
        let result;
        if (modelId.includes('anthropic')) {
            result = responseBody.completion;
        } else if (modelId.includes('amazon')) {
            result = responseBody.results[0].outputText;
        }
        
        res.json({ response: result });
    } catch (err) {
        let status = await addMissingPermissionFromError(err.message);
        console.error(err);
        res.status(500).json({ error: err.message, status: status || 'error' });
    }
});

module.exports = router;