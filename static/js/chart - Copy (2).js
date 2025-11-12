let chart;
let selectedAxis = "dy";
let refreshTimer = null;
let currentSelected = null;
let currentProject = null;

// ---- Load & Redraw Chart ----
function loadDataForProject(project) {
  fetch(`/get_data?project=${project}`)
    .then(r => r.json())
    .then(data => {
      drawChart(data);
      updateIDList(data.ids);
      updateHeaderProjectName(project);
      loadSettings(project); // apply saved settings
    })
    .catch(err => console.error("Failed to load project data:", err));
}

// ---- Extract Cycle from Filename ----
function extractCycleFromStem(stem) {
  // Matches filenames like: N106IB_30Oct25_Cycle3_09-00-29
  if (!stem) return null;
  const match = stem.match(/_Cycle(\d+)_/i);
  return match ? `C${match[1]}` : null;
}

// ---- Draw Chart ----
function drawChart(data) {
  const ctx = document.getElementById("combinedChart").getContext("2d");

  const yMin = parseFloat(document.getElementById("yMin").value);
  const yMax = parseFloat(document.getElementById("yMax").value);
  const AL = parseFloat(document.getElementById("alarmLimit").value);
  const WSL = parseFloat(document.getElementById("warningLimit").value);

  // Format timestamps with real cycle number from filename
  const formattedLabels = data.timestamps.map((ts, idx) => {
    const tsFmt = ts.replace("T", " ").slice(0, 16);
    const stem = (data.files && data.files[idx]) || "";
    const cycle = extractCycleFromStem(stem) || `C${idx + 1}`;
    return `${tsFmt} ${cycle}`;
  });

  const datasets = data.ids.map((id, index) => ({
    label: id,
    data: data[selectedAxis][index],
    borderColor: `hsl(${index * 35}, 70%, 45%)`,
    borderWidth: 2,
    pointRadius: 2,
    fill: false
  }));

  datasets.push(
    { label: "WSL +", data: data.timestamps.map(() => WSL), borderColor: "orange", borderDash: [6, 4], borderWidth: 1, pointRadius: 0 },
    { label: "WSL -", data: data.timestamps.map(() => -WSL), borderColor: "orange", borderDash: [6, 4], borderWidth: 1, pointRadius: 0 },
    { label: "AL +", data: data.timestamps.map(() => AL), borderColor: "red", borderDash: [4, 4], borderWidth: 2, pointRadius: 0 },
    { label: "AL -", data: data.timestamps.map(() => -AL), borderColor: "red", borderDash: [4, 4], borderWidth: 2, pointRadius: 0 }
  );

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: "line",
    data: { labels: formattedLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const idx = items[0].dataIndex;
              const tsFmt = data.timestamps[idx].replace("T", " ").slice(0, 16);
              const stem = (data.files && data.files[idx]) || "";
              const cycle = extractCycleFromStem(stem) || `C${idx + 1}`;
              return `${tsFmt} ${cycle}`;
            }
          }
        }
      },
    
scales: {
  x: {
    ticks: {
      font: { size: 9 },   // 👈 smaller font for date-cycle labels
      maxRotation: 50,
      minRotation: 40
    }
  },
  y: {
    min: yMin,
    max: yMax,
    ticks: { callback: v => v.toFixed(1), font: { size: 10 } }
  }
}



    }
  });
}

// ---- Update Point ID List ----
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

// ---- Hide All / Show All ----
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

// ---- Show / Hide Right Panel ----
document.getElementById("togglePanel").addEventListener("click", function () {
  const panel = document.getElementById("pointPanel");
  const hidden = panel.classList.toggle("hidden");
  this.textContent = hidden ? "Show Panel" : "Hide Panel";
  setTimeout(() => chart?.resize(), 350);
});

document.addEventListener("transitionend", e => {
  if (e.target.id === "sidebar-left" && chart) chart.resize();
});

// ---- Save & Load Settings ----
function saveSettings(project) {
  const payload = {
    project,
    axis: document.getElementById("axis").value,
    yMin: document.getElementById("yMin").value,
    yMax: document.getElementById("yMax").value,
    alarmLimit: document.getElementById("alarmLimit").value,
    warningLimit: document.getElementById("warningLimit").value,
    refreshSec: document.getElementById("refreshSec").value
  };
  fetch("/save_settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

function loadSettings(project) {
  fetch(`/get_settings?project=${project}`)
    .then(r => r.json())
    .then(s => {
      if (!s) return;
      if (s.axis) document.getElementById("axis").value = s.axis;
      if (s.yMin) document.getElementById("yMin").value = s.yMin;
      if (s.yMax) document.getElementById("yMax").value = s.yMax;
      if (s.alarmLimit) document.getElementById("alarmLimit").value = s.alarmLimit;
      if (s.warningLimit) document.getElementById("warningLimit").value = s.warningLimit;
      if (s.refreshSec) document.getElementById("refreshSec").value = s.refreshSec;
      selectedAxis = s.axis || "dy";
      setAutoRefresh();
    });
}

// ---- Apply + Refresh ----
document.getElementById("chartForm").addEventListener("submit", e => {
  e.preventDefault();
  if (!currentProject) return;
  selectedAxis = document.getElementById("axis").value;
  saveSettings(currentProject);
  loadDataForProject(currentProject);
  setAutoRefresh();
});

// Add Refresh button next to Apply
const refreshBtn = document.createElement("button");
refreshBtn.type = "button";
refreshBtn.textContent = "Refresh";
refreshBtn.className = "btn btn-info btn-sm";
refreshBtn.style.marginLeft = "4px";
document.getElementById("togglePanel").before(refreshBtn);
refreshBtn.addEventListener("click", () => {
  if (currentProject) loadDataForProject(currentProject);
});

// ---- Auto Refresh ----
function setAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const interval = parseInt(document.getElementById("refreshSec").value) * 1000;
  refreshTimer = setInterval(() => {
    if (currentProject) loadDataForProject(currentProject);
  }, interval);
}

// ---- Project Loader ----
function loadProjects() {
  fetch("/get_projects")
    .then(r => r.json())
    .then(projects => {
      const listContainer = document.querySelector(".nav-children");
      listContainer.innerHTML = "";

      projects.forEach(p => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#";
        a.textContent = p;
        a.onclick = () => {
          document.querySelectorAll(".nav-children a").forEach(el => el.classList.remove("active"));
          a.classList.add("active");
          currentProject = p;
          loadSettings(p);
          loadDataForProject(p);
        };
        li.appendChild(a);
        listContainer.appendChild(li);
      });

      if (!currentProject && projects.length > 0) {
        currentProject = projects[0];
        loadSettings(currentProject);
        loadDataForProject(currentProject);
      }
    })
    .catch(err => console.error("Failed to load projects:", err));
}

function updateHeaderProjectName(project) {
  const headerTitle = document.querySelector(".panel-title");
  const pageHeader = document.querySelector(".page-header h2");
  if (headerTitle) headerTitle.textContent = `${project} Displacement Trend (Last 14 Days)`;
  if (pageHeader) pageHeader.textContent = `${project} Displacement Trend`;
}

// ---- Init ----
loadProjects();
