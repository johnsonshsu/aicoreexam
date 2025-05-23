// app.js
let questions = [];
let quizQuestions = [];
let current = 0;
let score = 0;
let total = 0;
let timerInterval;
let startTime = 0;

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
    });

document.getElementById('start-btn').addEventListener('click', startQuiz);
document.getElementById('submit-btn').addEventListener('click', submitAnswer);
document.getElementById('restart-btn').addEventListener('click', () => {
    resultSection.classList.add('hidden');
    setupSection.classList.remove('hidden');
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

// 修改 startQuiz 與 showResult
function startQuiz() {
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
    quizQuestions = shuffle([...rangedQuestions]).slice(0, total);
    current = 0;
    score = 0;
    setupSection.classList.add('hidden');
    resultSection.classList.add('hidden');
    quizSection.classList.remove('hidden');
    startTimer();
    showQuestion();
}

function showQuestion() {
    feedback.textContent = '';
    optionsForm.innerHTML = '';
    const q = quizQuestions[current];
    questionText.textContent = `(${current + 1}/${total}) ` + q.question;
    // 圖片
    if (q.image) {
        questionImage.innerHTML = `<img src="${q.image}" alt="題目圖片">`;
    } else {
        questionImage.innerHTML = '';
    }
    // 單選或複選
    q.options.forEach((opt, idx) => {
        const id = `opt${idx}`;
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.marginBottom = '8px';
        const input = document.createElement('input');
        input.type = q.answer.length > 1 ? 'checkbox' : 'radio';
        input.name = 'option';
        input.value = idx;
        input.id = id;
        input.style.marginRight = '8px';
        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = opt;
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
        nextBtn.style.marginLeft = '12px';
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
    quizSection.classList.add('hidden');
    resultSection.classList.remove('hidden');
    scoreDiv.textContent = `您的分數：${score} / ${total}`;
    stopTimer();
    // 顯示總用時
    const timerDiv = document.getElementById('timer');
    timerDiv.classList.remove('hidden');
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
