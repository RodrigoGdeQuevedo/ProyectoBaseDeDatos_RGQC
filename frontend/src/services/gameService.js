import api from "./api";

export async function getGames() {
    const response = await api.get("/games");
    return response.data;
}

export async function searchGames(query) {
    const response = await api.get("/games/search", {
        params: { q: query }
    });

    return response.data;
}

export async function createGame(payload) {
    const response = await api.post("/games", payload);
    return response.data;
}

export async function updateGame(id, payload) {
    const response = await api.put(`/games/${id}`, payload);
    return response.data;
}

export async function deleteGame(id) {
    const response = await api.delete(`/games/${id}`);
    return response.data;
}

export async function getGameMedia(id) {
    const response = await api.get(`/games/${id}/media`);
    return response.data;
}

export async function getFavorites() {
    const response = await api.get("/users/me/favorites");
    return response.data;
}

export async function addFavorite(id) {
    const response = await api.post(`/users/me/favorites/${id}`);
    return response.data;
}

export async function removeFavorite(id) {
    const response = await api.delete(`/users/me/favorites/${id}`);
    return response.data;
}