<!--
Qiita タグ案: Azure / AppService / StaticWebApps / GitHubActions / トラブルシューティング
シリーズ第3回
-->

# Azure初デプロイで詰まった10のこと（結婚式クイズアプリをAzureに載せた話 3）

「結婚式クイズアプリをAzureに載せた話」の第3回です。
第1回の構成（Static Web Apps + App Service + GitHub Actions）を実際に組む過程で、10箇所で手が止まりました。
どれも致命傷ではないのですが、事前に知っていれば合計数時間は節約できたはずです…
同じ構成を組む方のために、症状と原因と対処をまとめておきます。

前提として、デプロイの方式はこうです。

- backend: GitHub Actions でテスト → ビルド → zipデプロイ（`azure/webapps-deploy@v3`）
- frontend: GitHub Actions で `Azure/static-web-apps-deploy@v1`
- mainへのpushでdev環境に自動デプロイ、本番はworkflow_dispatchと承認ゲート

## 1. Japan EastでApp Serviceが作れない

作成の最終確認まで進んでから、このエラーで弾かれました。

```
Operation cannot be completed without additional quota.
Current Limit (Total VMs): 0
Amount required for this deployment (Total VMs): 1
```

新しめの個人サブスクリプションだと、人気リージョンのVMクォータが0になっていることがあるようです。
無料のF1でも対象です。
クォータ引き上げのサポートリクエストは無料プランでも出せますが、数時間〜1営業日かかります。
リージョンをJapan Westに変えたら、そのまま通りました。

## 2. 価格プランのデフォルトがPremium

App Service作成ウィザードの価格プランは、既定でPremium V3が選択されています。
そのまま作ると月1万円前後かかります。自腹には死活問題です。
「価格プランを確認する」から明示的にFree F1を選ぶ必要があります。

さらに罠なのが、作成途中でリージョンを変えるとApp Serviceプランが作り直しになり、**価格プランの選択もPremiumに戻る**ことです。
1の対処でリージョンを変えた直後が、いちばん危なかったです。
「見積もり価格 - 無料」の表示を確認画面で見てから作成ボタンを押す、を習慣にしました。

## 3. 基本認証がデフォルト無効で、発行プロファイルが使えない

`azure/webapps-deploy` を発行プロファイル認証で使う場合、App ServiceのSCM基本認証が必要です。
新規作成したApp Serviceはこれが既定で無効になっていて、そのままだと発行プロファイルのダウンロードもデプロイも失敗します。
作成ウィザードの「デプロイ」タブに基本認証の有効/無効があるので、作成時に有効にしておくのが楽です。

なお、これはあくまで暫定で、最終的にはOIDC認証に切り替えて基本認証を無効に戻しました（第4回で書きます）。

## 4. WebSocketの設定トグルが見つからない

Socket.ioを使うので「App ServiceでWebSocketを有効化する」手順を探したのですが、Linux App Serviceの設定画面にそのトグルは存在しません。
存在しないのが正解で、**LinuxのApp ServiceではWebSocketは常時有効**、無効化もできません。
あのトグルはWindows App Service専用の設定なんですね。
ネット上の手順記事はWindows前提のものが多く、存在しないトグルをずっと探して時間を溶かしました…

## 5. Node 20がランタイムの選択肢にない

作成ウィザードのランタイムスタックにNode 20 LTSがなく、22 LTSと24 LTSだけが並んでいました。
Node 20は2026年4月でEOLになったため、新規作成の選択肢から外されたようです。
22 LTSを選び、合わせてGitHub Actionsの `node-version` も20から22に更新しました。
CIとランタイムのNodeメジャーバージョンがずれていると、「CIでは通るのに本番で動かない」系の問題を切り分けるときに疑う箇所が増えてしまうので。

## 6. staticwebapp.config.json がリポジトリ直下だと読まれない

Static Web Appsの設定ファイル（SPAフォールバック、セキュリティヘッダなど）をリポジトリ直下に置いていたのですが、これは**無視されます**。
このファイルは、ワークフローで指定する `app_location`（今回は `src/frontend`）の配下に置く必要があります。

たちが悪いのは、無視されてもデプロイ自体は成功することです。
SPAのディープリンクが404になって初めて気付きました。
設定が効いているかどうかは、レスポンスヘッダに自分で書いたCSPが出ているかで確認できます。

## 7. ビルド時の環境変数（VITE_API_URL）を注入し忘れる

フロントとAPIが別オリジンなので、フロントはビルド時にAPIのURLを埋め込む必要があります。
Viteの環境変数はビルド時に確定するので、ワークフローのビルドステップに `env` で渡します。

```yaml
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          # ...
        env:
          VITE_API_URL: ${{ vars.VITE_API_URL }}
```

これを忘れると、ビルドは成功し、デプロイも成功し、APIへのリクエストだけが全部失敗するSPAができあがります。
値はGitHub Environmentsの環境変数（dev/prodで別の値）から取っています。

## 8. デプロイzipの構造が起動コマンドと合っていない

backendのzipデプロイは、App Serviceが `wwwroot` にzipを展開してから起動コマンド（`npm start`）を実行します。
つまり、**zipのルート直下に package.json と node_modules がある構造**でなければなりません。
リポジトリのディレクトリ構成（`src/backend/...`）のままzipを作ると、`wwwroot/backend/package.json` のような配置になって起動に失敗します。

```yaml
      # src/backend をカレントにして、zipのルート直下に成果物を置く
      - name: Create deployment package
        run: zip -r ../../deploy-package.zip dist/ node_modules/ package.json
```

私の場合、ワークフローに元からあったzip作成ステップが `cd` とworking-directoryの組み合わせを誤っていて、パス自体が存在せず失敗しました。
このワークフロー、書かれてから一度も実行されたことがなく、初回実行がそのまま初デバッグになったんですよね。
「書いてあるけど動かしたことのないCI」は動かない前提で見たほうがいいです。

## 9. publish-profile認証ではstartup-commandが指定できない

`azure/webapps-deploy@v3` に起動コマンドを渡したら、デプロイがこのエラーで拒否されました。

```
Deployment Failed, Error: startup-command is not a valid input for Windows web app
or with publish-profile auth scheme.
```

発行プロファイル認証はデプロイの権限しか持っておらず、サイト構成の変更（起動コマンドの設定）ができません。
起動コマンドはポータルの「構成 → 全般設定 → スタートアップ コマンド」で設定して、ワークフローからは外しました。
OIDC認証（az login経由）に切り替えれば指定できるようになりますが、ポータル側の設定は一度入れれば残るので、結局そのままにしています。

## 10. 別オリジンのAPIをCSPが塞ぐ

フロント側で配信しているCSPの `connect-src` が `'self'` 前提のままだと、別オリジンのApp ServiceへのfetchとSocket.ioのポーリングがブラウザにブロックされます。
`connect-src` にバックエンドのオリジン（httpsとwss）を、画像を返すなら `img-src` にも同じオリジンを追加する必要があります。

なお、CSPを直しても画像だけが表示されない問題が残りました。
これは別の原因（Cross-Origin-Resource-Policy）で、1本の記事になる分量なので番外編に分けています。

→ 番外編: 「curlだと200なのにブラウザだと画像が表示されない」の原因がCORPだった話（Qiita投稿後にここへリンクを貼る）

## おまけ: デプロイしても直らないときは、タブが古い

SPAは一度読み込むと、リロードするまで古いJavaScriptで動き続けます。
修正をデプロイした直後に「直ってない！」と判断する前に、開いているタブすべてをスーパーリロードしましょう。
（私はこれで1回、直っている修正を「直っていない」と誤判定しました）

本番当日の運用にも関わる話で、「イベント開始後にデプロイしない」「開始前に会場の全端末（ホストPC、プロジェクター、参加者のスマホ）をリロードする」を運用ルールにしました。

## まとめ

10個を分類すると、3種類になります。

- **Azure側の既定値が自分の想定と違う**: 1、2、3、5（クォータ、Premium既定、基本認証無効、EOL）
- **設定が効く場所・効かない場所の理解不足**: 4、6、8、9（Linuxの仕様、配置場所、zip構造、認証方式の権限）
- **別オリジン構成に固有の配線**: 7、10（ビルド時変数、CSP）

一つずつは小さいのですが、初回は全部を同時に踏むので、切り分けに時間がかかります。
この一覧で、これから同じ構成を組む方の切り分けが少しでも短くなればうれしいです。

次回は、環境変数に平文で置いていたシークレットを、Key VaultとマネージドIDとOIDCで消していきます。

:::note info
### 参考資料

[Azure Static Web Apps を構成する](https://learn.microsoft.com/ja-jp/azure/static-web-apps/configuration)

[GitHub Actions を使用した App Service へのデプロイ](https://learn.microsoft.com/ja-jp/azure/app-service/deploy-github-actions)
:::
