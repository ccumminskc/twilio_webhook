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

// Twilio credentials (from environment variables)
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

// Webhook endpoint
app.post('/', async (req, res) => {
    // Log the incoming request body for debugging
    const logData = JSON.stringify(req.body, null, 2);
    console.log(`Received at ${new Date().toISOString()}:\n${logData}\n\n`);

    // Extract data from the Twilio webhook
    const payload = req.body.Payload ? JSON.parse(req.body.Payload) : {};
    const messageSid = payload.resource_sid || 'Unknown';
    const errorCode = payload.error_code || 'Unknown';

    // Default error message (for error code 30003)
    let errorMessage = 'Landline or Unreachable Carrier';
    if (errorCode !== '30003') {
        errorMessage = `Error Code ${errorCode}`;
    }

    // Fetch the message body from Twilio API
    let smsBody = 'Unknown';
    try {
        const twilioResponse = await axios.get(
            `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages/${messageSid}.json`,
            {
                auth: {
                    username: twilioAccountSid,
                    password: twilioAuthToken
                }
            }
        );
        smsBody = twilioResponse.data.body || 'Unknown';
    } catch (error) {
        console.error('Error fetching message body from Twilio:', {
            message: error.message,
            status: error.response ? error.response.status : 'No status',
            data: error.response ? error.response.data : 'No data'
        });
    }

    // Format the Message Body for FileMaker
    const messageBody = `Twilio error:\n\nThe following message is undelivered.\nTo: +19137128376\nMessageSID: ${messageSid}\nMessage Body: "${smsBody}"\nError: ${errorMessage}`;

    // Prepare data to send to FileMaker
    const recordData = {
        fieldData: {
            "Message Body": messageBody
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
