## 奥越前まんまるサイト お問い合わせフォーム

- [奥越前まんまるサイト](https://okuetu-manmaru.com/) の窓口 (移住・定住相談／ワークステイ／まんまるハウス／その他) を一本化した、ステップ形式のお問い合わせフォーム
- 独立したページとして単体で動作
- 選んだ目的と回答に応じて、表示するステップと質問が切り替わる

### 開発

```bash
npm install
cd api && composer install && cp .env.example .env && cd ..   # 初回のみ。.env を開発用に書き換える

npm run dev:api  # PHP の開発サーバー (http://localhost:8000/)
npm run dev      # http://localhost:5173/ (別のターミナルで。/api は PHP の開発サーバーへ中継される)
npm run build    # フォーム定義を api/schema.json に書き出してから dist/ にビルド
npm run lint
```

開発用の `api/.env` では、`ALLOWED_ORIGINS="http://localhost:5173"` を設定する (送信元チェックで弾かれないように) 。

`?type=relocation` / `workstay` / `house` / `other` を付けて開くと、その目的を選んだ状態で始まる。  
指定がない場合は「ちょっとしたご質問・その他」が選ばれる。

入力チェックは `src/form/config.ts` の `ENABLE_VALIDATION` で切り替える。  
画面と分岐の確認を優先するため、現在は `false` (チェックなし) 。本番前に `true` に戻すこと。

開発サーバーでは、完了画面に送信データ (JSON) と通知先を表示する。

### 送信 (api/)

`api/send.php` が送信データを受け取り、担当宛の通知メールと、お問い合わせいただいた方への自動返信を送る。

- 設定はすべて `api/.env` に書く (各項目の説明は `api/.env.example`) 。担当ごとの通知先も `NOTIFY_RELOCATION` などで分けられる
- フォーム定義は `npm run schema` (ビルド時は自動) で `api/schema.json` に書き出し、PHP 側も同じ定義で項目を整形・検証する。定義にない項目は捨てる
- 入力チェックに通らなければ 422 と項目ごとのエラーを返し、画面は該当するステップに戻ってエラーを示す
- メール本文は、確認画面と同じ見出し・表示名で組み立てる

### 公開

`npm run build` で作られた `dist/` の中身と、`api/` (`vendor/` と `.env` を含む) を、サーバーの同じディレクトリに置く。  
アップロード後、ブラウザで `api/.env` を開いて 403 になることを確認する。

### 構成

```
src/
├── form/
│   ├── types.ts       項目・条件・値の型
│   ├── schema.ts      フォーム定義 (ステップ、項目、表示／必須条件) 
│   ├── engine.ts      条件評価・検証・確認画面用の整形 (React 非依存) 
│   ├── submit.ts      送信処理 (api/send.php へ POST) 
│   ├── config.ts      入力チェックの有効・無効
│   ├── utils.ts       クラス名の結合、id の生成、生年月日の自動整形
│   └── styles.ts      画面間で共通のクラス
├── components/
│   ├── Control.tsx    入力項目 (テキスト、選択、チェック、範囲など) 
│   ├── Repeater.tsx   行を追加できる項目 (参加者、候補日時) 
│   ├── FieldList.tsx  項目の並び・見出しのまとまり
│   ├── Progress.tsx   進み具合
│   ├── Review.tsx     確認画面
│   └── Done.tsx       完了画面
├── App.tsx            ステップの進行と検証
└── index.css          Tailwind とテーマの色・書体 (ダークモード対応) 
api/
├── send.php           送信の受け口 (送信元チェック、整形、検証、メール送信)
├── schema.json        フォーム定義 (src/form/schema.ts から生成)
├── lib/
│   ├── Form.php       フォーム定義の解釈 (engine.ts の PHP 版)
│   ├── mail.php       PHPMailer の準備と通知先の決定
│   └── env.php        .env の読み込み
└── .env.example       設定の見本
scripts/
└── export-schema.mjs  フォーム定義を api/schema.json に書き出す
```

質問の追加や変更は、基本的に `schema.ts` だけで完結する。  
表示条件・必須条件は `{ field: 'purpose', equals: 'workstay' }` のような JSON で書くため、サーバー側の検証でも同じ定義を読み込める。

---

## ライセンス | License

MIT License

詳しくは LICENSE ファイルをご覧ください。  
See the LICENSE file for details.  

---

## 制作者 | Author

[QWEL.DESIGN](https://qwel.design)  
福井を拠点に活動するフロントエンド開発者  
Front-end developer based in Fukui, Japan  
