# pg-twland

瀏覽器**台灣路名地產**：對齊台灣版紙本核心（買地、蓋房、催租、破產）；棋盤為忠孝東路等台灣路名。金額單位「元」；價位可再調。詳見 [RULES.md](./RULES.md)。

**Mobile-first：** 窄螢幕直向格列表＋頂部固定操作列；約 ≥720px 為環形棋盤。

**AI 託管：** 開局可勾選；對局中可「託管 AI／收回」。

非 Monopoly／大富翁等商標或商業產品復刻。

也可當作 [Playgrounds（遊樂場）](https://play.samkuo.me/) 的 **SAM**（`index.html` 入口）。

## 一鍵開 SAM 小

**[一鍵開 SAM 小](https://play.samkuo.me/?open=sampot%2Fpg-twland&name=%E5%8F%B0%E7%81%A3%E8%B7%AF%E5%90%8D%E5%9C%B0%E7%94%A2)**

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

## 操作摘要

| 階段 | 可做 |
| --- | --- |
| 開局 | 擲骰爭先手；起手 1500 元 |
| 擲骰 | 2d6；雙子再擲；三連雙子入獄 |
| 購買 | 買下或不買（**維持空地，不拍賣**） |
| 管理 | 停在自家地可蓋房；抵押／交易／結束回合 |
| 坐牢 | 仍可管理／交易；再繳 50、用卡或試擲雙子 |
| 欠債 | 抵押／拆屋／交易籌款，或宣告破產 |
| AI 託管 | 開局勾選或對局中切換 |

## 檔案

| 檔案 | 說明 |
| --- | --- |
| `RULES.md` | 台灣版規則對齊說明 |
| `index.html` | 結構 |
| `styles.css` | 亮／暗色、mobile-first |
| `app.js` | 熱座 UI |
| `engine.js` | 規則狀態機 |
| `board.js` | 40 格路名與價位 |
| `cards.js` | 機會／命運 |
| `ai.js` | 託管 AI |
| `functions.js` | Playgrounds 可選 stub |

## License

MIT
