let chart;
let selectedAxis = "dy";
let refreshTimer = null;

// Detect current project name from header or dataset
function getCurrentProject() {
  const header = document.querySelector("h2.page-header") || document.querySelector("header.page-header h2");
  return header ? header.textContent.split(" ")[0] : "OBVCB";
}

// Load project-specific data
function loadData() {
  const project = getCurrentProject();
  fetch(`/get_data?project=${project}`)
    .then(r => r.json())
    .then(data => {
      if (data.error) {
        console.error("Data load error:", data.error);
        return;
      }
      drawChart(data);
      updateIDList(data.ids);
    })
    .catch(err => console.error("Fetch error:", err));
}

// Draw combined displacement chart
function drawChart(data) {
  const ctx = document.getElementById("combinedChart").getContext("2d");
  if (!data.timestamps || !data.ids) return;

  const yMin = parseFloat(document.getElementById("yMin").value);
  const yMax = parseFloat(document.getElementById("yMax").value);

  const datasets = data.ids.map((id, i) => ({
    label: id,
    data: data[selectedAxis][i].map((v, j) => ({ x: j, y: v })),
    borderWidth: 1.8,
    borderColor: "rgba(0, 128, 255, 0.6)",
    fill: false,
    tension: 0.1,
    pointRadius: 0
  }));

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.timestamps,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { min: yMin, max: yMax, title: { display: true, text: selectedAxis } },
        x: { ticks: { autoSkip: true, maxTicksLimit: 10 } }
      }
    }
  });
}

// Update point ID list at the right panel
function updateIDList(ids) {
  const list = document.getElementById("idList");
  if (!list) return;
  list.innerHTML = "";
  ids.forEach(id => {
    const div = document.createElement("div");
    div.textContent = id;
    div.onclick = e => highlightID(id, e.target);
    list.appendChild(div);
  });
}

// Highlight the selected ID
function highlightID(id, element) {
  document.querySelectorAll("#idList div").forEach(el => el.classList.remove("id-highlight"));
  element.classList.add("id-highlight");
  chart.data.datasets.forEach(set => {
    set.borderWidth = set.label === id ? 3 : 1.2;
    set.borderColor = set.label === id ? "rgba(255, 100, 0, 0.9)" : "rgba(0, 128, 255, 0.5)";
  });
  chart.update();
}

// Handle form changes
document.getElementById("chartForm").addEventListener("submit", e => {
  e.preventDefault();
  selectedAxis = document.getElementById("axis").value;
  clearInterval(refreshTimer);
  const interval = parseInt(document.getElementById("refreshSec").value) || 30;
  refreshTimer = setInterval(loadData, interval * 1000);
  loadData();
});

// Auto-load chart
loadData();
refreshTimer = setInterval(loadData, 30000);
