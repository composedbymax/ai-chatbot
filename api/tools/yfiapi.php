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
$action = $input['action'] ?? 'search';
if ($action === 'chart') {
    handleChart($input);
} else {
    handleSearch($input);
}
function handleSearch($input) {
    $query = trim($input['query'] ?? '');
    if (!$query) {
        echo json_encode(['error' => 'No query provided']);
        exit;
    }
    $searchUrl = 'https://query2.finance.yahoo.com/v1/finance/search?' . http_build_query([
        'q'           => $query,
        'quotesCount' => 6,
        'newsCount'   => 0,
    ]);
    $res = httpGet($searchUrl);
    if ($res === false) {
        echo json_encode(['error' => 'Yahoo Finance search failed']);
        exit;
    }
    $decoded = json_decode($res, true);
    $results = $decoded['quotes'] ?? [];
    if (empty($results)) {
        echo json_encode(['error' => 'No results found for: ' . htmlspecialchars($query)]);
        exit;
    }
    $candidates = [];
    foreach ($results as $q) {
        if (empty($q['symbol'])) continue;
        $candidates[] = [
            'symbol'   => $q['symbol'],
            'name'     => $q['longname'] ?? $q['shortname'] ?? '',
            'type'     => $q['quoteType'] ?? '',
            'exchange' => $q['exchDisp'] ?? $q['exchange'] ?? '',
        ];
    }
    echo json_encode(['candidates' => $candidates]);
}
function handleChart($input) {
    $symbol   = trim($input['symbol']   ?? '');
    $range    = trim($input['range']    ?? '1mo');
    $interval = trim($input['interval'] ?? '1d');
    $allowedRanges    = ['1d','5d','1mo','3mo','6mo','1y','2y','5y','10y','ytd','max'];
    $allowedIntervals = ['1m','2m','5m','15m','30m','60m','90m','1h','1d','5d','1wk','1mo','3mo'];
    if (!in_array($range, $allowedRanges))       $range    = '1mo';
    if (!in_array($interval, $allowedIntervals)) $interval = '1d';
    if (!$symbol) {
        echo json_encode(['error' => 'No symbol provided']);
        exit;
    }
    if (!preg_match('/^[A-Z0-9\.\-\^\=]+$/i', $symbol) || strlen($symbol) > 20) {
        echo json_encode(['error' => 'Invalid symbol format']);
        exit;
    }
    $chartUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/' . urlencode($symbol) . '?' . http_build_query([
        'range'    => $range,
        'interval' => $interval,
    ]);
    $chartRes = httpGet($chartUrl);
    if ($chartRes === false) {
        echo json_encode(['error' => 'Chart request failed for: ' . htmlspecialchars($symbol)]);
        exit;
    }
    $chartData = json_decode($chartRes, true);
    $result    = $chartData['chart']['result'][0] ?? null;
    if (!$result) {
        $errMsg = $chartData['chart']['error']['description'] ?? 'No data for: ' . htmlspecialchars($symbol);
        echo json_encode(['error' => $errMsg]);
        exit;
    }
    $meta       = $result['meta'] ?? [];
    $timestamps = $result['timestamp'] ?? [];
    $rawQuotes  = $result['indicators']['quote'][0] ?? [];
    $quotes = [];
    foreach ($timestamps as $i => $ts) {
        $close = $rawQuotes['close'][$i] ?? null;
        if ($close !== null) {
            $quotes[] = [
                'timestamp' => $ts,
                'open'      => $rawQuotes['open'][$i]   ?? null,
                'high'      => $rawQuotes['high'][$i]   ?? null,
                'low'       => $rawQuotes['low'][$i]    ?? null,
                'close'     => $close,
                'volume'    => $rawQuotes['volume'][$i] ?? null,
            ];
        }
    }
    echo json_encode([
        'symbol'     => $symbol,
        'meta'       => $meta,
        'timestamps' => $timestamps,
        'quotes'     => $quotes,
    ]);
}
function httpGet($url) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; YFITool/1.0)',
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json',
            'Accept-Language: en-US,en;q=0.9',
        ],
    ]);
    $res  = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($res !== false && $code === 200) ? $res : false;
}