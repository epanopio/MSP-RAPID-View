let chart;
let selectedAxis = "dy";
let refreshTimer;

function loadData() {
  fetch("/get_data")
    .then(r => r.json())
    .then(data => {
      drawChart(data);
      updateIDList(data.ids, data);
    });
}

function drawChart(data) {
  const ctx = document.getElementById("combinedChart").getContext("2d");

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
      scales: { y: { min: yMin.value, max: yMax.value } }
    }
  });
}

function updateIDList(ids, data) {
  const list = document.getElementById("idList");
  list.innerHTML = "";
  ids.forEach(id => {
    let div = document.createElement("div");
    div.textContent = id;
    div.onclick = () => highlightID(id);
    list.appendChild(div);
  });
}

function highlightID(id) {
  document.querySelectorAll("#idList div").forEach(el => el.classList.remove("id-highlight"));
  event.target.classList.add("id-highlight");

  chart.data.datasets.forEach(set => {
    set.borderWidth = (set.label === id ? 4 : 1);
    set.pointRadius = (set.label === id ? 3 : 1);
  });

  chart.update();
}

chartForm.addEventListener("submit", e => {
  e.preventDefault();
  selectedAxis = axis.value;
  clearInterval(refreshTimer);
  refreshTimer = setInterval(loadData, refreshSec.value * 1000);
  loadData();
});

loadData();
refreshTimer = setInterval(loadData, 30000);
