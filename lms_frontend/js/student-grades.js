document.addEventListener("DOMContentLoaded", () => {
    initialize();
});

// ===============================
// Globals
// ===============================

const ASSIGNMENTS_ENDPOINT = `${API.BASE_URL}/api/student/assignments/`;
const EXAM_MARKS_ENDPOINT = `${API.BASE_URL}/api/student/exam-marks/`;
const DASHBOARD_ENDPOINT = `${API.BASE_URL}/api/student/dashboard/`;

const EXAM_TYPE_LABELS = {
    INTERNAL: "Internal",
    MODEL: "Model",
    FINAL: "Final",
};

let courseFilter;
let summaryBody;
let courseSections;

// ===============================
// Letter grade mapping — copied exactly from js/submissions.js /
// js/student-assignments.js. Display only; marks (0-100) are what's
// actually stored. Pass mark is 40 (C and above pass, F fails).
// ===============================

function getLetterGrade(marks) {

    const m = Number(marks);
    if (isNaN(m)) return null;

    if (m >= 90) return "S";
    if (m >= 75) return "A";
    if (m >= 60) return "B";
    if (m >= 40) return "C";
    return "F";

}

function getLetterGradeBadgeClass(letter) {

    switch (letter) {
        case "S": return "bg-success";
        case "A": return "bg-primary";
        case "B": return "bg-info text-dark";
        case "C": return "bg-warning text-dark";
        case "F": return "bg-danger";
        default: return "bg-secondary";
    }

}

// ===============================
// Initialize
// ===============================

function initialize() {

    const token = API.token();

    if (!token) {
        window.location.href = "/login.html";
        return;
    }

    courseFilter = document.getElementById("courseFilter");
    summaryBody = document.getElementById("summaryBody");
    courseSections = document.getElementById("courseSections");

    courseFilter.addEventListener("change", loadGrades);

    loadCourseFilter();
    loadGrades();

}

// ===============================
// Course filter dropdown (dashboard's enrolled courses — same
// pattern as student-learning-materials.js / student-assignments.js)
// ===============================

async function loadCourseFilter() {

    try {

        const response = await api.get(DASHBOARD_ENDPOINT);
        const courses = response.data.courses || [];

        courseFilter.innerHTML = `<option value="">All Courses</option>` +
            courses.map(c => `<option value="${c.id}">${c.name} (${c.code})</option>`).join("");

    } catch (error) {
        console.error(error);
    }

}

// ===============================
// Load + render grades
// ===============================

async function loadGrades() {

    showLoading();

    try {

        const courseId = courseFilter.value;
        const assignmentsUrl = courseId ? `${ASSIGNMENTS_ENDPOINT}?course=${courseId}` : ASSIGNMENTS_ENDPOINT;
        const examMarksUrl = courseId ? `${EXAM_MARKS_ENDPOINT}?course=${courseId}` : EXAM_MARKS_ENDPOINT;

        const [assignmentsResponse, examMarksResponse] = await Promise.all([
            api.get(assignmentsUrl),
            api.get(examMarksUrl),
        ]);

        renderGrades(assignmentsResponse.data, examMarksResponse.data);

    } catch (error) {

        console.error(error);

        if (error.response?.status === 401) {
            localStorage.clear();
            window.location.href = "/login.html";
            return;
        }

        showError();

    }

}

function showLoading() {
    summaryBody.innerHTML = `
    <div class="text-center py-4 text-muted">
        <div class="spinner-border text-primary mb-2"></div><br>Loading Grades...
    </div>`;
    courseSections.innerHTML = "";
}

function showError() {
    summaryBody.innerHTML = `<div class="text-center text-danger py-4">Failed to load grades.</div>`;
    courseSections.innerHTML = "";
}

function showEmptyState() {
    summaryBody.innerHTML = `
    <div class="text-center py-4 text-muted">
        <i class="bi bi-bar-chart fs-1"></i><br><br>
        No Grades Found
    </div>`;
    courseSections.innerHTML = "";
}

// ===============================
// Grouping + rendering
// ===============================

function renderGrades(assignments, examMarks) {

    if ((!assignments || assignments.length === 0) && (!examMarks || examMarks.length === 0)) {
        showEmptyState();
        return;
    }

    assignments = assignments || [];
    examMarks = examMarks || [];

    // Group by course, preserving first-seen order across both sources.
    const courseMap = new Map();

    const ensureCourse = (courseId, courseName, courseCode) => {
        if (!courseMap.has(courseId)) {
            courseMap.set(courseId, {
                course_id: courseId,
                course_name: courseName,
                course_code: courseCode,
                assignments: [],
                examMarks: [],
            });
        }
        return courseMap.get(courseId);
    };

    assignments.forEach((assignment) => {
        ensureCourse(assignment.course, assignment.course_name, assignment.course_code)
            .assignments.push(assignment);
    });

    examMarks.forEach((mark) => {
        ensureCourse(mark.course, mark.course_name, mark.course_code)
            .examMarks.push(mark);
    });

    // Overall stats — assignments and exam marks pooled together into
    // one combined average (no weighting scheme was specified, so
    // every graded item counts equally).
    const gradedAssignments = assignments.filter(a => a.submission && a.submission.grade !== null && a.submission.grade !== undefined);
    const allGradedValues = [
        ...gradedAssignments.map(a => Number(a.submission.grade)),
        ...examMarks.map(m => Number(m.marks)),
    ];

    const totalGraded = allGradedValues.length;
    const totalPendingAssignments = assignments.length - gradedAssignments.length;
    const overallAverage = totalGraded
        ? allGradedValues.reduce((sum, v) => sum + v, 0) / totalGraded
        : null;
    const overallLetter = overallAverage !== null ? getLetterGrade(overallAverage) : null;

    renderSummary(overallAverage, overallLetter, gradedAssignments.length, examMarks.length, totalPendingAssignments);
    renderCourseSections(Array.from(courseMap.values()));

}

function renderSummary(overallAverage, overallLetter, gradedAssignmentsCount, examResultsCount, totalPendingAssignments) {

    summaryBody.innerHTML = `
    <div class="row g-3">
        <div class="col-md-3">
            <div class="summary-stat">
                <h4 class="fw-bold">${overallAverage !== null ? overallAverage.toFixed(1) : "—"}</h4>
                <span class="badge ${getLetterGradeBadgeClass(overallLetter)}">${overallLetter || "No grades yet"}</span>
                <p class="text-muted small mt-2 mb-0">Overall Average</p>
            </div>
        </div>
        <div class="col-md-3">
            <div class="summary-stat">
                <h4 class="fw-bold text-success">${gradedAssignmentsCount}</h4>
                <p class="text-muted small mb-0">Assignments Graded</p>
            </div>
        </div>
        <div class="col-md-3">
            <div class="summary-stat">
                <h4 class="fw-bold text-primary">${examResultsCount}</h4>
                <p class="text-muted small mb-0">Exam Results</p>
            </div>
        </div>
        <div class="col-md-3">
            <div class="summary-stat">
                <h4 class="fw-bold text-warning">${totalPendingAssignments}</h4>
                <p class="text-muted small mb-0">Pending / Ungraded Assignments</p>
            </div>
        </div>
    </div>
    `;

}

function renderCourseSections(courses) {

    courseSections.innerHTML = "";

    courses.forEach((course) => {

        const gradedAssignments = course.assignments.filter(a => a.submission && a.submission.grade !== null && a.submission.grade !== undefined);
        const combinedValues = [
            ...gradedAssignments.map(a => Number(a.submission.grade)),
            ...course.examMarks.map(m => Number(m.marks)),
        ];
        const courseAverage = combinedValues.length
            ? combinedValues.reduce((sum, v) => sum + v, 0) / combinedValues.length
            : null;
        const courseLetter = courseAverage !== null ? getLetterGrade(courseAverage) : null;

        const assignmentRows = course.assignments.map((assignment) => {

            const submission = assignment.submission;
            const dueDateDisplay = assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : "—";

            let statusBadge;
            let marksDisplay = "—";
            let gradeBadge = "—";
            let feedbackDisplay = `<span class="text-muted">—</span>`;

            if (!submission) {
                statusBadge = `<span class="badge bg-secondary">Not Submitted</span>`;
            } else if (submission.grade === null || submission.grade === undefined) {
                statusBadge = `<span class="badge bg-info text-dark">Awaiting Grading</span>`;
            } else {
                const letter = getLetterGrade(submission.grade);
                statusBadge = `<span class="badge bg-success">Graded</span>`;
                marksDisplay = submission.grade;
                gradeBadge = `<span class="badge ${getLetterGradeBadgeClass(letter)}">${letter}</span>`;
                feedbackDisplay = submission.feedback
                    ? `<span class="feedback-cell" title="${submission.feedback.replace(/"/g, "&quot;")}">${submission.feedback}</span>`
                    : `<span class="text-muted">No feedback</span>`;
            }

            return `
            <tr>
                <td>${assignment.title}</td>
                <td>${dueDateDisplay}</td>
                <td>${statusBadge}</td>
                <td>${marksDisplay}</td>
                <td>${gradeBadge}</td>
                <td>${feedbackDisplay}</td>
            </tr>
            `;

        }).join("");

        const assignmentsTable = course.assignments.length ? `
            <div class="table-responsive">
                <table class="table grade-table mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Assignment</th>
                            <th>Due Date</th>
                            <th>Status</th>
                            <th>Marks</th>
                            <th>Grade</th>
                            <th>Feedback</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${assignmentRows}
                    </tbody>
                </table>
            </div>
        ` : `<p class="text-muted small px-3 py-2 mb-0">No assignments for this course.</p>`;

        const examRows = course.examMarks.map((mark) => {
            const letter = getLetterGrade(mark.marks);
            return `
            <tr>
                <td>${EXAM_TYPE_LABELS[mark.exam_type] || mark.exam_type}</td>
                <td>${mark.marks}</td>
                <td><span class="badge ${getLetterGradeBadgeClass(letter)}">${letter}</span></td>
            </tr>
            `;
        }).join("");

        const examTable = course.examMarks.length ? `
            <div class="table-responsive">
                <table class="table grade-table mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Exam</th>
                            <th>Marks</th>
                            <th>Grade</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${examRows}
                    </tbody>
                </table>
            </div>
        ` : `<p class="text-muted small px-3 py-2 mb-0">No exam results published yet.</p>`;

        courseSections.innerHTML += `
        <div class="card shadow-sm border-0 mb-4">
            <div class="card-header bg-white border-0 py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                    <h6 class="fw-bold mb-0">${course.course_name} <span class="text-muted">(${course.course_code})</span></h6>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="text-muted small">Course Average:</span>
                    <span class="fw-bold">${courseAverage !== null ? courseAverage.toFixed(1) : "—"}</span>
                    <span class="badge ${getLetterGradeBadgeClass(courseLetter)}">${courseLetter || "—"}</span>
                </div>
            </div>
            <div class="card-body p-0">
                <p class="fw-semibold small text-muted px-3 pt-3 mb-1">Assignments</p>
                ${assignmentsTable}
                <hr class="my-0">
                <p class="fw-semibold small text-muted px-3 pt-3 mb-1">Exam Results</p>
                ${examTable}
            </div>
        </div>
        `;

    });

}