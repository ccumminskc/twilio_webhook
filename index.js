// index.js
const express = require('express');
const axios = require('axios');
const app = express();

// Middleware to parse URL-encoded form data (Twilio sends data in this format)
app.use(express.urlencoded({ extended: true }));

// FileMaker Data API credentials (hardcoded for now)
const fmHost = 'your-filemaker-server-domain.com'; // Replace with your actual FileMaker Server domain
const fmDatabase = 'YourDatabaseName'; // Replace with your actual database name
const fmUsername = 'your-data-api-username'; // Replace with your actual username
const fmPassword = 'your-data-api-password'; // Replace with your actual password
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
        console.log('Attempting to authenticate with FileMaker...');
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
        console.log('Authentication successful, token:', token);

        // Create a new record in FileMaker
        console.log('Creating record in FileMaker...');
        const createResponse = await axios.post(
            `https://${fmHost}/fmi/data/v1/databases/${fmDatabase}/layouts/${fmLayout}/records`,
            recordData,
            {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            }
        );
        console.log('Record created successfully:', createResponse.data);

        // Log out of the Data API session
        console.log('Logging out of FileMaker session...');
        await axios.delete(
            `https://${fmHost}/fmi/data/v1/databases/${fmDatabase}/sessions/${token}`,
            {
                headers: { 'Content-Type': 'application/json' }
            }
        );
        console.log('Logged out successfully');
    } catch (error) {
        console.error('Error sending data to FileMaker:', {
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
