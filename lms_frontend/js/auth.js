document.addEventListener("DOMContentLoaded", function () {

    console.log("AUTH JS LOADED");

    const token = localStorage.getItem("access");

    if (
        !token &&
        window.location.pathname !== "/login.html"
    ) {
        window.location.replace("/login.html");
    }

    const logoutBtn = document.getElementById("logoutBtn");
    const confirmLogoutBtn = document.getElementById("confirmLogoutBtn");
    const logoutModalElement = document.getElementById("logoutModal");

    console.log("Logout Button:", logoutBtn);
    console.log("Confirm Button:", confirmLogoutBtn);
    console.log("Modal:", logoutModalElement);

    if (!logoutModalElement) {
        return;
    }

    const logoutModal = new bootstrap.Modal(logoutModalElement);

    logoutBtn?.addEventListener("click", function (e) {

        e.preventDefault();

        console.log("Opening Logout Modal");

        logoutModal.show();

    });

    confirmLogoutBtn?.addEventListener("click", function () {

        console.log("Logging out...");

        localStorage.clear();

        window.location.href = "/login.html";

    });

    // Prevents the browser's back/forward cache from showing a stale,
    // already-logged-out page. Forces a real reload on back/forward
    // navigation, which re-runs this page's own token check.
    window.addEventListener("pageshow", function (event) {
        if (event.persisted) {
            window.location.reload();
        }
    });

});