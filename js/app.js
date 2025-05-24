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

const setupSection = document.getElementById('setup-section');
const quizSection = document.getElementById('quiz-section');
const resultSection = document.getElementById('result-section');
const questionText = document.getElementById('question-text');
const questionImage = document.getElementById('question-image');
const optionsForm = document.getElementById('options-form');
const feedback = document.getElementById('feedback');
const scoreDiv = document.getElementById('score');

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
document.getElementById('submit-btn').addEventListener('click', submitAnswer);
document.getElementById('restart-btn').addEventListener('click', () => {
    resultSection.classList.add('hidden');
    setupSection.classList.remove('hidden');
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

function startTimer() {
    const timerDiv = document.getElementById('timer');
    const timerValue = document.getElementById('timer-value');
    timerDiv.classList.remove('hidden');
    startTime = Date.now();
    timerValue.textContent = '00:00';
    timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
        const sec = String(elapsed % 60).padStart(2, '0');
        timerValue.textContent = `${min}:${sec}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
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
    setupSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    quizSection.classList.remove('hidden');
    startTimer();
    showQuestion();
}

function showQuestion() {
    // 強制隱藏高權重題目列表
    const weightedList = document.getElementById('weighted-list');
    if (weightedList) weightedList.style.display = 'none';
    feedback.textContent = '';
    optionsForm.innerHTML = '';
    const q = quizQuestions[current];
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
    let optionList = q.options.map((opt, idx) => ({ opt, idx }));
    if (answerOrder === 'shuffle') {
        optionList = shuffle(optionList);
    }
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
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = item.opt;
        label.style.margin = 0;
        wrapper.appendChild(input);
        wrapper.appendChild(label);
        optionsForm.appendChild(wrapper);
    });
    // 顯示詳細說明欄位（僅於有設定時）
    let explanationDiv = document.getElementById('explanation');
    if (!explanationDiv) {
        explanationDiv = document.createElement('div');
        explanationDiv.id = 'explanation';
        explanationDiv.style.whiteSpace = 'pre-line';
        explanationDiv.style.marginTop = '16px';
        explanationDiv.style.background = '#f8f8f8';
        explanationDiv.style.borderLeft = '4px solid #3498db';
        explanationDiv.style.padding = '10px 16px';
        explanationDiv.style.display = 'none';
        quizSection.appendChild(explanationDiv);
    }
    // 將 \n 轉為 <br> 以支援多行顯示
    if (q.explanation) {
        explanationDiv.innerHTML = q.explanation.replace(/\n/g, '<br>');
    } else {
        explanationDiv.innerHTML = '';
    }
    explanationDiv.style.display = 'none';
    // 隱藏繼續按鈕
    let nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.style.display = 'none';
}

function submitAnswer(e) {
    e.preventDefault();
    const q = quizQuestions[current];
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
    if (correct) {
        score++;
        feedback.textContent = '✔️ 答對了！';
        feedback.style.color = '#27ae60';
    } else {
        feedback.textContent = '❌ 答錯了！正確答案：' + answerZeroBased.map(i => q.options[i]).join('、');
        feedback.style.color = '#e74c3c';
        wrongQuestions.push({ q, selected });
    }
    // 顯示詳細說明欄位（若有）
    const explanationDiv = document.getElementById('explanation');
    if (q.explanation) {
        explanationDiv.innerHTML = q.explanation.replace(/\n/g, '<br>');
        explanationDiv.style.display = 'block';
    } else if (explanationDiv) {
        explanationDiv.style.display = 'none';
    }
    // 顯示繼續按鈕
    let nextBtn = document.getElementById('next-btn');
    if (!nextBtn) {
        nextBtn = document.createElement('button');
        nextBtn.id = 'next-btn';
        nextBtn.textContent = '繼續下一題';
        //nextBtn.style.marginLeft = '12px';
        nextBtn.addEventListener('click', goNextQuestion);
        quizSection.appendChild(nextBtn);
    }
    nextBtn.style.display = 'inline-block';
    // 禁用提交按鈕避免重複作答
    document.getElementById('submit-btn').disabled = true;
}

function goNextQuestion(e) {
    e.preventDefault();
    let nextBtn = document.getElementById('next-btn');
    if (nextBtn) nextBtn.style.display = 'none';
    document.getElementById('submit-btn').disabled = false;
    current++;
    if (current < total) {
        showQuestion();
    } else {
        showResult();
    }
}

function showResult() {
    // 強制隱藏高權重題目列表
    const weightedList = document.getElementById('weighted-list');
    if (weightedList) weightedList.style.display = 'none';
    quizSection.classList.add('hidden');
    resultSection.classList.remove('hidden');
    const percent = total > 0 ? Math.round((score / total) * 100) : 0;
    stopTimer();
    // 顯示總用時
    const timerDiv = document.getElementById('timer');
    timerDiv.classList.remove('hidden');
    const timerValue = document.getElementById('timer-value').textContent;
    let html = `您的分數：${score} / ${total}　正確率：${percent}%<br>總作答時間：${timerValue}`;
    // 新增正確率圖形
    html += '<div style="width:120px;margin:18px auto 0 auto;"><canvas id="accuracyChart" width="120" height="120"></canvas></div>';
    if (wrongQuestions.length > 0) {
        html += '<br><br><b>您答錯的題目：</b><ol style="margin-top:6px; color:#e74c3c;">';
        wrongQuestions.forEach(item => {
            // item: { q, selected }
            const q = item.q;
            // 使用者答案（1-based轉文字）
            let userAns = item.selected.map(idx => q.options[idx] || '').join('、');
            if (!userAns) userAns = '<span style="color:#aaa">未作答</span>';
            // 正確答案（1-based轉文字）
            const correctAns = (q.answer.map(idx => q.options[idx - 1] || '').join('、'));
            html += `<li style='margin-bottom:12px;'>
                <div>${q.question}</div>
                <div style='font-size:0.98em;margin-top:2px;'>
                  <span style='color:#888'>您的答案：</span><span style='color:#222'>${userAns}</span><br>
                  <span style='color:#888'>正確答案：</span><span style='color:#222'>${correctAns}</span>
                </div>
            </li>`;
        });
        html += '</ol>';
    }
    scoreDiv.innerHTML = html;
    // 畫正確率圖
    setTimeout(() => {
        if (document.getElementById('accuracyChart')) {
            drawAccuracyChart(percent);
        }
    }, 0);
}

// 新增正確率圖形函式
function drawAccuracyChart(percent) {
    const canvas = document.getElementById('accuracyChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 120, 120);
    // 背景圓
    ctx.beginPath();
    ctx.arc(60, 60, 50, 0, 2 * Math.PI);
    ctx.strokeStyle = '#eee';
    ctx.lineWidth = 16;
    ctx.stroke();
    // 正確率圓弧
    ctx.beginPath();
    ctx.arc(60, 60, 50, -Math.PI / 2, (2 * Math.PI) * (percent / 100) - Math.PI / 2);
    ctx.strokeStyle = '#4caf50';
    ctx.lineWidth = 16;
    ctx.stroke();
    // 文字
    ctx.font = '24px Arial';
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(percent + '%', 60, 60);
}

// 在重新開始時清空錯誤題目
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
    setupSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    quizSection.classList.remove('hidden');
    startTimer();
    showQuestion();
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function arraysEqual(a, b) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
}

function showWeightedQuestionsList() {
    // 篩選權重大於1的題目
    const weighted = questions
        .map((q, idx) => ({
            id: q.id || (idx + 1),
            weight: q.weight || 1,
            question: q.question
        }))
        .filter(q => q.weight > 1)
        .sort((a, b) => b.weight - a.weight);
    let listDiv = document.getElementById('weighted-list');
    if (!listDiv) {
        listDiv = document.createElement('div');
        listDiv.id = 'weighted-list';
        document.querySelector('.container').appendChild(listDiv);
    }
    // 嚴格控制只在 setup-section 顯示時才顯示
    if (weighted.length === 0 || setupSection.classList.contains('hidden')) {
        listDiv.style.display = 'none';
        return;
    }
    // 只顯示兩欄：編號(權重)、題目
    let html = '<b>高權重題目列表：</b><br><table style="width:100%;margin-top:6px;font-size:0.98em;"><tr><th style="text-align:left;width:60px;">編號</th><th style="text-align:left;">題目</th></tr>';
    weighted.forEach(q => {
        const idStr = String(q.id).padStart(3, '0');
        html += `<tr><td>${idStr}.(x${q.weight})</td><td>${q.question}</td></tr>`;
    });
    html += '</table>';
    listDiv.innerHTML = html;
    listDiv.style.display = 'block';
}

// 重新顯示 setup-section 時也要重新顯示高權重題目列表
const restartBtn = document.getElementById('restart-btn');
if (restartBtn) {
    restartBtn.addEventListener('click', () => {
        setTimeout(() => {
            showWeightedQuestionsList();
        }, 0);
    });
}
