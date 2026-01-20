<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
$apiUrl = 'https://openrouter.ai/api/frontend/models/find';
$cacheFile = __DIR__ . '/models_cache.json';
$cacheTtl = 48 * 60 * 60;
function fetchRemote($url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT => 'PHP OpenRouter Cache/1.0 (+https://yourdomain.example)',
    ]);
    $resp = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_errno($ch) ? curl_error($ch) : null;
    curl_close($ch);
    if ($resp === false || $httpCode !== 200) {
        return ['ok' => false, 'body' => null, 'http' => $httpCode, 'error' => $err];
    }
    return ['ok' => true, 'body' => $resp, 'http' => $httpCode, 'error' => null];
}
$force = isset($_GET['refresh']) && $_GET['refresh'] == '1';
$useCache = false;
if (!$force && file_exists($cacheFile)) {
    $age = time() - filemtime($cacheFile);
    if ($age < $cacheTtl) $useCache = true;
}
$rawJson = null;
if ($useCache) {
    $rawJson = file_get_contents($cacheFile);
} else {
    $result = fetchRemote($apiUrl);
    if ($result['ok']) {
        $rawJson = $result['body'];
        @file_put_contents($cacheFile, $rawJson, LOCK_EX);
    } elseif (file_exists($cacheFile)) {
        $rawJson = file_get_contents($cacheFile);
    } else {
        http_response_code(502);
        echo json_encode([
            'error' => 'Failed to fetch remote models and no cache available.',
            'remote_http' => $result['http'],
            'remote_error' => $result['error']
        ]);
        exit;
    }
}
$decoded = json_decode($rawJson, true);
$out = [
    'models' => [],
    'cached_at' => file_exists($cacheFile) ? date('c', filemtime($cacheFile)) : date('c'),
    'cache_ttl_seconds' => $cacheTtl,
];
function modelIsFree($m) {
    if (isset($m['is_free']) && $m['is_free'] === true) return true;
    if (isset($m['endpoint']['is_free']) && $m['endpoint']['is_free'] === true) return true;
    if (isset($m['variant']) && strtolower($m['variant']) === 'free') return true;
    if (isset($m['endpoint']['variant']) && strtolower($m['endpoint']['variant']) === 'free') return true;
    if (isset($m['free']) && $m['free'] === true) return true;
    if (!empty($m['provider_model_id']) && preg_match('/:free$/i', $m['provider_model_id'])) return true;
    return false;
}
function getProviderDisplay($m) {
    if (!empty($m['endpoint']['provider_display_name'])) return $m['endpoint']['provider_display_name'];
    if (!empty($m['provider_display_name'])) return $m['provider_display_name'];
    if (!empty($m['provider'])) return $m['provider'];
    return null;
}
function getModelDisplayName($m) {
    if (!empty($m['display_name'])) return $m['display_name'];
    if (!empty($m['name'])) return $m['name'];
    if (!empty($m['endpoint']['model']['name'])) return $m['endpoint']['model']['name'];
    if (!empty($m['slug'])) return $m['slug'];
    if (!empty($m['endpoint']['model']['slug'])) return $m['endpoint']['model']['slug'];
    return 'Unnamed model';
}
function getProviderModelId($m) {
    if (!empty($m['provider_model_id'])) return $m['provider_model_id'];
    if (!empty($m['endpoint']['provider_model_id'])) return $m['endpoint']['provider_model_id'];
    if (!empty($m['slug'])) return $m['slug'];
    if (!empty($m['endpoint']['model']['slug'])) return $m['endpoint']['model']['slug'];
    return null;
}
if (isset($decoded['data']['models']) && is_array($decoded['data']['models'])) {
    foreach ($decoded['data']['models'] as $m) {
        if (!modelIsFree($m)) continue;
        $provider = getProviderDisplay($m) ?: 'UnknownProvider';
        $modelName = getModelDisplayName($m);
        $llmName = sprintf('%s — %s (free)', $provider, $modelName);
        $provModelId = getProviderModelId($m);
        if ($provModelId) {
            $provIdNormalized = mb_strtolower($provModelId, 'UTF-8');
            $provIdNormalized = preg_replace('/\s+/', '-', $provIdNormalized);
            $provIdNormalized = preg_replace('/:free$/', '', $provIdNormalized);
            $provIdNormalized = preg_replace('/[^a-z0-9\-\._:]/', '', $provIdNormalized);
            if (!preg_match('/:free$/', $provIdNormalized)) $provIdNormalized .= ':free';
        } else {
            $provIdNormalized = mb_strtolower(preg_replace('/\s+/', '-', $provider . '-' . $modelName), 'UTF-8');
            $provIdNormalized = preg_replace('/[^a-z0-9\-\._:]/', '', $provIdNormalized) . ':free';
        }
        $out['models'][] = [
            'llm_name' => $llmName,
            'provider_id' => $provIdNormalized,
        ];
    }
}
$out['models_count'] = count($out['models']);
echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);