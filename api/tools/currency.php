<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}
$body = file_get_contents('php://input');
$input = json_decode($body, true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}
$from   = strtolower(trim($input['from']   ?? ''));
$to     = strtolower(trim($input['to']     ?? ''));
$amount = floatval($input['amount']        ?? 1);
if (!$from || !$to) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: from, to']);
    exit;
}
$endpoints = [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{$from}.min.json",
    "https://latest.currency-api.pages.dev/v1/currencies/{$from}.min.json",
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/{$from}.json",
    "https://latest.currency-api.pages.dev/v1/currencies/{$from}.json",
];
$rawData = null;
$lastError = '';
foreach ($endpoints as $url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT      => 'CurrencyTool/1.0',
        CURLOPT_SSL_VERIFYPEER => true,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    if ($response !== false && $httpCode === 200) {
        $decoded = json_decode($response, true);
        if ($decoded && isset($decoded[$from])) {
            $rawData = $decoded;
            break;
        }
    }
    $lastError = $curlError ?: "HTTP $httpCode from $url";
}
if (!$rawData) {
    http_response_code(502);
    echo json_encode(['error' => "Could not fetch exchange rates. Last error: $lastError"]);
    exit;
}
$rates = $rawData[$from];
if (!isset($rates[$to])) {
    http_response_code(404);
    echo json_encode(['error' => "No rate found for {$from} → {$to}"]);
    exit;
}
$rate        = floatval($rates[$to]);
$converted   = $amount * $rate;
$date        = $rawData['date'] ?? date('Y-m-d');
$reverseRate = null;
if (isset($rates[$to]) && $rate != 0) {
    $reverseRate = round(1 / $rate, 6);
}
echo json_encode([
    'from'         => strtoupper($from),
    'to'           => strtoupper($to),
    'amount'       => $amount,
    'rate'         => $rate,
    'converted'    => $converted,
    'reverse_rate' => $reverseRate,
    'date'         => $date,
]);