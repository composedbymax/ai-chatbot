<?php
require __DIR__ . '/../../check_premium.php';
header('Content-Type: application/json');
$action = $_GET['action'] ?? '';
if (!$action) {
    $input = json_decode(file_get_contents('php://input'), true);
    $action = $input['action'] ?? '';
}
$userLoggedIn = isset($_SESSION['user']);
$userRole     = isset($_SESSION['user_role']) ? $_SESSION['user_role'] : null;
$userName     = isset($_SESSION['user']) ? $_SESSION['user'] : null;
if (!$userLoggedIn || !$userName) {
    echo json_encode(['success' => false, 'error' => 'User not logged in']);
    exit;
}
$userDir = __DIR__ . '/chats/' . preg_replace('/[^a-zA-Z0-9_-]/', '', $userName);
if (!is_dir($userDir)) {
    mkdir($userDir, 0755, true);
}
function compressMessages($messages) {
    return base64_encode(gzcompress(json_encode($messages), 9));
}
function decompressMessages($compressed) {
    $decompressed = @gzuncompress(base64_decode($compressed));
    return $decompressed ? json_decode($decompressed, true) : [];
}
switch ($action) {
    case 'save':
        $input = json_decode(file_get_contents('php://input'), true);
        $chatId = $input['id'] ?? '';
        $title = $input['title'] ?? 'Untitled';
        $messages = $input['messages'] ?? [];
        $timestamp = $input['timestamp'] ?? time();
        if (!$chatId) {
            echo json_encode(['success' => false, 'error' => 'No chat ID provided']);
            exit;
        }
        $filename = $userDir . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '', $chatId) . '.json';
        $data = [
            'id' => $chatId,
            'title' => $title,
            'timestamp' => $timestamp,
            'compressed_messages' => compressMessages($messages)
        ];
        if (file_put_contents($filename, json_encode($data))) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to save chat']);
        }
        break;
    case 'load':
        $files = glob($userDir . '/*.json');
        $chats = [];
        foreach ($files as $file) {
            $data = json_decode(file_get_contents($file), true);
            if ($data) {
                $messages = decompressMessages($data['compressed_messages'] ?? '');
                $chats[] = [
                    'id' => $data['id'],
                    'title' => $data['title'] ?? 'Untitled',
                    'timestamp' => $data['timestamp'] ?? 0,
                    'messages' => $messages,
                    'preview' => !empty($messages) && isset($messages[0]['content']) 
                        ? substr($messages[0]['content'], 0, 60) 
                        : ''
                ];
            }
        }
        usort($chats, function($a, $b) {
            return $b['timestamp'] - $a['timestamp'];
        });
        echo json_encode(['success' => true, 'chats' => $chats]);
        break;
    case 'delete':
        $input = json_decode(file_get_contents('php://input'), true);
        $chatId = $input['id'] ?? '';
        if (!$chatId) {
            echo json_encode(['success' => false, 'error' => 'No chat ID provided']);
            exit;
        }
        $filename = $userDir . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '', $chatId) . '.json';
        if (file_exists($filename) && unlink($filename)) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['success' => false, 'error' => 'Failed to delete chat']);
        }
        break;
    default:
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
}