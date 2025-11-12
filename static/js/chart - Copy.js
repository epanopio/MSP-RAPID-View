let chart;
let selectedAxis = "dy";
let refreshTimer = null;
let currentSelected = null;

// Load & redraw chart
function loadData() {
  fetch("/get_data")
    .then(r => r.json())
    .then(data => {
      drawChart(data);
      updateIDList(data.ids);
    });
}

function drawChart(data) {
  const ctx = document.getElementById("combinedChart").getContext("2d");

  const yMin = parseFloat(document.getElementById("yMin").value);
  const yMax = parseFloat(document.getElementById("yMax").value);
  const AL = parseFloat(document.getElementById("alarmLimit").value);
  const WSL = parseFloat(document.getElementById("warningLimit").value);

  const datasets = data.ids.map((id, index) => ({
    label: id,
    data: data[selectedAxis][index],
    borderColor: `hsl(${index * 35}, 70%, 45%)`,
    borderWidth: 2,
    pointRadius: 2,
    fill: false
  }));

  datasets.push(
    { label: "WSL +", data: data.timestamps.map(() => WSL), borderColor: "orange", borderDash: [6,4], borderWidth: 1, pointRadius: 0 },
    { label: "WSL -", data: data.timestamps.map(() => -WSL), borderColor: "orange", borderDash: [6,4], borderWidth: 1, pointRadius: 0 },
    { label: "AL +", data: data.timestamps.map(() => AL), borderColor: "red", borderDash: [4,4], borderWidth: 2, pointRadius: 0 },
    { label: "AL -", data: data.timestamps.map(() => -AL), borderColor: "red", borderDash: [4,4], borderWidth: 2, pointRadius: 0 }
  );

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: { labels: data.timestamps, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: yMin, max: yMax, ticks: { callback: v => v.toFixed(1) } }
      }
    }
  });
}

function updateIDList(ids) {
  const list = document.getElementById("idList");
  list.innerHTML = "";
  currentSelected = null;

  ids.forEach(id => {
    const item = document.createElement("div");
    item.textContent = id;
    item.className = "id-chip";

    item.onclick = () => {
      if (currentSelected === id) {
        currentSelected = null;
        document.querySelectorAll("#idList .id-chip").forEach(el => el.classList.remove("id-highlight"));
        chart.data.datasets.forEach(ds => { ds.hidden = false; ds.borderWidth = 2; });
        chart.update();
        return;
      }

      currentSelected = id;
      document.querySelectorAll("#idList .id-chip").forEach(el => el.classList.remove("id-highlight"));
      item.classList.add("id-highlight");

      chart.data.datasets.forEach(ds => {
        if (["AL +","AL -","WSL +","WSL -"].includes(ds.label)) ds.hidden = false;
        else if (ds.label === id) { ds.hidden = false; ds.borderWidth = 4; }
        else ds.hidden = true;
      });
      chart.update();
    };

    list.appendChild(item);
  });
}

// Hide All / Show All
document.getElementById("toggleVisibility").addEventListener("click", function () {
  const hide = this.textContent === "Hide All";

  chart.data.datasets.forEach(ds => {
    if (["AL +","AL -","WSL +","WSL -"].includes(ds.label)) ds.hidden = false;
    else ds.hidden = hide;
    ds.borderWidth = 2;
  });

  document.querySelectorAll("#idList .id-chip").forEach(el => el.classList.remove("id-highlight"));
  currentSelected = null;

  this.textContent = hide ? "Show All" : "Hide All";
  chart.update();
});

// ✅ Show / Hide Right Panel
document.getElementById("togglePanel").addEventListener("click", function () {
  const panel = document.getElementById("pointPanel");
  const isCollapsed = panel.style.width === "0px";

  panel.style.width = isCollapsed ? "260px" : "0px";
  this.textContent = isCollapsed ? "Hide Panel" : "Show Panel";

  setTimeout(() => { if (chart) chart.resize(); }, 300);
});

// ✅ Detect sidebar collapse transition to resize chart
document.addEventListener("transitionend", function(e) {
  if (e.target.id === "sidebar-left" && chart) {
    chart.resize();
  }
});

// Apply button
document.getElementById("chartForm").addEventListener("submit", function(e) {
  e.preventDefault();
  selectedAxis = document.getElementById("axis").value;
  loadData();
  setAutoRefresh();
});

// Auto refresh
function setAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(loadData, parseInt(document.getElementById("refreshSec").value) * 1000);
}

// Start
loadData();
setAutoRefresh();
