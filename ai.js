const express = require('express');
const AWS = require('aws-sdk');
const fs = require('fs');
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
        let usageData = {}
        if(fs.existsSync('usage.json')) {
            usageData = JSON.parse(fs.readFileSync('usage.json', 'utf8'));
        }
        /*const params = {
            byProvider: 'Amazon' // Can also filter by 'Anthropic', 'AI21', etc.
        };

        const data = await getBedrockClient().listFoundationModels(params).promise();*/
        const data = await getBedrockClient().listFoundationModels().promise();//not passing params to get all models
        for(let i=0;i<data.modelSummaries.length;i++) {
            const model = data.modelSummaries[i];
            if(usageData[model.modelId]) {
                model.tokenUsage = usageData[model.modelId];
            } else {
                model.tokenUsage = [];
            }
        }
        data.modelSummaries.sort((a, b) => b.tokenUsage.length - a.tokenUsage.length);
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
        } else if (modelId.includes('mistral')) {
            requestBody = JSON.stringify({
                prompt: prompt,
                max_tokens: 300,
                temperature: temperature || 0.5,
                top_p: topP || 0.9
            });
            contentType = 'application/json';
        } else {
            throw new Error('Unsupported model type' + modelId);
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
        } else if (modelId.includes('mistral')) {
            result = responseBody.outputs[0].text;
        }

        const tokenUsage = extractTokenUsage(prompt, responseBody, modelId);
        const response = {
            response: result,
            tokenUsage: tokenUsage,
            modelId: modelId
        };
        //store usage data to a local file
        let usageData = {}
        if(fs.existsSync('usage.json')) {
            usageData = JSON.parse(fs.readFileSync('usage.json', 'utf8'));
        }
        if(usageData[modelId]) {
            usageData[modelId].push(tokenUsage)
        } else {
            usageData[modelId] = [tokenUsage];
        }
        fs.writeFileSync('usage.json', JSON.stringify(usageData, null, 2));

        res.json(response);
    } catch (err) {
        let status = await addMissingPermissionFromError(err.message);
        console.error(err);
        res.status(500).json({ error: err.message, status: status || 'error' });
    }
});

function estimateTokens(text) {
    if (!text) return 0;
    // Rough approximation: 1 token ≈ 0.75 words or 4 characters
    const wordCount = text.trim().split(/\s+/).length;
    const charCount = text.length;
    // Use the higher estimate for safety
    return Math.ceil(Math.max(wordCount / 0.75, charCount / 4));
}

function extractTokenUsage(inputPrompt, responseBody, modelId) {
    const tokenUsage = {
        inputTokens: null,
        outputTokens: null,
        totalTokens: null
    };

    try {
        if (modelId.includes('anthropic')) {
            // Anthropic Claude models
            if (responseBody.usage) {
                tokenUsage.inputTokens = responseBody.usage.input_tokens;
                tokenUsage.outputTokens = responseBody.usage.output_tokens;
                tokenUsage.totalTokens = (responseBody.usage.input_tokens || 0) + (responseBody.usage.output_tokens || 0);
            }
        } else if (modelId.includes('amazon')) {
            // Amazon Titan models
            if (responseBody.inputTextTokenCount !== undefined) {
                tokenUsage.inputTokens = responseBody.inputTextTokenCount;
            }
            if (responseBody.results && responseBody.results[0] && responseBody.results[0].tokenCount !== undefined) {
                tokenUsage.outputTokens = responseBody.results[0].tokenCount;
            }
            if (tokenUsage.inputTokens !== null && tokenUsage.outputTokens !== null) {
                tokenUsage.totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;
            }
        } else if (modelId.includes('mistral')) {
            // Mistral models
            console.log('Response Body:', responseBody);
            if (responseBody.usage) {
                tokenUsage.inputTokens = responseBody.usage.prompt_tokens;
                tokenUsage.outputTokens = responseBody.usage.completion_tokens;
                tokenUsage.totalTokens = responseBody.usage.total_tokens;
            } else {
                // Mistral doesn't provide token counts in Bedrock, so estimate
                const outputText = responseBody.outputs && responseBody.outputs[0] ? responseBody.outputs[0].text : '';
                tokenUsage.inputTokens = estimateTokens(inputPrompt);
                tokenUsage.outputTokens = estimateTokens(outputText);
                tokenUsage.totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;
                tokenUsage.estimatedUsage = true;
            }
        } else if (modelId.includes('ai21')) {
            // AI21 models
            if (responseBody.prompt && responseBody.prompt.tokens) {
                tokenUsage.inputTokens = responseBody.prompt.tokens.length;
            }
            if (responseBody.completions && responseBody.completions[0] && responseBody.completions[0].data && responseBody.completions[0].data.tokens) {
                tokenUsage.outputTokens = responseBody.completions[0].data.tokens.length;
            }
            if (tokenUsage.inputTokens !== null && tokenUsage.outputTokens !== null) {
                tokenUsage.totalTokens = tokenUsage.inputTokens + tokenUsage.outputTokens;
            }
        } else if (modelId.includes('cohere')) {
            // Cohere models
            if (responseBody.meta && responseBody.meta.billed_units) {
                tokenUsage.inputTokens = responseBody.meta.billed_units.input_tokens;
                tokenUsage.outputTokens = responseBody.meta.billed_units.output_tokens;
                tokenUsage.totalTokens = (responseBody.meta.billed_units.input_tokens || 0) + (responseBody.meta.billed_units.output_tokens || 0);
            }
        }
    } catch (error) {
        console.warn('Error extracting token usage:', error.message);
    }

    return tokenUsage;
}

module.exports = router;