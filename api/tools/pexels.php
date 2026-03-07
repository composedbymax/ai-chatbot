<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
$config = require __DIR__ . '/../config.php';
$pexels_api_key = $config['pexels_api_key'];
$body = json_decode(file_get_contents('php://input'), true);
if (!$body || empty($body['query'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing query parameter']);
    exit;
}

$query    = trim($body['query']);
$type     = isset($body['type']) ? $body['type'] : 'photo';
$per_page = 1;
if ($type === 'video') {
    $url = 'https://api.pexels.com/v1/videos/search?query=' . urlencode($query) . '&per_page=' . $per_page;
} else {
    $url = 'https://api.pexels.com/v1/search?query=' . urlencode($query) . '&per_page=' . $per_page;
}
$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: ' . $pexels_api_key
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
$response  = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curl_err  = curl_error($ch);
curl_close($ch);
if ($curl_err) {
    http_response_code(502);
    echo json_encode(['error' => 'Request failed: ' . $curl_err]);
    exit;
}
if ($http_code !== 200) {
    http_response_code(502);
    echo json_encode(['error' => 'Pexels API returned status ' . $http_code]);
    exit;
}
$data = json_decode($response, true);
if ($type === 'video') {
    if (empty($data['videos'])) {
        echo json_encode(['error' => 'No videos found for "' . $query . '"']);
        exit;
    }
    $video      = $data['videos'][0];
    $video_url  = null;
    foreach ($video['video_files'] as $file) {
        if ($file['quality'] === 'hd' && $file['file_type'] === 'video/mp4') {
            $video_url = $file['link'];
            break;
        }
    }
    if (!$video_url && !empty($video['video_files'])) {
        $video_url = $video['video_files'][0]['link'];
    }
    echo json_encode([
        'type'         => 'video',
        'query'        => $query,
        'video_url'    => $video_url,
        'duration'     => $video['duration'] ?? null,
        'pexels_url'   => $video['url'] ?? 'https://www.pexels.com',
        'photographer' => $video['user']['name'] ?? null,
    ]);
} else {
    if (empty($data['photos'])) {
        echo json_encode(['error' => 'No photos found for "' . $query . '"']);
        exit;
    }
    $photo = $data['photos'][0];
    echo json_encode([
        'type'         => 'photo',
        'query'        => $query,
        'image_url'    => $photo['src']['large'],
        'image_small'  => $photo['src']['small'],
        'photographer' => $photo['photographer'] ?? null,
        'pexels_url'   => $photo['url'] ?? 'https://www.pexels.com',
    ]);
}