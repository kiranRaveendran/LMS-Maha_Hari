const API = {

    BASE_URL: "http://127.0.0.1:8000",

    token() {

        return localStorage.getItem("access");

    },

    headers() {

        return {

            "Authorization": `Bearer ${this.token()}`

        };

    }

};