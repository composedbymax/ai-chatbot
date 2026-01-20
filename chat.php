<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
$message = $input['message'] ?? null;
$model = $input['model'] ?? null;
if (!$message) {
    echo json_encode(['error' => 'No message supplied.']);
    exit;
}
if (!$model) {
    echo json_encode(['error' => 'No model selected.']);
    exit;
}
$configFile = __DIR__ . '/config.php';
if (!file_exists($configFile)) {
    echo json_encode(['error' => 'Server error: config.php not found.']);
    exit;
}
$config = include $configFile;
$apiKey = $config['openrouter_api_key'] ?? null;
if (!$apiKey) {
    echo json_encode(['error' => 'Server error: OpenRouter API key not configured in config.php.']);
    exit;
}
$url = 'https://openrouter.ai/api/v1/chat/completions';
$post = [
    'model' => $model,
    'messages' => [
        ['role' => 'user', 'content' => $message]
    ],
    'max_tokens' => 1000,
];
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($post),
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json',
        'Authorization: Bearer ' . $apiKey
    ],
    CURLOPT_TIMEOUT => 30,
    CURLOPT_FAILONERROR => false,
]);
$res = curl_exec($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_errno($ch) ? curl_error($ch) : null;
curl_close($ch);
if ($res === false) {
    echo json_encode(['error' => 'Error contacting OpenRouter: ' . ($err ?? 'unknown')]);
    exit;
}
$decoded = json_decode($res, true);
if (!$decoded) {
    echo json_encode(['error' => 'Invalid response from OpenRouter', 'raw' => $res]);
    exit;
}
$reply = null;
if (isset($decoded['choices'][0]['message']['content'])) {
    $reply = $decoded['choices'][0]['message']['content'];
} elseif (isset($decoded['result'])) {
    $reply = $decoded['result'];
} elseif (isset($decoded['choices'][0]['text'])) {
    $reply = $decoded['choices'][0]['text'];
}
if ($reply === null) {
    echo json_encode(['error' => 'No assistant reply found', 'response' => $decoded]);
    exit;
}
echo json_encode(['reply' => $reply]);