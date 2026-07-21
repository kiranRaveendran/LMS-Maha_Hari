// Since the frontend is no longer served by Django, it lives on a
// different origin (e.g. http://127.0.0.1:5500) than the API
// (e.g. http://127.0.0.1:8000). Every axios/fetch call must be
// prefixed with this base URL instead of using a relative path.
//
// Change this one line for local dev vs deployment.
const API_BASE_URL = "http://127.0.0.1:8000";