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

if getattr(sys, "frozen", False):
    BASE = Path(sys.executable).parent
else:
    BASE = Path(__file__).parent

SETTINGS_FILE = BASE / "project_settings.txt"
BACKUP_DAYS = 14

print("-------------------------------------------------------------")
print(f"Running from: {BASE}")
print(f"Settings file: {SETTINGS_FILE}")
print("-------------------------------------------------------------")


# ==============================================================

def read_directory_settings():
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if line.startswith("PROJECTS_PATH="):
                    path = line.split("=", 1)[1].strip()
                    if path:
                        return Path(path)
    return None


def get_projects_dir():
    folder = read_directory_settings()
    if folder and folder.exists():
        return folder
    return None


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

def save_project_settings(project_name, new_settings):
    lines = []
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()

    output = []
    in_section = False
    section_found = False

    for line in lines:
        stripped = line.strip()

        if stripped.startswith("[") and stripped.endswith("]"):
            if in_section:
                for k, v in new_settings.items():
                    output.append(f"{k.upper()}={v}\n")
                output.append("\n")
                in_section = False

            if stripped[1:-1] == project_name:
                section_found = True
                in_section = True
                output.append(f"[{project_name}]\n")
                continue

        if in_section and "=" in stripped:
            continue

        output.append(line)

    if in_section:
        for k, v in new_settings.items():
            output.append(f"{k.upper()}={v}\n")
        output.append("\n")

    if not section_found:
        output.append(f"\n[{project_name}]\n")
        for k, v in new_settings.items():
            output.append(f"{k.upper()}={v}\n")

    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        f.writelines(output)


def read_project_settings(project_name):
    settings = {}
    if not SETTINGS_FILE.exists():
        return settings

    with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
        lines = f.readlines()

    in_section = False
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("[") and line.endswith("]"):
            in_section = (line[1:-1] == project_name)
            continue
        if in_section and "=" in line:
            key, val = line.split("=", 1)
            settings[key.strip().upper()] = val.strip()
    return settings


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


@app.route("/get_projects")
def get_projects():
    PROJECTS_DIR = get_projects_dir()
    if PROJECTS_DIR is None:
        return jsonify([])

    projects = [p.name for p in PROJECTS_DIR.iterdir() if p.is_dir()]
    return jsonify(sorted(projects))


@app.route("/get_data")
def get_data_route():
    project = request.args.get("project")
    if not project:
        return jsonify({"error": "Missing project"}), 400

    return jsonify(load_data(project))


@app.route("/save_directory_settings", methods=["POST"])
def save_directory_settings():
    data = request.get_json()

    path = data.get("path", "").strip()
    project = data.get("project", "").strip()

    if not path:
        return jsonify({"error": "Invalid path"}), 400

    # Save PROJECTS_PATH
    lines = []
    if SETTINGS_FILE.exists():
        with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()

    new_lines = []
    wrote_path = False
    for line in lines:
        if line.startswith("PROJECTS_PATH="):
            new_lines.append(f"PROJECTS_PATH={path}\n")
            wrote_path = True
        else:
            new_lines.append(line)

    if not wrote_path:
        new_lines.insert(0, f"PROJECTS_PATH={path}\n\n")

    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    # Save per-project settings if provided
    settings = data.get("settings")
    if project and isinstance(settings, dict):
        save_project_settings(project, settings)

    return jsonify({"message": "Settings saved", "reload": True})


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


@app.route("/get_project_settings")
def get_project_settings_route():
    project = request.args.get("project")
    if not project:
        return jsonify({"error": "Missing project"}), 400

    return jsonify(read_project_settings(project))


# ==============================================================

if __name__ == "__main__":
    port = 5000
    url = f"http://127.0.0.1:{port}"

    def open_browser():
        webbrowser.open(url)

    threading.Timer(1.5, open_browser).start()

    app.run(host="127.0.0.1", port=port, debug=False, use_reloader=False)
