// routes/launchCmd.js
const express = require('express');
const { exec } = require('child_process');
const path = require('path');

const router = express.Router();

/**
 * POST /launch-cmd
 * Body: { ip: string, user: string, keyPath: string }
 */
router.post('/', (req, res) => {
    const { ip, user, keyPath } = req.body;

    if (!ip || !user || !keyPath) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // Build the SSH command
    const sshCommand = `ssh -i "${path.resolve(keyPath)}" ${user}@${ip}`;
    console.log('Executing command:', sshCommand);

    // Decide platform command
    let finalCommand;
    if (process.platform.startsWith('win')) {
        // On Windows
        finalCommand = `start cmd /k "${sshCommand}"`;
    } else {
        // On macOS/Linux
        finalCommand = `x-terminal-emulator -e '${sshCommand}'`;
    }

    // Execute it
    exec(finalCommand, (error) => {
        if (error) {
            console.error('Error launching command:', error);
            return res.status(500).json({ error: 'Failed to launch SSH command' });
        }
        res.json({ success: true, command: sshCommand });
    });
});

module.exports = router;
