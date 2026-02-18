<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
$raw   = file_get_contents('php://input');
$input = json_decode($raw, true);
$location = trim($input['location'] ?? '');
if (!$location) {
    echo json_encode(['error' => 'No location provided']);
    exit;
}
function geocodeLocation(string $query): ?array {
    $url = 'https://geocoding-api.open-meteo.com/v1/search?' . http_build_query([
        'name'     => $query,
        'count'    => 5,
        'language' => 'en',
        'format'   => 'json'
    ]);
    $res = httpGet($url);
    if ($res === false) return null;
    $geo = json_decode($res, true);
    return (!empty($geo['results'])) ? $geo['results'] : null;
}
function buildSearchCandidates(string $location): array {
    $candidates = [];
    $normalized = preg_replace('/\s+/', ' ', str_replace(',', ' ', $location));
    $normalized = trim($normalized);
    $candidates[] = $normalized;
    $candidates[] = $location;
    $parts = array_values(array_filter(array_map('trim', explode(' ', $normalized))));
    if (count($parts) > 1) {
        $candidates[] = $parts[0];
    }
    return array_unique($candidates);
}
$place = null;
foreach (buildSearchCandidates($location) as $candidate) {
    $results = geocodeLocation($candidate);
    if (!empty($results)) {
        $place = $results[0];
        break;
    }
}
if (!$place) {
    echo json_encode(['error' => 'Location not found: ' . htmlspecialchars($location)]);
    exit;
}
$name     = $place['name']         ?? $location;
$country  = $place['country_code'] ?? ($place['country'] ?? '');
$timezone = $place['timezone']     ?? null;
if (!$timezone) {
    echo json_encode(['error' => 'Could not determine timezone for: ' . htmlspecialchars($location)]);
    exit;
}
$area_location = implode('/', array_map('rawurlencode', explode('/', $timezone)));
$timeUrl = "https://time.now/developer/api/timezone/{$area_location}";
$timeRes = httpGet($timeUrl);
if ($timeRes === false) {
    echo json_encode(['error' => 'Time API request failed']);
    exit;
}
$timeData = json_decode($timeRes, true);
if (!isset($timeData['datetime'])) {
    echo json_encode(['error' => 'Invalid time data received']);
    exit;
}
echo json_encode([
    'location' => [
        'name'    => $name,
        'country' => $country,
        'lat'     => $place['latitude'],
        'lon'     => $place['longitude'],
    ],
    'time' => $timeData
]);
function httpGet(string $url): string|false {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT      => 'TimeTool/1.0',
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($res !== false && $code === 200) ? $res : false;
}