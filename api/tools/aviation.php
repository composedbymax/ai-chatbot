<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}
$config = require __DIR__ . '/../config.php';
$api_key = $config['aviationstack_api_key'];
$body = json_decode(file_get_contents('php://input'), true);
if (!$body) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON body']);
    exit;
}
$query_type = $body['query_type'] ?? 'flight';
$params = ['access_key' => $api_key, 'limit' => 5];
switch ($query_type) {
    case 'flight':
        $flight_id = $body['flight_iata'] ?? $body['flight_icao'] ?? null;
        if (!$flight_id) {
            http_response_code(400);
            echo json_encode(['error' => 'No flight identifier provided']);
            exit;
        }
        if (isset($body['flight_iata'])) {
            $params['flight_iata'] = strtoupper($body['flight_iata']);
        } else {
            $params['flight_icao'] = strtoupper($body['flight_icao']);
        }
        break;
    case 'departure':
        $airport = $body['airport'] ?? null;
        if (!$airport) {
            http_response_code(400);
            echo json_encode(['error' => 'No departure airport provided']);
            exit;
        }
        $params['dep_iata'] = strtoupper($airport);
        if (!empty($body['flight_status'])) {
            $params['flight_status'] = $body['flight_status'];
        }
        break;
    case 'arrival':
        $airport = $body['airport'] ?? null;
        if (!$airport) {
            http_response_code(400);
            echo json_encode(['error' => 'No arrival airport provided']);
            exit;
        }
        $params['arr_iata'] = strtoupper($airport);
        if (!empty($body['flight_status'])) {
            $params['flight_status'] = $body['flight_status'];
        }
        break;
    case 'airline':
        $airline = $body['airline_iata'] ?? null;
        if (!$airline) {
            http_response_code(400);
            echo json_encode(['error' => 'No airline IATA code provided']);
            exit;
        }
        $params['airline_iata'] = strtoupper($airline);
        if (!empty($body['flight_status'])) {
            $params['flight_status'] = $body['flight_status'];
        }
        break;
    default:
        http_response_code(400);
        echo json_encode(['error' => 'Unknown query_type: ' . $query_type]);
        exit;
}
$url = 'http://api.aviationstack.com/v1/flights?' . http_build_query($params);
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json']);
$json = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_error = curl_error($ch);
curl_close($ch);
if ($curl_error) {
    http_response_code(502);
    echo json_encode(['error' => 'Request failed: ' . $curl_error]);
    exit;
}
$result = json_decode($json, true);
if (!$result) {
    http_response_code(502);
    echo json_encode(['error' => 'Invalid response from AviationStack']);
    exit;
}
if (isset($result['error'])) {
    http_response_code(502);
    echo json_encode(['error' => $result['error']['message'] ?? 'AviationStack API error']);
    exit;
}
echo json_encode([
    'query_type' => $query_type,
    'flights' => $result['data'] ?? [],
    'pagination' => $result['pagination'] ?? null,
    'query' => $body
]);