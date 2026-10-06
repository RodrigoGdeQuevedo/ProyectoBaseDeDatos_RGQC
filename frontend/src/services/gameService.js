import api from "./api";

export async function getGames() {
    const response = await api.get("/games");
    return response.data;
}

export async function getGame(id) {
    const response = await api.get(`/games/mongo_id/${id}`);
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

export async function getCustomLists() { return (await api.get("/users/me/lists")).data; }
export async function createCustomList(name) { return (await api.post("/users/me/lists", { name })).data; }
export async function addGameToList(listId, gameId) { return api.post(`/users/me/lists/${listId}/games/${gameId}`); }
export async function getCustomListGames(listId) { return (await api.get(`/users/me/lists/${listId}/games`)).data; }
export async function removeGameFromList(listId, gameId) { return api.delete(`/users/me/lists/${listId}/games/${gameId}`); }
export async function getGameReviews(gameId) { return (await api.get(`/games/${gameId}/reviews`)).data; }
export async function saveGameReview(gameId, review) { return api.put(`/games/${gameId}/reviews`, review); }
