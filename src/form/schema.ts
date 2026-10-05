// フォーム定義。条件（show / required）は JSON で表現できる形にしてあり、
// PHP 側のサーバー検証でも同じ定義を読み込める想定。
import type { Condition, Option, Schema } from './types.ts';

const opts = (rows: [string, string, string?, string?][]): Option[] =>
  rows.map(([value, label, desc, badge]) => ({ value, label, ...(desc && { desc }), ...(badge && { badge }) }));

export const PREFS: Option[] = [
  '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県',
  '埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県',
  '岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県',
  '鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県',
  '佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県',
].map((p) => ({ value: p, label: p }));

// よく使う条件（目的は1つだけ選ぶ）
const hasRelocation: Condition = { field: 'purpose', equals: 'relocation' };
const hasWork: Condition = { field: 'purpose', equals: 'workstay' };
const hasHouse: Condition = { field: 'purpose', equals: 'house' };
const hasOther: Condition = { field: 'purpose', equals: 'other' };
const hasStay: Condition = { field: 'purpose', in: ['workstay', 'house'] };
const notOther: Condition = { not: hasOther };
const wantsPamphlet: Condition = { field: 'pamphlet', filled: true };
const stayFixed: Condition = { field: 'stay_plan', equals: 'fixed' };
const stayUndecided: Condition = { field: 'stay_plan', equals: 'undecided' };
const topic = (t: string): Condition => ({ field: 'support_topics', includes: t });

export const PURPOSES = opts([
  ['relocation', '移住・定住のご相談', '住まい、仕事、暮らしのことなど。まだ迷っている段階でも大丈夫です', 'オンライン相談も可'],
  ['workstay', 'ワークステイ', '地域に入り込んで、暮らしながら働く'],
  ['house', 'まんまるハウスの利用', '視察や相談、体験のための滞在'],
  ['other', 'ちょっとしたご質問・その他', 'ひとこと聞いてみたいこと、サイトへのご意見など。お気軽にどうぞ'],
]);

export const ROUTES: Record<string, string> = {
  relocation: '移住・定住相談の担当',
  workstay: 'ワークステイの担当',
  house: 'まんまるハウスの担当',
  other: 'サイト管理の担当',
};

export const SCHEMA: Schema = {
  steps: [
    {
      id: 'basic',
      short: '基本',
      title: 'ご連絡先とお問い合わせの目的',
      lead: 'ご家族やグループの場合は、代表の方についてご記入ください。選んだ目的に合わせて、次のページの質問が変わります。',
      fields: [
        { id: 'name', type: 'text', label: 'お名前', required: true, autoComplete: 'name' },
        {
          id: 'email', type: 'email', label: 'メールアドレス', required: true, autoComplete: 'email',
          hint: '受付確認のメールをお送りします。',
        },
        { id: 'tel', type: 'tel', label: '電話番号', autoComplete: 'tel' },
        {
          id: 'purpose', type: 'radio', variant: 'cards', label: 'お問い合わせの目的', required: true, options: PURPOSES,
          // 迷ったまま進んでも負担の軽い窓口に着くよう、手軽な目的を初期値にする（?type= で上書きできる）
          defaultValue: 'other',
        },
      ],
    },
    {
      id: 'relocation',
      short: '移住相談',
      title: '移住・定住のご相談',
      lead: '大野での暮らしを考えるにあたって、ご希望をお聞かせください。',
      show: hasRelocation,
      fields: [
        { id: 'age', type: 'number', label: 'ご年齢', unit: '歳', min: 0, max: 120, width: 'quarter' },
        { id: 'pref', type: 'select', label: 'お住まいの都道府県', options: PREFS, width: 'half' },
        {
          id: 'relocation_timing', type: 'select', label: '移住を希望される時期', width: 'half',
          options: opts([['within1', '1年以内'], ['1to3', '1〜3年以内'], ['over3', '3年以上先'], ['undecided', 'まだ決めていない']]),
        },
        {
          id: 'family', type: 'section', label: '移住を考えているご家族',
          fields: [
            {
              id: 'family_pattern', type: 'radio', label: '家族構成',
              options: opts([['single', 'おひとり'], ['couple', '夫婦のみ'], ['couple_child', '夫婦と子ども'], ['three_gen', '夫婦・親・子ども'], ['other', 'その他']]),
            },
            { id: 'family_children', type: 'number', label: 'お子さんの人数', unit: '人', min: 0, max: 15, width: 'quarter', show: { field: 'family_pattern', in: ['couple_child', 'three_gen'] } },
            { id: 'family_other', type: 'text', label: '家族構成の詳細', show: { field: 'family_pattern', equals: 'other' } },
          ],
        },
        {
          id: 'support_topics', type: 'checks', label: '希望するサポートの分野', required: true,
          hint: '選んだ分野ごとに、詳しい質問が下に表示されます。',
          options: opts([['housing', '住まい'], ['work', '仕事'], ['agri', '農業・林業'], ['exchange', '交流・体験・訪問'], ['life', '子育て・教育・福祉']]),
        },
        {
          id: 'sec_housing', type: 'section', label: '住まいについて', show: topic('housing'),
          fields: [
            {
              id: 'housing_plan', type: 'radio', label: '住まいの探し方', required: true,
              options: opts([['buy', '購入したい'], ['rent', '賃貸を希望'], ['rent_first', 'まずは賃貸、いずれ購入']]),
            },
            { id: 'buy_target', type: 'radio', label: '購入したいもの', show: { field: 'housing_plan', equals: 'buy' }, options: opts([['land', '土地のみ'], ['building', '建物のみ'], ['both', '土地と建物']]) },
            { id: 'buy_budget', type: 'range', label: '購入のご予算', unit: '万円', show: { field: 'housing_plan', equals: 'buy' } },
            { id: 'rent_type', type: 'radio', label: '賃貸の種類', show: { field: 'housing_plan', in: ['rent', 'rent_first'] }, options: opts([['house', '一戸建て'], ['apartment', 'アパート']]) },
            { id: 'rent_budget', type: 'range', label: '家賃のご予算（月額）', unit: '千円', show: { field: 'housing_plan', in: ['rent', 'rent_first'] } },
            { id: 'housing_subsidy', type: 'checkbox', label: '住宅取得の助成・支援制度について知りたい' },
          ],
        },
        {
          id: 'sec_work', type: 'section', label: '仕事について', show: topic('work'),
          fields: [
            {
              id: 'work_items', type: 'checks', label: '知りたいこと・探していること', required: true,
              options: opts([['seeking', '定職を探している'], ['status', '求人の状況を知りたい'], ['support', '就労の助成・支援制度を知りたい'], ['startup', '起業の助成・支援制度を知りたい']]),
            },
            {
              id: 'job_types', type: 'checks', label: '希望する職種', show: { field: 'work_items', includes: 'seeking' },
              options: opts([['office', '事務職'], ['farm', '農業'], ['forest', '林業'], ['manufacturing', '製造業'], ['civil', '土木業'], ['service', 'サービス業'], ['other', 'その他']]),
            },
            { id: 'job_other', type: 'text', label: 'その他の職種', show: { all: [{ field: 'work_items', includes: 'seeking' }, { field: 'job_types', includes: 'other' }] } },
          ],
        },
        {
          id: 'sec_agri', type: 'section', label: '農業・林業について', show: topic('agri'),
          fields: [
            {
              id: 'agri_style', type: 'checks', label: 'どのように関わりたいですか', required: true,
              options: opts([['full', '本格的に取り組みたい'], ['hobby', '余暇として楽しみたい'], ['trial', 'まずは体験してみたい']]),
            },
            { id: 'agri_full', type: 'radio', label: '本格的に取り組みたい分野', required: true, show: { field: 'agri_style', includes: 'full' }, options: opts([['farm', '農業'], ['forest', '林業'], ['both', '両方']]) },
            { id: 'agri_hobby', type: 'radio', label: '余暇として楽しみたい分野', required: true, show: { field: 'agri_style', includes: 'hobby' }, options: opts([['farm', '農業'], ['forest', '林業'], ['both', '両方']]) },
            { id: 'agri_trial', type: 'radio', label: '体験してみたい分野', required: true, show: { field: 'agri_style', includes: 'trial' }, options: opts([['farm', '農業'], ['forest', '林業'], ['both', '両方']]) },
          ],
        },
        {
          id: 'sec_exchange', type: 'section', label: '交流・体験・訪問について', show: topic('exchange'),
          fields: [
            {
              id: 'exchange_items', type: 'checks', label: '興味のあること', required: true,
              options: opts([['green', 'グリーンツーリズムを体験したい'], ['rural_life', '田舎暮らしを体験したい'], ['event', 'イベント情報を知りたい'], ['visit', '定住に向けて大野市を訪問したい'], ['sightseeing', '一度観光で訪れてみたい']]),
            },
            { id: 'visit_ym', type: 'month', label: '訪問を希望する時期', show: { field: 'exchange_items', includes: 'visit' }, width: 'half' },
          ],
        },
        {
          id: 'sec_life', type: 'section', label: '子育て・教育・福祉について', show: topic('life'),
          fields: [
            {
              id: 'life_items', type: 'checks', label: '知りたいこと', required: true,
              options: opts([['childcare', '子育て支援'], ['education', '教育'], ['welfare', '高齢者・社会福祉の支援'], ['other', 'その他の支援']]),
            },
            { id: 'life_other', type: 'text', label: 'その他の支援の内容', show: { field: 'life_items', includes: 'other' } },
          ],
        },
        {
          id: 'sec_online', type: 'section', label: 'オンライン移住相談',
          fields: [
            { id: 'online_consult', type: 'radio', label: 'オンラインでの相談を希望しますか', required: true, options: opts([['yes', '希望する'], ['no', '希望しない']]) },
            {
              id: 'online_slots', type: 'repeater', label: 'ご都合のよい日時', show: { field: 'online_consult', equals: 'yes' },
              min: 1, max: 3, rowLabel: '候補', addLabel: '候補日時を追加',
              hint: '現在はGoogle Meetのみで実施しています。候補を複数いただけると調整がスムーズです。',
              fields: [{ id: 'dt', type: 'datetime-local', label: '日時', required: true }],
            },
          ],
        },
        {
          id: 'relocation_note', type: 'textarea', label: '関心を持ったきっかけや、不安なこと、移住後にしてみたいことなど',
          hint: '大野市に興味を持った理由など、自由にお書きください。',
        },
      ],
    },
    {
      id: 'stay',
      short: '滞在',
      title: 'ワークステイ・まんまるハウスのご利用',
      lead: '滞在のご希望日程と、一緒に来られる方について教えてください。',
      show: hasStay,
      rules: [{ type: 'dateOrder', from: 'stay_from', to: 'stay_to', message: '終了日は開始日より後の日付にしてください' }],
      fields: [
        {
          id: 'stay_plan', type: 'radio', label: '滞在の日程', required: true,
          options: opts([['fixed', '希望日が決まっている'], ['undecided', 'まだ決まっていない']]),
        },
        { id: 'stay_from', type: 'date', label: '滞在開始の希望日', required: true, width: 'half', show: stayFixed },
        { id: 'stay_to', type: 'date', label: '滞在終了の希望日', required: true, width: 'half', show: stayFixed },
        {
          id: 'stay_rough', type: 'text', label: 'おおよその時期や期間', show: stayUndecided,
          hint: '「来年の春ごろ、1週間くらい」など、わかる範囲で構いません。',
        },
        {
          id: 'workstay_jobs', type: 'checks', label: '体験したい仕事', show: hasWork, required: hasWork,
          hint: '複数選べます。',
          options: opts([['farming', '農業'], ['forestry', '林業'], ['instructor', '体験インストラクター']]),
        },
        {
          id: 'house_purpose', type: 'checks', label: 'まんまるハウスの利用目的', show: hasHouse, required: hasHouse,
          options: opts([['inspection', '現地視察・相談'], ['workstay', 'ワークステイ'], ['ecotour', 'エコツアー'], ['other', 'その他']]),
        },
        {
          id: 'companions', type: 'repeater', label: '参加される方', min: 1, max: 8,
          rowLabel: '参加者', firstRowLabel: '代表者', addLabel: '参加者を追加',
          firstRow: { relation: 'self' }, firstRowFrom: { name: 'name' },
          hint: '1人目は代表者の方です。一緒に来られる方がいれば追加してください。',
          fields: [
            { id: 'name', type: 'text', label: 'お名前', required: true },
            { id: 'kana', type: 'text', label: 'ふりがな', required: true },
            {
              id: 'relation', type: 'select', label: '代表者との関係', required: true,
              options: opts([['self', '本人'], ['spouse', '配偶者'], ['child', '子'], ['parent', '親'], ['sibling', '兄弟姉妹'], ['friend', '友人・知人'], ['other', 'その他']]),
            },
            { id: 'birthdate', type: 'birthdate', label: '生年月日', required: true, hint: '数字8桁で入力すると、自動で区切ります' },
          ],
        },
        { id: 'stay_note', type: 'textarea', label: 'ご希望やご質問', rows: 4 },
      ],
    },
    {
      id: 'other',
      short: '内容',
      title: 'ご質問・ご意見の内容',
      lead: '気になっていることを、気軽にお書きください。',
      show: hasOther,
      fields: [
        { id: 'subject', type: 'text', label: '件名' },
        { id: 'message', type: 'textarea', label: '内容', required: true, rows: 6 },
      ],
    },
    {
      id: 'final',
      short: '同意',
      title: '最後に',
      lead: 'あと少しで完了です。資料の郵送のご希望と、個人情報の取り扱いをご確認ください。',
      fields: [
        {
          id: 'how_known', type: 'checks', label: '大野市やこのサイトを知ったきっかけ', show: notOther,
          options: opts([['web', '市や県のWebサイト'], ['fair', '移住フェア・相談会'], ['sns', 'SNS'], ['friend', '知人・家族から'], ['media', '新聞・雑誌・テレビ'], ['visited', '観光で訪れた'], ['other', 'その他']]),
        },
        { id: 'how_known_other', type: 'text', label: 'その他のきっかけ', show: { all: [notOther, { field: 'how_known', includes: 'other' }] } },
        {
          id: 'sec_pamphlet', type: 'section', label: '資料の郵送',
          fields: [
            { id: 'pamphlet', type: 'checkbox', label: '観光パンフレットなどの資料を、郵送で受け取りたい' },
            {
              id: 'pamphlet_address', type: 'text', label: '郵送先の住所', show: wantsPamphlet, required: wantsPamphlet,
              autoComplete: 'street-address', hint: '郵便番号と、都道府県からご記入ください。',
            },
          ],
        },
        {
          id: 'privacy_note', type: 'note',
          text: 'ご記入いただいたお名前・ご住所などの個人情報は、取り扱いに十分注意するとともに、大野市における定住・交流事業に関すること以外には使用しません。',
        },
        { id: 'consent_privacy', type: 'checkbox', label: '上記の個人情報の取り扱いに同意します', required: true, requiredMessage: '同意いただけない場合は送信できません' },
        {
          id: 'consent_insurance', type: 'checkbox', show: hasWork, required: hasWork, requiredMessage: 'ワークステイには保険加入が必要なため、同意が必要です',
          label: 'ワークステイ中の保険加入のため、参加者全員の氏名と生年月日を保険会社へ提供することに同意します（同行者の方の同意も得ています）',
        },
      ],
    },
  ],
};
