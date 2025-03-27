// index.js
const express = require('express');
const axios = require('axios');
const app = express();

// Middleware to parse URL-encoded form data (Twilio sends data in this format)
app.use(express.urlencoded({ extended: true }));

// FileMaker Data API credentials (from environment variables only)
const fmHost = process.env.FM_HOST;
const fmDatabase = process.env.FM_DATABASE;
const fmUsername = process.env.FM_USERNAME;
const fmPassword = process.env.FM_PASSWORD;
const fmLayout = 'Error%20Log';

// Debug: Log environment variables to confirm they're being read
console.log('Environment Variables:', {
    FM_HOST: process.env.FM_HOST,
    FM_DATABASE: process.env.FM_DATABASE,
    FM_USERNAME: process.env.FM_USERNAME,
    FM_PASSWORD: process.env.FM_PASSWORD
});

// Webhook endpoint
app.post('/', async (req, res) => {
    // Log the incoming request body for debugging
    const logData = JSON.stringify(req.body, null, 2);
    console.log(`Received at ${new Date().toISOString()}:\n${logData}\n\n`);

    // Prepare data to send to FileMaker
    const recordData = {
        fieldData: {
            "Message Body": "Railway.app webhook test for Twilio Errors"
        }
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

        // Create a new record in FileMaker
        console.log('Creating record in FileMaker...');
        const createResponse = await axios.post(
            `https://${fmHost}/fmi/data/vLatest/databases/${fmDatabase}/layouts/${fmLayout}/records`,
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
            `https://${fmHost}/fmi/data/vLatest/databases/${fmDatabase}/sessions/${token}`,
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
