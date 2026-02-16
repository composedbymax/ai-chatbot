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
$action = $_GET['action'] ?? null;
if (!$action) {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    $action = $input['action'] ?? null;
}
switch ($action) {
    case 'init':
        handleInit($apiKey);
        break;
    case 'chat':
        handleChat($apiKey);
        break;
    default:
        echo json_encode(['error' => 'Invalid action']);
        break;
}
function handleInit($apiKey) {
    $models = getModels();
    $rateInfo = null;
    try {
        $rateInfo = getRateInfo($apiKey);
    } catch (Exception $e) {
    }
    $response = ['models' => $models];
    if ($rateInfo) {
        $response['rate_info'] = $rateInfo;
    }
    echo json_encode($response);
}
function handleChat($apiKey) {
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
    if (isset($decoded['error'])) {
        $errorMsg = $decoded['error']['message'] ?? 'Unknown error';
        $errorCode = $decoded['error']['code'] ?? null;
        if ($errorCode === 429 || stripos($errorMsg, 'rate limit') !== false) {
            echo json_encode([
                'error' => 'Rate limit reached. Please wait before sending more messages.',
                'rate_limit_message' => 'You have reached your rate limit. Please try again later.'
            ]);
            exit;
        }
        echo json_encode(['error' => $errorMsg]);
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
    $rateInfo = null;
    try {
        $rateInfo = getRateInfo($apiKey);
    } catch (Exception $e) {
    }
    $response = ['reply' => $reply];
    if ($rateInfo) {
        $response['rate_info'] = $rateInfo;
        if (isset($rateInfo['limit_remaining']) && $rateInfo['limit_remaining'] !== null) {
            if ($rateInfo['limit_remaining'] <= 5 && $rateInfo['limit_remaining'] > 0) {
                $response['rate_limit_message'] = "Warning: You have {$rateInfo['limit_remaining']} requests remaining.";
            } elseif ($rateInfo['limit_remaining'] <= 0) {
                $response['rate_limit_message'] = "You have reached your rate limit.";
            }
        }
    }
    echo json_encode($response);
}
function getModels() {
    $apiUrl = 'https://openrouter.ai/api/frontend/models/find';
    $cacheFile = __DIR__ . '/models_cache.json';
    $cacheTtl = 48 * 60 * 60;
    $useCache = false;
    if (file_exists($cacheFile)) {
        $age = time() - filemtime($cacheFile);
        if ($age < $cacheTtl) $useCache = true;
    }
    $rawJson = null;
    if ($useCache) {
        $rawJson = file_get_contents($cacheFile);
    } else {
        $ch = curl_init($apiUrl);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_USERAGENT => 'PHP OpenRouter Cache/1.0',
        ]);
        $resp = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($resp !== false && $httpCode === 200) {
            $rawJson = $resp;
            @file_put_contents($cacheFile, $rawJson, LOCK_EX);
        } elseif (file_exists($cacheFile)) {
            $rawJson = file_get_contents($cacheFile);
        } else {
            return [];
        }
    }
    $decoded = json_decode($rawJson, true);
    $models = [];
    if (isset($decoded['data']['models']) && is_array($decoded['data']['models'])) {
        foreach ($decoded['data']['models'] as $m) {
            if (!modelIsFree($m)) continue;
            $provider = getProviderDisplay($m) ?: 'UnknownProvider';
            $modelName = getModelDisplayName($m);
            $llmName = sprintf('%s — %s (free)', $provider, $modelName);
            $provModelId = getProviderModelId($m);
            if ($provModelId) {
                $models[] = [
                    'llm_name' => $llmName,
                    'provider_id' => $provModelId,
                ];
            }
        }
    }
    return $models;
}
function getRateInfo($apiKey) {
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
    curl_close($ch);
    if ($res === false || $http !== 200) {
        return null;
    }
    $decoded = json_decode($res, true);
    if (!$decoded) {
        return null;
    }
    return $decoded['data'] ?? $decoded;
}
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
    if (!empty($m['endpoint']['model_variant_slug'])) {
        return $m['endpoint']['model_variant_slug'];
    }
    $slug = null;
    if (!empty($m['slug'])) {
        $slug = $m['slug'];
    } elseif (!empty($m['endpoint']['model']['slug'])) {
        $slug = $m['endpoint']['model']['slug'];
    }
    if ($slug) {
        if (!preg_match('/:free$/i', $slug)) {
            $slug .= ':free';
        }
        return $slug;
    }
    return null;
}