# 請求書・領収書メーカー

同じ取引データから **請求書と領収書を同時に作成** できる、依存ゼロの静的PWAです。
入力データはすべて端末内（localStorage）に保存され、外部には一切送信しません。

- 出力: 「PDF出力」→ ブラウザの「PDFとして保存」
- 保存: 端末内に履歴保存（開く／複製／削除）
- 税率10%/8%/非課税・軽減税率表示・インボイス登録番号・収入印紙欄に対応

## ローカルで動かす

```sh
cd seikyu-ryosyo
python3 -m http.server 4180
# → ブラウザで http://localhost:4180
```

## テスト（計算ロジック）

```sh
osascript -l JavaScript test_engine.js
```

## ネットに無料公開する（GitHub Pages）

サーバー代・月額は不要。永続URLが手に入り、独自ドメインも後から設定できます。

1. GitHub でアカウントを作成（無料）
2. 新しいリポジトリを作成（例: `seikyu-ryosyo`、Public）
3. このフォルダを push する：
   ```sh
   git remote add origin https://github.com/<ユーザー名>/seikyu-ryosyo.git
   git branch -M main
   git push -u origin main
   ```
4. リポジトリの **Settings → Pages** を開く
5. **Source** を「Deploy from a branch」、Branch を **main / (root)** にして Save
6. 数分後、`https://<ユーザー名>.github.io/seikyu-ryosyo/` で公開される

### スマホでアプリとして使う
公開URLをスマホのブラウザで開き、
- iPhone(Safari): 共有 → 「ホーム画面に追加」
- Android(Chrome): メニュー → 「アプリをインストール」

これでアイコンから起動でき、オフラインでも動きます。

## 独自ドメイン・収益化（任意）

- 独自ドメイン: GitHub Pages の Settings → Pages → Custom domain に設定
- 広告(AdSense): 独自ドメイン + `privacy.html`（同梱済み）+ 審査が必要
- 有料機能(フリーミアム): 決済導入には別途サーバーが必要
