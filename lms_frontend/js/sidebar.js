document.addEventListener("DOMContentLoaded", () => {

    const sidebar = document.querySelector(".sidebar");
    const overlay = document.getElementById("sidebarOverlay");
    const toggle = document.getElementById("sidebarToggle");

    if (!sidebar || !overlay || !toggle) return;

    function openSidebar() {

        sidebar.classList.add("show");
        overlay.classList.add("show");

        document.body.style.overflow = "hidden";

    }

    function closeSidebar() {

        sidebar.classList.remove("show");
        overlay.classList.remove("show");

        document.body.style.overflow = "";

    }

    toggle.addEventListener("click", () => {

        if (sidebar.classList.contains("show")) {

            closeSidebar();

        } else {

            openSidebar();

        }

    });

    overlay.addEventListener("click", closeSidebar);

    document.querySelectorAll(".nav-link").forEach(link => {

        link.addEventListener("click", () => {

            if (window.innerWidth < 992) {

                closeSidebar();

            }

        });

    });

    window.addEventListener("resize", () => {

        if (window.innerWidth >= 992) {

            closeSidebar();

        }

    });

    document.addEventListener("keydown", (e) => {

        if (e.key === "Escape") {

            closeSidebar();

        }

    });

});