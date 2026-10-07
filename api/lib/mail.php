<?php
declare(strict_types=1);

use PHPMailer\PHPMailer\PHPMailer;

/**
 * SMTP の設定を済ませた PHPMailer を作る
 *
 * @param array{host: string, user: string, pass: string, port: int, secure: string} $smtp
 */
function create_mailer(array $smtp): PHPMailer
{
  $mail = new PHPMailer(true);
  $mail->isSMTP();
  $mail->Host     = $smtp['host'];
  $mail->SMTPAuth = true;
  $mail->Username = $smtp['user'];
  $mail->Password = $smtp['pass'];
  $mail->Port     = $smtp['port'];
  $mail->CharSet  = 'UTF-8';

  if ($smtp['secure'] === 'none') {
    // 暗号化なし（ローカルのテスト用メールサーバー向け）
    $mail->SMTPSecure = '';
    $mail->SMTPAutoTLS = false;
  } else {
    $mail->SMTPSecure = $smtp['secure'] === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
  }

  return $mail;
}

/**
 * 通知先のメールアドレスを集める。担当ごとの設定（NOTIFY_RELOCATION など）がなければ ADMIN_EMAIL に送る
 *
 * @param string[] $routes
 * @param array<string, string> $env
 * @return string[]
 */
function notify_addresses(array $routes, array $env, string $fallback): array
{
  $to = [];
  foreach ($routes as $route) {
    $list = env_list($env, 'NOTIFY_' . strtoupper($route));
    array_push($to, ...($list ?: [$fallback]));
  }
  return array_values(array_unique($to ?: [$fallback]));
}
