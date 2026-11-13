# whack-a-mole-cam — 體感打地鼠

靜態網頁遊戲（`index.html`＋`scene3d.js`（Three.js 3D 場景）＋`manual.html`＋PWA 檔），無建置步驟。攝影機骨架（`initCamera`／`refreshCamPicker`／`pickPreferredCam`／滑鼠降級／跑馬燈／PWA 安裝段落）與大頭照裁切編輯器複製自 `ball-throw-cam`。port 8873。2026-11-13 建立（使用者一句話需求：「3D 打地鼠，地鼠可以換人頭，用體感打擊」）並同日上線：公開 repo <https://github.com/M255525/whack-a-mole-cam>，GitHub Pages（Actions workflow，push 到 master 自動部署）<https://m255525.github.io/whack-a-mole-cam/>。visitor-badge `m255525.whackamolecam`。

## 架構
- `scene3d.js` 只負責畫：菜園木框土台＋3×3 地洞（`HOLES`，洞距 x 2.5／z 2.65）、地鼠（膠囊身體＋球頭＋臉帽＋耳朵爪子、安全帽、皇冠、炸彈、暈眩星星）、槌子（最多 3 支：h0／h1／m）、粒子／爆炸、天色（白天→傍晚→最後衝刺紫）、遠景（穀倉、風車、樹、柵欄、乾草捆、雲、蝴蝶）。全部程式產生，無外部素材。
- 介面：`render(dt, state)`、`pick(sx,sy)`（畫面座標→頭部高度 `HIT_Y=1.55` 平面的 x,z）、`screenOf(i, y)`、`setFaces(canvases)`、`refreshFaces()`、`burst`、`explode`、`shake`。**規則與命中判定都在 index.html**，3D 只是呈現。
- 臉：`capGeo()` 半球帽，UV 依 x/y 平面投影，圓形 256px 貼圖剛好貼滿臉不變形。每隻地鼠有自己的 faceMat，換臉只換 `map`。
- 鏡頭：依畫面寬自動拉遠（`placeCamera`，菜圃左右都要入鏡），手機直式也看得到 9 個洞。
- Three.js 用 importmap → jsDelivr three@0.160.0（同 jetski-cam／ball-throw-cam），載入失敗顯示 `#no3d` 提示（本遊戲沒有 2D 退路）。

## 玩法（使用者沒細講，下列數值都是我自定，可調）
- 一局 `SET.duration`（30／60／90，預設 60）秒，倒數 3-2-1。難度 `DIFF`：停留秒數、出洞間隔、同時隻數隨進度遞增。
- `KINDS`：地鼠 +10、黃金 +30（停留 ×0.6）、安全帽（第一下 +5 掉帽、第二下 +20）、炸彈 −20＋連擊歸零（開局 8% 時間內不出、設定可關）。連擊第 3 下起每下 +2，上限 +10。最後 10 秒（`FEVER_SEC`）全部 ×2。沒打到就縮回＝溜走，連擊中斷。
- 命中：`whackAt(x,z)` 找最近洞口，距離 ≤ `HIT_RADIUS=1.25` 且地鼠 `hittable()`（up 狀態或升降超過 45%）才算。
- 結算：分數、打中、命中率（打中／揮槌次數）、最高連擊、溜走、「被敲最多次」人頭排行（`G.faceHits`）、本機排行榜 TOP5（含難度、📷／🖱️）。

## 換人頭
- 開始畫面 6 格（`MAX_FACES`）；點圓圈上傳 → 裁切視窗（沿用 ball-throw-cam：拖曳＋滑桿／滾輪／兩指）→ 套用後可取名字（最多 6 字，顯示在地鼠頭上）。
- 儲存 `wam-faces`＝`[{name, img(256px JPEG), src(原圖縮到最長邊 800), crop{cx,cy,zoom}}]`；容量不足時自動捨棄 src（之後不能重新裁切）。
- 出場：`buildFaceList()` 每局重建，照片在前、卡通 4 款（`CARTOON_NAMES`）在後；混合模式照片出現機率 75%；設定「只用照片」則不出卡通。
- **照片 Image 要等 load 完才畫得進貼圖**——`photoFaceCanvas` 未載入時掛 onload 重畫並 `WORLD.refreshFaces()`（第一版漏了，臉變一片咖啡色）。

## 體感判定
- HandLandmarker numHands 依設定 1／2（預設 2，雙手兩支槌子），攝影機 640×360，左下角小視窗（設定可隱藏，`opacity:0` 不停播放）。
- **九宮格瞄準（`SET.aim='grid'`，預設；2026-11-13 使用者要求「對應九宮格畫出九宮格方便辨識打擊」）**：手在攝影機畫面的正規化位置 (u,v)（`palm.x/W`、`palm.y/H`）→ `gridCell(u,v,prev)` 格號 0~8，上排＝最後排（與 `HOLES` 順序一致），`GRID_HYST=0.12` 格寬的換格遲滯。格子範圍 `GRID_REGION`（依「手部活動範圍」小／中／大＝0.06~0.94／0.15~0.85／0.24~0.76）。槌子直接吸附到那一洞（`screenOf(cell)`）。出手 `smashSample()`：**敲起手那一格（`g.top.cell`）**；手碰到模式用目前格。
- 左下角 `#pip`（`<div>` 包 `#cam` 影像＋`#camgrid` 疊層）：`drawCamGrid()` 畫格線、格外變暗、手的黃點（力道滿變綠）、手所在格亮黃（有地鼠綠、炸彈紅）、各格地鼠小圖示 `KIND_ICON`、出手閃一下（`G.flash`）。座標換算 `pipMap()` 依 object-fit:cover 裁切。九宮格模式寬 `min(26vw,320px)`（400 時在 1280 寬會蓋到左前洞）；「隱藏影像」時九宮格模式仍顯示格子（`#cam.ghost`），自由模式整個藏起來（`#pip.off`）。
- 自由移動（`SET.aim='free'`）：手座標對應整個畫面（`lmToScreen`，鏡像），再以畫面中心放大 `RANGE_SCALE`（小 1.0／中 1.3／大 1.6）＝槌子位置。
- **往下敲** `detectSmash(samples, now, relax)` 純函式：時間窗（320ms）內最高點→最新點下降 ≥ `DROP_BASE=0.07`×H、下降量 ≥ 0.6×橫向位移、最近 ≥33ms 瞬時下降速度 ≥ `SPEED_BASE=0.75`×H/s；靈敏度 1~5（`SENS_FACTOR`）縮放；冷卻 300ms。**敲哪一洞用起手最高點（`top`）的瞄準位置**，不是敲到底的位置（敲下去手會往下滑到前一排）。手消失補判 `RELEASE_RELAX=0.65`。
- **手碰到就打**（`SET.hitMode='touch'`）：手停在可打地鼠上 90ms 就打，冷卻 450ms，給小朋友／長輩。
- 力道環、偵測數值面板（設定「顯示偵測數值」）同 ball-throw-cam。
- 滑鼠：移動槌子、點一下敲；觸控點擊；數字鍵 7-8-9／4-5-6／1-2-3 對應後中前排。

## 標準配備
跑馬燈（共用 Apps Script，`wamMarquee`，不可關）、操作手冊 `manual.html`（含完整創作者區塊，取自 taiwan-bird-atlas 的手冊範本）、使用警語（頁面上 `.warnbox`＋首訪 `#warn-modal`＋按鈕）、加入主畫面（manifest／service-worker／icons）、訪客計數器、⚙ 常用設定（收合式 `details.set-sec`，記住展開狀態 `wam-set-open`，底部「ℹ 關於本工具」）。

## 儲存（localStorage，全部 try/catch）
`wam-settings`、`wam-faces`、`wam-best`、`wam-leaderboard`、`wam-cam`、`wam-warned`、`wam-set-open`、`wamMarquee`。

## 已知限制
- **體感敲擊門檻只用合成軌跡驗證過**（快速下敲、15fps 兩點會觸發；慢慢放下、橫揮、往上抬不觸發），未經真人實機測試。使用者回報手感時先請他開「顯示偵測數值」看 fps 與下敲速度再調 `_BASE`。
- 雙手＋3D 同時跑的效能未在低階筆電實測；卡頓先改單手。

## 測試
- 本機：`python -m http.server 8873`（launch.json 名稱 `whack-a-mole-cam`）。
- **只走滑鼠模式**：`document.getElementById('mouse-btn').click()`，避免誤開真實攝影機。Playwright 開的瀏覽器若被真人滑鼠碰到會亂敲，斷言要在同一次 evaluate 內做完。
- `window.__game._test`：`step(dt)`、`spawn(i, kind, face)`（直接升到 up）、`whackHole(i)`、`whackAt(x,z)`、`swingHammer`、`detectSmash`、`effThresholds`、`set`、`world()`、`faces()`、`buildFaceList`、`crop`／`cropApply`／`openCropFor`、`gridCell`／`gridBox`／`smashSample`／`drawCamGrid`／`applyPip`／`setMode`（`setMode('cam')` 只切畫面不開攝影機，可塞假手 `G.hands.set('h0',{palm,cell,aim,meter,hist:[],seen})` 測九宮格；沒有 landmarker 時 detectHands 直接 return，假手不會被清掉）、`up`（上傳格位 `up.slot`，測上傳時設它，不要點圓圈——會開原生檔案視窗卡住 Playwright）。
- 2026-11-13 已驗證：點擊 9 個洞都命中正確那一洞且一次只打一隻、安全帽兩下、炸彈 −20 連擊歸零、黃金 +30、揮空、溜走中斷連擊、整局跑完到結算（被敲排行、統計）、上傳→裁切→命名→存檔→貼到地鼠臉上、設定收合與儲存、390px 手機版無溢出、console 無錯誤。
