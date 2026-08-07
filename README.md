# pg-twland

瀏覽器**台灣路名地產**：經典紙本買地蓋房規則（拍賣、抵押、交易、破產、機會／命運），棋盤換成忠孝東路等台灣路名。金額單位為「元」（可當台幣理解）；價位先用經典相對比例，**試玩後再調**。

非 Monopoly／大富翁等商標或商業產品復刻；民間紙本機制之開源小品。

也可當作 [Playgrounds（遊樂場）](https://play.samkuo.me/) 的 **SAM**（`index.html` 入口）。

## 一鍵開 SAM 小

**[一鍵開 SAM 小](https://play.samkuo.me/?open=sampot%2Fpg-twland&name=%E5%8F%B0%E7%81%A3%E8%B7%AF%E5%90%8D%E5%9C%B0%E7%94%A2)**（需已推到 GitHub `sampot/pg-twland`）

```
https://play.samkuo.me/?open=sampot/pg-twland&name=台灣路名地產
```

同源會重用本機已匯入的沙盒；要強制新建可加 `&fresh=1`。

## 試玩（本機）

```bash
npx --yes serve .
# 或
python3 -m http.server 8080
```

選 2–4 人熱座輪流即可。

## 操作摘要

| 階段 | 可做 |
| --- | --- |
| 擲骰 | 2d6；雙子再擲；三連雙子入獄 |
| 購買 | 買下或拒買→拍賣 |
| 管理 | 蓋房／拆屋、抵押／贖回、交易、結束回合 |
| 坐牢 | 繳 50 元、用卡、或試擲雙子 |
| 欠債 | 抵押／拆屋／交易籌款，或宣告破產 |

點棋盤格可看租金表。房屋庫存 32、旅館 12；同色組齊且無抵押才能蓋，須平均興建。

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `index.html` | 結構 |
| `styles.css` | 亮／暗色、mobile-first |
| `app.js` | 熱座 UI |
| `engine.js` | 規則狀態機 |
| `board.js` | 40 格路名與價位 |
| `cards.js` | 機會／命運 |
| `functions.js` | Playgrounds 可選 stub |

調整地價／租金：改 `board.js`。改卡文：改 `cards.js`。

## License

MIT
