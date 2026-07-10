import api from "./api";

export async function login(username, password) {

    const form = new URLSearchParams();

    form.append("username", username);
    form.append("password", password);

    const response = await api.post(
        "/auth/login",
        form,
        {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            }
        }
    );

    return response.data;
}

export async function register(user){

    const response = await api.post("/auth/register", user);

    return response.data;
}