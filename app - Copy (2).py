from flask import Flask, render_template, jsonify, request
from pathlib import Path
import re
from datetime import datetime, timedelta
import shutil
import threading
import webbrowser
import os
import sys

app = Flask(__name__)

# ==============================================================
#  EXE / DEV PATH DETECTION
# ==============================================================

if getattr(sys, "frozen", False):
    # Running as EXE
    BASE = Path(sys.executable).parent
else:
    # Running normally
    BASE = Path(__file__).parent

SETTINGS_FILE = BASE / "project_settings.txt"
BACKUP_DAYS = 14

print("-------------------------------------------------------------")
print(f"Running from: {BASE}")
print(f"Settings file: {SETTINGS_FILE}")
print("-------------------------------------------------------------")


# ==============================================================
# READ SAVED PROJECT DIRECTORY
# ==============================================================

def read_directory_settings():
    """Return the PROJECTS folder path saved in project_settings.txt."""
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("PROJECTS_PATH="):
                    path = line.split("=", 1)[1].strip()
                    if path:
                        return Path(path)
    return None


def get_projects_dir():
    """Return Path object or None if no folder selected."""
    folder = read_directory_settings()
    if folder and folder.exists():
        return folder
    return None


# ==============================================================
# PARSE TIMESTAMP FROM FILENAME
# ==============================================================

def parse_timestamp(filename: str):
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


# ==============================================================
# BACKUP OLD FILES
# ==============================================================

def backup_old_files(folder: Path):
    files = list(folder.glob("*.dat"))
    if not files:
        return

    latest_time = max(
        parse_timestamp(f.name) or datetime.fromtimestamp(f.stat().st_mtime)
        for f in files
    )
    cutoff = latest_time - timedelta(days=BACKUP_DAYS)

    backup_dir = folder / "Backup"
    backup_dir.mkdir(exist_ok=True)

    moved = 0
    for f in files:
        ts = parse_timestamp(f.name) or datetime.fromtimestamp(f.stat().st_mtime)
        if ts < cutoff:
            shutil.move(str(f), str(backup_dir / f.name))
            moved += 1

    if moved:
        print(f"[BACKUP] Moved {moved} file(s) to {backup_dir}")


# ==============================================================
# LOAD PROJECT DATA
# ==============================================================

def load_data(project: str):
    PROJECTS_DIR = get_projects_dir()
    if PROJECTS_DIR is None:
        return {"timestamps": [], "ids": [], "dx": [], "dy": [], "dz": []}

    folder = PROJECTS_DIR / project
    if not folder.exists():
        return {"timestamps": [], "ids": [], "dx": [], "dy": [], "dz": []}

    backup_old_files(folder)

    files = []
    for file in folder.glob("*.dat"):
        ts = parse_timestamp(file.name) or datetime.fromtimestamp(file.stat().st_mtime)
        files.append((ts, file))
    files.sort(key=lambda x: x[0])

    timestamps = [ts.isoformat() for ts, _ in files]
    filenames = [f.stem for _, f in files]

    data = {}

    for _, f in files:
        with open(f, "r", encoding="utf-8", errors="ignore") as fh:
            lines = [ln.strip() for ln in fh if ln.strip()]

        for row in lines[1:]:
            parts = re.split(r"\s+", row)
            if len(parts) < 4:
                continue

            pid = parts[0]
            dxs, dys, dzs = parts[-3], parts[-2], parts[-1]

            # skip invalid data
            if any(v.lower() in ("data", "nodata", "no") for v in (dxs, dys, dzs)):
                continue

            try:
                dx, dy, dz = float(dxs), float(dys), float(dzs)
            except ValueError:
                continue

            data.setdefault(pid, {"dx": [], "dy": [], "dz": []})
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
        "files": filenames
    }


# ==============================================================
# ROUTES
# ==============================================================

@app.route("/")
def dashboard():
    PROJECTS_DIR = get_projects_dir()

    if PROJECTS_DIR is None:
        return render_template("settings.html", projects=[], saved_path="", error="Please select your PROJECTS folder in Settings.")

    projects = [p.name for p in PROJECTS_DIR.iterdir() if p.is_dir()]
    default = projects[0] if projects else None

    return render_template("index.html", project=default, projects=projects)


@app.route("/project/<project_name>")
def project_view(project_name):
    PROJECTS_DIR = get_projects_dir()

    if PROJECTS_DIR is None:
        return render_template("settings.html", projects=[], saved_path="", error="Please set your PROJECTS folder.")

    projects = [p.name for p in PROJECTS_DIR.iterdir() if p.is_dir()]
    return render_template("index.html", project=project_name, projects=projects)


# ==============================================================
# SETTINGS PAGE
# ==============================================================

@app.route("/settings")
def settings_page():
    folder = read_directory_settings()
    path = str(folder) if folder else ""

    PROJECTS_DIR = get_projects_dir()
    projects = []
    error = None

    if PROJECTS_DIR is None:
        error = "No project folder selected."
    else:
        projects = [p.name for p in PROJECTS_DIR.iterdir() if p.is_dir()]

    return render_template("settings.html", saved_path=path, projects=projects, error=error)


# ==============================================================
# PROJECT LIST
# ==============================================================

@app.route("/get_projects")
def get_projects():
    PROJECTS_DIR = get_projects_dir()
    if PROJECTS_DIR is None:
        return jsonify([])

    projects = [p.name for p in PROJECTS_DIR.iterdir() if p.is_dir()]
    return jsonify(sorted(projects))


# ==============================================================
# GRAPH DATA
# ==============================================================

@app.route("/get_data")
def get_data_route():
    project = request.args.get("project")
    if not project:
        return jsonify({"error": "Missing project"}), 400

    return jsonify(load_data(project))


# ==============================================================
# SETTINGS SAVE
# ==============================================================

@app.route("/save_directory_settings", methods=["POST"])
def save_directory_settings():
    data = request.get_json()
    path = data.get("path", "").strip()

    if not path:
        return jsonify({"error": "Invalid path"}), 400

    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        f.write(f"PROJECTS_PATH={path}\n")

    print(f"[SETTINGS] Saved PROJECTS_PATH = {path}")

    return jsonify({"message": "Settings saved", "reload": True})


# ==============================================================
# WINDOWS FOLDER PICKER (EXE ONLY)
# ==============================================================

@app.route("/choose_directory")
def choose_directory():
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()

        folder = filedialog.askdirectory(title="Select PROJECTS Folder")
        return jsonify({"path": folder})

    except Exception as e:
        print(f"[ERROR] Folder picker: {e}")
        return jsonify({"path": ""})


# ==============================================================
# RUN SERVER
# ==============================================================

if __name__ == "__main__":
    port = 5000
    url = f"http://127.0.0.1:{port}"

    def open_browser():
        webbrowser.open(url)

    threading.Timer(1.5, open_browser).start()

    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
