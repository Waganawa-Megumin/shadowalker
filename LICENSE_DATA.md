# 外部データの出典とライセンス

影みち（shadowalker）が利用する外部データ・サービスの出典とライセンスです。
コードのライセンス（MIT）とは別に、各データの条件に従ってください。

| 用途 | 出典 | ライセンス | 帰属表示 |
|---|---|---|---|
| 地図タイル / 経路 / 地名 / 建物・覆い・樹（OSM由来） | OpenStreetMap contributors | ODbL 1.0 | © OpenStreetMap contributors |
| 徒歩経路エンジン | BRouter, OSRM(FOSSGIS), Valhalla(FOSSGIS) | 各サービス規約（フェアユース） | データは OSM |
| 3D建物（高さ・東京都 約320万棟＝23区＋多摩 収録） | Project PLATEAU（国土交通省, G空間情報センター） | CC BY 4.0 | 「国土交通省 Project PLATEAU」 |
| 3D建物（軽量再パッケージ・本アプリで使用） | Flateau（Pacific Spatial Solutions, Source Cooperative） | CC BY 4.0 | PLATEAU 由来 |
| 街路樹（約22.8万本・区部＋多摩 収録） | 東京都オープンデータカタログ「都道の街路樹」（建設局） | CC BY 4.0 | 「東京都 都道の街路樹」 |
| 街路樹（補完） | OpenStreetMap `natural=tree` | ODbL 1.0 | © OpenStreetMap contributors |
| 公園・緑地ポリゴン（約1.2万） | OpenStreetMap `leisure=park/garden/recreation_ground` 等 | ODbL 1.0 | © OpenStreetMap contributors |
| 休憩スポット（給水・トイレ 約1,120点） | OpenStreetMap `amenity=drinking_water/toilets` | ODbL 1.0 | © OpenStreetMap contributors |
| 気温・体感温度・湿度・日射・風（暑さ指数WBGTの近似に使用） | Open-Meteo | CC BY 4.0 | Open-Meteo.com |
| 地名検索 | Nominatim（OpenStreetMap Foundation） | ODbL / 利用規約 | © OpenStreetMap contributors |

## 注意
- 収録データは **東京都（23区＋多摩）** が対象です（建物=PLATEAU 由来のタイル `public/data/plateau/`、
  街路樹=東京都OD のタイル `public/data/trees/`、公園=OSM `public/data/parks/`、休憩スポット=OSM `public/data/poi/`）。
  島嶼部・都外は OpenStreetMap で概算します。
- 暑さ指数(WBGT)は Open-Meteo の気温・湿度・日射・風からの**近似値**で、環境省の公式実測値とは異なります（目安）。
- `public/data/arcades/curated.geojson` の覆い経路は概略線形の人手作成データです（実測ではなく目安）。
- `public/data/sample/*` と `public/data/**/sample.geojson`、`*.sample.geojson` は
  開発・オフライン動作・テスト用のダミーで、実在データではありません。
- 公共サービス（Overpass/Nominatim/各ルーター）はレート制限・フェアユースに従って利用しています
  （debounce・キャッシュ・APIレスポンスの長期キャッシュ回避など）。
