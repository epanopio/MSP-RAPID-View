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

# ------------------------------------------
# CONFIG
# ------------------------------------------
# Detect if running as EXE
if getattr(sys, 'frozen', False):
    BASE = Path(sys.executable).parent
else:
    BASE = Path(__file__).parent

SETTINGS_FILE = BASE / "project_settings.txt"
BACKUP_DAYS = 14  # move .dat older than latest-14d into /Backup


# ------------------------------------------
# Load directory path from settings
# ------------------------------------------
def read_directory_settings():
    """Read saved projects directory path from settings file"""
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("PROJECTS_PATH="):
                    path = line.split("=", 1)[1].strip()
                    if path and Path(path).exists():
                        return Path(path)
    # fallback if not set or invalid
    default = BASE / "MSP RAPID VIEW" / "PROJECTS"
    if not default.exists():
        default.mkdir(parents=True, exist_ok=True)
    return default


def get_projects_dir():
    """Always return the latest folder path dynamically."""
    return read_directory_settings()


print(f"🧩 Settings file: {SETTINGS_FILE}")


# ------------------------------------------
# Helpers
# ------------------------------------------
def parse_timestamp(filename: str):
    """Parse date/time from filename patterns like: N106IB_11Nov25_Cycle2_05-00-31.dat"""
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


def backup_old_files(folder: Path):
    """Move .dat files older than BACKUP_DAYS from newest into /Backup."""
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
            dest = backup_dir / f.name
            if not dest.exists():
                shutil.move(str(f), str(dest))
                moved += 1
    if moved:
        print(f"[BACKUP] Moved {moved} file(s) to {backup_dir}")


# ------------------------------------------
# Data loader
# ------------------------------------------
def load_data(project: str):
    PROJECTS_DIR = get_projects_dir()
    folder = PROJECTS_DIR / project
    if not folder.exists():
        print(f"[ERROR] Project folder not found: {folder}")
        return {"project": project, "timestamps": [], "ids": [], "dx": [], "dy": [], "dz": [], "files": []}

    backup_old_files(folder)

    files = []
    for file in folder.glob("*.dat"):
        ts = parse_timestamp(file.name) or datetime.fromtimestamp(file.stat().st_mtime)
        files.append((ts, file))
    files.sort(key=lambda x: x[0])  # oldest → newest

    timestamps = [ts.isoformat() for ts, _ in files]
    filenames = [f.stem for _, f in files]

    data = {}
    for _, file in files:
        with open(file, "r", encoding="utf-8", errors="ignore") as fh:
            lines = [ln.strip() for ln in fh if ln.strip()]
        for row in lines[1:]:
            parts = re.split(r"\s+", row)
            if len(parts) < 4:
                continue
            pid = parts[0]
            dxs, dys, dzs = parts[-3], parts[-2], parts[-1]
            if any(v.lower() in ("data", "dx", "dy", "dz", "nodata", "no") for v in (dxs, dys, dzs)):
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


# ------------------------------------------
# Routes
# ------------------------------------------
@app.route("/")
def dashboard():
    PROJECTS_DIR = get_projects_dir()
    if not PROJECTS_DIR.exists():
        msg = f"⚠️ Project folder not found: {PROJECTS_DIR}"
        print(msg)
        return render_template("settings.html", projects=[], error=msg)

    projects = [p.name for p in PROJECTS_DIR.iterdir() if p.is_dir()]
    default = projects[0] if projects else "No Projects"
    return render_template("index.html", project=default, projects=projects)


@app.route("/project/<project_name>")
def project_view(project_name):
    PROJECTS_DIR = get_projects_dir()
    if not PROJECTS_DIR.exists():
        return render_template("settings.html", projects=[], error="Projects directory not found.")
    projects = [p.name for p in PROJECTS_DIR.iterdir() if p.is_dir()]
    return render_template("index.html", project=project_name, projects=projects)


@app.route("/settings")
def settings():
    PROJECTS_DIR = get_projects_dir()
    projects = []
    if PROJECTS_DIR.exists():
        projects = [p.name for p in PROJECTS_DIR.iterdir() if p.is_dir()]
    return render_template("settings.html", projects=projects)


@app.route("/get_projects")
def get_projects():
    PROJECTS_DIR = get_projects_dir()
    if not PROJECTS_DIR.exists():
        return jsonify([])
    projects = [p.name for p in PROJECTS_DIR.iterdir() if p.is_dir()]
    return jsonify(sorted(projects))


@app.route("/get_data")
def get_data():
    project = request.args.get("project")
    if not project:
        return jsonify({"error": "Missing project"}), 400
    return jsonify(load_data(project))


# ------------------------------------------
# Directory Settings
# ------------------------------------------
@app.route("/get_directory_settings")
def get_directory_settings():
    path = ""
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("PROJECTS_PATH="):
                    path = line.split("=", 1)[1].strip()
                    break
    return jsonify({"path": path})


@app.route("/save_directory_settings", methods=["POST"])
def save_directory_settings_route():
    data = request.get_json()
    path = data.get("path", "").strip()
    if not path:
        return jsonify({"error": "No path provided"}), 400

    # Update or create setting entry
    lines = []
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            lines = [ln for ln in f if not ln.startswith("PROJECTS_PATH=")]
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        for ln in lines:
            f.write(ln)
        f.write(f"PROJECTS_PATH={path}\n")

    print(f"[SETTINGS] Saved PROJECTS_PATH: {path}")
    return jsonify({"message": f"Saved folder: {path}", "reload": True})


# 🧭 Native Windows folder picker (for EXE mode)
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
        print(f"[ERROR] Folder dialog: {e}")
        return jsonify({"path": ""})


# ------------------------------------------
# Run Flask
# ------------------------------------------
if __name__ == "__main__":
    port = 5000
    url = f"http://127.0.0.1:{port}"

    def open_browser():
        webbrowser.open(url)

    threading.Timer(1.5, open_browser).start()
    print(f"🚀 Launching MSP RAPID View at {url}")
    print(f"🔥 Active project root: {get_projects_dir()}")
    print(f"🧩 Settings file: {SETTINGS_FILE}")

    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
