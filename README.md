# とちぎ外国人雇用ニュース便

外国人雇用・留学生のニュース（全国と栃木県）を3時間ごとに自動更新する Web ページです。GitHub Pages で無料公開できます。

## 公開手順

1. GitHub で public リポジトリを新規作成する（例: `ryugakusei-news`）
2. このフォルダで次を実行する

   ```
   git init -b main
   git add .
   git commit -m "初回公開"
   git remote add origin https://github.com/<ユーザー名>/ryugakusei-news.git
   git push -u origin main
   ```

3. リポジトリの Settings > Pages で Source を `Deploy from a branch`、Branch を `main` / `(root)` にする
4. Actions タブの「ニュース更新」を開き、Run workflow で動作を確認する

公開先は `https://<ユーザー名>.github.io/ryugakusei-news/` です。

## 変更方法

検索語とカテゴリは `scripts/fetch-news.mjs` の `FEEDS` で変更します。手元での更新は `node scripts/fetch-news.mjs` です。
