<?php
declare(strict_types=1);

/**
 * フォーム定義（schema.json）を解釈するクラス
 *
 * フロントエンドの src/form/engine.ts と同じ考え方で動く。
 * - 表示条件・必須条件の評価
 * - 非表示の項目を取り除いた「有効な値」の算出
 * - 入力チェック
 * - メール本文用の整形
 */
final class Form
{
  /** 1項目あたりの最大文字数 */
  private const MAX_LENGTH = ['textarea' => 4000, 'default' => 200];

  /** @var array<string, mixed> */
  private array $schema;

  /** @var array<string, array<string, mixed>> id → 項目定義（セクション内も含む） */
  private array $fields = [];

  /** @param array<string, mixed> $schema */
  public function __construct(array $schema)
  {
    $this->schema = $schema;
    foreach ($schema['steps'] as $step) {
      $this->indexFields($step['fields']);
    }
  }

  public static function fromFile(string $path): self
  {
    $json = is_readable($path) ? file_get_contents($path) : false;
    $schema = $json === false ? null : json_decode($json, true);
    if (!is_array($schema) || !isset($schema['steps'])) {
      throw new RuntimeException("フォーム定義を読み込めません: {$path}");
    }
    return new self($schema);
  }

  // ---- 入力値の整形 -------------------------------------------------------

  /**
   * 送信された値を、定義にある項目だけ・正しい型だけに絞る
   *
   * @param array<string, mixed> $data
   * @return array<string, mixed>
   * @throws InvalidArgumentException 型や選択肢が不正な場合
   */
  public function sanitize(array $data): array
  {
    $out = [];
    foreach ($this->fields as $id => $f) {
      if (!array_key_exists($id, $data)) continue;
      $out[$id] = $this->sanitizeValue($f, $data[$id], $id);
    }
    return $out;
  }

  /** @param array<string, mixed> $f */
  private function sanitizeValue(array $f, $v, string $path)
  {
    switch ($f['type']) {
      case 'checkbox':
        if (!is_bool($v)) $this->invalid($path);
        return $v;

      case 'checks':
        if (!is_array($v) || !self::isList($v)) $this->invalid($path);
        $allowed = array_column($f['options'], 'value');
        foreach ($v as $x) {
          if (!is_string($x) || !in_array($x, $allowed, true)) $this->invalid($path);
        }
        return array_values(array_unique($v));

      case 'range':
        if (!is_array($v)) $this->invalid($path);
        return [
          'min' => $this->sanitizeString(['type' => 'text'], $v['min'] ?? '', $path),
          'max' => $this->sanitizeString(['type' => 'text'], $v['max'] ?? '', $path),
        ];

      case 'repeater':
        if (!is_array($v) || !self::isList($v) || count($v) > ($f['max'] ?? 99)) $this->invalid($path);
        $rows = [];
        foreach ($v as $i => $row) {
          if (!is_array($row)) $this->invalid($path);
          $clean = [];
          foreach ($f['fields'] as $sf) {
            if (array_key_exists($sf['id'], $row)) {
              $clean[$sf['id']] = $this->sanitizeString($sf, $row[$sf['id']], "{$path}.{$i}.{$sf['id']}");
            }
          }
          $rows[] = $clean;
        }
        return $rows;

      default:
        return $this->sanitizeString($f, $v, $path);
    }
  }

  /** @param array<string, mixed> $f */
  private function sanitizeString(array $f, $v, string $path): string
  {
    if (!is_string($v)) $this->invalid($path);
    // 制御文字（改行・タブ以外）を取り除く
    $v = preg_replace('/[^\P{C}\n\t]/u', '', $v) ?? '';
    if ($f['type'] !== 'textarea') $v = str_replace(["\n", "\t"], ' ', $v);
    $max = self::MAX_LENGTH[$f['type']] ?? self::MAX_LENGTH['default'];
    if (mb_strlen($v) > $max) $this->invalid($path);
    if (isset($f['options']) && $v !== '' && !in_array($v, array_column($f['options'], 'value'), true)) {
      $this->invalid($path);
    }
    return $v;
  }

  /** @return never */
  private function invalid(string $path)
  {
    throw new InvalidArgumentException("不正な値: {$path}");
  }

  // ---- 条件の評価 -------------------------------------------------------

  /**
   * @param array<string, mixed>|null $c
   * @param array<string, mixed> $v
   */
  public static function evalCond(?array $c, array $v): bool
  {
    if ($c === null) return true;
    if (isset($c['all'])) {
      foreach ($c['all'] as $x) if (!self::evalCond($x, $v)) return false;
      return true;
    }
    if (isset($c['any'])) {
      foreach ($c['any'] as $x) if (self::evalCond($x, $v)) return true;
      return false;
    }
    if (isset($c['not'])) return !self::evalCond($c['not'], $v);

    $val = $v[$c['field']] ?? null;
    if (array_key_exists('includes', $c)) return is_array($val) && in_array($c['includes'], $val, true);
    if (array_key_exists('only', $c)) return is_array($val) && count($val) === 1 && ($val[0] ?? null) === $c['only'];
    if (array_key_exists('equals', $c)) return $val === $c['equals'];
    if (array_key_exists('in', $c)) return is_string($val) && in_array($val, $c['in'], true);
    if (array_key_exists('filled', $c)) return self::isFilled($val) === $c['filled'];
    return true;
  }

  public static function isFilled($v): bool
  {
    if ($v === null) return false;
    if (is_bool($v)) return $v;
    if (is_array($v)) {
      if (self::isList($v)) return count($v) > 0;
      foreach ($v as $x) if (trim((string) $x) !== '') return true; // 範囲（min / max）
      return false;
    }
    return trim((string) $v) !== '';
  }

  /** @param array<string, mixed> $f */
  public static function isRequired(array $f, array $eff): bool
  {
    $r = $f['required'] ?? false;
    return $r === true || (is_array($r) && self::evalCond($r, $eff));
  }

  /**
   * 非表示の項目を取り除いた「有効な値」。src/form/engine.ts の effectiveValues と同じ
   *
   * @param array<string, mixed> $values
   * @return array<string, mixed>
   */
  public function effective(array $values): array
  {
    $eff = $values;
    for ($i = 0; $i < 8; $i++) {
      $visible = [];
      $hidden = [];
      foreach ($this->schema['steps'] as $step) {
        $this->walk($step['fields'], $eff, self::evalCond($step['show'] ?? null, $eff), function ($f, $vis) use (&$visible, &$hidden) {
          if ($vis) $visible[$f['id']] = true;
          else $hidden[$f['id']] = true;
        });
      }
      $next = $values;
      foreach (array_keys($hidden) as $id) if (!isset($visible[$id])) unset($next[$id]);
      $same = array_keys($next) == array_keys($eff);
      $eff = $next;
      if ($same) break;
    }
    return $eff;
  }

  // ---- 入力チェック -------------------------------------------------------

  /**
   * 表示中の項目を検証し、エラーを返す（キーはフロントエンドと同じ形式）
   *
   * @param array<string, mixed> $eff
   * @return array<string, string>
   */
  public function validate(array $eff): array
  {
    $errors = [];
    foreach ($this->visibleSteps($eff) as $step) {
      $this->validateFields($step['fields'], $eff, $errors);
      foreach ($step['rules'] ?? [] as $r) {
        if ($r['type'] === 'oneOf') {
          $any = false;
          foreach ($r['fields'] as $id) if (self::isFilled($eff[$id] ?? null)) $any = true;
          if (!$any) foreach ($r['fields'] as $id) $errors[$id] = $errors[$id] ?? $r['message'];
        }
        if ($r['type'] === 'dateOrder') {
          $a = $eff[$r['from']] ?? '';
          $b = $eff[$r['to']] ?? '';
          if ($a !== '' && $b !== '' && $a > $b && !isset($errors[$r['to']])) $errors[$r['to']] = $r['message'];
        }
      }
    }
    return $errors;
  }

  /** @param array<int, array<string, mixed>> $fields */
  private function validateFields(array $fields, array $eff, array &$errors): void
  {
    foreach ($fields as $f) {
      if (!self::evalCond($f['show'] ?? null, $eff) || $f['type'] === 'note') continue;
      if ($f['type'] === 'section') {
        $this->validateFields($f['fields'], $eff, $errors);
        continue;
      }
      if ($f['type'] === 'repeater') {
        $rows = $eff[$f['id']] ?? [];
        foreach ($rows as $i => $row) {
          foreach ($f['fields'] as $sf) {
            if (!self::evalCond($sf['show'] ?? null, $eff)) continue;
            $e = $this->checkValue($sf, $row[$sf['id']] ?? null, $eff);
            if ($e !== null) $errors["{$f['id']}.{$i}.{$sf['id']}"] = $e;
          }
        }
        $min = $f['min'] ?? 0;
        if (count($rows) < $min) $errors[$f['id']] = "{$min}件以上入力してください";
        continue;
      }
      $e = $this->checkValue($f, $eff[$f['id']] ?? null, $eff);
      if ($e !== null) $errors[$f['id']] = $e;
    }
  }

  /** @param array<string, mixed> $f */
  private function checkValue(array $f, $v, array $eff): ?string
  {
    if (!self::isFilled($v)) {
      if (!self::isRequired($f, $eff)) return null;
      if (!empty($f['requiredMessage'])) return $f['requiredMessage'];
      if (in_array($f['type'], ['checks', 'radio', 'select'], true)) return '選択してください';
      if ($f['type'] === 'checkbox') return 'チェックしてください';
      return '入力してください';
    }
    $s = is_string($v) ? $v : '';
    switch ($f['type']) {
      case 'email':
        if (!filter_var($s, FILTER_VALIDATE_EMAIL)) return 'メールアドレスの形式を確認してください';
        break;
      case 'tel':
        if (!preg_match('/^[0-9０-９\-－ー+()（） ]{10,}$/u', $s)) return '電話番号を確認してください（例：0779-67-1117）';
        break;
      case 'number':
        if (!is_numeric($s)) return '数字で入力してください';
        if (isset($f['min']) && (float) $s < $f['min']) return "{$f['min']}以上で入力してください";
        if (isset($f['max']) && (float) $s > $f['max']) return "{$f['max']}以下で入力してください";
        break;
      case 'range':
        foreach (['min', 'max'] as $k) if ($v[$k] !== '' && !is_numeric($v[$k])) return '数字で入力してください';
        if ($v['min'] !== '' && $v['max'] !== '' && (float) $v['min'] > (float) $v['max']) return '下限が上限より大きくなっています';
        break;
      case 'birthdate':
        if (!preg_match('#^(\d{4})/(\d{2})/(\d{2})$#', $s, $m)) return '8桁の数字で入力してください（例：19900501）';
        if (!checkdate((int) $m[2], (int) $m[3], (int) $m[1]) || "{$m[1]}-{$m[2]}-{$m[3]}" > date('Y-m-d')) return '日付を確認してください';
        break;
      case 'date':
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) return '日付を確認してください';
        break;
      case 'month':
        if (!preg_match('/^\d{4}-\d{2}$/', $s)) return '年月を確認してください';
        break;
      case 'datetime-local':
        if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/', $s)) return '日時を確認してください';
        break;
    }
    return null;
  }

  // ---- 表示・メール用 -------------------------------------------------------

  /**
   * 表示中のステップ
   *
   * @return array<int, array<string, mixed>>
   */
  public function visibleSteps(array $eff): array
  {
    return array_values(array_filter($this->schema['steps'], fn ($s) => self::evalCond($s['show'] ?? null, $eff)));
  }

  /**
   * 通知先の担当（ルート名）。src/form/schema.ts の routesFor と同じ規則
   *
   * @return string[]
   */
  public function routes(array $eff): array
  {
    $routes = [];
    foreach ($this->schema['routeRules'] ?? [] as $r) {
      if (self::evalCond($r['when'], $eff)) $routes[] = $r['route'];
    }
    return $routes;
  }

  public function routeLabel(string $route): string
  {
    return $this->schema['routes'][$route] ?? $route;
  }

  /** 選択肢の値を表示名に変える（例：purpose の 'workstay' → '越前大野でワークステイ'） */
  public function optionLabel(string $fieldId, string $value): string
  {
    foreach ($this->fields[$fieldId]['options'] ?? [] as $o) {
      if ($o['value'] === $value) return $o['label'];
    }
    return $value;
  }

  /**
   * 入力内容を、ステップごとの見出しと「項目：値」の行に整形する
   */
  public function toText(array $eff): string
  {
    $blocks = [];
    foreach ($this->visibleSteps($eff) as $step) {
      $lines = $this->summarize($step['fields'], $eff, '');
      if ($lines) $blocks[] = "■ {$step['title']}\n" . implode("\n", $lines);
    }
    return implode("\n\n", $blocks);
  }

  /** @return string[] */
  private function summarize(array $fields, array $eff, string $indent): array
  {
    $out = [];
    foreach ($fields as $f) {
      if (!self::evalCond($f['show'] ?? null, $eff) || $f['type'] === 'note') continue;
      if ($f['type'] === 'section') {
        $inner = $this->summarize($f['fields'], $eff, $indent . '  ');
        if ($inner) {
          $out[] = "{$indent}［{$f['label']}］";
          array_push($out, ...$inner);
        }
        continue;
      }
      if ($f['type'] === 'repeater') {
        foreach ($eff[$f['id']] ?? [] as $i => $row) {
          $parts = [];
          foreach ($f['fields'] as $sf) {
            if (self::evalCond($sf['show'] ?? null, $eff) && self::isFilled($row[$sf['id']] ?? null)) {
              $parts[] = "{$sf['label']}：" . $this->formatValue($sf, $row[$sf['id']]);
            }
          }
          if ($parts) $out[] = $indent . "{$f['rowLabel']} " . ($i + 1) . '：' . implode(' ／ ', $parts);
        }
        continue;
      }
      $v = $eff[$f['id']] ?? null;
      if (!self::isFilled($v)) continue;
      $text = $this->formatValue($f, $v);
      // 複数行の入力は、2行目以降を字下げしてそろえる
      $out[] = $f['type'] === 'textarea'
        ? "{$indent}{$f['label']}：\n" . preg_replace('/^/m', "{$indent}  ", $text)
        : "{$indent}{$f['label']}：{$text}";
    }
    return $out;
  }

  /** @param array<string, mixed> $f */
  private function formatValue(array $f, $v): string
  {
    $label = function (string $x) use ($f): string {
      foreach ($f['options'] ?? [] as $o) if ($o['value'] === $x) return $o['label'];
      return $x;
    };
    switch ($f['type']) {
      case 'checks':
        return implode('、', array_map($label, $v));
      case 'radio':
      case 'select':
        return $label($v);
      case 'checkbox':
        return 'はい';
      case 'range':
        return ($v['min'] !== '' ? $v['min'] : '（指定なし）') . ' 〜 ' . ($v['max'] !== '' ? $v['max'] : '（指定なし）') . " {$f['unit']}";
      case 'number':
        return $v . ($f['unit'] ?? '');
      case 'birthdate':
        [$y, $m, $d] = array_pad(explode('/', $v), 3, '');
        return $d !== '' ? sprintf('%s年%d月%d日', $y, (int) $m, (int) $d) : $v;
      case 'date':
        [$y, $m, $d] = array_pad(explode('-', $v), 3, '');
        return sprintf('%s年%d月%d日', $y, (int) $m, (int) $d);
      case 'month':
        [$y, $m] = array_pad(explode('-', $v), 2, '');
        return sprintf('%s年%d月', $y, (int) $m);
      case 'datetime-local':
        [$date, $time] = array_pad(explode('T', $v), 2, '');
        [$y, $m, $d] = array_pad(explode('-', $date), 3, '');
        return sprintf('%s年%d月%d日 %s', $y, (int) $m, (int) $d, $time);
      default:
        return (string) $v;
    }
  }

  // ---- 内部 -------------------------------------------------------

  private function indexFields(array $fields): void
  {
    foreach ($fields as $f) {
      if ($f['type'] === 'section') {
        $this->indexFields($f['fields']);
      } elseif ($f['type'] !== 'note' && !isset($this->fields[$f['id']])) {
        $this->fields[$f['id']] = $f;
      }
    }
  }

  private function walk(array $fields, array $eff, bool $parentVisible, callable $cb): void
  {
    foreach ($fields as $f) {
      $vis = $parentVisible && self::evalCond($f['show'] ?? null, $eff);
      $cb($f, $vis);
      if ($f['type'] === 'section') $this->walk($f['fields'], $eff, $vis, $cb);
    }
  }

  private static function isList(array $a): bool
  {
    return $a === [] || array_keys($a) === range(0, count($a) - 1);
  }
}
