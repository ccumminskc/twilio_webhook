// index.js
const express = require('express');
const app = express();

// Middleware to parse URL-encoded form data (Twilio sends data in this format)
app.use(express.urlencoded({ extended: true }));

// Webhook endpoint
app.post('/', (req, res) => {
    // Log the incoming request body for debugging
    const logData = JSON.stringify(req.body, null, 2);
    console.log(`Received at ${new Date().toISOString()}:\n${logData}\n\n`);

    // Send a 200 OK response with TwiML
    res.set('Content-Type', 'application/xml');
    res.send('<Response></Response>');
});

// Start the server (Railway.app will set the PORT environment variable)
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
