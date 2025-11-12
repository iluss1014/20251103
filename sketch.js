let questionsTable;
let questions = [];
let quizQuestions = []; // 存放本次測驗的題目
let userAnswers = []; // 存放使用者的答案
let quizState = 'START'; // START, QUIZ, RESULT, EXPLANATION
let currentQuestionIndex = 0;
let score = 0;
let selectedOption = null;

// --- 新增狀態 ---
let showSubmitPopup = false; // 是否顯示提交確認彈窗

// --- 特效相關變數 ---
let cursorTrail = []; // 游標拖尾特效
let particleSystem = []; // 結果畫面的粒子系統

// 新增捲動與 scrollbar 相關變數
let explanationScroll = 0;
let explanationContentHeight = 0;
let explanationDrag = false;
let scrollbarGrabOffset = 0;

// --- 版面與響應式設定 ---
let layout = {
    scale: 1,
    titleSize: 48,
    questionSize: 24,
    optionSize: 20,
    optionW: 400,
    optionH: 60,
    optionXGap: 450,
    optionYStart: 280,
    optionYGap: 100,
    columns: 2,
    navW: 200,
    navH: 50
};

// 在 setup 和 draw 執行前確保 CSV 載入
function preload() {
    // loadTable(filename, format, header, callback, errorCallback)
    // 'header' 表示第一行是標頭
    questionsTable = loadTable('assets/questions.csv', 'csv', 'header');
}

function setup() {
    createCanvas(windowWidth, windowHeight);
    textAlign(CENTER, CENTER);
    textSize(24);
    noCursor(); // 隱藏原生游標，使用自定義游標特效
    
    // 將表格資料轉換為更易於操作的物件陣列
    for (let r = 0; r < questionsTable.getRowCount(); r++) {
        let row = questionsTable.getRow(r);
        // 確保所有必要的欄位都存在
        if (!row.getString('Question') || !row.getString('Answer')) continue;

        questions.push({
            question: row.getString('Question'),
            options: {
                A: row.getString('OptionA'),
                B: row.getString('OptionB'),
                C: row.getString('OptionC'),
                D: row.getString('OptionD')
            },
            correctAnswer: row.getString('Answer'),
            explanation: row.getString('Explanation')
        });
    }
    
    // 洗牌並選取 5 題
    questions = shuffle(questions);
    updateLayout(); // 初始化版面尺寸相關
    resetQuiz();

    // 初始化粒子系統
    for (let i = 0; i < 50; i++) {
        particleSystem.push(new Particle(width / 2, height / 2));
    }
}

function windowResized() {
    resizeCanvas(windowWidth, windowHeight);
    updateLayout(); // 畫面大小變動時更新布局
}

// 改寫 updateLayout，使題目字型有上限、選項寬度依畫面調整（避免相鄰按鈕貼在一起）
function updateLayout() {
    layout.scale = constrain(width / 1200, 0.6, 1.6);
    layout.titleSize = round(48 * layout.scale);
    layout.questionSize = round(constrain(26 * layout.scale, 16, 34));
    layout.optionSize = round(constrain(18 * layout.scale, 12, 24));
    layout.optionH = max(44, round(56 * layout.scale));
    layout.navW = max(120, round(180 * layout.scale));
    layout.navH = max(36, round(44 * layout.scale));

    // explanation / list sizing (響應式)
    layout.exHeaderH = round(80 * layout.scale);
    layout.exFooterH = round(100 * layout.scale);
    layout.exGroupPadding = round(12 * layout.scale);
    layout.exGroupGap = round(16 * layout.scale);
    layout.exGroupTitleH = round(28 * layout.scale);
    layout.exLineH = round(22 * layout.scale);

    let contentW = width * 0.8;
    if (width < 900) {
        layout.columns = 1;
        layout.optionW = min(contentW * 0.95, width * 0.85);
        layout.optionXGap = 0;
        layout.optionYStart = round(160 * layout.scale);
        layout.optionYGap = round((layout.optionH + 20) * layout.scale);
    } else {
        layout.columns = 2;
        let gutter = 40 * layout.scale;
        layout.optionW = min(450 * layout.scale, (contentW - gutter) / 2);
        layout.optionXGap = layout.optionW + gutter;
        layout.optionYStart = round(200 * layout.scale);
        layout.optionYGap = round(max(layout.optionH + 20, 100 * layout.scale));
    }
}

// 新增：為 quizQuestions 每題建立一個洗牌後的選項陣列（保留原始 key）
function shuffleOptionsForQuiz() {
    for (let q of quizQuestions) {
        let keys = ['A','B','C','D'].filter(k => q.options[k]);
        let arr = keys.map(k => ({ key: k, label: q.options[k] }));
        q.shuffledOptions = shuffle(arr);
    }
}

function draw() {
    background(30, 30, 40); // 深藍色背景
    
    // 繪製游標拖尾特效
    drawCursorTrail();

    // 根據測驗狀態繪製不同畫面
    switch (quizState) {
        case 'START':
            drawStartScreen();
            break;
        case 'QUIZ':
            drawQuizScreen();
            break;
        case 'RESULT':
            drawResultScreen();
            break;
        case 'EXPLANATION':
            drawExplanationScreen();
            break;
    }
    
    // 繪製自定義游標
    drawCustomCursor();
}

// --- 繪製畫面函式 ---

function drawStartScreen() {
    fill(255);
    textSize(layout.titleSize);
    text("p5.js 動態測驗系統", width / 2, height / 3);

    textSize(floor(layout.optionSize * 1.2));
    fill(100, 200, 255);
    let buttonY = height * 2 / 3;
    rectMode(CENTER);
    rect(width / 2, buttonY, layout.navW, layout.navH, 10);
    
    fill(30, 30, 40);
    text("開始測驗", width / 2, buttonY);
}

function drawQuizScreen() {
    let q = quizQuestions[currentQuestionIndex];
    background(30, 30, 40);
    fill(255);

    // 問題以編號為前綴（置中，限制寬度以避免靠右或換行亂掉）
    textSize(round(layout.questionSize * 0.9));
    textSize(layout.questionSize); // 稍微加大問題字體
    textAlign(CENTER, TOP); // 確保每次繪製問題時都置中對齊
    let questionBoxW = min(width * 0.72, width - 120); // 收窄寬度以置中美觀
    rectMode(CENTER); // 確保文字框相對於中心點
    text(`問題${currentQuestionIndex + 1}. ${q.question}`, width / 2, height * 0.22, questionBoxW, 240); // Y 座標往下調整

    // 選項繪製寬度（繪製時縮小，檢測也會使用相同寬度）
    let optionDrawW = layout.optionW - round(10 * layout.scale);
    let options = q.shuffledOptions;
    textAlign(CENTER, CENTER);
    let baseY = layout.optionYStart;
    for (let i = 0; i < options.length; i++) {
        let optObj = options[i];
        let row = (layout.columns === 1) ? i : Math.floor(i / 2);
        let col = (layout.columns === 1) ? 0 : (i % 2);
        let x, y;
        if (layout.columns === 1) {
            x = width / 2;
            y = baseY + row * layout.optionYGap;
        } else {
            x = width / 2 + (col === 0 ? -layout.optionXGap / 2 : layout.optionXGap / 2);
            y = baseY + row * layout.optionYGap;
        }

        let w = optionDrawW;
        let h = layout.optionH;
        let isMouseOver = mouseX > x - w / 2 && mouseX < x + w / 2 &&
                          mouseY > y - h / 2 && mouseY < y + h / 2;

        if (userAnswers[currentQuestionIndex] === optObj.key) {
            fill(150, 150, 250);
        } else if (isMouseOver) {
            fill(100, 100, 200);
        } else {
            fill(50, 50, 80);
        }

        rectMode(CENTER);
        rect(x, y, w, h, 8);

        fill(255);
        textSize(layout.optionSize);
        text(`${optObj.key}: ${optObj.label}`, x, y, w - 24, h - 10);
    }

    // 底部按鈕位置統一使用變數（避免繪製/檢查座標不一致）
    let navY = height - 70;
    let navGap = 30 * layout.scale; // 加大按鈕間距
    let leftNavX = width / 2 - layout.navW / 2 - navGap;
    let rightNavX = width / 2 + layout.navW / 2 + navGap;

    if (currentQuestionIndex > 0) {
        drawNavButton(leftNavX, navY, "上一題");
    }
    if (userAnswers[currentQuestionIndex]) {
        drawNavButton(rightNavX, navY, "確認"); // 使用新的右側座標
    }

    // 進度條放在按鈕的下方（避免重疊）
    drawProgressBar(navY + layout.navH / 2 + 12);

    // 提交彈窗
    if (showSubmitPopup) drawSubmitPopup();
}

// 修改 drawProgressBar：接受 y 參數（放在按鈕下方）
function drawProgressBar(yPosition) {
    let total = max(quizQuestions.length, 1);
    let answered = userAnswers.filter(a => a !== null && a !== undefined).length;
    let pct = answered / total;
    let barW = min(width * 0.6, 800);
    let barH = max(8, round(12 * layout.scale));
    let x = width / 2 - barW / 2;
    let y = yPosition !== undefined ? yPosition : (height - (layout.navH + 30));

    // 背景條
    noStroke();
    fill(70);
    rectMode(CORNER);
    rect(x, y, barW, barH, barH / 2);

    // 已完成
    fill(100, 200, 150);
    rect(x, y, barW * pct, barH, barH / 2);

    // 百分比文字（置於進度條上方）
    fill(255);
    textSize(round(layout.optionSize * 0.9));
    textAlign(CENTER, BOTTOM);
    text(`${round(pct * 100)}%`, width / 2, y - 14);
}

function drawResultScreen() {
    let resultRatio = score / 100; // 滿分 100
    let message = "";
    let resultColor;

    if (resultRatio === 1) {
        message = "🎉 完美！太棒了！ 🎉";
        resultColor = color(0, 255, 100);
    } else if (resultRatio >= 0.7) {
        message = "👍 幹得好！成績優異！ 👍";
        resultColor = color(100, 255, 255);
    } else if (resultRatio >= 0.4) {
        message = "💪 繼續努力！你快要成功了！ 💪";
        resultColor = color(255, 200, 0);
    } else {
        message = "🌱 再接再厲，下次會更好！ 🌱";
        resultColor = color(255, 100, 100);
    }

    // 粒子動畫
    fill(resultColor, 180);
    for (let p of particleSystem) {
        p.update(resultRatio);
        p.display();
    }
    
    // 繪製結果文字
    fill(resultColor);
    textSize(50);
    text(message, width / 2, height / 3);
    
    textSize(36);
    fill(255);
    text(`你的分數：${score} / 100`, width / 2, height / 2);

    // 使用 layout.navW 及相同座標計算法，確保與 mousePressed 中檢查一致
    let leftX = width / 2 - layout.navW - 20;
    let rightX = width / 2 + layout.navW + 20 - layout.navW;
    let navY = height * 2 / 3;

    drawNavButton(width / 2 - layout.navW / 2 - 20, navY, "重新測驗");
    drawNavButton(width / 2 + layout.navW / 2 + 20, navY, "錯題詳解");
}

// 修正 mousePressed：保持 RESULT 按鈕檢查座標與 drawResultScreen 一致，並修正重新測驗行為
function mousePressed() {
    // 若在說明頁且 scrollbar 可用，優先處理 scrollbar 拖曳
    if (quizState === 'EXPLANATION') {
        let headerHeight = layout.exHeaderH;
        let footerHeight = layout.exFooterH;
        let viewportH = height - headerHeight - footerHeight;
        let trackX = width - 36;
        let trackY = headerHeight + 8;
        let trackW = 12;
        let trackH = viewportH - 16;

        if (explanationContentHeight > viewportH) {
            let thumbMinH = max(40, 36 * layout.scale);
            let thumbH = constrain(map(viewportH, 0, explanationContentHeight, thumbMinH, trackH), thumbMinH, trackH);
            let maxScroll = max(0, explanationContentHeight - viewportH);
            let thumbY = map(explanationScroll, 0, maxScroll, trackY, trackY + trackH - thumbH);

            // 判斷滑鼠是否在滑塊上
            if (mouseX > trackX - 10 && mouseX < trackX + trackW + 10 && mouseY > thumbY && mouseY < thumbY + thumbH) {
                explanationDrag = true;
                scrollbarGrabOffset = mouseY - thumbY;
                return; // 開始拖曳後不處理其他按鈕
            }
        }

        // 若點擊回到結果按鈕（底部固定按鈕）
        if (checkButton(width / 2, height - 60, layout.navW, layout.navH)) {
            quizState = 'RESULT';
            return;
        }
    }

    // 原有行為（其他頁面）
    if (quizState === 'START') {
        let buttonY = height * 2 / 3;
        if (checkButton(width / 2, buttonY, layout.navW, layout.navH)) {
            quizState = 'QUIZ';
            resetQuiz();
        }
    } else if (quizState === 'QUIZ') {
        if (showSubmitPopup) {
            // 使用與 drawSubmitPopup 相同的按鈕尺寸與位移
            let popupW = min(600, width * 0.6);
            let popupH = min(320, height * 0.4);
            let popupX = width / 2;
            let popupY = height / 2;
            let popupBtnW = min(160, round(layout.navW * 0.9));
            let popupBtnH = min(44, round(layout.navH * 0.9));
            let gap = 24 * layout.scale;
            let leftX = popupX - (popupBtnW / 2 + gap);
            let rightX = popupX + (popupBtnW / 2 + gap);
            let btnY = popupY + popupH * 0.22;

            if (checkButton(leftX, btnY, popupBtnW, popupBtnH)) { // 再看看
                showSubmitPopup = false;
            } else if (checkButton(rightX, btnY, popupBtnW, popupBtnH)) { // 確認交卷
                calculateScore();
                quizState = 'RESULT';
                showSubmitPopup = false;
            }
        } else {
            // 檢查是否點擊選項（需跟 drawQuizScreen 一致）
            let q = quizQuestions[currentQuestionIndex];
            let options = q.shuffledOptions;
            let baseY = layout.optionYStart;
            let optionDrawW = layout.optionW - round(10 * layout.scale);

            for (let i = 0; i < options.length; i++) {
                let row = (layout.columns === 1) ? i : Math.floor(i / 2);
                let col = (layout.columns === 1) ? 0 : (i % 2);
                let x, y;
                if (layout.columns === 1) {
                    x = width / 2;
                    y = baseY + row * layout.optionYGap;
                } else {
                    x = width / 2 + (col === 0 ? -layout.optionXGap / 2 : layout.optionXGap / 2);
                    y = baseY + row * layout.optionYGap;
                }
                let w = optionDrawW;
                let h = layout.optionH;
                if (checkButton(x, y, w, h)) {
                    userAnswers[currentQuestionIndex] = options[i].key; // 存原始 key（A/B/C/D）
                    break;
                }
            }

            // 檢查是否點擊 "上一題"
            let navGap = 30 * layout.scale; // 加大按鈕間距
            let leftNavX = width / 2 - layout.navW / 2 - navGap;
            let rightNavX = width / 2 + layout.navW / 2 + navGap;
            let navY = height - 70;
            if (currentQuestionIndex > 0 && checkButton(leftNavX, navY, layout.navW, layout.navH)) {
                previousQuestion();
            }

            // 檢查是否點擊 "確認"
            if (userAnswers[currentQuestionIndex] && checkButton(rightNavX, navY, layout.navW, layout.navH)) { // 使用新的右側座標
                nextQuestion();
            }
        }
    } else if (quizState === 'RESULT') {
        // 使用與 drawResultScreen 相同的座標
        let leftX = width / 2 - layout.navW - 20;
        let rightX = width / 2 + layout.navW + 20 - layout.navW;
        let navY = height * 2 / 3;        
        if (checkButton(width / 2 - layout.navW / 2 - 20, navY, layout.navW, layout.navH)) {
            // 重新測驗：立即重置並進入 QUIZ（避免必須再按 START）
            // resetQuiz(); // resetQuiz() is called when the 'START' button is pressed.
            quizState = 'START';
        } else if (checkButton(width / 2 + layout.navW / 2 + 20, navY, layout.navW, layout.navH)) {
            explanationScroll = 0;
            quizState = 'EXPLANATION';
        }
    }
}

function mouseDragged() {
    if (explanationDrag) {
        let headerHeight = layout.exHeaderH;
        let footerHeight = layout.exFooterH;
        let viewportH = height - headerHeight - footerHeight;
        let trackY = headerHeight + 8;
        let trackH = viewportH - 16;
        let thumbMinH = max(40, 36 * layout.scale);
        let thumbH = constrain(map(viewportH, 0, explanationContentHeight, thumbMinH, trackH), thumbMinH, trackH);
        let maxScroll = max(0, explanationContentHeight - viewportH);
        // 計算 thumb 的可移動範圍，並映射回 explanationScroll
        let scrollableY0 = trackY;
        let scrollableY1 = trackY + trackH - thumbH;
        let newThumbY = constrain(mouseY - scrollbarGrabOffset, scrollableY0, scrollableY1);
        explanationScroll = map(newThumbY, scrollableY0, scrollableY1, 0, maxScroll);
        explanationScroll = constrain(explanationScroll, 0, maxScroll);
    }
}

function mouseReleased() {
    explanationDrag = false;
}

function mouseWheel(event) {
    if (quizState === 'EXPLANATION') {
        let headerHeight = layout.exHeaderH;
        let footerHeight = layout.exFooterH;
        let viewportH = height - headerHeight - footerHeight;
        if (explanationContentHeight > viewportH) {
            let maxScroll = max(0, explanationContentHeight - viewportH);
            explanationScroll = constrain(explanationScroll + event.delta, 0, maxScroll);
            return false; // 防止瀏覽器滾動頁面
        }
    }
}

// 修改 checkMouseOverOption 使用與實際繪製相同的 option 寬度
function checkMouseOverOption() {
    if (quizState === 'QUIZ' && !showSubmitPopup) {
        let q = quizQuestions[currentQuestionIndex];
        let options = q.shuffledOptions;
        let baseY = layout.optionYStart;
        let optionDrawW = layout.optionW - round(10 * layout.scale);
        for (let i = 0; i < options.length; i++) {
            let row = (layout.columns === 1) ? i : Math.floor(i / 2);
            let col = (layout.columns === 1) ? 0 : (i % 2);
            let x, y;
            if (layout.columns === 1) {
                x = width / 2;
                y = baseY + row * layout.optionYGap;
            } else {
                x = width / 2 + (col === 0 ? -layout.optionXGap / 2 : layout.optionXGap / 2);
                y = baseY + row * layout.optionYGap;
            }
            if (checkButton(x, y, optionDrawW, layout.optionH)) {
                return true;
            }
        }
        let navGap = 30 * layout.scale; // 加大按鈕間距
        let navLeftX = width / 2 - layout.navW / 2 - navGap;
        let navRightX = width / 2 + layout.navW / 2 + navGap;
        let navY = height - 70;
        if (currentQuestionIndex > 0 && checkButton(navLeftX, navY, layout.navW, layout.navH)) return true;
        if (userAnswers[currentQuestionIndex] && checkButton(navRightX, navY, layout.navW, layout.navH)) return true;
    }
    return false;
}

// 補上必要的輔助函式與元件實作

function resetQuiz() {
    // 重新洗牌題庫並取前五題（若題庫不足則取全部）
    questions = shuffle(questions);
    quizQuestions = questions.slice(0, min(5, questions.length));
    userAnswers = new Array(quizQuestions.length).fill(null);
    currentQuestionIndex = 0;
    score = 0;
    showSubmitPopup = false;
    explanationScroll = 0;
    explanationContentHeight = 0;
    explanationDrag = false;
    scrollbarGrabOffset = 0;
    // 為所選題目產生亂序選項
    shuffleOptionsForQuiz();
    // 重建粒子中心（如果需要）
    particleSystem = [];
    for (let i = 0; i < 50; i++) {
        particleSystem.push(new Particle(width / 2, height / 2));
    }
}

function nextQuestion() {
    if (currentQuestionIndex < quizQuestions.length - 1) {
        currentQuestionIndex++;
    } else {
        // 到最後一題按確認則跳出交卷確認
        showSubmitPopup = true;
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) currentQuestionIndex--;
}

function calculateScore() {
    let correct = 0;
    for (let i = 0; i < quizQuestions.length; i++) {
        let qa = quizQuestions[i];
        if (userAnswers[i] && userAnswers[i] === qa.correctAnswer) correct++;
    }
    // 每題等權，總分 100
    score = round((correct / max(quizQuestions.length, 1)) * 100);
    // 重新初始化粒子系統依照分數
    particleSystem = [];
    for (let i = 0; i < 50; i++) particleSystem.push(new Particle(width / 2, height / 2));
}

function checkButton(cx, cy, w, h) {
    // 中心座標為 cx,cy，寬高 w,h
    let left = cx - w / 2;
    let right = cx + w / 2;
    let top = cy - h / 2;
    let bottom = cy + h / 2;
    return mouseX >= left && mouseX <= right && mouseY >= top && mouseY <= bottom;
}

// 可傳入 w,h（預設使用 layout.navW, layout.navH）
function drawNavButton(x, y, textContent, w = layout.navW, h = layout.navH) {
    let isHover = mouseX > x - w / 2 && mouseX < x + w / 2 && mouseY > y - h / 2 && mouseY < y + h / 2;
    fill(isHover ? 140 : 80);
    rectMode(CENTER);
    noStroke();
    rect(x, y, w, h, 8);
    fill(255);
    textSize(round(layout.optionSize * 1.0));
    textAlign(CENTER, CENTER);
    text(textContent, x, y);
}

// 簡易 submit popup（與畫面尺寸響應）
function drawSubmitPopup() {
    fill(0, 0, 0, 150);
    rectMode(CORNER);
    rect(0, 0, width, height);

    let popupW = min(600, width * 0.6);
    let popupH = min(320, height * 0.4);
    let px = width / 2;
    let py = height / 2;

    rectMode(CENTER);
    fill(50, 50, 80);
    noStroke();
    rect(px, py, popupW, popupH, 10);

    fill(255);
    textSize(round(layout.titleSize * 0.4));
    textAlign(CENTER, CENTER);
    text("確定要交卷嗎？", px, py - popupH * 0.22);

    let popupBtnW = min(160, round(layout.navW * 0.9));
    let popupBtnH = min(44, round(layout.navH * 0.9));
    let gap = 24 * layout.scale;
    let leftX = px - (popupBtnW / 2 + gap);
    let rightX = px + (popupBtnW / 2 + gap);
    let btnY = py + popupH * 0.22;

    drawNavButton(leftX, btnY, "再看看", popupBtnW, popupBtnH);
    drawNavButton(rightX, btnY, "確認交卷", popupBtnW, popupBtnH);
}

// 簡化但完整的 Explanation 頁面（響應式，單一 scrollbar）
// 若你已有更完整版本可合併，此為保護性實作以避免未定義錯誤
function drawExplanationScreen() {
    background(30, 30, 40);
    fill(255);
    textSize(round(layout.titleSize * 0.9));
    textAlign(CENTER, TOP);
    text("錯題詳解", width / 2, 16);

    let headerHeight = layout.exHeaderH;
    let footerHeight = layout.exFooterH;
    let viewportY = headerHeight;
    let viewportH = height - headerHeight - footerHeight;
    let groupX = 40;
    let groupW = width - 140;

    let wrongIndices = [];
    for (let i = 0; i < quizQuestions.length; i++) {
        if (userAnswers[i] !== quizQuestions[i].correctAnswer) wrongIndices.push(i);
    }

    if (wrongIndices.length === 0) {
        fill(200);
        textSize(round(layout.optionSize * 1.1));
        textAlign(CENTER, CENTER);
        text("恭喜！沒有錯題。", width / 2, headerHeight + viewportH / 2);
        drawNavButton(width / 2, height - 60, "返回結果");
        return;
    }

    // 計算內容高度（簡易估算）
    textAlign(LEFT, TOP);
    let totalH = 0;
    for (let idx of wrongIndices) {
        textSize(round(layout.questionSize * 0.7));
        let titleH = layout.exGroupTitleH;
        textSize(round(layout.optionSize * 0.9));
        let explanationText = quizQuestions[idx].explanation || "（無詳細說明）";
        let approxCharW = max(6, textWidth("我"));
        let charsPerLine = max(1, floor((groupW - 36) / approxCharW));
        let wrapLines = ceil(explanationText.length / charsPerLine);
        let explanationH = wrapLines * (textAscent() + textDescent() + 6);
        let optsH = (textAscent() + textDescent() + 8) * 2;
        let groupH = titleH + optsH + explanationH + layout.exGroupPadding;
        totalH += groupH + layout.exGroupGap;
    }
    explanationContentHeight = max(totalH, viewportH);
    let maxScroll = max(0, explanationContentHeight - viewportH);
    explanationScroll = constrain(explanationScroll, 0, maxScroll);

    // 背景
    noStroke();
    fill(25, 25, 35);
    rectMode(CORNER);
    rect(20, viewportY, width - 60, viewportH, 8);

    push();
    translate(0, viewportY - explanationScroll);
    let drawY = 10;
    for (let i = 0; i < wrongIndices.length; i++) {
        let qi = wrongIndices[i];
        let q = quizQuestions[qi];

        textSize(round(layout.questionSize * 0.7));
        let titleH = layout.exGroupTitleH;
        textSize(round(layout.optionSize * 0.9));
        let explanationText = q.explanation || "（無詳細說明）";
        let approxCharW = max(6, textWidth("我"));
        let charsPerLine = max(1, floor((groupW - 36) / approxCharW));
        let wrapLines = ceil(explanationText.length / charsPerLine);
        let explanationH = wrapLines * (textAscent() + textDescent() + 6);
        let optsH = (textAscent() + textDescent() + 8) * 2;
        let groupH = titleH + optsH + explanationH + layout.exGroupPadding;

        fill(40, 40, 60);
        noStroke();
        rect(groupX, drawY, groupW, groupH, 8);

        fill(255, 180, 180);
        textSize(round(layout.questionSize * 0.7));
        textAlign(LEFT, TOP);
        text(`問題${i + 1}. ${q.question}`, groupX + 12, drawY + 8, groupW - 24, titleH + 8);

        textSize(round(layout.optionSize * 0.9));
        fill(255);
        let userOpt = userAnswers[qi] ? `${userAnswers[qi]} - ${q.options[userAnswers[qi]]}` : "未作答";
        let yourY = drawY + titleH + 8;
        text(`你的選項：${userOpt}`, groupX + 12, yourY);

        fill(100, 255, 100);
        let correctOpt = `${q.correctAnswer} - ${q.options[q.correctAnswer]}`;
        let correctY = yourY + layout.exLineH;
        text(`正確選項：${correctOpt}`, groupX + 12, correctY);

        fill(200);
        textSize(round(layout.optionSize * 0.9));
        let explainY = correctY + layout.exLineH;
        text(`解釋：${explanationText}`, groupX + 12, explainY, groupW - 24, groupH - (explainY - drawY) - 12);

        drawY += groupH + layout.exGroupGap;
    }
    pop();

    // scrollbar
    let trackX = width - 36;
    let trackY = viewportY + 8;
    let trackW = 12;
    let trackH = viewportH - 16;
    if (explanationContentHeight > viewportH) {
        let thumbMinH = max(40, 36 * layout.scale);
        let thumbH = constrain(map(viewportH, 0, explanationContentHeight, thumbMinH, trackH), thumbMinH, trackH);
        let thumbY = map(explanationScroll, 0, maxScroll, trackY, trackY + trackH - thumbH);
        noStroke();
        fill(60);
        rect(trackX, trackY, trackW, trackH, 6);
        fill(explanationDrag ? 180 : 160);
        rect(trackX, thumbY, trackW, thumbH, 6);
    }

    // 返回按鈕
    textAlign(CENTER, CENTER);
    drawNavButton(width / 2, height - 60, "返回結果");
}

// 很簡單的游標拖尾與自定義游標（避免未定義）
// function drawCursorTrail() {
//     // 簡單保留最近幾個游標位置以產生拖尾
//     cursorTrail.push({ x: mouseX, y: mouseY, t: millis() });
//     if (cursorTrail.length > 12) cursorTrail.shift();
//     noStroke();
//     for (let i = 0; i < cursorTrail.length; i++) {
//         let p = cursorTrail[i];
//         let a = map(i, 0, cursorTrail.length - 1, 40, 200);
//         fill(150, 150, 255, a);
//         ellipse(p.x, p.y, (i + 1) * 2);
//     }
// }

function drawCursorTrail() {
    // 簡單保留最近幾個游標位置以產生拖尾
    cursorTrail.push({ x: mouseX, y: mouseY, t: millis() });
    if (cursorTrail.length > 12) cursorTrail.shift();
    noStroke();
    for (let i = 0; i < cursorTrail.length; i++) {
        let p = cursorTrail[i];
        let a = map(i, 0, cursorTrail.length - 1, 40, 200);
        fill(150, 150, 255, a);
        ellipse(p.x, p.y, (i + 1) * 2);
    }
}

function drawCustomCursor() {
    push();
    noFill();
    stroke(255);
    strokeWeight(1.2);
    ellipse(mouseX, mouseY, 14, 14);
    pop();
}

// 簡單粒子類別（供結果頁使用）
class Particle {
    constructor(x, y) {
        this.x = x + random(-40, 40);
        this.y = y + random(-40, 40);
        this.vx = random(-1, 1);
        this.vy = random(-2, -0.2);
        this.size = random(3, 8);
        this.color = color(random(100, 255), random(100, 255), random(100, 255), 180);
    }
    update(ratio) {
        this.x += this.vx * (1 + ratio * 2);
        this.y += this.vy * (1 + ratio * 2);
        this.vy += 0.02;
        if (this.y > height + 50) {
            this.y = random(-100, -10);
            this.x = width / 2 + random(-200, 200);
        }
    }
    display() {
        noStroke();
        fill(this.color);
        ellipse(this.x, this.y, this.size);
    }
}
