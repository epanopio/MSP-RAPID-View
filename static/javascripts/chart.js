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

  const response = await fetch(`/get_data?project=${encodeURIComponent(project)}`);
  if (!response.ok) {
    let err = null;
    try { err = await response.json(); } catch(e) { try { err = await response.text(); } catch(e2) { err = 'Unknown error'; } }
    console.error('Failed to load data:', err);
    showMessage('Failed to load data: ' + (err && (err.error || err.message || err)), 'error');
    return;
  }
  const data = await response.json();

  if (!data || data.error) {
    showMessage('No data returned for project or error: ' + (data && data.error ? data.error : 'No data'), 'error');
    return;
  }

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
  if (!data || !data.timestamps || !data.ids) return;

  const yMin = parseFloat(document.getElementById("yMin").value);
  const yMax = parseFloat(document.getElementById("yMax").value);
  const AL = parseFloat(document.getElementById("alarmLimit").value) || 0;
  const WSL = parseFloat(document.getElementById("warningLimit").value) || 0;

  // Format X labels with cycle number from filenames when available
  const labels = data.timestamps.map((ts, idx) => {
    try {
      const date = new Date(ts);
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      const hh = String(date.getHours()).padStart(2, '0');
      const mi = String(date.getMinutes()).padStart(2, '0');
      let cycle = '';
      if (data.files && data.files[idx]) {
        const m = data.files[idx].match(/Cycle\s*(\d+)/i);
        if (m) cycle = ' C' + m[1];
      }
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}${cycle}`;
    } catch (e) {
      return data.timestamps[idx];
    }
  });

  // Data series for points
  const datasets = data.ids.map((id, i) => ({
    label: id,
    data: data[selectedAxis][i],
    borderColor: `hsl(${(i * 45) % 360}, 70%, 40%)`,
    borderWidth: 1.6,
    pointRadius: 1.5,
    fill: false,
    tension: 0.12
  }));

  // Add WSL and AL lines (dashed)
  if (WSL) {
    datasets.push({ label: 'WSL +', data: labels.map(() => WSL), borderColor: 'orange', borderDash: [6,4], borderWidth: 1, pointRadius: 0 });
    datasets.push({ label: 'WSL -', data: labels.map(() => -WSL), borderColor: 'orange', borderDash: [6,4], borderWidth: 1, pointRadius: 0 });
  }
  if (AL) {
    datasets.push({ label: 'AL +', data: labels.map(() => AL), borderColor: 'red', borderDash: [4,4], borderWidth: 1.5, pointRadius: 0 });
    datasets.push({ label: 'AL -', data: labels.map(() => -AL), borderColor: 'red', borderDash: [4,4], borderWidth: 1.5, pointRadius: 0 });
  }

  if (chart) chart.destroy();

  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { maxRotation: 45, minRotation: 30, autoSkip: true, maxTicksLimit: 12 },
          grid: { display: true }
        },
        y: {
          min: yMin,
          max: yMax,
          ticks: { callback: v => v.toFixed(1) },
          grid: { display: true }
        }
      }
    }
  });
}

// -------------------------------
// Update ID list and highlight behavior
// -------------------------------
let currentSelected = null;

function updateIDList(ids) {
  const list = document.getElementById("idList");
  if (!list) return;
  list.innerHTML = "";
  ids.forEach(id => {
    const div = document.createElement("div");
    div.textContent = id;
    div.className = 'id-chip';
    div.onclick = () => highlightID(id, div);
    list.appendChild(div);
  });
}

function highlightID(id, element) {
  const listEls = document.querySelectorAll("#idList .id-chip");
  listEls.forEach(el => el.classList.remove("id-highlight"));

  // Toggle selection
  if (currentSelected === id) {
    // Deselect
    currentSelected = null;
    listEls.forEach(el => el.classList.remove('id-highlight'));
    // show all data series
    chart.data.datasets.forEach(ds => { ds.hidden = false; ds.borderWidth = ds.borderWidth || 1.6; });
    chart.update();
    return;
  }

  // Select new id
  currentSelected = id;
  element.classList.add('id-highlight');

  chart.data.datasets.forEach(ds => {
    if (['AL +', 'AL -', 'WSL +', 'WSL -'].includes(ds.label)) {
      ds.hidden = false; // always show limits
    } else if (ds.label === id) {
      ds.hidden = false;
      ds.borderWidth = 3.2;
    } else {
      ds.hidden = true;
    }
  });
  chart.update();
}

// Hide/Show All button
const toggleVisibilityBtn = document.getElementById('toggleVisibility');
if (toggleVisibilityBtn) {
  toggleVisibilityBtn.addEventListener('click', function() {
    const hide = this.textContent.trim() === 'Hide All';
    chart.data.datasets.forEach(ds => {
      if (['AL +', 'AL -', 'WSL +', 'WSL -'].includes(ds.label)) ds.hidden = false;
      else ds.hidden = hide;
    });
    document.querySelectorAll('#idList .id-chip').forEach(el => el.classList.remove('id-highlight'));
    currentSelected = null;
    this.textContent = hide ? 'Show All' : 'Hide All';
    chart.update();
  });
}

// Toggle right panel visibility
const togglePanelBtn = document.getElementById('togglePanel');
if (togglePanelBtn) {
  togglePanelBtn.addEventListener('click', function() {
    const panel = document.getElementById('pointPanel');
    if (!panel) return;
    const hidden = panel.classList.toggle('hidden');
    this.textContent = hidden ? 'Show Panel' : 'Hide Panel';
    // allow chart to resize after CSS transition
    setTimeout(() => { try { chart.resize(); } catch (e) {} }, 350);
  });
}

// -------------------------------
// Save settings to backend
// -------------------------------
function showMessage(msg, type='success') {
  let container = document.getElementById('messageContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'messageContainer';
    container.style.position = 'fixed';
    container.style.top = '10px';
    container.style.right = '10px';
    container.style.zIndex = 9999;
    document.body.appendChild(container);
  }
  const alert = document.createElement('div');
  alert.className = 'alert alert-' + (type === 'error' ? 'danger' : 'success');
  alert.style.marginTop = '5px';
  alert.textContent = msg;
  container.appendChild(alert);
  setTimeout(() => {
    alert.style.transition = 'opacity .5s';
    alert.style.opacity = 0;
    setTimeout(() => alert.remove(), 500);
  }, 2500);
}

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

  const res = await fetch("/save_directory_settings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  let json = {};
  try { json = await res.json(); } catch (e) {}
  if (json.message) showMessage(json.message, res.ok ? 'success' : 'error');
}

// -------------------------------
// Handle Apply button
// -------------------------------
document.getElementById("chartForm").addEventListener("submit", async e => {
  e.preventDefault();
  await saveSettings();
  await loadData();
});

// Attach Refresh button (template has one without id)
(function attachRefresh() {
  const refreshBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadData();
    });
  }
})();

// -------------------------------
// Initial load
// -------------------------------
loadData();
refreshTimer = setInterval(loadData, 30000);
