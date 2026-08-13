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
  { label: "Dashboard",          icon: "bi-speedometer2",      href: "/admin_dashboard.html",       key: "dashboard" },
  { label: "Academic Managers",  icon: "bi-person-workspace",  href: "/admin/academic-managers.html", key: "academic-managers" },
  { label: "Faculty",            icon: "bi-person-workspace",  href: "/admin/faculty.html",          key: "faculty" },
  { label: "Students",           icon: "bi-mortarboard",       href: "/admin/students.html",         key: "students" },
  { label: "Courses",            icon: "bi-book-half",         href: "/admin/courses.html",          key: "courses" },
  { label: "Leave Requests",     icon: "bi-calendar-check",    href: "/admin/leave-requests.html",   key: "leave-requests" },
  { label: "Performance",        icon: "bi-graph-up",          href: "/admin/performance.html",      key: "performance" },
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
            <div class="admin-avatar" id="profileAvatarTrigger" style="cursor:pointer;" title="Manage profile picture">
              <img id="topbarAvatarImg" src="" alt="" style="display:none; width:34px; height:34px; border-radius:50%; object-fit:cover;">
              <i class="bi bi-person-circle" id="topbarAvatarIcon"></i>
              <span id="topbarUserName">Loading...</span>
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

    <!-- Profile Picture Modal -->
    <div class="modal fade" id="profileModal" tabindex="-1">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title"><i class="bi bi-person-circle me-2"></i>Profile Picture</h5>
            <button class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body text-center">
            <img id="profileModalPreview" src="" alt="" style="display:none; width:120px; height:120px; border-radius:50%; object-fit:cover; margin-bottom:16px;">
            <i class="bi bi-person-circle" id="profileModalIcon" style="font-size:120px; color:#d1d5db;"></i>
            <div class="mt-3">
              <input type="file" id="profilePictureInput" accept="image/*" class="form-control">
            </div>
            <div class="text-danger small mt-2" id="profilePictureError"></div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-outline-danger me-auto" id="removeProfilePictureBtn" style="display:none;">
              <i class="bi bi-trash me-1"></i>Remove Photo
            </button>
            <button class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button class="btn btn-primary" id="saveProfilePictureBtn">
              <i class="bi bi-check-circle me-2"></i>Save
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

// ===============================================================
// Profile picture widget (avatar + name in the topbar, click to
// upload/change/remove). Deferred to DOMContentLoaded rather than
// called directly from renderLayout() — at the point renderLayout()
// runs, the axios CDN script, bootstrap, and js/api.js haven't loaded
// yet (they're later <script> tags on the page), so `api` and
// `bootstrap` don't exist yet. By DOMContentLoaded, every script tag
// on the page has already executed, so both are guaranteed available
// — while the shell HTML (inserted synchronously by renderLayout())
// is already in the DOM well before that point.
// ===============================================================

document.addEventListener("DOMContentLoaded", initProfileWidget);

async function initProfileWidget() {

    const trigger = document.getElementById("profileAvatarTrigger");
    const profileModalEl = document.getElementById("profileModal");
    if (!trigger || !profileModalEl || typeof api === "undefined") return;

    const profileModal = new bootstrap.Modal(profileModalEl);

    trigger.addEventListener("click", () => {
        document.getElementById("profilePictureInput").value = "";
        document.getElementById("profilePictureError").textContent = "";
        profileModal.show();
    });

    document.getElementById("profilePictureInput").addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const preview = document.getElementById("profileModalPreview");
            preview.src = ev.target.result;
            preview.style.display = "inline-block";
            document.getElementById("profileModalIcon").style.display = "none";
        };
        reader.readAsDataURL(file);
    });

    document.getElementById("saveProfilePictureBtn").addEventListener("click", saveProfilePicture);
    document.getElementById("removeProfilePictureBtn").addEventListener("click", removeProfilePicture);

    try {
        const response = await api.get(`${API.BASE_URL}/api/accounts/profile/`);
        renderProfile(response.data);
    } catch (error) {
        console.error(error);
    }

}

function renderProfile(profile) {

    const nameEl = document.getElementById("topbarUserName");
    const imgEl = document.getElementById("topbarAvatarImg");
    const iconEl = document.getElementById("topbarAvatarIcon");
    const modalPreview = document.getElementById("profileModalPreview");
    const modalIcon = document.getElementById("profileModalIcon");
    const removeBtn = document.getElementById("removeProfilePictureBtn");

    const displayName = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.username;
    nameEl.textContent = displayName;

    if (profile.profile_image) {
        imgEl.src = `${API.BASE_URL}${profile.profile_image}`;
        imgEl.style.display = "inline-block";
        iconEl.style.display = "none";
        modalPreview.src = `${API.BASE_URL}${profile.profile_image}`;
        modalPreview.style.display = "inline-block";
        modalIcon.style.display = "none";
        removeBtn.style.display = "inline-block";
    } else {
        imgEl.style.display = "none";
        iconEl.style.display = "inline-block";
        modalPreview.style.display = "none";
        modalIcon.style.display = "inline-block";
        removeBtn.style.display = "none";
    }

}

async function saveProfilePicture() {

    const fileInput = document.getElementById("profilePictureInput");
    const file = fileInput.files[0];

    if (!file) {
        document.getElementById("profilePictureError").textContent = "Choose an image first.";
        return;
    }

    const saveBtn = document.getElementById("saveProfilePictureBtn");
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Saving...`;

    const formData = new FormData();
    formData.append("profile_image", file);

    try {

        const response = await api.patch(`${API.BASE_URL}/api/accounts/profile/`, formData);
        renderProfile(response.data);
        bootstrap.Modal.getInstance(document.getElementById("profileModal"))?.hide();

    } catch (error) {

        console.error(error);
        document.getElementById("profilePictureError").textContent = "Failed to save picture.";

    } finally {

        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="bi bi-check-circle me-2"></i>Save`;

    }

}

async function removeProfilePicture() {

    const removeBtn = document.getElementById("removeProfilePictureBtn");
    removeBtn.disabled = true;

    try {

        const response = await api.delete(`${API.BASE_URL}/api/accounts/profile/`);
        renderProfile(response.data);
        bootstrap.Modal.getInstance(document.getElementById("profileModal"))?.hide();

    } catch (error) {

        console.error(error);
        document.getElementById("profilePictureError").textContent = "Failed to remove picture.";

    } finally {

        removeBtn.disabled = false;

    }

}