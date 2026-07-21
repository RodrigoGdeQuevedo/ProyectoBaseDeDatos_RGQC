import { useState } from "react";

function FiltersSidebar({
    genres,
    selectedGenres,
    onToggleGenre,
    priceFilter,
    onPriceFilterChange,
    onClear,
    resultCount
}) {
    const hasActiveFilters = priceFilter !== "all" || selectedGenres.size > 0;
    const [isScrollbarVisible, setIsScrollbarVisible] = useState(false);

    return (
        <aside className="filters-sidebar">
            <div className="filters-sidebar__header">
                <h2 className="filters-sidebar__title">Filtros</h2>

                {hasActiveFilters && (
                    <button type="button" className="filters-sidebar__clear" onClick={onClear}>
                        Limpiar
                    </button>
                )}
            </div>

            <p className="filters-sidebar__count">{resultCount} juego(s)</p>

            <div className="filters-sidebar__group">
                <h3 className="filters-sidebar__group-title">Precio</h3>

                <label className="filters-sidebar__option">
                    <input
                        type="radio"
                        name="price-filter"
                        checked={priceFilter === "all"}
                        onChange={() => onPriceFilterChange("all")}
                    />
                    Todos
                </label>

                <label className="filters-sidebar__option">
                    <input
                        type="radio"
                        name="price-filter"
                        checked={priceFilter === "free"}
                        onChange={() => onPriceFilterChange("free")}
                    />
                    Gratis
                </label>

                <label className="filters-sidebar__option">
                    <input
                        type="radio"
                        name="price-filter"
                        checked={priceFilter === "paid"}
                        onChange={() => onPriceFilterChange("paid")}
                    />
                    De pago
                </label>
            </div>

            {genres.length > 0 && (
                <div className="filters-sidebar__group">
                    <h3 className="filters-sidebar__group-title">Géneros</h3>

                    <div
                        className={`filters-sidebar__genre-list ${isScrollbarVisible ? "filters-sidebar__genre-list--visible" : ""}`.trim()}
                        onMouseEnter={() => setIsScrollbarVisible(true)}
                        onMouseLeave={() => setIsScrollbarVisible(false)}
                    >
                        {genres.map((genre) => (
                            <label key={genre} className="filters-sidebar__option">
                                <input
                                    type="checkbox"
                                    checked={selectedGenres.has(genre)}
                                    onChange={() => onToggleGenre(genre)}
                                />
                                {genre}
                            </label>
                        ))}
                    </div>
                </div>
            )}
        </aside>
    );
}

export default FiltersSidebar;