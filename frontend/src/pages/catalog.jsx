import { useEffect, useState } from "react";
import { getGames } from "../services/gameService";
import GameModal from "../components/GameModal";
import "../styles/catalog.css";

function Catalog() {

    const [games, setGames] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedGame, setSelectedGame] = useState(null);

    useEffect(() => {
        async function loadGames() {
            try {
                const data = await getGames();
                setGames(data);
            } catch (error) {
                console.error("Error cargando juegos:", error);
            } finally {
                setLoading(false);
            }
        }
        loadGames();
    }, []);

    if (loading) {
        return <p className="catalog-loading">Cargando juegos...</p>;
    }

    return (
        <div className="catalog-container">
            <h1 className="catalog-header">Catálogo de juegos</h1>

            <div className="catalog-grid">
                {games.map((game) => (
                    <div
                        key={game.steam_appid}
                        className="game-card"
                        onClick={() => setSelectedGame(game)}
                    >
                        {game.is_free && (
                            <span className="game-card__badge">Gratis</span>
                        )}

                        <h2 className="game-card__title">{game.name}</h2>

                        <p className="game-card__row">
                            <span className="game-card__label">Género</span>
                            {game.genres?.map((g) => g.description).join(", ") || "No disponible"}
                        </p>

                        <p className="game-card__row">
                            <span className="game-card__label">Desarrollador</span>
                            {game.developers?.join(", ") || "No disponible"}
                        </p>

                        <p className="game-card__row game-card__price">
                            {game.price_overview?.final_formatted || (game.is_free ? "" : "N/D")}
                        </p>
                    </div>
                ))}
            </div>

            {selectedGame && (
                <GameModal game={selectedGame} onClose={() => setSelectedGame(null)} />
            )}
        </div>
    );
}

export default Catalog;