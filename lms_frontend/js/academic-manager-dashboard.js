document.addEventListener("DOMContentLoaded", function () {

    const DASHBOARD_URL = `${API.BASE_URL}/api/academic-manager/dashboard/`;

    const STAT_FIELDS = {
        courseCount: "total_courses",
        batchCount: "total_batches",
        facultyCount: "total_faculty",
        studentCount: "total_students",
        enrollmentCount: "total_enrollments",
        pendingLeaveCount: "pending_leave_requests",
    };

    function showStats(data) {
        Object.entries(STAT_FIELDS).forEach(([elId, dataKey]) => {
            const el = document.getElementById(elId);
            if (!el) return;
            el.textContent = data[dataKey] ?? 0;

            const skeleton = el.previousElementSibling;
            if (skeleton && skeleton.classList.contains("stat-skeleton")) {
                skeleton.classList.add("hidden");
            }
            el.classList.remove("hidden");
        });
    }

    async function loadDashboardStats() {
        try {
            // Uses the shared `api` instance (not raw axios) so the
            // request/response interceptors in api.js — token injection
            // and auto-refresh on 401 — actually run.
            const res = await api.get(DASHBOARD_URL);
            showStats(res.data);
        } catch (err) {
            showToast(extractApiError(err, "Could not load dashboard stats."), true);
        }
    }

    loadDashboardStats();
});