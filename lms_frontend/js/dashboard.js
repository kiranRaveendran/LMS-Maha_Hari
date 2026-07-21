// ===============================================================
// Admin Dashboard statistics.
// Reuses: API.BASE_URL (js/api.js), token from localStorage (js/auth.js).
// If your project's toast helper has a different name than `showToast`,
// update the one reference in handleDashboardError() below.
// ===============================================================

const DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/accounts/admin/dashboard/`;

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

    document
        .getElementById("refreshDashboardBtn")
        ?.addEventListener("click", () => loadDashboardStats(true));
});

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

        const response = await axios.get(DASHBOARD_ENDPOINT, {
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