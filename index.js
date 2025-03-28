// index.js
const express = require('express');
const axios = require('axios');
const app = express();

// Middleware to parse URL-encoded form data (Twilio sends data in this format)
app.use(express.urlencoded({ extended: true }));

// FileMaker Data API credentials (from environment variables)
const fmHost = process.env.FM_HOST;
const fmDatabase = process.env.FM_DATABASE;
const fmUsername = process.env.FM_USERNAME;
const fmPassword = process.env.FM_PASSWORD;
const fmLayout = 'Error%20Log';
const fmScript = 'Error%20Handling%20Twilio%20Copy';

// Webhook endpoint
app.post('/', async (req, res) => {
    // Log the incoming request body for debugging
    const logData = JSON.stringify(req.body, null, 2);
    console.log(`Received at ${new Date().toISOString()}:\n${logData}\n\n`);

    // Extract data from the Twilio webhook
    const payload = req.body.Payload ? JSON.parse(req.body.Payload) : {};
    const debugSid = req.body.Sid || 'Unknown';
    const timestamp = req.body.Timestamp || 'Unknown';
    const errorLevel = req.body.Level || 'Unknown';
    const messageSid = payload.resource_sid || 'Unknown';
    const errorCode = payload.error_code || 'Unknown';

    // Prepare the script parameter for FileMaker
    const scriptParam = {
        debug_sid: debugSid,
        timestamp: timestamp,
        error: errorLevel,
        payload_resource_sid: messageSid,
        error_code: errorCode
    };

    try {
        // Authenticate with FileMaker Data API
        console.log('Attempting to authenticate with FileMaker...');
        const authResponse = await axios.post(
            `https://${fmHost}/fmi/data/vLatest/databases/${fmDatabase}/sessions`,
            {},
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Basic ' + Buffer.from(`${fmUsername}:${fmPassword}`).toString('base64')
                }
            }
        );
        const token = authResponse.data.response.token;
        console.log('Authentication successful, token:', token);

        // Perform the FileMaker script
        console.log('Performing FileMaker script...');
        const scriptResponse = await axios.get(
            `https://${fmHost}/fmi/data/vLatest/databases/${fmDatabase}/layouts/${fmLayout}/script/${fmScript}`,
            {
                params: {
                    'script.param': JSON.stringify(scriptParam)
                },
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            }
        );
        console.log('Script executed successfully:', scriptResponse.data);

        // Log out of the Data API session
        console.log('Logging out of FileMaker session...');
        await axios.delete(
            `https://${fmHost}/fmi/data/vLatest/databases/${fmDatabase}/sessions/${token}`,
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );
        console.log('Logged out successfully');
    } catch (error) {
        console.error('Error interacting with FileMaker:', {
            message: error.message,
            status: error.response ? error.response.status : 'No status',
            data: error.response ? error.response.data : 'No data'
        });
    }

    // Send a 200 OK response with TwiML
    res.set('Content-Type', 'application/xml');
    res.send('<Response></Response>');
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
