# 影みち（Kagemichi）— 東京 日陰ルート案内

東京の暑い日に、距離だけでなく **日陰の多さ** で徒歩ルートを比較・推薦する
モバイル対応のWebアプリ（PWA）です。フレームワーク不要のバニラJS・静的サイトで、
外部APIはすべてキー不要のものだけを使います。

## 使い方

1. 出発地・目的地を **地図タップ / 地名検索 / 現在地ボタン** で指定
2. 「いつ歩く？」で日付・時刻を選ぶ（太陽の位置が更新されます）
3. 「近さ ⟷ 日陰の多さ」スライダーで重視するバランスを調整
4. **影みちを探す** を押すと、複数の徒歩ルートを日陰率で比較しておすすめを表示
   - 日陰区間はティール（青緑）、日なたはオレンジで色分け

## 仕組み

- **太陽位置**: 緯度経度と日時からの天文計算（SunCalc準拠 / 外部データ不要）
- **日陰判定**: 各地点から太陽方向へレイを飛ばし、太陽を遮る高さの建物があるかを判定。
  建物は OpenStreetMap（Overpass）から取得し、高さは `height` / `building:levels`、
  無い所は約9mと仮定。判定は **一様グリッドの空間インデックス** で高速化。
- **徒歩ルート**: BRouter（foot プロファイル）を優先。取得できない場合は
  OSRM-foot（FOSSGIS）→ OSRM-car の順にフォールバック。
- **地名検索**: Nominatim（東京近郊にバイアス、debounce・中断・キャッシュで規約配慮）
- **天気**: Open-Meteo（体感温度に応じた一言コメント）

## ローカル実行

ビルド不要。リポジトリ直下で静的サーバを立てるだけです（ESモジュールのため
`file://` ではなく HTTP で開く必要があります）。

```bash
python3 -m http.server 8000
# → http://localhost:8000/
```

現在地（Geolocation）は HTTPS か localhost でのみ動作します。

## デプロイ（GitHub Pages）

`.github/workflows/deploy.yml` が `main` / 開発ブランチへの push で自動デプロイします。
初回のみ、リポジトリ設定の **Settings → Pages → Build and deployment → Source** を
**「GitHub Actions」** に切り替えてください。公開URLは
`https://<ユーザー名>.github.io/shadowalker/` です（サブパス対応のため全パス相対）。

## 構成

```
index.html              エントリ（Leaflet は CDN）
css/styles.css          スタイル（暖色紙パレット / ティール=日陰 / オレンジ=日なた）
js/config.js            定数・APIエンドポイント・ベースパス
js/sun.js               太陽位置の天文計算
js/geo.js               幾何ヘルパ + 現在地取得
js/buildings.js         建物取得（Overpass）+ 空間インデックス
js/routing.js           徒歩ルーティング（フォールバック連鎖）
js/shade.js             日陰判定・経路スコアリング
js/weather.js           天気（Open-Meteo）
js/geocode.js           地名検索（Nominatim, debounce）
js/ui.js                ボトムシート・太陽コンパス
js/app.js               配線・状態管理・SW登録
manifest.json / sw.js   PWA（ホーム画面追加・アプリシェルのオフライン対応）
icons/                  アイコン
.github/workflows/      Pages 自動デプロイ
```

## 限界（相対比較の目安として）

歩行者専用路・地下通路・アーケードは経路グラフ次第で十分に反映されません。
建物高さデータは東京でも欠損があり、街路樹・高架下・日射の散乱は未考慮です。
今後の強化候補: 国土交通省 PLATEAU の3D都市モデル連携、OSM の
`tunnel`/`covered`/`layer` を常時日陰の特別な辺として重み付け、街路樹データの活用。

## 外部サービスについて

BRouter / OSRM / Overpass / Nominatim / Open-Meteo の各公共サーバを利用します。
いずれもSLAのない無料サービスのため、混雑時は失敗・低速になることがあります
（Nominatim は debounce/キャッシュ、地図タイル以外のAPIレスポンスは Service Worker で
長期キャッシュしないなど、利用規約に配慮しています）。
