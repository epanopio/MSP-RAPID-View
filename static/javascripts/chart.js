let chart;
let selectedAxis = "dy";
let refreshTimer;

// -------------------------------
// Load data + apply project settings
// -------------------------------
async function loadData() {
  const project = document.getElementById("projectInput").value;

  // Load saved settings
  const settingsRes = await fetch(`/get_project_settings?project=${project}`);
  const settings = await settingsRes.json();

  if (settings) {
    document.getElementById("axis").value = settings.AXIS || "dy";
    document.getElementById("yMin").value = settings.MIN || -8;
    document.getElementById("yMax").value = settings.MAX || 8;
    document.getElementById("alarmLimit").value = settings.AL || 4;
    document.getElementById("warningLimit").value = settings.WSL || 2;
    document.getElementById("refreshSec").value = settings.REFRESH_INTERVAL || 30;
  }

  selectedAxis = document.getElementById("axis").value;

  const response = await fetch("/get_data");
  const data = await response.json();

  drawChart(data);
  updateIDList(data.ids, data);

  clearInterval(refreshTimer);
  const refreshSec = parseInt(document.getElementById("refreshSec").value) || 30;
  refreshTimer = setInterval(loadData, refreshSec * 1000);
}

// -------------------------------
// Draw chart
// -------------------------------
function drawChart(data) {
  const ctx = document.getElementById("combinedChart").getContext("2d");
  const yMin = parseFloat(document.getElementById("yMin").value);
  const yMax = parseFloat(document.getElementById("yMax").value);

  const datasets = data.ids.map((id, i) => ({
    label: id,
    data: data[selectedAxis][i],
    borderWidth: 2,
    pointRadius: 1.5,
    fill: false
  }));

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: { labels: data.timestamps, datasets },
    options: {
      scales: { y: { min: yMin, max: yMax } }
    }
  });
}

// -------------------------------
// Update ID list
// -------------------------------
function updateIDList(ids) {
  const list = document.getElementById("idList");
  list.innerHTML = "";
  ids.forEach(id => {
    const div = document.createElement("div");
    div.textContent = id;
    div.onclick = e => highlightID(e, id);
    list.appendChild(div);
  });
}

function highlightID(e, id) {
  document.querySelectorAll("#idList div").forEach(el => el.classList.remove("id-highlight"));
  e.target.classList.add("id-highlight");

  chart.data.datasets.forEach(set => {
    set.borderWidth = (set.label === id ? 4 : 1);
    set.pointRadius = (set.label === id ? 3 : 1);
  });

  chart.update();
}

// -------------------------------
// Save settings to backend
// -------------------------------
async function saveSettings() {
  const payload = {
    path: document.getElementById("projectsPath").value,
    project: document.getElementById("projectInput").value,
    settings: {
      AXIS: document.getElementById("axis").value,
      MIN: document.getElementById("yMin").value,
      MAX: document.getElementById("yMax").value,
      AL: document.getElementById("alarmLimit").value,
      WSL: document.getElementById("warningLimit").value,
      REFRESH_INTERVAL: document.getElementById("refreshSec").value
    }
  };

  await fetch("/save_directory_settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

// -------------------------------
// Handle Apply button
// -------------------------------
document.getElementById("chartForm").addEventListener("submit", async e => {
  e.preventDefault();
  await saveSettings();
  await loadData();
});

// -------------------------------
// Initial load
// -------------------------------
loadData();
refreshTimer = setInterval(loadData, 30000);
