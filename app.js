(function () {
  "use strict";

  var STORAGE_KEY = "item-bank-progress-v1";
  var DATA_URL = "questions.json";

  var QUESTIONS = [];

  var state = {
    domainFilter: "All",
    diffFilter: { Easy: true, Medium: true, Hard: true },
    order: [],
    pos: 0,
    answers: {},
    qStart: null,
    timerHandle: null
  };

  function loadProgress() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && typeof saved === "object" && saved.answers) {
        state.answers = saved.answers;
      }
    } catch (e) { /* ignore, start fresh */ }
  }

  function saveProgress() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ answers: state.answers }));
    } catch (e) { /* storage unavailable, continue silently */ }
  }

  function formatTrap(t) {
    if (!t || t === "NONE") return "";
    return t.toLowerCase().replace(/_/g, " ").replace(/^./, function (c) { return c.toUpperCase(); });
  }

  function computeOrder() {
    var out = [];
    for (var i = 0; i < QUESTIONS.length; i++) {
      var q = QUESTIONS[i];
      if (state.domainFilter !== "All" && q.domain !== state.domainFilter) continue;
      if (!state.diffFilter[q.difficulty]) continue;
      out.push(i);
    }
    return out;
  }

  function currentQuestion() {
    if (state.order.length === 0) return null;
    var idx = state.order[state.pos];
    return QUESTIONS[idx];
  }

  function renderStimulus(text) {
    var lines = text.split("\n");
    var html = "";
    var inList = false;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.trim() === "") continue;
      if (line.trim().indexOf("\u2022") === 0) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += "<li>" + line.trim().substring(1).trim() + "</li>";
      } else {
        if (inList) { html += "</ul>"; inList = false; }
        html += "<p>" + line + "</p>";
      }
    }
    if (inList) html += "</ul>";
    return html;
  }

  function diffDots(difficulty) {
    var levels = { Easy: 1, Medium: 2, Hard: 3 };
    var n = levels[difficulty] || 1;
    var html = '<span class="diff-dots"><span class="label">' + difficulty + "</span>";
    for (var i = 0; i < 3; i++) {
      html += '<span class="dot' + (i < n ? " filled" : "") + '"></span>';
    }
    html += "</span>";
    return html;
  }

  function formatTime(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }

  function stopTimer() {
    if (state.timerHandle) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
    }
  }

  function startTimer() {
    stopTimer();
    state.qStart = Date.now();
    state.timerHandle = setInterval(function () {
      var el = document.getElementById("qTimer");
      if (el) el.textContent = formatTime(Math.floor((Date.now() - state.qStart) / 1000));
    }, 1000);
  }

  function renderQuestion() {
    var area = document.getElementById("questionArea");
    var q = currentQuestion();

    if (!q) {
      area.innerHTML = '<div class="empty-state">No items match the current filters. Try turning a difficulty chip back on.</div>';
      stopTimer();
      updateScoreChip();
      return;
    }

    var recorded = state.answers[q.id];
    var domainClass = q.domain === "Math" ? "math" : "rw";
    var domainLabel = q.domain === "Math" ? "Math" : "Reading & Writing";

    var html = '<div class="card">';
    html += '<div class="card-meta">';
    html += '<span class="domain-tag ' + domainClass + '">' + domainLabel + "</span>";
    html += '<span class="skill-tag">' + q.skillCategory + "</span>";
    html += diffDots(q.difficulty);
    html += '<span class="timer" id="qTimer">0:00</span>';
    html += "</div>";

    html += '<div class="card-body">';
    html += '<div class="stimulus">' + renderStimulus(q.stimulus) + "</div>";
    html += '<div class="stem">' + q.questionStem + "</div>";
    html += '<div class="choices" id="choicesWrap">';

    for (var i = 0; i < q.choices.length; i++) {
      var c = q.choices[i];
      var cls = "choice";
      var showRationale = !!recorded;
      if (recorded) {
        cls += " answered";
        if (c.isCorrect) cls += recorded.chosen === c.letter ? " correct-pick" : " reveal-correct-unpicked";
        else if (recorded.chosen === c.letter) cls += " wrong-pick";
      }
      html += '<button class="' + cls + '" data-letter="' + c.letter + '" ' + (recorded ? "disabled" : "") + ">";
      html += '<span class="letter">' + c.letter + "</span>";
      html += '<span class="body">' + c.text;
      if (showRationale) {
        html += '<span class="rationale">' + c.rationale + "</span>";
        if (!c.isCorrect) {
          var trapLabel = formatTrap(c.trapType);
          if (trapLabel) html += '<span class="trap-chip">Trap: ' + trapLabel + "</span>";
        }
      }
      html += "</span></button>";
    }
    html += "</div>";

    if (recorded) {
      if (recorded.correct) {
        html += '<div class="verdict good"><span class="mark" aria-hidden="true">\u2713</span> Correct.</div>';
      } else {
        html += '<div class="verdict bad"><span class="mark" aria-hidden="true">\u2717</span> Not quite \u2014 the correct answer is ' + q.correctAnswer + ".</div>";
      }

      html += '<details class="study-note"><summary>Study note</summary><div class="note-body">';
      html += '<div class="note-section"><div class="note-label">Core concept</div><div class="note-text">' + q.studyNote.ruleOrPrinciple + "</div></div>";
      html += '<div class="note-section"><div class="note-label">Trap anatomy</div><div class="note-text">' + q.studyNote.trapAlert + "</div></div>";
      html += '<div class="note-section"><div class="note-label">Elimination playbook</div><div class="note-text">' + q.studyNote.strategicShortcut + "</div></div>";
      html += '<div class="vocab-row">';
      for (var v = 0; v < q.studyNote.keyVocabularyOrFormulas.length; v++) {
        html += '<span class="vocab-tag">' + q.studyNote.keyVocabularyOrFormulas[v] + "</span>";
      }
      html += "</div></div></details>";
    }

    html += "</div>"; // card-body

    html += '<div class="card-body" style="padding-top:0;">';
    html += '<div class="bubbles" role="group" aria-label="Jump to item">';
    for (var b = 0; b < state.order.length; b++) {
      var bq = QUESTIONS[state.order[b]];
      var brec = state.answers[bq.id];
      var bcls = "bubble";
      if (b === state.pos) bcls += " current";
      if (brec) bcls += brec.correct ? " done-correct" : " done-wrong";
      html += '<button class="' + bcls + '" data-pos="' + b + '" type="button" aria-label="Item ' + (b + 1) + '">' + (b + 1) + "</button>";
    }
    html += "</div>";

    html += '<div class="nav-row">';
    html += '<button class="nav-btn" id="prevBtn" type="button" ' + (state.pos === 0 ? "disabled" : "") + ">Previous</button>";
    html += '<span style="font-family:var(--font-mono); font-size:0.78rem; color:var(--ink-faint);">' + (state.pos + 1) + " of " + state.order.length + "</span>";
    html += '<button class="nav-btn" id="nextBtn" type="button" ' + (state.pos === state.order.length - 1 ? "disabled" : "") + ">Next</button>";
    html += "</div>";
    html += '<div class="hint-row">Press A\u2013D to answer, and the arrow keys to move between items.</div>';
    html += "</div>"; // card-body 2

    html += "</div>"; // card

    area.innerHTML = html;

    var choiceButtons = area.querySelectorAll(".choice");
    for (var k = 0; k < choiceButtons.length; k++) {
      choiceButtons[k].addEventListener("click", function () {
        if (this.disabled) return;
        answerCurrent(this.getAttribute("data-letter"));
      });
    }
    var bubbleButtons = area.querySelectorAll(".bubble");
    for (var m = 0; m < bubbleButtons.length; m++) {
      bubbleButtons[m].addEventListener("click", function () {
        goTo(parseInt(this.getAttribute("data-pos"), 10));
      });
    }
    var prevBtn = document.getElementById("prevBtn");
    var nextBtn = document.getElementById("nextBtn");
    if (prevBtn) prevBtn.addEventListener("click", function () { goTo(state.pos - 1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { goTo(state.pos + 1); });

    if (!recorded) startTimer(); else stopTimer();

    updateScoreChip();
  }

  function answerCurrent(letter) {
    var q = currentQuestion();
    if (!q || state.answers[q.id]) return;
    stopTimer();
    var elapsed = state.qStart ? Math.floor((Date.now() - state.qStart) / 1000) : 0;
    var correctChoice = null;
    for (var i = 0; i < q.choices.length; i++) {
      if (q.choices[i].isCorrect) correctChoice = q.choices[i].letter;
    }
    state.answers[q.id] = {
      chosen: letter,
      correct: letter === correctChoice,
      timeSeconds: elapsed
    };
    saveProgress();
    renderQuestion();
  }

  function goTo(pos) {
    if (pos < 0 || pos >= state.order.length) return;
    state.pos = pos;
    renderQuestion();
  }

  function updateScoreChip() {
    var total = 0, correct = 0;
    for (var id in state.answers) {
      if (Object.prototype.hasOwnProperty.call(state.answers, id)) {
        total++;
        if (state.answers[id].correct) correct++;
      }
    }
    var chip = document.getElementById("scoreChip");
    if (chip) chip.innerHTML = "<strong>" + correct + "</strong> / " + total + " correct";
  }

  function refilter() {
    var currentQ = currentQuestion();
    state.order = computeOrder();
    if (currentQ) {
      var idx = QUESTIONS.indexOf(currentQ);
      var newPos = state.order.indexOf(idx);
      state.pos = newPos >= 0 ? newPos : 0;
    } else {
      state.pos = 0;
    }
    renderQuestion();
  }

  function openReport() {
    var byDomain = { "Reading and Writing": { total: 0, correct: 0 }, "Math": { total: 0, correct: 0 } };
    var totalAnswered = 0, totalCorrect = 0;
    for (var i = 0; i < QUESTIONS.length; i++) {
      var q = QUESTIONS[i];
      var rec = state.answers[q.id];
      if (rec) {
        totalAnswered++;
        byDomain[q.domain].total++;
        if (rec.correct) { totalCorrect++; byDomain[q.domain].correct++; }
      }
    }
    var body = document.getElementById("reportBody");
    var pct = totalAnswered ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
    var html = "";
    html += '<div class="report-line"><span>Answered</span><span>' + totalAnswered + " / " + QUESTIONS.length + "</span></div>";
    html += '<div class="report-line"><span>Accuracy</span><span>' + pct + "% (" + totalCorrect + " correct)</span></div>";
    html += '<div class="report-line"><span>Reading &amp; Writing</span><span>' + byDomain["Reading and Writing"].correct + " / " + byDomain["Reading and Writing"].total + "</span></div>";
    html += '<div class="report-line"><span>Math</span><span>' + byDomain["Math"].correct + " / " + byDomain["Math"].total + "</span></div>";
    body.innerHTML = html;
    document.getElementById("report").showModal();
  }

  function resetProgress() {
    state.answers = {};
    saveProgress();
    document.getElementById("report").close();
    refilter();
  }

  function initControls() {
    var domainTabs = document.querySelectorAll("#domainTabs button");
    for (var i = 0; i < domainTabs.length; i++) {
      domainTabs[i].addEventListener("click", function () {
        for (var j = 0; j < domainTabs.length; j++) domainTabs[j].setAttribute("aria-pressed", "false");
        this.setAttribute("aria-pressed", "true");
        state.domainFilter = this.getAttribute("data-domain");
        refilter();
      });
    }

    var diffChips = document.querySelectorAll("#diffChips .chip");
    for (var d = 0; d < diffChips.length; d++) {
      diffChips[d].addEventListener("click", function () {
        var diff = this.getAttribute("data-diff");
        var nowOn = this.getAttribute("aria-pressed") !== "true";
        this.setAttribute("aria-pressed", nowOn ? "true" : "false");
        state.diffFilter[diff] = nowOn;
        refilter();
      });
    }

    document.getElementById("reportBtn").addEventListener("click", openReport);
    document.getElementById("closeReportBtn").addEventListener("click", function () {
      document.getElementById("report").close();
    });
    document.getElementById("resetBtn").addEventListener("click", resetProgress);

    document.addEventListener("keydown", function (e) {
      var dialogEl = document.getElementById("report");
      if (dialogEl.open) return;
      var key = e.key.toUpperCase();
      if (["A", "B", "C", "D"].indexOf(key) !== -1) {
        var q = currentQuestion();
        if (q && !state.answers[q.id]) answerCurrent(key);
      } else if (["1", "2", "3", "4"].indexOf(key) !== -1) {
        var letters = ["A", "B", "C", "D"];
        var q2 = currentQuestion();
        if (q2 && !state.answers[q2.id]) answerCurrent(letters[parseInt(key, 10) - 1]);
      } else if (e.key === "ArrowRight") {
        goTo(state.pos + 1);
      } else if (e.key === "ArrowLeft") {
        goTo(state.pos - 1);
      } else if (key === "R") {
        openReport();
      }
    });
  }

  function showLoading() {
    document.getElementById("questionArea").innerHTML = '<div class="load-state">Loading item bank\u2026</div>';
  }

  function showLoadError(err) {
    document.getElementById("questionArea").innerHTML =
      '<div class="error-state">Could not load <code>questions.json</code> (' + err + ').<br><br>' +
      'Most browsers block a page opened directly from disk (a <code>file://</code> URL) from fetching a local JSON file. ' +
      'Serve this folder instead \u2014 for example, run <code>python3 -m http.server</code> inside the <code>item-bank</code> folder and open ' +
      '<code>http://localhost:8000</code>, or open the folder in VS Code with the Live Server extension.</div>';
  }

  function init() {
    showLoading();
    loadProgress();
    initControls();
    fetch(DATA_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        QUESTIONS = data;
        state.order = computeOrder();
        renderQuestion();
      })
      .catch(function (err) {
        showLoadError(err.message || err);
      });
  }

  init();
})();
