import { useContext, useEffect, useMemo, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import GameModal from "../components/GameModal";
import FiltersSidebar from "../components/FiltersSidebar";
import {
    addFavorite,
    createGame,
    deleteGame,
    getFavorites,
    getGames,
    removeFavorite,
    searchGames,
    updateGame
} from "../services/gameService";
import "../styles/catalog.css";

const emptyAdminForm = {
    name: "",
    steam_appid: "",
    type: "game",
    is_free: false,
    short_description: "",
    detailed_description: "",
    website: "",
    youtube_trailer_id: "",
    developers: "",
    publishers: "",
    genres: ""
};

const emptyQuickAddForm = {
    steam_appid: "",
    youtube_trailer_id: ""
};

function csvToList(value) {
    return value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

function gameToForm(game) {
    return {
        name: game.name || "",
        steam_appid: game.steam_appid ? String(game.steam_appid) : "",
        type: game.type || "game",
        is_free: Boolean(game.is_free),
        short_description: game.short_description || "",
        detailed_description: game.detailed_description || "",
        website: game.website || "",
        youtube_trailer_id: game.youtube_trailer_id || "",
        developers: Array.isArray(game.developers) ? game.developers.join(", ") : "",
        publishers: Array.isArray(game.publishers) ? game.publishers.join(", ") : "",
        genres: Array.isArray(game.genres)
            ? game.genres.map((genre) => genre.description || genre.name || "").filter(Boolean).join(", ")
            : ""
    };
}

function Catalog() {
    const { user } = useContext(AuthContext);
    const isAdmin = user?.role === "admin";

    const [games, setGames] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [favoritesOpen, setFavoritesOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedGame, setSelectedGame] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusMessage, setStatusMessage] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const [adminForm, setAdminForm] = useState(emptyAdminForm);
    const [editingGame, setEditingGame] = useState(null);
    const [quickAddForm, setQuickAddForm] = useState(emptyQuickAddForm);
    const [importing, setImporting] = useState(false);
    const [priceFilter, setPriceFilter] = useState("all");
    const [selectedGenres, setSelectedGenres] = useState(() => new Set());

    async function loadGames(query = "") {
        setLoading(true);
        setErrorMessage("");

        try {
            const data = query.trim() ? await searchGames(query.trim()) : await getGames();
            setGames(data);
        } catch (error) {
            setGames([]);
            setErrorMessage(error.response?.data?.detail || "No se pudieron cargar los juegos");
        } finally {
            setLoading(false);
        }
    }

    async function loadFavorites() {
        if (!user) {
            setFavorites([]);
            return;
        }

        try {
            const data = await getFavorites();
            setFavorites(data);
        } catch (error) {
            console.error("Error cargando favoritos:", error);
        }
    }

    useEffect(() => {
        loadGames();
    }, []);

    useEffect(() => {
        loadFavorites();
    }, [user]);

    const availableGenres = useMemo(() => {
        const set = new Set();

        games.forEach((game) => {
            game.genres?.forEach((genre) => {
                if (genre.description) {
                    set.add(genre.description);
                }
            });
        });

        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [games]);

    const displayedGames = useMemo(() => {
        return games.filter((game) => {
            if (priceFilter === "free" && !game.is_free) return false;
            if (priceFilter === "paid" && game.is_free) return false;

            if (selectedGenres.size > 0) {
                const gameGenres = game.genres?.map((genre) => genre.description) || [];
                const hasMatch = gameGenres.some((genre) => selectedGenres.has(genre));
                if (!hasMatch) return false;
            }

            return true;
        });
    }, [games, priceFilter, selectedGenres]);

    function toggleGenre(genre) {
        setSelectedGenres((current) => {
            const next = new Set(current);
            if (next.has(genre)) {
                next.delete(genre);
            } else {
                next.add(genre);
            }
            return next;
        });
    }

    function clearFilters() {
        setPriceFilter("all");
        setSelectedGenres(new Set());
    }

    async function handleSearchSubmit(event) {
        event.preventDefault();
        await loadGames(searchQuery);
    }

    async function handleClearSearch() {
        setSearchQuery("");
        await loadGames("");
    }

    function handleEdit(game) {
        setEditingGame(game);
        setAdminForm(gameToForm(game));
        setStatusMessage(`Editando ${game.name}`);
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function handleCancelEdit() {
        setEditingGame(null);
        setAdminForm(emptyAdminForm);
        setStatusMessage("");
    }

    async function handleQuickAddSubmit(event) {
        event.preventDefault();
        setErrorMessage("");
        setStatusMessage("");

        const steamAppid = Number(quickAddForm.steam_appid);

        if (!quickAddForm.steam_appid.trim() || Number.isNaN(steamAppid)) {
            setErrorMessage("Ingresa un Steam App ID válido.");
            return;
        }

        const payload = { steam_appid: steamAppid };

        if (quickAddForm.youtube_trailer_id.trim()) {
            payload.youtube_trailer_id = quickAddForm.youtube_trailer_id.trim();
        }

        setImporting(true);

        try {
            await createGame(payload);
            setStatusMessage("Juego importado correctamente desde Steam.");
            setQuickAddForm(emptyQuickAddForm);
            setSearchQuery("");
            await loadGames("");
            await loadFavorites();
        } catch (error) {
            setErrorMessage(error.response?.data?.detail || "No se pudo importar el juego");
        } finally {
            setImporting(false);
        }
    }

    async function handleAdminSubmit(event) {
        event.preventDefault();
        setErrorMessage("");
        setStatusMessage("");

        const steamAppid = Number(adminForm.steam_appid);

        if (!adminForm.name.trim() || Number.isNaN(steamAppid)) {
            setErrorMessage("El nombre y el Steam App ID son obligatorios.");
            return;
        }

        const payload = {
            name: adminForm.name.trim(),
            steam_appid: steamAppid,
            type: adminForm.type.trim() || "game",
            is_free: Boolean(adminForm.is_free)
        };

        if (adminForm.short_description.trim()) {
            payload.short_description = adminForm.short_description.trim();
        }

        if (adminForm.detailed_description.trim()) {
            payload.detailed_description = adminForm.detailed_description.trim();
        }

        if (adminForm.website.trim()) {
            payload.website = adminForm.website.trim();
        }

        if (adminForm.youtube_trailer_id.trim()) {
            payload.youtube_trailer_id = adminForm.youtube_trailer_id.trim();
        }

        const developers = csvToList(adminForm.developers);
        const publishers = csvToList(adminForm.publishers);
        const genres = csvToList(adminForm.genres);

        if (developers.length > 0) {
            payload.developers = developers;
        }

        if (publishers.length > 0) {
            payload.publishers = publishers;
        }

        if (genres.length > 0) {
            payload.genres = genres.map((description) => ({ description }));
        }

        try {
            await updateGame(editingGame.id, payload);
            setStatusMessage("Juego actualizado correctamente.");
            setEditingGame(null);
            setAdminForm(emptyAdminForm);
            await loadGames(searchQuery);
            await loadFavorites();
        } catch (error) {
            setErrorMessage(error.response?.data?.detail || "No se pudo guardar el juego");
        }
    }

    async function handleDelete(game) {
        const confirmed = window.confirm(`¿Eliminar ${game.name}?`);
        if (!confirmed) {
            return;
        }

        try {
            await deleteGame(game.id);
            setStatusMessage("Juego eliminado correctamente.");

            if (editingGame?.id === game.id) {
                handleCancelEdit();
            }

            await loadGames(searchQuery);
            await loadFavorites();
        } catch (error) {
            setErrorMessage(error.response?.data?.detail || "No se pudo eliminar el juego");
        }
    }

    async function handleToggleFavorite(game) {
        const isFavorite = favorites.some((favorite) => favorite.id === game.id);

        try {
            if (isFavorite) {
                await removeFavorite(game.id);
            } else {
                await addFavorite(game.id);
            }

            await loadFavorites();
        } catch (error) {
            setErrorMessage(error.response?.data?.detail || "No se pudo actualizar favoritos");
        }
    }

    function renderGameCard(game) {
        const isFavorite = favorites.some((favorite) => favorite.id === game.id);

        return (
            <div
                key={game.id}
                className="game-card"
                onClick={() => setSelectedGame(game)}
            >
                <div className="game-card__media">
                    {game.is_free && (
                        <span className="game-card__badge">Gratis</span>
                    )}

                    {game.header_image ? (
                        <img
                            src={game.header_image}
                            alt={game.name}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                        />
                    ) : (
                        <div className="game-card__media--placeholder">
                            {game.name?.charAt(0).toUpperCase() || "?"}
                        </div>
                    )}
                </div>

                <div className="game-card__body">
                    <h2 className="game-card__title">{game.name}</h2>

                    <p className="game-card__row">
                        <span className="game-card__label">Género</span>
                        {game.genres?.map((genre) => genre.description).join(", ") || "No disponible"}
                    </p>

                    <p className="game-card__row">
                        <span className="game-card__label">Desarrollador</span>
                        {game.developers?.join(", ") || "No disponible"}
                    </p>

                    <p className="game-card__row game-card__price">
                        {game.price_overview?.final_formatted || (game.is_free ? "" : "N/D")}
                    </p>

                    <div className="game-card__actions">
                        <button
                            type="button"
                            className={`game-card__action ${isFavorite ? "game-card__action--active" : ""}`}
                            onClick={(event) => {
                                event.stopPropagation();
                                handleToggleFavorite(game);
                            }}
                        >
                            {isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                        </button>

                        {isAdmin && (
                            <>
                                <button
                                    type="button"
                                    className="game-card__action"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        handleEdit(game);
                                    }}
                                >
                                    Editar
                                </button>

                                <button
                                    type="button"
                                    className="game-card__action game-card__action--danger"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        handleDelete(game);
                                    }}
                                >
                                    Eliminar
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="catalog-container">
            <div className="catalog-header-row">
                <div>
                    <h1 className="catalog-header">Catálogo de juegos</h1>
                    <p className="catalog-subtitle">
                        Busca y explora juegos de Steam, agrega tus favoritos y, si eres administrador, importa juegos directamente desde la API de Steam.
                    </p>
                </div>
            </div>

            <form className="catalog-search" onSubmit={handleSearchSubmit}>
                <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Buscar por género, temática, desarrollador o nombre"
                />

                <button type="submit">Buscar</button>

                {searchQuery && (
                    <button type="button" className="catalog-search__ghost" onClick={handleClearSearch}>
                        Limpiar
                    </button>
                )}
            </form>

            {isAdmin && !editingGame && (
                <section className="admin-panel">
                    <div className="admin-panel__header">
                        <div>
                            <h2 className="admin-panel__title">Agregar juego desde Steam</h2>
                            <p className="admin-panel__subtitle">
                                Ingresa el Steam App ID, a partir de ahí se importarán automáticamente los datos del juego desde la API de Steam.
                                <br />
                                Igualmente agrega el ID del trailer de YouTube si quieres que se muestre en la página del juego.
                            </p>
                        </div>
                    </div>

                    <form className="admin-form admin-form--quick" onSubmit={handleQuickAddSubmit}>
                        <input
                            value={quickAddForm.steam_appid}
                            onChange={(event) => setQuickAddForm((current) => ({ ...current, steam_appid: event.target.value }))}
                            placeholder="Steam App ID"
                        />
                        <input
                            value={quickAddForm.youtube_trailer_id}
                            onChange={(event) => setQuickAddForm((current) => ({ ...current, youtube_trailer_id: event.target.value }))}
                            placeholder="YouTube Trailer ID"
                        />
                        <button type="submit" disabled={importing}>
                            {importing ? "Importando..." : "Agregar juego"}
                        </button>
                    </form>
                </section>
            )}

            {isAdmin && editingGame && (
                <section className="admin-panel">
                    <div className="admin-panel__header">
                        <div>
                            <h2 className="admin-panel__title">Editar juego</h2>
                            <p className="admin-panel__subtitle">
                                Ajusta manualmente los campos de este juego ya importado.
                            </p>
                        </div>

                        <button type="button" className="catalog-search__ghost" onClick={handleCancelEdit}>
                            Cancelar edición
                        </button>
                    </div>

                    <form className="admin-form" onSubmit={handleAdminSubmit}>
                        <input
                            value={adminForm.name}
                            onChange={(event) => setAdminForm((current) => ({ ...current, name: event.target.value }))}
                            placeholder="Nombre"
                        />
                        <input
                            type="number"
                            value={adminForm.steam_appid}
                            onChange={(event) => setAdminForm((current) => ({ ...current, steam_appid: event.target.value }))}
                            placeholder="Steam App ID"
                        />
                        <input
                            value={adminForm.type}
                            onChange={(event) => setAdminForm((current) => ({ ...current, type: event.target.value }))}
                            placeholder="Tipo"
                        />
                        <label className="admin-form__checkbox">
                            <input
                                type="checkbox"
                                checked={adminForm.is_free}
                                onChange={(event) => setAdminForm((current) => ({ ...current, is_free: event.target.checked }))}
                            />
                            Gratis
                        </label>
                        <input
                            value={adminForm.short_description}
                            onChange={(event) => setAdminForm((current) => ({ ...current, short_description: event.target.value }))}
                            placeholder="Descripción corta"
                        />
                        <input
                            value={adminForm.website}
                            onChange={(event) => setAdminForm((current) => ({ ...current, website: event.target.value }))}
                            placeholder="Sitio web"
                        />
                        <input
                            value={adminForm.youtube_trailer_id}
                            onChange={(event) => setAdminForm((current) => ({ ...current, youtube_trailer_id: event.target.value }))}
                            placeholder="YouTube Trailer ID"
                        />
                        <input
                            value={adminForm.developers}
                            onChange={(event) => setAdminForm((current) => ({ ...current, developers: event.target.value }))}
                            placeholder="Desarrolladores separados por coma"
                        />
                        <input
                            value={adminForm.publishers}
                            onChange={(event) => setAdminForm((current) => ({ ...current, publishers: event.target.value }))}
                            placeholder="Publishers separados por coma"
                        />
                        <input
                            value={adminForm.genres}
                            onChange={(event) => setAdminForm((current) => ({ ...current, genres: event.target.value }))}
                            placeholder="Géneros separados por coma"
                        />
                        <textarea
                            value={adminForm.detailed_description}
                            onChange={(event) => setAdminForm((current) => ({ ...current, detailed_description: event.target.value }))}
                            placeholder="Descripción detallada"
                        />

                        <button type="submit">Guardar cambios</button>
                    </form>
                </section>
            )}

            {statusMessage && <p className="catalog-status">{statusMessage}</p>}
            {errorMessage && <p className="catalog-status catalog-status--error">{errorMessage}</p>}

            {favorites.length > 0 && (
                <section className="catalog-section catalog-section--collapsible">
                    <button
                        type="button"
                        className="catalog-section__toggle"
                        onClick={() => setFavoritesOpen((value) => !value)}
                    >
                        <h2 className="catalog-section__title">
                            Mis favoritos
                            <span className="catalog-section__count">{favorites.length}</span>
                        </h2>

                        <span className={`catalog-section__chevron ${favoritesOpen ? "catalog-section__chevron--open" : ""}`}>
                            ⌄
                        </span>
                    </button>

                    {favoritesOpen && (
                        <div className="catalog-grid">
                            {favorites.map((game) => renderGameCard(game))}
                        </div>
                    )}
                </section>
            )}

            <div className="catalog-layout">
                <FiltersSidebar
                    genres={availableGenres}
                    selectedGenres={selectedGenres}
                    onToggleGenre={toggleGenre}
                    priceFilter={priceFilter}
                    onPriceFilterChange={setPriceFilter}
                    onClear={clearFilters}
                    resultCount={displayedGames.length}
                />

                <div className="catalog-main">
                    <section className="catalog-section">
                        <h2 className="catalog-section__title">
                            {searchQuery.trim() ? "Resultados de búsqueda" : "Todos los juegos"}
                        </h2>

                        {loading ? (
                            <p className="catalog-loading">Cargando juegos...</p>
                        ) : displayedGames.length === 0 ? (
                            <p className="catalog-empty">No se encontraron juegos para mostrar.</p>
                        ) : (
                            <div className="catalog-grid">
                                {displayedGames.map((game) => renderGameCard(game))}
                            </div>
                        )}
                    </section>
                </div>
            </div>

            {selectedGame && (
                <GameModal game={selectedGame} onClose={() => setSelectedGame(null)} />
            )}
        </div>
    );
}

export default Catalog;