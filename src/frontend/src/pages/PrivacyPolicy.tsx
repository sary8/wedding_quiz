export function PrivacyPolicy() {
  return (
    <div className="min-h-[100dvh] bg-blush px-6 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-sage-text mb-6">プライバシーポリシー</h1>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-sage-text mb-2">収集する情報</h2>
          <p className="text-sm text-sage-text/80 leading-relaxed">
            本サービスでは、クイズへの参加に際して以下の情報を収集します。
          </p>
          <ul className="list-disc list-inside text-sm text-sage-text/80 mt-2 space-y-1">
            <li>ニックネーム（8文字以内）</li>
            <li>自撮り画像（任意）</li>
            <li>クイズへの回答データ</li>
            <li>参加時刻</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-sage-text mb-2">利用目的</h2>
          <p className="text-sm text-sage-text/80 leading-relaxed">
            収集した情報は、結婚式の余興としてのクイズゲームの運営・表示のためにのみ使用します。
            第三者への提供や、マーケティング目的での使用は行いません。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-sage-text mb-2">データの保持期間</h2>
          <p className="text-sm text-sage-text/80 leading-relaxed">
            クイズ終了後、データは最大1時間でサーバーから自動的に削除されます。
            自撮り画像を含むすべてのデータが対象です。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-sage-text mb-2">データの削除</h2>
          <p className="text-sm text-sage-text/80 leading-relaxed">
            参加者は、ゲーム終了後の画面からご自身のデータを即時削除することができます。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-lg font-semibold text-sage-text mb-2">外部サービス</h2>
          <p className="text-sm text-sage-text/80 leading-relaxed">
            本サービスでは、外部の分析ツールや広告サービスは使用していません。
          </p>
        </section>

        <a
          href="/"
          className="inline-block mt-4 px-6 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:opacity-90 transition-opacity duration-200"
        >
          トップに戻る
        </a>
      </div>
    </div>
  );
}
