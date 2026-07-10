import { useEffect, useState } from "react";
import { getGameMedia } from "../services/gameService";
import { API_BASE_URL } from "../services/api";
import "../styles/modal.css";

function GameModal({ game, onClose }) {
    const [media, setMedia] = useState(null);
    const [loadingMedia, setLoadingMedia] = useState(true);
    const [activeVideo, setActiveVideo] = useState(null);
    const [videoError, setVideoError] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(null);
    const [showDetailedDescription, setShowDetailedDescription] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadMedia() {
            try {
                const data = await getGameMedia(game.id);
                if (!cancelled) setMedia(data);
            } catch (error) {
                console.error("Error cargando multimedia:", error);
            } finally {
                if (!cancelled) setLoadingMedia(false);
            }
        }

        loadMedia();
        return () => {
            cancelled = true;
        };
    }, [game.id]);

    const screenshots = media?.screenshots || [];
    const movies = media?.movies || [];
    const genres = game.genres?.map((g) => g.description).join(", ") || "Sin género";
    const detailedDescription = game.detailed_description || game.about_the_game || "";
    const releaseDate = typeof game.release_date === "string"
        ? game.release_date
        : game.release_date?.date || "No disponible";

    useEffect(() => {
        if (lightboxIndex === null || screenshots.length === 0) return;

        function handleKey(e) {
            if (e.key === "Escape") {
                setLightboxIndex(null);
            }

            if (e.key === "ArrowRight") {
                setLightboxIndex((i) => (i + 1) % screenshots.length);
            }

            if (e.key === "ArrowLeft") {
                setLightboxIndex((i) => (i - 1 + screenshots.length) % screenshots.length);
            }
        }

        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [lightboxIndex, screenshots.length]);

    function handlePlayVideo(m) {
        setVideoError(false);
        setActiveVideo(m);
    }

    function videoProxySrc(m) {
        const original = m.mp4 || m.webm;
        if (!original) return null;
        return `${API_BASE_URL}/media/video-proxy?url=${encodeURIComponent(original)}`;
    }

    function stripHtml(html) {
        if (!html) return "";

        const doc = new DOMParser().parseFromString(html, "text/html");
        return doc.body.textContent || "";
    }

    function getLanguageCapsules(html) {
        if (!html) return [];

        const normalizedHtml = html.replace(/<br\s*\/?>(\s*)/gi, "\n");
        const doc = new DOMParser().parseFromString(normalizedHtml, "text/html");
        return doc.body.textContent
            .split(/[\n,]+/)
            .map((line) => line.replace(/\*/g, "").replace(/^\s*[,•\-]+\s*/, "").replace(/\s+/g, " ").trim())
            .filter(Boolean)
            .filter((line) => line.toLowerCase() !== "n/a")
            .filter((line) => !/support/i.test(line))
            .filter((line) => line !== "*")
            .filter((line) => line.length > 1);
    }

    function normalizeRequirements(req) {
        if (!req) return [];

        const raw = typeof req === "string" ? req : req.minimum || req.recommended || "";
        const text = stripHtml(raw);

        return text
            .split(/\n+/)
            .map((line) => line.trim())
            .filter(Boolean);
    }

    function renderRequirementCard(label, req) {
        const lines = normalizeRequirements(req);

        if (lines.length === 0) return null;

        return (
            <div className="modal-requirement-card">
                <h4 className="modal-requirement-platform">{label}</h4>
                <pre className="modal-requirement-text">{lines.join("\n")}</pre>
            </div>
        );
    }

    const requirementCards = [
        renderRequirementCard("Windows", game.pc_requirements),
        renderRequirementCard("Mac", game.mac_requirements),
        renderRequirementCard("Linux", game.linux_requirements)
    ].filter(Boolean);

    function formatDlcPrice(price) {
        if (!price) return "Precio no disponible";
        if (price.final != null && price.currency) {
            return `${price.currency} ${price.final}`;
        }
        if (price.final_formatted) return price.final_formatted;
        return "Precio no disponible";
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>✕</button>

                {media?.header_image && (
                    <img
                        src={media.header_image}
                        alt={game.name}
                        className="modal-header-image"
                        referrerPolicy="no-referrer"
                    />
                )}

                <h1 className="modal-title">{game.name}</h1>

                <div className="modal-meta">
                    <span className="modal-tag">{genres}</span>
                    {game.is_free ? (
                        <span className="modal-price">Gratis</span>
                    ) : (
                        <span className="modal-price">
                            {game.price_overview?.final_formatted || "N/D"}
                        </span>
                    )}
                </div>

                <p className="modal-description">{game.short_description}</p>

                {game.youtube_trailer_id && (
                    <div className="modal-section">
                        <h3 className="modal-section-title">Video de YouTube</h3>
                        <div className="modal-youtube-wrapper">
                            <iframe
                                src={`https://www.youtube.com/embed/${game.youtube_trailer_id}`}
                                title={`Trailer de ${game.name}`}
                                frameBorder="0"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    </div>
                )}

                {loadingMedia && <p className="modal-loading">Cargando multimedia...</p>}

                {movies.length > 0 && (
                    <div className="modal-section">
                        <h3 className="modal-section-title">Videos</h3>
                        <div className="modal-media-row">
                            {movies.map((m) => (
                                <div
                                    key={m.id}
                                    className="modal-video-thumb"
                                    onClick={() => handlePlayVideo(m)}
                                >
                                    <img
                                        src={m.thumbnail}
                                        alt={m.name}
                                        referrerPolicy="no-referrer"
                                    />
                                    <span className="modal-play-icon">▶</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeVideo && !videoError && (
                    <video
                        key={activeVideo.id}
                        className="modal-video-player"
                        controls
                        autoPlay
                        src={videoProxySrc(activeVideo)}
                        onEnded={() => setActiveVideo(null)}
                        onError={() => setVideoError(true)}
                    />
                )}

                {activeVideo && videoError && (
                    <div className="modal-video-fallback">
                        <p>No se pudo reproducir el video aquí.</p>
                        <a
                            href={activeVideo.mp4 || activeVideo.webm}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Abrir video en una pestaña nueva
                        </a>
                    </div>
                )}

                {screenshots.length > 0 && (
                    <div className="modal-section">
                        <h3 className="modal-section-title">Imágenes</h3>
                        <div className="modal-media-row">
                            {screenshots.map((s, i) => (
                                <img
                                    key={s.id}
                                    src={s.thumbnail}
                                    className="modal-screenshot"
                                    alt=""
                                    referrerPolicy="no-referrer"
                                    onClick={() => setLightboxIndex(i)}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {detailedDescription && (
                    <div className="modal-section">
                        <div className="modal-section-header">
                            <h3 className="modal-section-title">Descripción detallada</h3>
                            <button
                                type="button"
                                className="modal-read-more"
                                onClick={() => setShowDetailedDescription((value) => !value)}
                            >
                                {showDetailedDescription ? "Leer menos" : "Leer más"}
                            </button>
                        </div>

                        {showDetailedDescription ? (
                            <p className="modal-description modal-description--expanded">
                                {stripHtml(detailedDescription)}
                            </p>
                        ) : (
                            <p className="modal-description modal-description--preview">
                                {stripHtml(detailedDescription).slice(0, 260)}
                                {stripHtml(detailedDescription).length > 260 ? "..." : ""}
                            </p>
                        )}
                    </div>
                )}

                <div className="modal-section">
                    <h3 className="modal-section-title">Ficha del juego</h3>

                    <p className="modal-detail-row">
                        <span className="modal-detail-label">Fecha</span>
                        {releaseDate}
                    </p>

                    <p className="modal-detail-row">
                        <span className="modal-detail-label">Edad mínima</span>
                        {game.required_age > 0 ? `${game.required_age}+` : "Todas las edades"}
                    </p>

                    <p className="modal-detail-row">
                        <span className="modal-detail-label">Steam ID</span>
                        {game.steam_appid}
                    </p>

                    <p className="modal-detail-row">
                        <span className="modal-detail-label">Desarrollador</span>
                        {game.developers?.join(", ") || "No disponible"}
                    </p>

                    <p className="modal-detail-row">
                        <span className="modal-detail-label">Publisher</span>
                        {game.publishers?.join(", ") || "No disponible"}
                    </p>

                    {game.metacritic?.score != null && (
                        <p className="modal-detail-row">
                            <span className="modal-detail-label">Metacritic</span>
                            {`${game.metacritic.score}/100`}
                        </p>
                    )}

                    {game.website && (
                        <p className="modal-detail-row">
                            <span className="modal-detail-label">Sitio web</span>

                            <a
                                href={game.website}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: "#66c0f4" }}
                            >
                                Abrir sitio
                            </a>
                        </p>
                    )}
                </div>

                {requirementCards.length > 0 && (
                    <div className="modal-section">
                        <h3 className="modal-section-title">Requisitos mínimos</h3>
                        <div className="modal-requirements-grid">
                            {requirementCards}
                        </div>
                    </div>
                )}

                {game.dlcs?.length > 0 && (
                    <div className="modal-section">
                        <h3 className="modal-section-title">DLCs</h3>
                        <div className="modal-dlc-list">
                            {game.dlcs.map((dlc) => (
                                <div key={dlc.appid} className="modal-dlc-item">
                                    <div className="modal-dlc-title-row">
                                        <span className="modal-dlc-title">{dlc.name || `DLC ${dlc.appid}`}</span>
                                        {dlc.is_free ? (
                                            <span className="modal-dlc-price">Gratis</span>
                                        ) : (
                                            <span className="modal-dlc-price">{formatDlcPrice(dlc.price)}</span>
                                        )}
                                    </div>
                                    <div className="modal-dlc-meta">
                                        <span>{dlc.release_date || "Sin fecha"}</span>
                                        {dlc.type && <span>{dlc.type}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {game.platforms && (
                    <div className="modal-section">
                        <h3 className="modal-section-title">Plataformas</h3>
                        <div className="modal-platforms">
                            {game.platforms.windows && <span className="modal-tag">Windows</span>}
                            {game.platforms.mac && <span className="modal-tag">Mac</span>}
                            {game.platforms.linux && <span className="modal-tag">Linux</span>}
                        </div>
                    </div>
                )}

                {game.categories?.length > 0 && (
                    <div className="modal-section">
                        <h3 className="modal-section-title">Categorías</h3>
                        <div className="modal-tags">
                            {game.categories.map((category) => (
                                <span key={category.id} className="modal-tag">
                                    {category.description}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {game.supported_languages && (
                    <div className="modal-section">
                        <h3 className="modal-section-title">Idiomas soportados</h3>
                        <div className="modal-tags">
                            {getLanguageCapsules(game.supported_languages).map((language) => (
                                <span key={language} className="modal-tag">
                                    {language}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {lightboxIndex !== null && screenshots.length > 0 && (
                <div
                    className="lightbox-overlay"
                    onClick={(e) => {
                        e.stopPropagation();
                        setLightboxIndex(null);
                    }}
                >
                    <button
                        className="lightbox-arrow lightbox-arrow--left"
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxIndex((i) => (i - 1 + screenshots.length) % screenshots.length);
                        }}
                    >
                        ‹
                    </button>

                    <img
                        src={screenshots[lightboxIndex].full}
                        alt=""
                        className="lightbox-image"
                        referrerPolicy="no-referrer"
                        onClick={(e) => e.stopPropagation()}
                    />

                    <button
                        className="lightbox-arrow lightbox-arrow--right"
                        onClick={(e) => {
                            e.stopPropagation();
                            setLightboxIndex((i) => (i + 1) % screenshots.length);
                        }}
                    >
                        ›
                    </button>

                    <span className="lightbox-counter">
                        {lightboxIndex + 1} / {screenshots.length}
                    </span>
                </div>
            )}
        </div>
    );
}

export default GameModal;