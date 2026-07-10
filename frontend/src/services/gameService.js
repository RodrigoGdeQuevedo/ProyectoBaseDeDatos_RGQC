import api from "./api";

export async function getGames() {
    const response = await api.get("/games");
    return response.data;
}

export async function getGameMedia(id) {
    const response = await api.get(`/games/${id}/media`);
    return response.data;
}