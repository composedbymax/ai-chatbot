<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
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
$url = 'https://openrouter.ai/api/v1/key';
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        'Authorization: Bearer ' . $apiKey
    ],
    CURLOPT_TIMEOUT => 12,
]);
$res = curl_exec($ch);
$http = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err = curl_errno($ch) ? curl_error($ch) : null;
curl_close($ch);
if ($res === false) {
    http_response_code(502);
    echo json_encode(['error' => 'Failed to contact OpenRouter: ' . ($err ?? 'unknown')]);
    exit;
}
$decoded = json_decode($res, true);
if (!$decoded) {
    http_response_code(502);
    echo json_encode(['error' => 'Invalid JSON from OpenRouter', 'raw' => $res]);
    exit;
}
echo json_encode($decoded);