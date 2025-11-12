from flask import Flask, render_template, jsonify
from pathlib import Path
import re
from datetime import datetime

app = Flask(__name__)

# ------------------------------------------
# CONFIGURATION
# ------------------------------------------
BASE = Path(__file__).parent
PROJECTS_DIR = BASE / "MSP RAPID VIEW" / "PROJECTS"
CURRENT_PROJECT = "OBVCB"   # Change this to switch project folder


# ------------------------------------------
# TIMESTAMP PARSER
# Extract date + time from filename
# Example: OBVCB_01Nov25_Cycle1_01-00-30.dat
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
        return datetime.combine(date_obj, time_obj).isoformat()

    return date_obj.isoformat()


# ------------------------------------------
# MAIN FILE LOADER
# Reads all *.dat in project folder
# Extracts Point ID, dx, dy, dz only
# ------------------------------------------
def load_data(project):
    folder = PROJECTS_DIR / project

    if not folder.exists():
        print(f"[ERROR] Project folder not found: {folder}")
        return {"timestamps": [], "ids": [], "dx": [], "dy": [], "dz": []}

    timestamps = []
    data = {}  # {ID: {"dx":[], "dy":[], "dz":[]} }

    for file in sorted(folder.glob("*.dat")):
        ts = parse_timestamp(file.name) or file.stat().st_mtime
        timestamps.append(ts)

        with open(file, "r", encoding="utf-8", errors="ignore") as f:
            lines = [ln.strip() for ln in f if ln.strip()]

        # Skip header row → start from line 2
        for row in lines[1:]:
            parts = re.split(r"\s+", row)

            if len(parts) < 4:
                continue

            pid = parts[0]
            dx_str, dy_str, dz_str = parts[-3], parts[-2], parts[-1]

            # Skip header-like or invalid strings
            if any(v.lower() in ("data", "dx", "dy", "dz", "nodata", "no") for v in (dx_str, dy_str, dz_str)):
                continue

            try:
                dx = float(dx_str)
                dy = float(dy_str)
                dz = float(dz_str)
            except:
                continue  # skip bad rows

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
    return render_template("index.html", project=CURRENT_PROJECT)


@app.route("/get_data")
def get_data():
    return jsonify(load_data(CURRENT_PROJECT))


# ------------------------------------------
# START SERVER
# ------------------------------------------
if __name__ == "__main__":
    print(f"🔥 Loading project from: {PROJECTS_DIR / CURRENT_PROJECT}")
    app.run(debug=True)
