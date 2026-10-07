<?php
declare(strict_types=1);

require __DIR__ . '/vendor/autoload.php';
require __DIR__ . '/lib/env.php';
require __DIR__ . '/lib/Form.php';
require __DIR__ . '/lib/mail.php';

use PHPMailer\PHPMailer\Exception as MailerException;

mb_language('Japanese');
mb_internal_encoding('UTF-8');
date_default_timezone_set('Asia/Tokyo');
header('Content-Type: application/json; charset=UTF-8');

/** JSON で応答して終了する */
function respond(int $status, array $body = []): void
{
  http_response_code($status);
  if ($body) echo json_encode($body, JSON_UNESCAPED_UNICODE);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  header('Allow: POST');
  respond(405, ['message' => 'POST で送信してください']);
}

// ---- 設定の読み込み（項目の説明は .env.example を参照）----
// .env を公開ディレクトリの外に置く場合は、このパスを書き換える
$env_path = __DIR__ . '/.env';

try {
  $env = load_env($env_path);
  $site_title  = env_required($env, 'SITE_TITLE');
  $site_url    = rtrim(env_required($env, 'SITE_URL'), '/');
  $mail_from   = env_required($env, 'MAIL_FROM');
  $admin_email = env_required($env, 'ADMIN_EMAIL');
  $smtp = [
    'host'   => env_required($env, 'SMTP_HOST'),
    'user'   => env_required($env, 'SMTP_USER'),
    'pass'   => env_required($env, 'SMTP_PASS'),
    'port'   => (int) ($env['SMTP_PORT'] ?? 587),
    'secure' => strtolower($env['SMTP_SECURE'] ?? 'tls'),
  ];
  $name_field    = $env['NAME_FIELD'] ?? 'name';
  $email_field   = $env['EMAIL_FIELD'] ?? 'email';
  $purpose_field = $env['PURPOSE_FIELD'] ?? 'purpose';
  $strict        = strtolower($env['SCHEMA_VALIDATION'] ?? 'true') !== 'false';
  $mail_footer   = $env['MAIL_FOOTER'] ?? '';
  $form = Form::fromFile(__DIR__ . '/schema.json');
} catch (RuntimeException $e) {
  // 設定ミスの内容はサーバーのログにだけ残す
  error_log('お問い合わせフォームの設定エラー: ' . $e->getMessage());
  respond(500, ['message' => '送信できませんでした。時間をおいて再度お試しください']);
}

// ---- 送信元のチェック（CSRF 対策）----
// Origin（なければ Referer）が、サイトまたは許可したオリジンと一致しなければ弾く
$allowed = array_map(fn ($o) => rtrim($o, '/'), [parse_origin($site_url), ...env_list($env, 'ALLOWED_ORIGINS')]);
$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
$referer = $_SERVER['HTTP_REFERER'] ?? '';
$from_ok = $origin !== ''
  ? in_array($origin, $allowed, true)
  : ($referer !== '' && in_array(parse_origin($referer), $allowed, true));
if (!$from_ok) respond(403, ['message' => '送信元を確認できませんでした']);

// JSON 以外（通常のフォーム送信など）は受け付けない
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
  respond(415, ['message' => 'JSON で送信してください']);
}

// ---- データの取得と整形 ----
$raw = file_get_contents('php://input', false, null, 0, 200 * 1024);
$payload = json_decode($raw ?: '', true);
if (!is_array($payload) || !isset($payload['data']) || !is_array($payload['data'])) {
  respond(400, ['message' => '送信データを読み取れませんでした']);
}

try {
  // 定義にない項目は捨て、型と選択肢を確かめる
  $values = $form->sanitize($payload['data']);
} catch (InvalidArgumentException $e) {
  error_log('お問い合わせフォーム: ' . $e->getMessage());
  respond(400, ['message' => '送信データに不正な値が含まれています']);
}
$eff = $form->effective($values);

// ---- 入力チェック ----
// 返信と振り分けに欠かせない項目は、設定にかかわらず必ず確かめる
$errors = [];
if (trim((string) ($eff[$name_field] ?? '')) === '') $errors[$name_field] = '入力してください';
if (!filter_var($eff[$email_field] ?? '', FILTER_VALIDATE_EMAIL)) $errors[$email_field] = 'メールアドレスの形式を確認してください';
if (($eff[$purpose_field] ?? '') === '') $errors[$purpose_field] = '選択してください';
if ($strict) $errors += $form->validate($eff);
if ($errors) respond(422, ['message' => '入力内容を確認してください', 'errors' => $errors]);

// ---- メール本文 ----
$name     = $eff[$name_field];
$email    = $eff[$email_field];
$purpose  = $form->optionLabel($purpose_field, $eff[$purpose_field]);
$routes   = $form->routes($eff);
$summary  = $form->toText($eff);
$received = date('Y年n月j日 H:i');

$route_text = implode('、', array_map([$form, 'routeLabel'], $routes));
$ip         = $_SERVER['REMOTE_ADDR'] ?? '';
$user_agent = mb_strimwidth($_SERVER['HTTP_USER_AGENT'] ?? '', 0, 200, '…');

$admin_body = <<<TEXT
{$site_title}のお問い合わせフォームから、以下の内容で受け付けました。
このメールに返信すると、お問い合わせいただいた方に届きます。

受付日時：{$received}
お問い合わせの目的：{$purpose}
担当：{$route_text}

{$summary}

────────────────────────────
送信元IP：{$ip}
ブラウザ：{$user_agent}

TEXT;

$reply_body = <<<TEXT
{$name} 様

{$site_title}へのお問い合わせ、ありがとうございます。
以下の内容で受け付けました。担当者から、通常3営業日以内にご連絡します。

{$summary}
{$mail_footer}
TEXT;

// ---- 送信 ----
try {
  // 担当宛（失敗したらエラーを返す）
  $mail = create_mailer($smtp);
  $mail->setFrom($mail_from, $site_title);
  foreach (notify_addresses($routes, $env, $admin_email) as $to) $mail->addAddress($to);
  $mail->addReplyTo($email, $name);
  $mail->Subject = "【{$site_title}】{$purpose}のお問い合わせ（{$name} 様）";
  $mail->Body    = $admin_body;
  $mail->send();
} catch (MailerException $e) {
  error_log('お問い合わせの通知メール送信失敗: ' . $e->getMessage());
  respond(500, ['message' => '送信できませんでした。時間をおいて再度お試しください']);
}

try {
  // 自動返信（失敗してもお問い合わせ自体は受け付けているので、エラーにはしない）
  $reply = create_mailer($smtp);
  $reply->setFrom($mail_from, $site_title);
  $reply->addAddress($email, $name);
  $reply->addReplyTo($admin_email, $site_title);
  $reply->Subject = "【{$site_title}】お問い合わせを受け付けました";
  $reply->Body    = $reply_body;
  $reply->send();
} catch (MailerException $e) {
  error_log('自動返信失敗: ' . $e->getMessage() . ' 宛先: ' . $email);
}

respond(204);

/** URL から「スキーム://ホスト[:ポート]」を取り出す */
function parse_origin(string $url): string
{
  $p = parse_url($url);
  if (!isset($p['scheme'], $p['host'])) return '';
  return $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
}
