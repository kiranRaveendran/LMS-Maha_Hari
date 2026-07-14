// ===============================================================
// Faculty portal layout. Same pattern as js/layout.js (Admin),
// kept as a separate file so nothing here can break the Admin
// module. Reuses the same shell IDs (sidebarOverlay, sidebarToggle,
// logoutModal, confirmLogoutBtn, appToast, toastMessage) so the
// existing js/sidebar.js and js/auth.js work unchanged here too.
//
// Every faculty page calls: renderFacultyLayout({ pageTitle, active })
// ===============================================================

// Root-relative (leading "/") — always resolves from the site root,
// regardless of whether the current page is at project root or one
// folder deep inside faculty/. This is the fix for the whole class
// of "Cannot GET" / 404 path bugs we kept hitting with the Admin module.
const FACULTY_NAV_ITEMS = [
    { label: "Dashboard", icon: "bi-speedometer2", href: "/faculty_dashboard.html", key: "dashboard" },
    { label: "Learning Materials", icon: "bi-journal-richtext", href: "/faculty/learning-materials.html", key: "learning-materials" },
    { label: "Assignments", icon: "bi-clipboard-check", href: "/faculty/assignments.html", key: "assignments" },
    { label: "Attendance", icon: "bi-calendar2-check", href: "/faculty/attendance.html", key: "attendance" },
    { label: "Marks", icon: "bi-bar-chart-line", href: "/faculty/marks.html", key: "marks" },
    { label: "Leave Management", icon: "bi-calendar-check", href: "/faculty/leave-history.html", key: "leave-history" },
];

function renderFacultyLayout({ pageTitle, active }) {

    document.title = `${pageTitle} | LMS Faculty`;

    const navHtml = FACULTY_NAV_ITEMS.map(item => `
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
          <span>LMS Faculty</span>
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
              <span>Faculty</span>
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

    const source = document.getElementById("page-content-source");
    if (source) {
        document.getElementById("pageContent").appendChild(source.content.cloneNode(true));
        source.remove();
    }
}