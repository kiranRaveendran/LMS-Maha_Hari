const API = {
    BASE_URL: "http://127.0.0.1:8000",
    token() {
        return localStorage.getItem("access");
    },
    headers() {
        return {
            "Authorization": this.token() ? `Bearer ${this.token()}` : ""
        };
    }
};

// Create a pre-configured Axios client instance
const api = axios.create({
    baseURL: API.BASE_URL,
    headers: {
        "Content-Type": "application/json"
    }
});

// Automatically inject the JWT access token into every outgoing request.
// Also strips the default JSON content-type for FormData bodies (file
// uploads, e.g. Learning Materials) — axios needs to set its own
// multipart/form-data boundary header for those, and a hardcoded
// default here would silently break that.
api.interceptors.request.use(
    (config) => {
        const token = API.token();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        if (config.data instanceof FormData) {
            delete config.headers["Content-Type"];
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Catch expired tokens and refresh automatically
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
            original._retry = true;
            try {
                const refresh = localStorage.getItem("refresh");
                const { data } = await axios.post(`${API.BASE_URL}/api/accounts/refresh/`, { refresh });
                localStorage.setItem("access", data.access);
                original.headers.Authorization = `Bearer ${data.access}`;
                return api(original);
            } catch (refreshError) {
                localStorage.clear();
                window.location.href = "/login.html";
                return Promise.reject(refreshError);
            }
        }
        return Promise.reject(error);
    }
);