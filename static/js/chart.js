let chart;
let selectedAxis = "dy";
let refreshTimer = null;
let currentSelected = null;
let currentProject = null; // active project name

// ---- Load & Redraw Chart ----
function loadDataForProject(project) {
  fetch(`/get_data?project=${project}`)
    .then(r => r.json())
    .then(data => {
      drawChart(data);
      updateIDList(data.ids);
      updateHeaderProjectName(project);
    })
    .catch(err => console.error("Failed to load project data:", err));
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

  // Add threshold lines
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
        y: {
          min: yMin,
          max: yMax,
          ticks: { callback: v => v.toFixed(1) }
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
        // Reset all
        currentSelected = null;
        document.querySelectorAll("#idList .id-chip").forEach(el => el.classList.remove("id-highlight"));
        chart.data.datasets.forEach(ds => { ds.hidden = false; ds.borderWidth = 2; });
        chart.update();
        return;
      }

      // Highlight selected
      currentSelected = id;
      document.querySelectorAll("#idList .id-chip").forEach(el => el.classList.remove("id-highlight"));
      item.classList.add("id-highlight");

      // Show only selected dataset
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

  // Resize chart after animation
  setTimeout(() => {
    if (chart && typeof chart.resize === "function") chart.resize();
  }, 350);
});

// ---- Detect sidebar collapse transition ----
document.addEventListener("transitionend", function(e) {
  if (e.target.id === "sidebar-left" && chart) {
    chart.resize();
  }
});

// ---- Apply Button ----
document.getElementById("chartForm").addEventListener("submit", function(e) {
  e.preventDefault();
  selectedAxis = document.getElementById("axis").value;
  if (currentProject) loadDataForProject(currentProject);
  setAutoRefresh();
});

// ---- Auto Refresh ----
function setAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const interval = parseInt(document.getElementById("refreshSec").value) * 1000;
  refreshTimer = setInterval(() => {
    if (currentProject) loadDataForProject(currentProject);
  }, interval);
}

// ---- Dynamic Project Loader ----
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
          loadDataForProject(p);
          setAutoRefresh();
        };

        li.appendChild(a);
        listContainer.appendChild(li);
      });

      // Auto-load first project if none selected
      if (!currentProject && projects.length > 0) {
        currentProject = projects[0];
        loadDataForProject(currentProject);
        setAutoRefresh();
      }
    })
    .catch(err => console.error("Failed to load projects:", err));
}

// ---- Update Page Header ----
function updateHeaderProjectName(project) {
  const headerTitle = document.querySelector(".panel-title");
  const pageHeader = document.querySelector(".page-header h2");
  if (headerTitle) headerTitle.textContent = `${project} Displacement Trend (Last 14 Days)`;
  if (pageHeader) pageHeader.textContent = `${project} Displacement Trend`;
}

// ---- Start ----
loadProjects();
