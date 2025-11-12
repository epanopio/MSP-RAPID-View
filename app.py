from flask import Flask, render_template, jsonify, request
from pathlib import Path
import re
from datetime import datetime

app = Flask(__name__)

# ------------------------------------------
# CONFIGURATION
# ------------------------------------------
BASE = Path(__file__).parent
PROJECTS_DIR = BASE / "MSP RAPID VIEW" / "PROJECTS"


# ------------------------------------------
# TIMESTAMP PARSER
# ------------------------------------------
def parse_timestamp(filename):
    date_match = re.search(r"(\d{2}[A-Za-z]{3}\d{2})", filename)
    time_match = re.search(r"(\d{2}-\d{2}-\d{2})", filename)

    if not date_match:
        return None

    date_obj = datetime.strptime(date_match.group(1), "%d%b%y")

    if time_match:
        time_str = time_match.group(1).replace("-", ":")
        time_obj = datetime.strptime(time_str, "%H:%M:%S").time()
        return datetime.combine(date_obj, time_obj)
    return date_obj


# ------------------------------------------
# MAIN FILE LOADER (non-recursive)
# ------------------------------------------
def load_data(project):
    folder = PROJECTS_DIR / project

    if not folder.exists():
        print(f"[ERROR] Project folder not found: {folder}")
        return {"timestamps": [], "ids": [], "dx": [], "dy": [], "dz": []}

    files = []
    for file in folder.glob("*.dat"):
        ts = parse_timestamp(file.name)
        if not ts:
            ts = datetime.fromtimestamp(file.stat().st_mtime)
        files.append((ts, file))

    # Sort by oldest to newest
    files.sort(key=lambda x: x[0])

    timestamps = [f[0].isoformat() for f in files]
    data = {}

    for ts, file in files:
        with open(file, "r", encoding="utf-8", errors="ignore") as f:
            lines = [ln.strip() for ln in f if ln.strip()]

        for row in lines[1:]:
            parts = re.split(r"\s+", row)
            if len(parts) < 4:
                continue

            pid = parts[0]
            dx_str, dy_str, dz_str = parts[-3], parts[-2], parts[-1]

            if any(v.lower() in ("data", "dx", "dy", "dz", "nodata", "no") for v in (dx_str, dy_str, dz_str)):
                continue

            try:
                dx, dy, dz = float(dx_str), float(dy_str), float(dz_str)
            except ValueError:
                continue

            if pid not in data:
                data[pid] = {"dx": [], "dy": [], "dz": []}

            data[pid]["dx"].append(dx)
            data[pid]["dy"].append(dy)
            data[pid]["dz"].append(dz)

    ids = sorted(data.keys())
    dx = [data[i]["dx"] for i in ids]
    dy = [data[i]["dy"] for i in ids]
    dz = [data[i]["dz"] for i in ids]

    return {
        "project": project,
        "timestamps": timestamps,
        "ids": ids,
        "dx": dx,
        "dy": dy,
        "dz": dz,
    }


# ------------------------------------------
# ROUTES
# ------------------------------------------
@app.route("/")
def index():
    # Render base page (default project)
    return render_template("index.html", project="RAPID View")


@app.route("/get_projects")
def get_projects():
    """Return list of all project folders"""
    projects = [p.name for p in PROJECTS_DIR.iterdir() if p.is_dir()]
    return jsonify(sorted(projects))


@app.route("/get_data")
def get_data():
    """Return data for a specific project"""
    project = request.args.get("project")
    if not project:
        return jsonify({"error": "Missing project"}), 400
    return jsonify(load_data(project))


# ------------------------------------------
# START SERVER
# ------------------------------------------
if __name__ == "__main__":
    print(f"🔥 Project root: {PROJECTS_DIR}")
    app.run(debug=True)
