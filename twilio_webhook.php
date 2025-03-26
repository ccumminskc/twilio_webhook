<?php
// twilio_webhook.php

// Log the incoming POST data for debugging
$postData = $_POST;
$logData = json_encode($postData, JSON_PRETTY_PRINT);
file_put_contents('webhook_log.txt', "Received at " . date('Y-m-d H:i:s') . ":\n" . $logData . "\n\n", FILE_APPEND);

// Send a 200 OK response to Twilio with TwiML
header("Content-Type: application/xml");
echo "<Response></Response>";
?>