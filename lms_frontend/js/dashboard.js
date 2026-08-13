// ===============================================================
// Admin Dashboard statistics.
// Reuses: API.BASE_URL (js/api.js), token from localStorage (js/auth.js).
// If your project's toast helper has a different name than `showToast`,
// update the one reference in handleDashboardError() below.
// ===============================================================

const DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/accounts/admin/dashboard/`;
const COURSES_PERFORMANCE_ENDPOINT = `${API.BASE_URL}/api/accounts/admin/courses-performance/`;

// Maps API response keys -> the <div id="..."> that displays that number
const STAT_CONFIG = [
    { key: "total_students",           elId: "studentCount" },
    { key: "total_faculty",            elId: "facultyCount" },
    { key: "total_academic_managers",  elId: "managerCount" },
    { key: "total_courses",            elId: "courseCount" },
    { key: "pending_leave_requests",   elId: "leaveCount" },
];

document.addEventListener("DOMContentLoaded", () => {
    loadDashboardStats();
    loadPerformanceOverview();
    initProfileWidget();

    document
        .getElementById("refreshDashboardBtn")
        ?.addEventListener("click", () => loadDashboardStats(true));
});

async function loadPerformanceOverview() {

    const tbody = document.getElementById("performanceOverviewBody");
    if (!tbody) return;

    try {

        const response = await api.get(COURSES_PERFORMANCE_ENDPOINT, {
            headers: API.headers()
        });

        const courses = response.data;

        if (!courses || courses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center text-muted py-3">No courses yet.</td></tr>`;
            return;
        }

        tbody.innerHTML = courses.map(c => `
            <tr>
                <td>${c.course_name} <span class="text-muted small">(${c.course_code})</span></td>
                <td>${c.class_average_attendance !== null ? c.class_average_attendance + "%" : "—"}</td>
                <td>${c.class_average_marks !== null ? c.class_average_marks : "—"}</td>
            </tr>
        `).join("");

    } catch (error) {

        console.error(error);
        tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger py-3">Failed to load.</td></tr>`;

    }

}

// ===============================
// Main fetch + render flow
// ===============================

async function loadDashboardStats(isManualRefresh = false) {

    const token = localStorage.getItem("access");

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    setSkeletonState(true);
    toggleRefreshSpinner(isManualRefresh, true);

    try {

        const response = await api.get(DASHBOARD_ENDPOINT, {
            headers: { Authorization: `Bearer ${token}` }
        });

        renderStats(response.data);
        updateLastUpdatedTimestamp();

    } catch (error) {

        handleDashboardError(error);

    } finally {

        setSkeletonState(false);
        toggleRefreshSpinner(isManualRefresh, false);

    }

}

function renderStats(data) {

    STAT_CONFIG.forEach(({ key, elId }) => {

        const el = document.getElementById(elId);

        if (el) {
            animateCountUp(el, Number(data[key]) || 0);
        }

    });

}

// ===============================
// Count-up animation
// ===============================

function animateCountUp(el, target, duration = 700) {

    const startTime = performance.now();

    function tick(now) {

        const progress = Math.min((now - startTime) / duration, 1);
        const value = Math.floor(target * progress);

        el.textContent = value;

        if (progress < 1) {
            requestAnimationFrame(tick);
        } else {
            el.textContent = target;
        }

    }

    requestAnimationFrame(tick);

}

// ===============================
// Loading skeleton toggling
// ===============================

function setSkeletonState(isLoading) {

    document.querySelectorAll(".stat-skeleton").forEach(el => {
        el.classList.toggle("hidden", !isLoading);
    });

    document.querySelectorAll(".stat-value").forEach(el => {
        el.classList.toggle("hidden", isLoading);
    });

}

function toggleRefreshSpinner(isManualRefresh, isLoading) {

    if (!isManualRefresh) return;

    const btn = document.getElementById("refreshDashboardBtn");
    if (!btn) return;

    btn.disabled = isLoading;
    btn.querySelector(".refresh-icon")?.classList.toggle("animate-spin", isLoading);

}

function updateLastUpdatedTimestamp() {

    const el = document.getElementById("lastUpdated");
    if (!el) return;

    el.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;

}

// ===============================
// Error handling
// ===============================

function handleDashboardError(error) {

    console.error(error);

    if (error.response?.status === 401) {
        localStorage.clear();
        window.location.href = "/login.html";
        return;
    }

    const message = "Failed to load dashboard statistics.";

    // Reuses your existing toast system if `showToast` exists globally.
    // Rename this call if your helper has a different name.
    if (typeof showToast === "function") {
        showToast(message, "danger");
    } else {
        alert(message);
    }

}

// ===============================================================
// Profile picture widget — same functionality as every other Admin
// page (via layout.js), added directly here since admin_dashboard.html
// is a standalone page that doesn't use the shared renderLayout()
// shell. Named renderTopbarProfile (not renderProfile) to avoid any
// future collision with page-specific code, matching the same
// collision issue that was found and fixed on the Faculty Dashboard.
// ===============================================================

async function initProfileWidget() {

    const trigger = document.getElementById("profileAvatarTrigger");
    const profileModalEl = document.getElementById("profileModal");
    if (!trigger || !profileModalEl) return;

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
        renderTopbarProfile(response.data);
    } catch (error) {
        console.error(error);
    }

}

function renderTopbarProfile(profile) {

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
        renderTopbarProfile(response.data);
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
        renderTopbarProfile(response.data);
        bootstrap.Modal.getInstance(document.getElementById("profileModal"))?.hide();

    } catch (error) {

        console.error(error);
        document.getElementById("profilePictureError").textContent = "Failed to remove picture.";

    } finally {

        removeBtn.disabled = false;

    }

}