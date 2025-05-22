這是一個純 HTML + CSS3 + JavaScript 的考試測驗復習系統範例。

## 功能說明
1. 題目與答案存於 `data/questions.json`，可自行擴充。
2. 支援單選與複選題，並可顯示題目圖片。
3. 題目隨機抽取且不重覆。
4. 可指定考幾題。
5. 答題後即時顯示正確與否。
6. 完成後顯示分數並可再考一次。

## 使用方式
1. 將本專案資料夾內容放於本地端或靜態伺服器。
2. 開啟 `index.html` 即可開始使用。
3. 若需新增題目，請編輯 `data/questions.json`。
4. 若題目需圖片，請將圖片放於 `images/` 目錄並於 json 設定路徑。

## 注意事項
- 若直接用瀏覽器開啟，部分瀏覽器會因 CORS 限制無法載入 json，建議用 VSCode Live Server 或其他本地伺服器。

## 檔案結構
```
index.html
css/style.css
js/app.js
data/questions.json
images/
```

---

如需進階功能（如分數統計、題庫分類、進度儲存等）可再擴充。
