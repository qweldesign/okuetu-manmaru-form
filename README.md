## 奥越前まんまるサイト お問い合わせフォーム

- [奥越前まんまるサイト](https://okuetu-manmaru.com/) の窓口 (移住・定住相談／ワークステイ／まんまるハウス／その他) を一本化した、ステップ形式のお問い合わせフォームのプロトタイプ
- 独立したページとして単体で動作
- 選んだ目的と回答に応じて、表示するステップと質問が切り替わる

### 開発

```bash
npm install
npm run dev      # http://localhost:5173/
npm run build
npm run lint
```

`?type=relocation` / `workstay` / `house` / `other` を付けて開くと、その目的を選んだ状態で始まる。  
指定がない場合は「ちょっとしたご質問・その他」が選ばれる。

入力チェックは `src/form/config.ts` の `ENABLE_VALIDATION` で切り替える。  
画面と分岐の確認を優先するため、現在は `false` (チェックなし) 。本番前に `true` に戻すこと。

プロトタイプのため、送信はシミュレートのみ (`src/form/submit.ts`) 。  
開発サーバーでは、完了画面に送信データ (JSON) と通知先を表示する。

### 構成

```
src/
├── form/
│   ├── types.ts       項目・条件・値の型
│   ├── schema.ts      フォーム定義 (ステップ、項目、表示／必須条件) 
│   ├── engine.ts      条件評価・検証・確認画面用の整形 (React 非依存) 
│   ├── submit.ts      送信処理 (現在はシミュレート) 
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
