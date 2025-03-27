// index.js
const express = require('express');
const axios = require('axios');
const app = express();

// Middleware to parse URL-encoded form data (Twilio sends data in this format)
app.use(express.urlencoded({ extended: true }));

// FileMaker Data API credentials (to be set as environment variables in Railway.app)
const fmHost = process.env.FM_HOST || 'your-filemaker-server-domain.com';
const fmDatabase = process.env.FM_DATABASE || 'YourDatabaseName';
const fmUsername = process.env.FM_USERNAME || 'your-data-api-username';
const fmPassword = process.env.FM_PASSWORD || 'your-data-api-password';
const fmLayout = 'WebErrors';

// Webhook endpoint
app.post('/', async (req, res) => {
    // Log the incoming request body for debugging
    const logData = JSON.stringify(req.body, null, 2);
    console.log(`Received at ${new Date().toISOString()}:\n${logData}\n\n`);

    // Extract relevant fields from the Twilio webhook
    const messageSid = req.body.Payload ? JSON.parse(req.body.Payload).resource_sid : '';
    const errorCode = req.body.Payload ? JSON.parse(req.body.Payload).error_code : '';
    const level = req.body.Level || '';
    const timestamp = req.body.Timestamp || '';

    // Prepare data to send to FileMaker
    const recordData = {
        fieldData: {
            MessageSID: messageSid,
            ErrorCode: errorCode,
            Level: level,
            Timestamp: timestamp
        }
    };

    try {
        // Authenticate with FileMaker Data API
        const authResponse = await axios.post(
            `https://${fmHost}/fmi/data/v1/databases/${fmDatabase}/sessions`,
            {},
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: 'Basic ' + Buffer.from(`${fmUsername}:${fmPassword}`).toString('base64')
                }
            }
        );
        const token = authResponse.data.response.token;

        // Create a new record in FileMaker
        await axios.post(
            `https://${fmHost}/fmi/data/v1/databases/${fmDatabase}/layouts/${fmLayout}/records`,
            recordData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            }
        );

        // Log out of the Data API session
        await axios.delete(
            `https://${fmHost}/fmi/data/v1/databases/${fmDatabase}/sessions/${token}`,
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );
    } catch (error) {
        console.error('Error sending data to FileMaker:', error.message);
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
