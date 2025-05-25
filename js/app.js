// app.js
let questions = [];
let quizQuestions = [];
let current = 0;
let score = 0;
let total = 0;
let timerInterval;
let startTime = 0;
let wrongQuestions = [];
let answerOrder = 'original'; // 新增答案順序全域變數
let answers = {}; // 新增：記錄每題最新作答狀態

let examDuration = 60; // 單位：分鐘
let remainTime = 0;
let remainTimerInterval;

const setupSection = document.getElementById('setup-section');
const quizSection = document.getElementById('quiz-section');
const resultSection = document.getElementById('result-section');
const questionText = document.getElementById('question-text');
const questionImage = document.getElementById('question-image');
const optionsForm = document.getElementById('options-form');
const feedback = document.getElementById('feedback');
const scoreDiv = document.getElementById('score');

let optionListPerQuestion = {}; // 新增：記錄每題選項順序

// 載入題庫
fetch('data/questions.json')
    .then(res => res.json())
    .then(data => {
        questions = data;
        document.getElementById('start-btn').disabled = false;
        // 自動設定題號範圍最大值
        const rangeEndInput = document.getElementById('question-range-end');
        if (rangeEndInput) rangeEndInput.value = data.length;
        showWeightedQuestionsList();
    });

document.getElementById('start-btn').addEventListener('click', startQuiz);
// 改用事件委派，確保動態產生的 options-form submit 也能觸發
// document.getElementById('options-form').addEventListener('submit', submitAnswer);
document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'options-form') {
        submitAnswer(e);
    }
});
document.getElementById('restart-btn').addEventListener('click', () => {
    resultSection.classList.add('hidden');
    setupSection.classList.remove('hidden');
    showWeightedQuestionsList(); // 確保回首頁時權重列表顯示
});
document.getElementById('download-json-btn').addEventListener('click', function () {
    // 取得目前記憶體中的 questions 陣列
    const dataStr = JSON.stringify(questions, null, 4);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'questions.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});
document.getElementById('quit-btn').addEventListener('click', () => {
    // 結束測驗，回到一開始畫面
    quizSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    setupSection.classList.remove('hidden');
    stopTimer();
    showWeightedQuestionsList();
    // 重新啟用提交按鈕
    setTimeout(() => {
        const submitBtn = document.getElementById('submit-btn');
        if (submitBtn) {
            submitBtn.disabled = false;
            // 先移除舊事件再重新綁定，避免多重綁定
            submitBtn.replaceWith(submitBtn.cloneNode(true));
            const newSubmitBtn = document.getElementById('submit-btn');
            if (newSubmitBtn) newSubmitBtn.addEventListener('click', submitAnswer);
        }
    }, 100);
});
document.getElementById('preview-json-btn').addEventListener('click', function () {
    // 取得目前記憶體中的 questions 陣列
    const previewContent = document.getElementById('json-preview-content');
    if (previewContent) {
        // 顯示所有題目
        const previewText = JSON.stringify(questions, null, 4);
        previewContent.textContent = previewText;
    }
    // 顯示 Bootstrap modal
    const modal = new bootstrap.Modal(document.getElementById('json-preview-modal'));
    modal.show();
});

function startTimer() {
    const timerDiv = document.getElementById('timer');
    const timerValue = document.getElementById('timer-value');
    timerDiv.classList.remove('hidden');
    startTime = Date.now();
    timerValue.textContent = '00:00';
    timerDiv.style.color = '#495057';
    timerDiv.setAttribute('data-mode', 'elapsed');
    timerDiv.innerHTML = '已用時間：<span id="timer-value">00:00</span>';
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const sec = String(elapsed % 60).padStart(2, '0');
        document.getElementById('timer-value').textContent = `${min}:${sec}`;
    }, 1000);
}

function startRemainTimer() {
    const timerDiv = document.getElementById('timer');
    timerDiv.classList.remove('hidden');
    timerDiv.style.color = '#d35400';
    timerDiv.setAttribute('data-mode', 'remain');
    function updateRemain() {
        if (remainTime <= 0) {
            timerDiv.innerHTML = '<span style="color:#e74c3c;">測驗已結束</span>';
            clearInterval(remainTimerInterval);
            // 自動交卷
            showResult();
            return;
        }
        const min = String(Math.floor(remainTime / 60)).padStart(2, '0');
        const sec = String(remainTime % 60).padStart(2, '0');
        timerDiv.innerHTML = `剩餘時間：<span id="remain-timer-value">${min}:${sec}</span>`;
        remainTime--;
    }
    updateRemain();
    remainTimerInterval = setInterval(updateRemain, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
    clearInterval(remainTimerInterval);
}

// 新增 buildWeightedPool 與 getRandomQuestions，支援題目權重加權隨機抽題
function buildWeightedPool(questions) {
    const pool = [];
    questions.forEach(q => {
        const w = q.weight || 1;
        for (let i = 0; i < w; i++) {
            pool.push(q);
        }
    });
    return pool;
}

function getRandomQuestions(questions, count) {
    const pool = buildWeightedPool(questions);
    const selected = [];
    const usedIds = new Set();
    while (selected.length < count && pool.length > 0) {
        const idx = Math.floor(Math.random() * pool.length);
        const q = pool[idx];
        if (!usedIds.has(q.id)) {
            selected.push(q);
            usedIds.add(q.id);
        }
        // 移除所有該題的分身，避免重複
        for (let i = pool.length - 1; i >= 0; i--) {
            if (pool[i].id === q.id) pool.splice(i, 1);
        }
    }
    return selected;
}

// 合併 startQuiz，並在最前面強制隱藏 weighted-list
function startQuiz() {
    // 強制隱藏高權重題目列表
    const weightedList = document.getElementById('weighted-list');
    if (weightedList) weightedList.style.display = 'none';
    // 讀取答案順序設定
    const orderRadio = document.querySelector('input[name="answer-order"]:checked');
    answerOrder = orderRadio ? orderRadio.value : 'original';
    let countValue = document.getElementById('question-count').value;
    let count;
    if (countValue === 'all') {
        count = questions.length;
    } else {
        count = parseInt(countValue, 10);
    }
    // 取得範圍
    let rangeStart = parseInt(document.getElementById('question-range-start').value, 10);
    let rangeEnd = parseInt(document.getElementById('question-range-end').value, 10);
    if (isNaN(rangeStart) || rangeStart < 1) rangeStart = 1;
    if (isNaN(rangeEnd) || rangeEnd < 1) rangeEnd = questions.length;
    if (rangeStart > rangeEnd) [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
    rangeStart = Math.max(1, rangeStart);
    rangeEnd = Math.min(questions.length, rangeEnd);
    // 篩選範圍內題目
    const rangedQuestions = questions.slice(rangeStart - 1, rangeEnd);
    total = Math.min(count, rangedQuestions.length);
    quizQuestions = getRandomQuestions(rangedQuestions, total);
    current = 0;
    score = 0;
    wrongQuestions = [];
    answers = {}; // 開始測驗時清空作答紀錄
    setupSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    quizSection.classList.remove('hidden');
    // 讀取測驗時間
    const durationInput = document.getElementById('exam-duration');
    examDuration = 60;
    if (durationInput) {
        let val = parseInt(durationInput.value, 10);
        if (!isNaN(val) && val > 0) examDuration = val;
    }
    remainTime = examDuration * 60;
    stopTimer();
    // 記錄開始作答時間
    startTime = Date.now();
    // 僅啟動 startRemainTimer，不要同時啟動 startTimer
    if (remainTime > 0) {
        startRemainTimer();
    } else {
        const timerDiv = document.getElementById('timer');
        timerDiv.innerHTML = '<span style="color:#e74c3c;">測驗已結束</span>';
        timerDiv.classList.remove('hidden');
    }
    showQuestion();
    setupJumpSelect(); // showQuestion 之後呼叫，確保 current/total 正確
}

function setupJumpSelect() {
    const jumpSelect = document.getElementById('jump-select');
    const jumpBtn = document.getElementById('jump-btn');
    if (!jumpSelect || !jumpBtn) return;
    jumpSelect.innerHTML = '';
    if (total > 0) {
        for (let i = 0; i < total; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `第 ${i + 1} 題`;
            jumpSelect.appendChild(opt);
        }
        jumpSelect.value = current;
        jumpSelect.style.display = '';
        jumpBtn.style.display = '';
    } else {
        jumpSelect.style.display = 'none';
        jumpBtn.style.display = 'none';
    }
    // 先移除舊事件再註冊，避免重複
    jumpBtn.onclick = null;
    jumpBtn.onclick = function () {
        const idx = parseInt(jumpSelect.value, 10);
        if (!isNaN(idx) && idx >= 0 && idx < total) {
            current = idx;
            showQuestion();
        }
    };
}

// 在 showQuestion 時同步更新下拉選單選項
function showQuestion() {
    // 強制隱藏高權重題目列表
    const weightedList = document.getElementById('weighted-list');
    if (weightedList) weightedList.style.display = 'none';
    feedback.textContent = '';
    optionsForm.innerHTML = '';
    optionsForm.style.display = '';
    optionsForm.classList.remove('hidden'); // 新增：確保答案區塊顯示
    const q = quizQuestions[current];
    // debug: 檢查題目與選項
    console.log('showQuestion', q);
    // 顯示進度
    const progressDiv = document.getElementById('progress-info');
    progressDiv.textContent = `第 ${current + 1} / ${total} 題　進度：${Math.round(((current + 1) / total) * 100)}%`;
    // 題目文字（不再顯示進度）
    questionText.textContent = q.question;
    // 圖片
    if (q.image) {
        questionImage.innerHTML = `<img src="${q.image}" alt="題目圖片">`;
    } else {
        questionImage.innerHTML = '';
    }
    // 處理選項順序
    let optionList = q.options ? q.options.map((opt, idx) => ({ opt, idx })) : [];
    if (answerOrder === 'shuffle') {
        optionList = shuffle(optionList);
    }
    // 記錄本題的 optionList 供 submitAnswer 用
    optionListPerQuestion[current] = optionList;
    // 單選或複選
    optionList.forEach((item, i) => {
        const id = `opt${i}`;
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.marginBottom = '8px';
        const input = document.createElement('input');
        input.type = q.answer.length > 1 ? 'checkbox' : 'radio';
        input.name = 'option';
        input.value = item.idx; // value 設為原始 index
        input.id = id;
        input.style.marginRight = '8px';
        // 新增：選項前加上數字
        const numberSpan = document.createElement('span');
        numberSpan.textContent = (i + 1) + '. ';
        numberSpan.style.marginRight = '4px';
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = item.opt;
        label.style.margin = 0;
        wrapper.appendChild(input);
        wrapper.appendChild(numberSpan);
        wrapper.appendChild(label);
        optionsForm.appendChild(wrapper);
    });
    // 動態產生提交答案按鈕
    let submitBtn = document.createElement('button');
    submitBtn.id = 'submit-btn';
    submitBtn.type = 'submit';
    submitBtn.className = 'btn btn-success';
    submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 提交答案';
    // 不再加 onclick，交由表單 submit 處理
    optionsForm.appendChild(submitBtn);
    // 顯示詳細說明欄位（僅於有設定時）
    let explanationDiv = document.getElementById('explanation');
    if (!explanationDiv) {
        explanationDiv = document.createElement('div');
        explanationDiv.id = 'explanation';
        explanationDiv.style.whiteSpace = 'pre-line';
        explanationDiv.style.marginTop = '22px';
        explanationDiv.style.background = '#f8f8f8';
        explanationDiv.style.borderLeft = '4px solid #3498db';
        explanationDiv.style.padding = '10px 16px';
        explanationDiv.style.display = 'none';
        quizSection.appendChild(explanationDiv);
    }
    // 一律隱藏說明，避免未作答就顯示
    explanationDiv.style.display = 'none';
    // 隱藏繼續按鈕
    let nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.style.display = 'none';
    // 更新跳題下拉選單選中狀態，並確保顯示與內容正確
    setupJumpSelect();
}

function submitAnswer(e) {
    console.log('submitAnswer called'); // debug: 確認事件有無觸發
    e.preventDefault();
    const q = quizQuestions[current];
    const optionList = optionListPerQuestion[current] || [];
    let selected = [];
    if (q.answer.length > 1) {
        // 複選
        optionsForm.querySelectorAll('input[type=checkbox]:checked').forEach(i => selected.push(Number(i.value)));
    } else {
        // 單選
        const checked = optionsForm.querySelector('input[type=radio]:checked');
        if (checked) selected.push(Number(checked.value));
    }
    if (selected.length === 0) {
        feedback.textContent = '請選擇答案';
        return;
    }
    // 將 answer 轉為 0-based 以比對
    const answerZeroBased = q.answer.map(idx => idx - 1);
    const correct = arraysEqual(selected.sort(), answerZeroBased.slice().sort());
    // 覆蓋 answers 紀錄
    answers[current] = { correct, selected: selected.slice() };
    // 重新計算分數
    score = Object.values(answers).filter(a => a.correct).length;
    // 更新 wrongQuestions
    wrongQuestions = [];
    Object.entries(answers).forEach(([idx, a]) => {
        if (!a.correct) {
            wrongQuestions.push({ q: quizQuestions[idx], selected: a.selected });
        }
    });
    if (correct) {
        feedback.textContent = '✔️ 答對了！';
        feedback.style.color = '#27ae60';
    } else {
        // 反查正確答案在畫面上的選項代號（1-based）
        const correctIdxs = answerZeroBased.map(ansIdx => {
            for (let i = 0; i < optionList.length; i++) {
                if (optionList[i].idx === ansIdx) return i + 1;
            }
            return '?';
        });
        feedback.textContent = '❌ 答錯了！正確答案選項：' + correctIdxs.join('、');
        feedback.style.color = '#e74c3c';
        wrongQuestions.push({ q, selected });
    }
    // 取得提交答案按鈕
    const submitBtn = document.getElementById('submit-btn');
    // 建立一個容器，水平排列 feedback 與 nextBtn
    let feedbackNextContainer = document.getElementById('feedback-next-container');
    if (!feedbackNextContainer) {
        feedbackNextContainer = document.createElement('span');
        feedbackNextContainer.id = 'feedback-next-container';
        feedbackNextContainer.style.display = 'inline-flex';
        feedbackNextContainer.style.alignItems = 'baseline'; // baseline 對齊
        feedbackNextContainer.style.marginLeft = '16px';
        submitBtn.parentNode.insertBefore(feedbackNextContainer, submitBtn.nextSibling);
    } else {
        feedbackNextContainer.innerHTML = '';
    }
    // 設定 feedback 樣式
    feedback.style.display = 'inline-block';
    feedback.style.margin = '0 12px 0 0';
    // 將 feedback 移到容器內
    feedbackNextContainer.appendChild(feedback);
    let nextBtn = document.getElementById('next-btn');
    if (!nextBtn) {
        nextBtn = document.createElement('button');
        nextBtn.id = 'next-btn';
        nextBtn.setAttribute("class", "btn btn-primary");
        nextBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (current === total - 1) {
                if (confirm('已經是最後一題，確定要交卷嗎？')) {
                    goNextQuestion(e);
                }
            } else {
                goNextQuestion(e);
            }
        });
    }
    // 根據是否為最後一題調整按鈕文字
    if (current === total - 1) {
        nextBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 答完交卷';
    } else {
        nextBtn.innerHTML = '<i class="fa-solid fa-forward-step"></i> 繼續下一題';
    }
    // 將 nextBtn 也放到 feedbackNextContainer
    feedbackNextContainer.appendChild(nextBtn);
    // 顯示詳細說明欄位（若有）
    const explanationDiv = document.getElementById('explanation');
    if (q.explanation) {
        explanationDiv.innerHTML = '<span class="explanation-info">答題說明：</span><br />' + q.explanation.replace(/\n/g, '<br>');
        explanationDiv.style.display = 'block';
    } else if (explanationDiv) {
        explanationDiv.style.display = 'none';
    }
    // 禁用提交按鈕避免重複作答
    document.getElementById('submit-btn').disabled = true;
    // optionsForm.classList.add('hidden'); // 移除這行，讓答案區塊不會隱藏
}

document.addEventListener('DOMContentLoaded', function () {
    const jumpBtn = document.getElementById('jump-btn');
    if (jumpBtn) {
        jumpBtn.addEventListener('click', () => {
            const jumpSelect = document.getElementById('jump-select');
            if (!jumpSelect) return;
            const idx = parseInt(jumpSelect.value, 10);
            if (!isNaN(idx) && idx >= 0 && idx < total) {
                current = idx;
                showQuestion();
            }
        });
    }
});

function goNextQuestion(e) {
    e.preventDefault();
    optionsForm.classList.remove('hidden'); // 新增：進入下一題時顯示答案區
    let nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.style.display = 'none';
    document.getElementById('submit-btn').disabled = false;
    current++;
    if (current < total) {
        showQuestion();
    } else {
        console.log('goNextQuestion: call showResult, current:', current, 'total:', total);
        showResult();
    }
}

function showResult() {
    console.log('showResult: start');
    // 強制隱藏高權重題目列表
    const weightedList = document.getElementById('weighted-list');
    if (weightedList) weightedList.style.display = 'none';
    quizSection.classList.add('hidden');
    resultSection.classList.remove('hidden');
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    stopTimer();
    // 正確計算總作答時間
    let usedSeconds = 0;
    if (typeof startTime === 'number' && startTime > 0) {
        usedSeconds = Math.floor((Date.now() - startTime) / 1000);
    }
    const min = String(Math.floor(usedSeconds / 60)).padStart(2, '0');
    const sec = String(usedSeconds % 60).padStart(2, '0');
    const usedTimeStr = `${min}:${sec}`;
    // 先顯示分數、正確率、圖表
    let html = `您的分數：${score} / ${total}　正確率：${percent}%<br>總作答時間：${usedTimeStr}`;
    scoreDiv.innerHTML = html;
    // 確保 canvas 存在且清空內容
    const chartCanvas = document.getElementById('accuracyChart');
    if (chartCanvas) {
        chartCanvas.width = 200;
        chartCanvas.height = 200;
        const ctx = chartCanvas.getContext('2d');
        ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    }
    // 畫正確率圖
    setTimeout(() => {
        if (document.getElementById('accuracyChart')) {
            drawAccuracyChart(percent);
        }
    }, 0);
    // 移動 [再考一次] 按鈕到錯題區塊上方
    const resultSectionDiv = document.getElementById('result-section');
    const restartBtn = document.getElementById('restart-btn');
    let wrongBlock = document.getElementById('wrong-list-block');
    if (!wrongBlock) {
        wrongBlock = document.createElement('div');
        wrongBlock.id = 'wrong-list-block';
    }
    // 生成錯題內容
    let wrongHtml = '';
    if (wrongQuestions.length > 0) {
        wrongHtml += '您答錯的題目：</b><ol style="margin-top:6px; color:#e74c3c;">';
        wrongQuestions.forEach(item => {
            const q = item.q;
            let userAns = item.selected.map(idx => q.options[idx] || '').join('、');
            if (!userAns) userAns = '<span style="color:#aaa">未作答</span>';
            const correctAns = (q.answer.map(idx => q.options[idx - 1] || '').join('、'));
            wrongHtml += `<li style='margin-bottom:12px;'>
                <div>${q.question}</div>
                <div style='font-size:0.98em;margin-top:2px;'>
                  <span style='color:#888'>您的答案：</span><span style='color:#222'>${userAns}</span><br>
                  <span style='color:#888'>正確答案：</span><span style='color:#222'>${correctAns}</span>
                </div>
            </li>`;
        });
        wrongHtml += '</ol>';
    }
    wrongBlock.innerHTML = wrongHtml;
    // 先移動 [再考一次] 按鈕到 canvas 下方、錯題區塊上方
    const canvasDiv = chartCanvas ? chartCanvas.parentNode : null;
    if (restartBtn && canvasDiv) {
        // 先移除再插入，避免重複
        resultSectionDiv.removeChild(restartBtn);
        if (canvasDiv.nextSibling) {
            resultSectionDiv.insertBefore(restartBtn, canvasDiv.nextSibling);
        } else {
            resultSectionDiv.appendChild(restartBtn);
        }
    }
    // 錯題區塊永遠在最下方
    if (wrongBlock.parentNode !== resultSectionDiv) {
        resultSectionDiv.appendChild(wrongBlock);
    } else {
        resultSectionDiv.appendChild(wrongBlock); // 保證順序
    }
    console.log('showResult: end, resultSection.hidden:', resultSection.classList.contains('hidden'));
}

// 新增正確率圖形函式
let accuracyChartInstance = null;

function drawAccuracyChart(percent) {
    const ctx = document.getElementById('accuracyChart').getContext('2d');
    // 若已存在 Chart 實例，先銷毀
    if (accuracyChartInstance) {
        accuracyChartInstance.destroy();
    }
    accuracyChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['正確', '錯誤'],
            datasets: [{
                data: [percent, 100 - percent],
                backgroundColor: ['#4caf50', '#eee'],
                borderWidth: 2
            }]
        },
        options: {
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
                title: {
                    display: true,
                    text: percent + '%',
                    color: '#333',
                    font: { size: 28 }
                }
            }
        }
    });
}

// 強化 showWeightedQuestionsList()，每次呼叫都自動顯示 weighted-list
function showWeightedQuestionsList() {
    const weightedList = document.getElementById('weighted-list');
    if (!weightedList) return;
    // 只在 setup-section 顯示
    if (setupSection.classList.contains('hidden')) {
        weightedList.style.display = 'none';
        return;
    }
    // 過濾權重>1
    const highWeight = questions.filter(q => (q.weight || 1) > 1);
    if (highWeight.length === 0) {
        weightedList.innerHTML = '';
        weightedList.style.display = 'none';
        return;
    }
    // 依權重排序
    highWeight.sort((a, b) => (b.weight || 1) - (a.weight || 1));
    let html = '<b>高權重題目列表（僅出題前顯示）：</b><ul style="margin-top:8px;">';
    highWeight.forEach(q => {
        html += `<li>第${q.id}題（權重${q.weight}）：${q.question.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</li>`;
    });
    html += '</ul>';
    weightedList.innerHTML = html;
    weightedList.style.display = '';
}

// 陣列內容完全相等判斷
function arraysEqual(a, b) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

// Fisher-Yates 洗牌演算法
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
