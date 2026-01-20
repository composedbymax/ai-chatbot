<?php
include '../check_auth.php';
header('Content-Type: application/json');
$input = json_decode(file_get_contents('php://input'), true);
$userMessage = $input['message'] ?? '';
$model = $input['model'] ?? null;
if (!$userMessage) {
    echo json_encode(['reply' => 'No message received.']);
    exit;
}
if (!$model) {
    echo json_encode(['reply' => 'No model selected.']);
    exit;
}
$apiKey = 'REDACTED';
$url = 'https://openrouter.ai/api/v1/chat/completions';
$data = [
    'model' => $model,
    'messages' => [
        ['role' => 'user', 'content' => $userMessage]
    ]
];
$options = [
    'http' => [
        'header'  => "Content-Type: application/json\r\n" .
                     "Authorization: Bearer $apiKey\r\n",
        'method'  => 'POST',
        'content' => json_encode($data),
        'timeout' => 15
    ]
];
$context  = stream_context_create($options);
$result = @file_get_contents($url, false, $context);
if ($result === FALSE) {
    echo json_encode(['reply' => 'Error contacting OpenRouter API']);
    exit;
}
$response = json_decode($result, true);
$reply = $response['choices'][0]['message']['content'] ?? 'No response from model';
echo json_encode(['reply' => $reply]);