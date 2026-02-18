<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
$location = trim($input['location'] ?? '');
if (!$location) {
    echo json_encode(['error' => 'No location provided']);
    exit;
}
$geoUrl = 'https://geocoding-api.open-meteo.com/v1/search?' . http_build_query([
    'name'    => $location,
    'count'   => 1,
    'language' => 'en',
    'format'  => 'json'
]);
$geoRes = httpGet($geoUrl);
if ($geoRes === false) {
    echo json_encode(['error' => 'Geocoding request failed']);
    exit;
}
$geo = json_decode($geoRes, true);
if (empty($geo['results'])) {
    echo json_encode(['error' => "Location not found: " . htmlspecialchars($location)]);
    exit;
}
$place = $geo['results'][0];
$lat   = $place['latitude'];
$lon   = $place['longitude'];
$name  = $place['name'] ?? $location;
$country = $place['country_code'] ?? ($place['country'] ?? '');
$weatherUrl = 'https://api.open-meteo.com/v1/forecast?' . http_build_query([
    'latitude'          => $lat,
    'longitude'         => $lon,
    'current_weather'   => 'true',
    'hourly'            => 'temperature_2m,precipitation_probability',
    'forecast_days'     => 1,
    'timezone'          => 'auto'
]);
$weatherRes = httpGet($weatherUrl);
if ($weatherRes === false) {
    echo json_encode(['error' => 'Weather request failed']);
    exit;
}
$weather = json_decode($weatherRes, true);
if (!isset($weather['current_weather'])) {
    echo json_encode(['error' => 'Invalid weather data received']);
    exit;
}
echo json_encode([
    'location' => [
        'name'    => $name,
        'country' => $country,
        'lat'     => $lat,
        'lon'     => $lon
    ],
    'weather' => $weather
]);
function httpGet($url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT      => 'WeatherTool/1.0',
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($res !== false && $code === 200) ? $res : false;
}