// app.js - fetches results from the Flask backend and renders the dashboard.
// This is genuine client-server communication: the numbers on this page are
// never hard-coded, they're requested live from /api/latest and /api/history
// every time this page loads.

async function loadDashboard() {
  const latest = await fetch("/api/latest").then(r => r.json());

  if (latest.empty) {
    document.getElementById("emptyState").style.display = "block";
    document.getElementById("generated").textContent = "No data yet";
    return;
  }

  document.getElementById("mainContent").style.display = "block";
  const run = latest.run;

  document.getElementById("generated").textContent =
    "Latest run: " + run.timestamp;
  document.getElementById("totalReps").textContent =
    String(run.total_reps).padStart(3, "0");
  document.getElementById("totalRecordings").textContent = run.total_recordings;

  const history = await fetch("/api/history").then(r => r.json());
  document.getElementById("totalRuns").textContent = history.length;

  const accText = run.acc_loso != null ? run.acc_loso.toFixed(1) + "%"
                : run.acc_kfold != null ? run.acc_kfold.toFixed(1) + "% (k-fold)"
                : "—";
  document.getElementById("latestAcc").textContent = accText;

  document.getElementById("accKfold").innerHTML =
    run.acc_kfold != null ? run.acc_kfold.toFixed(1) + "<span class='unit'>%</span>" : "—";
  document.getElementById("accLoso").innerHTML =
    run.acc_loso != null ? run.acc_loso.toFixed(1) + "<span class='unit'>%</span>" : "—";
  document.getElementById("oneSessionNote").style.display =
    run.acc_loso == null ? "block" : "none";

  // ---- progress-over-time chart ----
  new Chart(document.getElementById("historyChart"), {
    type: "line",
    data: {
      labels: history.map(h => h.timestamp.slice(5, 16)),
      datasets: [
        {
          label: "Same-session accuracy (%)",
          data: history.map(h => h.acc_kfold),
          borderColor: "#8B93A3", backgroundColor: "transparent", tension: 0.3,
        },
        {
          label: "Cross-session accuracy (%)",
          data: history.map(h => h.acc_loso),
          borderColor: "#4C8C6B", backgroundColor: "transparent", tension: 0.3,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: "#F3F1EA", font: { family: "Inter" } } } },
      scales: {
        x: { ticks: { color: "#8B93A3" }, grid: { color: "#2B374F" } },
        y: { ticks: { color: "#8B93A3" }, grid: { color: "#2B374F" }, suggestedMax: 100 },
      },
    },
  });

  // ---- consistency cards ----
  const byLabel = {};
  for (const row of latest.consistency) {
    (byLabel[row.label] ||= []).push(row.consistency_dtw);
  }
  const rollup = Object.entries(byLabel)
    .map(([label, vals]) => ({ label, avg: vals.reduce((a, b) => a + b, 0) / vals.length }))
    .sort((a, b) => a.avg - b.avg);
  const best = rollup[0]?.label;
  const worst = rollup.length > 1 ? rollup[rollup.length - 1].label : null;

  const consEl = document.getElementById("consistencyCards");
  if (rollup.length === 0) {
    consEl.innerHTML = "<div class='card'>Record at least 2 reps of the same motion in one session to see consistency scores.</div>";
  } else {
    consEl.innerHTML = rollup.map(r => {
      const tag = r.label === best ? "<span class='tag good'>most consistent</span>"
                : r.label === worst ? "<span class='tag watch'>needs practice</span>" : "";
      const barColor = r.label === worst ? "var(--clay)" : "var(--court)";
      const width = Math.min(100, r.avg * 300);
      return `<div class="card">
        <div class="row"><span class="label">${r.label}</span>${tag}</div>
        <div class="row" style="margin-top:0.6rem">
          <div class="bar-track"><div class="bar-fill" style="width:${width}%; background:${barColor}"></div></div>
          <span class="digits" style="font-size:1rem">${r.avg.toFixed(3)}</span>
        </div>
      </div>`;
    }).join("");
  }
  const noteEl = document.getElementById("recommendationNote");
  if (worst) {
    noteEl.style.display = "block";
    noteEl.innerHTML = `Recommended practice: <strong>${worst}</strong> shows the least ` +
      `repeatable technique of the motions tracked. More reps here would help the model — and your form.`;
  }

  // ---- link quality table ----
  document.getElementById("linkRows").innerHTML = latest.linkQuality.map(s =>
    `<tr><td>${s.label} &middot; session ${s.session}</td><td>${s.rate_hz} Hz</td><td>${s.loss_pct}%</td></tr>`
  ).join("");
}

// ---- Record a Session panel ----
const labelInput = document.getElementById("labelInput");
const sessionInput = document.getElementById("sessionInput");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const recordLive = document.getElementById("recordLive");
const liveText = document.getElementById("liveText");
const recordResult = document.getElementById("recordResult");
let pollTimer = null;

function setRecordingUI(isRecording) {
  startBtn.style.display = isRecording ? "none" : "inline-block";
  stopBtn.style.display = isRecording ? "inline-block" : "none";
  labelInput.disabled = isRecording;
  sessionInput.disabled = isRecording;
  recordLive.style.display = isRecording ? "flex" : "none";
}

async function pollStatus() {
  try {
    const s = await fetch("/api/record/status").then(r => r.json());
    if (s.recording) {
      liveText.textContent = `Recording '${s.label}' (session ${s.session}) — ${s.samples} samples, ${s.elapsedS}s`;
    }
  } catch (err) { /* ignore transient poll errors */ }
}

startBtn.addEventListener("click", async () => {
  const label = labelInput.value.trim();
  if (!label) {
    recordResult.textContent = "Enter a motion label first (e.g. forehand).";
    recordResult.style.color = "var(--clay)";
    return;
  }
  recordResult.textContent = "";
  try {
    const res = await fetch("/api/record/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, session: sessionInput.value || "1" }),
    });
    const data = await res.json();
    if (!data.success) {
      recordResult.textContent = data.error || "Could not start recording.";
      recordResult.style.color = "var(--clay)";
      return;
    }
    setRecordingUI(true);
    liveText.textContent = `Waiting for the sensor… (your IP: ${data.localIp})`;
    pollTimer = setInterval(pollStatus, 1000);
  } catch (err) {
    recordResult.textContent = "Could not reach the server: " + err;
    recordResult.style.color = "var(--clay)";
  }
});

stopBtn.addEventListener("click", async () => {
  stopBtn.disabled = true;
  try {
    const res = await fetch("/api/record/stop", { method: "POST" });
    const data = await res.json();
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    setRecordingUI(false);

    if (!data.success) {
      recordResult.textContent = data.error || "Could not stop recording.";
      recordResult.style.color = "var(--clay)";
    } else if (!data.saved) {
      recordResult.textContent = data.message;
      recordResult.style.color = "var(--clay)";
    } else {
      recordResult.textContent = `Saved ${data.file} — ${data.samples} samples, ` +
        `${data.durationS}s, ${data.rateHz} Hz effective`;
      recordResult.style.color = "var(--court)";
    }
  } finally {
    stopBtn.disabled = false;
  }
});

loadDashboard().catch(err => {
  console.error(err);
  document.getElementById("generated").textContent = "Error loading data — is app.py running?";
});

// ---- Run Analysis button ----
const runBtn = document.getElementById("runBtn");
const runOutputSection = document.getElementById("runOutputSection");
const runOutput = document.getElementById("runOutput");
const runStatus = document.getElementById("runStatus");

runBtn.addEventListener("click", async () => {
  runBtn.disabled = true;
  runBtn.classList.remove("error");
  runBtn.textContent = "Running…";
  runOutputSection.style.display = "block";
  runOutput.textContent = "";
  runStatus.textContent = "in progress";

  try {
    const res = await fetch("/api/run-analysis", { method: "POST" });
    const data = await res.json();
    runOutput.textContent = data.output || "";
    if (data.error) runOutput.textContent += "\n" + data.error;

    if (data.success) {
      runStatus.textContent = "done";
      runBtn.textContent = "\u25B6 Run Analysis";
      await loadDashboard();  // refresh every card, chart, and table with the new run
    } else {
      runStatus.textContent = "failed";
      runBtn.classList.add("error");
      runBtn.textContent = "\u25B6 Run Analysis";
    }
  } catch (err) {
    runOutput.textContent = "Could not reach the server: " + err;
    runStatus.textContent = "failed";
    runBtn.classList.add("error");
    runBtn.textContent = "\u25B6 Run Analysis";
  } finally {
    runBtn.disabled = false;
  }
});
