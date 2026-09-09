document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

const STUDENT_FEEDBACK_ENDPOINT = `${API.BASE_URL}/api/student/feedback/`;
const ACADEMIC_MANAGERS_ENDPOINT = `${API.BASE_URL}/api/student/academic-managers/`;

let amSelect;
let historyList;

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    amSelect = document.getElementById("academicManagerSelect");
    historyList = document.getElementById("feedbackHistoryList");

    document.getElementById("feedbackForm").addEventListener("submit", submitFeedback);

    loadAcademicManagers();
    loadHistory();

}

async function loadAcademicManagers() {

    try {

        const response = await api.get(ACADEMIC_MANAGERS_ENDPOINT);
        const managers = response.data;

        amSelect.innerHTML = `<option value="">— Select —</option>` +
            managers.map(m => {
                const displayName = (m.first_name || m.last_name)
                    ? `${m.first_name} ${m.last_name}`.trim()
                    : m.username;
                return `<option value="${m.id}">${displayName}</option>`;
            }).join("");

    } catch (error) {

        console.error(error);

    }

}

async function submitFeedback(e) {

    e.preventDefault();

    document.getElementById("academicManagerError").textContent = "";
    document.getElementById("messageError").textContent = "";

    const academicManager = amSelect.value;
    const message = document.getElementById("feedbackMessage").value.trim();

    let valid = true;

    if (!academicManager) {
        document.getElementById("academicManagerError").textContent = "Please choose who to send this to.";
        valid = false;
    }
    if (!message) {
        document.getElementById("messageError").textContent = "Please enter a message.";
        valid = false;
    }

    if (!valid) return;

    const submitBtn = document.getElementById("submitFeedbackBtn");
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>Sending...`;

    try {

        await api.post(STUDENT_FEEDBACK_ENDPOINT, {
            academic_manager: academicManager,
            message: message,
        });

        document.getElementById("feedbackForm").reset();
        loadHistory();

    } catch (error) {

        console.error(error);

        if (error.response?.data?.message) {
            document.getElementById("messageError").textContent = error.response.data.message[0];
        } else if (error.response?.data?.academic_manager) {
            document.getElementById("academicManagerError").textContent = error.response.data.academic_manager[0];
        }

    } finally {

        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="bi bi-send me-2"></i>Send`;

    }

}

async function loadHistory() {

    historyList.innerHTML = `
    <div class="text-center py-5">
        <div class="spinner-border text-primary"></div>
    </div>`;

    try {

        const response = await api.get(STUDENT_FEEDBACK_ENDPOINT);

        renderHistory(response.data);

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        historyList.innerHTML = `<div class="text-center text-danger py-5">Failed to load feedback history.</div>`;

    }

}

function renderHistory(records) {

    if (!records.length) {
        historyList.innerHTML = `
        <div class="text-center py-5 text-muted">
            <i class="bi bi-chat-left-text fs-1"></i><br><br>
            You haven't sent any feedback yet.
        </div>`;
        return;
    }

    historyList.innerHTML = records.map(f => `
        <div class="border rounded p-3 mb-3">
            <div class="d-flex justify-content-between align-items-start mb-2">
                <div>
                    <span class="text-muted small">To </span><strong>${f.academic_manager_username}</strong>
                    <span class="text-muted small ms-2">${new Date(f.created_at).toLocaleString()}</span>
                </div>
                ${f.responded_at
                    ? `<span class="badge bg-success">Responded</span>`
                    : `<span class="badge bg-warning text-dark">Awaiting response</span>`
                }
            </div>
            <p class="mb-2">${f.message}</p>
            ${f.responded_at
                ? `
                <div class="bg-light rounded p-2 mt-2">
                    <p class="text-muted small mb-1">Response — ${new Date(f.responded_at).toLocaleString()}</p>
                    <p class="mb-0">${f.response}</p>
                </div>
                `
                : ""
            }
        </div>
    `).join("");

}
