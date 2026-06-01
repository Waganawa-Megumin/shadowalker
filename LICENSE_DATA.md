# 外部データの出典とライセンス

影みち（shadowalker）が利用する外部データ・サービスの出典とライセンスです。
コードのライセンス（MIT）とは別に、各データの条件に従ってください。

| 用途 | 出典 | ライセンス | 帰属表示 |
|---|---|---|---|
| 地図タイル / 経路 / 地名 / 建物・覆い・樹（OSM由来） | OpenStreetMap contributors | ODbL 1.0 | © OpenStreetMap contributors |
| 徒歩経路エンジン | BRouter, OSRM(FOSSGIS), Valhalla(FOSSGIS) | 各サービス規約（フェアユース） | データは OSM |
| 3D建物（高さ） | Project PLATEAU（国土交通省, G空間情報センター） | CC BY 4.0 | 「国土交通省 Project PLATEAU」 |
| 3D建物（軽量再パッケージ・任意） | Flateau（Pacific Spatial Solutions） | CC BY 4.0 | PLATEAU 由来 |
| 街路樹 | 東京都オープンデータカタログ「都道の街路樹」（建設局） | CC BY 4.0 | 「東京都 都道の街路樹」 |
| 街路樹（補完） | OpenStreetMap `natural=tree` | ODbL 1.0 | © OpenStreetMap contributors |
| 気温・体感温度 | Open-Meteo | CC BY 4.0 | Open-Meteo.com |
| 地名検索 | Nominatim（OpenStreetMap Foundation） | ODbL / 利用規約 | © OpenStreetMap contributors |

## 注意
- `public/data/arcades/curated.geojson` の覆い経路は概略線形の人手作成データです（実測ではなく目安）。
- `public/data/sample/*` と `public/data/**/sample.geojson`、`*.sample.geojson` は
  開発・オフライン動作・テスト用のダミーで、実在データではありません。
- 公共サービス（Overpass/Nominatim/各ルーター）はレート制限・フェアユースに従って利用しています
  （debounce・キャッシュ・APIレスポンスの長期キャッシュ回避など）。
