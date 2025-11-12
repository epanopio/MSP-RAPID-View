/* --- Fix white gap & maintain original layout styling --- */
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow-x: hidden;
}

/* Keep the sidebar and content side by side properly */
.inner-wrapper {
  display: flex;
  min-height: 100vh;
  margin: 0 !important;
  padding: 0 !important;
}

/* Sidebar appearance (keep theme colors intact) */
#sidebar-left {
  width: 260px;
  transition: all 0.3s ease;
  background-color: #2f3e51; /* use theme dark blue */
  border-right: 1px solid #1b2735;
  overflow: hidden;
}

/* Collapsed sidebar */
html.sidebar-left-collapsed #sidebar-left {
  width: 60px;
}

/* Hide text when collapsed */
html.sidebar-left-collapsed #sidebar-left .nav-main > li > a span,
html.sidebar-left-collapsed #sidebar-left .nav-parent > a span,
html.sidebar-left-collapsed #sidebar-left .nav-children {
  display: none !important;
}

/* Center icons when collapsed */
html.sidebar-left-collapsed #sidebar-left .nav-main > li > a {
  text-align: center;
}

html.sidebar-left-collapsed #sidebar-left .nav-main > li > a i {
  margin-right: 0;
}

/* Main content area (remove white gap) */
.content-body {
  flex: 1;
  width: 100%;
  margin: 0 !important;
  padding: 20px;
  background-color: #ecf0f5; /* keep light background */
  transition: all 0.3s ease;
}

/* Remove extra white space beside sidebar */
html.sidebar-left-collapsed .content-body,
html.sidebar-left-opened .content-body {
  margin-left: 0 !important;
}

/* === Chart + Point list layout === */
.chart-and-list {
  display: flex;
  width: 100%;
  gap: 20px;
  align-items: stretch;
}

#chartContainer {
  flex: 1;
  min-width: 0;
  height: 400px;
}

/* Point panel */
#pointPanel {
  width: 260px;
  flex-shrink: 0;
  overflow: hidden;
  transition: width 0.3s ease;
}

/* Point ID list */
#idList {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  max-height: 420px;
  overflow-y: auto;
}

#idList div {
  padding: 6px;
  border: 1px solid #ccc;
  background: #f8f8f8;
  border-radius: 4px;
  cursor: pointer;
  text-align: center;
}

#idList div:hover {
  background: #e9e9e9;
}

.id-highlight {
  background: #ffe7a3 !important;
  border-color: #d39c00 !important;
}
