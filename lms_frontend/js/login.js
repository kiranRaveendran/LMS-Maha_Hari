const loginForm = document.getElementById("loginForm");
const messageBox = document.getElementById("messageBox");
const loginBtn = document.getElementById("loginBtn");

function showMessage(message, type) {
    messageBox.className = `alert alert-${type}`;
    messageBox.innerText = message;
    messageBox.classList.remove("d-none");
}

loginForm.addEventListener("submit", async function (e) {

    e.preventDefault();

    loginBtn.disabled = true;
    loginBtn.innerHTML = `
        <span class="spinner-border spinner-border-sm me-2"></span>
        Logging in...
    `;

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {

        const response = await fetch(`${API.BASE_URL}/api/accounts/login/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });

        const data = await response.json();

        console.log("Login Response:", data);

        if (response.ok) {

            const userData = data.data;

            localStorage.setItem("access", userData.access);
            localStorage.setItem("refresh", userData.refresh);
            localStorage.setItem("role", userData.role);

            const role = userData.role;

            console.log("Detected Role:", role);

            showMessage(
                "Login successful. Redirecting...",
                "success"
            );

            setTimeout(() => {

               switch (role) {

    case "SUPERUSER":

        window.location.href = "admin_dashboard.html";

        break;

    case "ACADEMIC_MANAGER":

        window.location.href = "academic_manager_dashboard.html";

        break;

    case "FACULTY":

        window.location.href = "faculty_dashboard.html";

        break;

    case "STUDENT":

        window.location.href = "student_dashboard.html";

        break;

    default:

        console.error("Unknown role:", role);

        showMessage(
            "Unknown user role.",
            "danger"
        );

}
            }, 1000);

        } else {

            showMessage(
                data.message || "Invalid username or password.",
                "danger"
            );

        }

    } catch (error) {

        console.error(error);

        showMessage(
            "Server error. Please try again later.",
            "danger"
        );

    } finally {

        loginBtn.disabled = false;
        loginBtn.innerHTML = "Login";

    }

});


