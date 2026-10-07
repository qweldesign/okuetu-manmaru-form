<?php
/**
 * .env ファイルの読み込み
 *
 * 外部ライブラリに頼らない最小限の実装。対応する書式:
 *   KEY=value                 クォートなし（行末の " #" 以降はコメント）
 *   KEY='value'               シングルクォート（そのままの文字列）
 *   KEY="value\n"             ダブルクォート（\n \t \" \\ を展開、複数行も可）
 *   export KEY=value          export は無視
 *   # comment                 コメント行
 */

/**
 * .env を読み込んで設定値の配列を返す
 *
 * @throws RuntimeException ファイルが読めない、または書式が不正な場合
 * @return array<string, string>
 */
function load_env(string $path): array
{
  if (!is_readable($path)) {
    throw new RuntimeException(".env を読み込めません: {$path}");
  }

  $text = str_replace(["\r\n", "\r"], "\n", file_get_contents($path));
  // UTF-8 の BOM を除去
  $text = preg_replace('/^\xEF\xBB\xBF/', '', $text);
  $lines = explode("\n", $text);
  $vars = [];

  for ($i = 0, $count = count($lines); $i < $count; $i++) {
    $line = trim($lines[$i]);
    if ($line === '' || $line[0] === '#') continue;

    if (!preg_match('/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/s', $line, $m)) {
      throw new RuntimeException('.env の書式が不正です（' . ($i + 1) . " 行目）");
    }
    [, $key, $raw] = $m;

    if ($raw !== '' && $raw[0] === '"') {
      // ダブルクォート: 閉じクォートが見つかるまで次の行を連結する
      $buffer = substr($raw, 1);
      $start = $i;
      while (!preg_match('/^((?:[^"\\\\]|\\\\.)*)"/s', $buffer, $q)) {
        if (++$i >= $count) {
          throw new RuntimeException('.env のクォートが閉じていません（' . ($start + 1) . " 行目）");
        }
        $buffer .= "\n" . $lines[$i];
      }
      $value = strtr($q[1], ['\\n' => "\n", '\\t' => "\t", '\\"' => '"', '\\\\' => '\\']);
    } elseif ($raw !== '' && $raw[0] === "'") {
      $end = strpos($raw, "'", 1);
      if ($end === false) {
        throw new RuntimeException('.env のクォートが閉じていません（' . ($i + 1) . " 行目）");
      }
      $value = substr($raw, 1, $end - 1);
    } else {
      $value = trim(preg_replace('/\s+#.*$/', '', $raw));
    }

    $vars[$key] = $value;
  }

  return $vars;
}

/**
 * 必須の設定値を取り出す。未設定または空ならエラー
 *
 * @param array<string, string> $env
 * @throws RuntimeException
 */
function env_required(array $env, string $key): string
{
  if (!isset($env[$key]) || $env[$key] === '') {
    throw new RuntimeException(".env に {$key} が設定されていません");
  }
  return $env[$key];
}

/**
 * カンマ区切りの設定値を配列で取り出す（前後の空白と空要素は除く）
 *
 * @param array<string, string> $env
 * @return string[]
 */
function env_list(array $env, string $key): array
{
  return array_values(array_filter(array_map('trim', explode(',', $env[$key] ?? '')), 'strlen'));
}
