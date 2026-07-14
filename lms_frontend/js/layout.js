// ===============================================================
// This file replaces base_admin.html.
//
// In Django, every admin page did:
//   {% extends "base_admin.html" %}
//   {% block content %} ... {% endblock %}
//
// There is no server here to merge a "child" template into a
// "parent" one, so instead: each page puts its unique content in
// a <template id="page-content-source"> tag, and this script
// builds the shared sidebar/topbar/modals shell around it and
// injects that content into a <div id="pageContent">.
//
// Every page calls: renderLayout({ pageTitle, active })
// ===============================================================

const NAV_ITEMS = [
  { label: "Dashboard",          icon: "bi-speedometer2",      href: "../admin_dashboard.html", key: "dashboard" },
  { label: "Academic Managers",  icon: "bi-person-workspace",  href: "academic-managers.html",  key: "academic-managers" },
  { label: "Faculty",            icon: "bi-person-workspace",  href: "faculty.html",             key: "faculty" },
  { label: "Students",           icon: "bi-mortarboard",       href: "students.html",            key: "students" },
  { label: "Courses",            icon: "bi-book-half",         href: "#",                        key: "courses" },
  { label: "Leave Requests",     icon: "bi-calendar-check",    href: "#",                        key: "leave-requests" },
];

function renderLayout({ pageTitle, active }) {

  document.title = `${pageTitle} | LMS`;

  const navHtml = NAV_ITEMS.map(item => `
    <li>
      <a href="${item.href}" class="nav-link${item.key === active ? " active" : ""}">
        <i class="bi ${item.icon}"></i>
        <span>${item.label}</span>
      </a>
    </li>
  `).join("");

  const shellHtml = `
    <div id="sidebarOverlay"></div>

    <div class="wrapper">

      <div class="sidebar-overlay" id="sidebarOverlayInner"></div>

      <aside class="sidebar" id="sidebar">
        <div class="logo">
          <i class="bi bi-mortarboard-fill"></i>
          <span>LMS Admin</span>
        </div>

        <ul class="nav-menu">
          ${navHtml}
        </ul>

        <div class="sidebar-footer">
          <a href="#" id="logoutBtn" class="logout-btn">
            <i class="bi bi-box-arrow-right"></i>
            <span>Logout</span>
          </a>
        </div>
      </aside>

      <main class="main-content">
        <header class="topbar">
          <div class="topbar-left">
            <button class="sidebar-toggle" id="sidebarToggle">
              <i class="bi bi-list"></i>
            </button>
            <div>
              <h3 class="page-title">${pageTitle}</h3>
              <small class="text-muted">Learning Management System</small>
            </div>
          </div>

          <div class="top-right">
            <div class="admin-avatar">
              <i class="bi bi-person-circle"></i>
              <span>Administrator</span>
            </div>
          </div>
        </header>

        <div class="page-content" id="pageContent"></div>
      </main>

    </div>

    <!-- Logout Modal -->
    <div class="modal fade" id="logoutModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title">
              <i class="bi bi-box-arrow-right text-danger me-2"></i>
              Confirm Logout
            </h5>
            <button class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <p class="text-muted mb-0">
              Are you sure you want to logout from the Learning Management System?
            </p>
          </div>
          <div class="modal-footer border-0">
            <button class="btn btn-light" data-bs-dismiss="modal">Cancel</button>
            <button id="confirmLogoutBtn" class="btn btn-danger">
              <i class="bi bi-box-arrow-right me-1"></i>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Toast -->
    <div class="toast-container position-fixed top-0 end-0 p-3">
      <div id="appToast" class="toast border-0">
        <div class="d-flex">
          <div id="toastMessage" class="toast-body"></div>
          <button class="btn-close me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML("afterbegin", shellHtml);

  // Pull this page's own markup out of its <template> tag and drop
  // it into the shell's content area (this is the {% block content %} swap)
  const source = document.getElementById("page-content-source");
  if (source) {
    document.getElementById("pageContent").appendChild(source.content.cloneNode(true));
    source.remove();
  }
}