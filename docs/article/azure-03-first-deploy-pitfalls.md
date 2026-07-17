<!--
Qiita タグ案: Azure / AppService / StaticWebApps / GitHubActions / トラブルシューティング
シリーズ第3回
-->

# Azure初デプロイで詰まった10のこと（結婚式クイズアプリをAzureに載せた話 3）

シリーズ第3回である。
第1回の構成（Static Web Apps + App Service + GitHub Actions）を実際に組む過程で、10箇所で手が止まった。
どれも致命傷ではないが、事前に知っていれば合計数時間は節約できた。
同じ構成を組む人のために、症状と原因と対処をまとめておく。

前提として、デプロイの方式はこうである。

- backend: GitHub Actions でテスト → ビルド → zipデプロイ（`azure/webapps-deploy@v3`）
- frontend: GitHub Actions で `Azure/static-web-apps-deploy@v1`
- mainへのpushでdev環境に自動デプロイ、本番はworkflow_dispatchと承認ゲート

## 1. Japan EastでApp Serviceが作れない

作成の最終確認まで進んでから、このエラーで弾かれた。

```
Operation cannot be completed without additional quota.
Current Limit (Total VMs): 0
Amount required for this deployment (Total VMs): 1
```

新しめの個人サブスクリプションは、人気リージョンのVMクォータが0になっていることがある。
無料のF1でも対象である。
クォータ引き上げのサポートリクエストは無料プランでも出せるが、数時間から1営業日かかる。
リージョンをJapan Westに変えたら、そのまま通った。

## 2. 価格プランのデフォルトがPremium

App Service作成ウィザードの価格プランは、既定でPremium V3が選択されている。
そのまま作ると月1万円前後かかる。
「価格プランを確認する」から明示的にFree F1を選ぶ必要がある。

さらに、作成途中でリージョンを変えるとApp Serviceプランが作り直しになり、**価格プランの選択もPremiumに戻る**。
1の対処でリージョンを変えた直後が、いちばん危なかった。
確認画面の「見積もり価格 - 無料」の表示を見てから作成ボタンを押す、を習慣にした。

## 3. 基本認証がデフォルト無効で、発行プロファイルが使えない

`azure/webapps-deploy` を発行プロファイル認証で使う場合、App ServiceのSCM基本認証が必要である。
新規作成したApp Serviceはこれが既定で無効になっており、そのままだと発行プロファイルのダウンロードもデプロイも失敗する。
作成ウィザードの「デプロイ」タブに基本認証の有効/無効があるので、作成時に有効にしておくのが楽である。

なお、これはあくまで暫定で、最終的にはOIDC認証に切り替えて基本認証を無効に戻した（第4回）。

## 4. WebSocketの設定トグルが見つからない

Socket.ioを使うので「App ServiceでWebSocketを有効化する」手順を探したが、Linux App Serviceの設定画面にそのトグルは存在しない。
存在しないのが正解で、**LinuxのApp ServiceではWebSocketは常時有効**であり、無効化できない。
あのトグルはWindows App Service専用の設定である。
ネット上の手順記事はWindows前提のものが多く、無いトグルを探して時間を使った。

## 5. Node 20がランタイムの選択肢にない

作成ウィザードのランタイムスタックにNode 20 LTSがなく、22 LTSと24 LTSだけが並んでいた。
Node 20は2026年4月でEOLになり、新規作成の選択肢から外されている。
22 LTSを選び、合わせてGitHub Actionsの `node-version` も20から22に更新した。
CIとランタイムのNodeメジャーバージョンがずれていると、「CIでは通るのに本番で動かない」系の問題を切り分ける時に疑う箇所が増える。

## 6. staticwebapp.config.json がリポジトリ直下だと読まれない

Static Web Appsの設定ファイル（SPAフォールバック、セキュリティヘッダなど）をリポジトリ直下に置いていたが、これは**無視される**。
このファイルはワークフローで指定する `app_location`（今回は `src/frontend`）の配下に置く必要がある。

質が悪いのは、無視されてもデプロイ自体は成功することである。
SPAのディープリンクが404になって初めて気付いた。
設定が効いているかは、レスポンスヘッダに自分で書いたCSPが出ているかで確認できる。

## 7. ビルド時の環境変数（VITE_API_URL）を注入し忘れる

フロントとAPIが別オリジンなので、フロントはビルド時にAPIのURLを埋め込む必要がある。
Viteの環境変数はビルド時に確定するため、ワークフローのビルドステップに `env` で渡す。

```yaml
      - name: Build And Deploy
        uses: Azure/static-web-apps-deploy@v1
        with:
          # ...
        env:
          VITE_API_URL: ${{ vars.VITE_API_URL }}
```

これを忘れると、ビルドは成功し、デプロイも成功し、APIへのリクエストだけが全部失敗するSPAができあがる。
値はGitHub Environmentsの環境変数（dev/prodで別の値）から取っている。

## 8. デプロイzipの構造が起動コマンドと合っていない

backendのzipデプロイは、App Serviceが `wwwroot` にzipを展開してから起動コマンド（`npm start`）を実行する。
つまり**zipのルート直下に package.json と node_modules がある構造**でなければならない。
リポジトリのディレクトリ構成（`src/backend/...`）のままzipを作ると、`wwwroot/backend/package.json` のような配置になって起動に失敗する。

```yaml
      # src/backend をカレントにして、zipのルート直下に成果物を置く
      - name: Create deployment package
        run: zip -r ../../deploy-package.zip dist/ node_modules/ package.json
```

うちの場合、ワークフローに元からあったzip作成ステップが `cd` とworking-directoryの組み合わせを誤っていて、パス自体が存在せず失敗した。
このワークフローは書かれてから一度も実行されたことがなく、初回実行がそのまま初デバッグになった。
「書いてあるが動かしたことのないCI」は動かない前提で見たほうがいい。

## 9. publish-profile認証ではstartup-commandが指定できない

`azure/webapps-deploy@v3` に起動コマンドを渡したら、デプロイがこのエラーで拒否された。

```
Deployment Failed, Error: startup-command is not a valid input for Windows web app
or with publish-profile auth scheme.
```

発行プロファイル認証はデプロイの権限しか持たず、サイト構成の変更（起動コマンドの設定）ができない。
起動コマンドはポータルの「構成 → 全般設定 → スタートアップ コマンド」で設定し、ワークフローからは外した。
OIDC認証（az login経由）に切り替えれば指定できるようになるが、ポータル側の設定は一度入れれば残るので、結局そのままにしている。

## 10. 別オリジンのAPIをCSPが塞ぐ

フロント側で配信しているCSPの `connect-src` が `'self'` 前提のままだと、別オリジンのApp ServiceへのfetchとSocket.ioのポーリングがブラウザにブロックされる。
`connect-src` にバックエンドのオリジン（httpsとwss）を、画像を返すなら `img-src` にも同じオリジンを追加する必要がある。

なお、CSPを直しても画像だけが表示されない問題が残り、これは別の原因（Cross-Origin-Resource-Policy）だった。
1本の記事になる分量なので、別記事「curlでは200が返るのにブラウザで画像が壊れるとき」に分けてある。

## おまけ: デプロイしても直らないときは、タブが古い

SPAは一度読み込むと、リロードするまで古いJavaScriptで動き続ける。
修正をデプロイした直後に「直っていない」と判断する前に、開いているタブすべてをスーパーリロードする。
本番当日の運用にも関わる話で、イベント開始後にデプロイしない、開始前に会場の全端末（ホストPC、プロジェクター、参加者のスマホ）をリロードする、を運用ルールにした。

## まとめ

10個を分類すると三種類になる。

- **Azure側の既定値が自分の想定と違う**: 1、2、3、5（クォータ、Premium既定、基本認証無効、EOL）
- **設定が効く場所・効かない場所の理解不足**: 4、6、8、9（Linuxの仕様、配置場所、zip構造、認証方式の権限）
- **別オリジン構成に固有の配線**: 7、10（ビルド時変数、CSP）

一つずつは小さいが、初回は全部を同時に踏むので、切り分けに時間がかかる。
この一覧が、これから同じ構成を組む人の切り分けを短くできれば書いた甲斐がある。

次回は、環境変数に平文で置いていたシークレットを、Key VaultとマネージドIDとOIDCで消していく。
