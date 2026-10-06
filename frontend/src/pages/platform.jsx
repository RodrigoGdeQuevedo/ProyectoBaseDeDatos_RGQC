import { useContext, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
    LuArrowRight, LuBookmarkCheck, LuCheck, LuChevronRight,
    LuGamepad2, LuHeart, LuLayers3, LuPlus,
    LuEllipsisVertical, LuSearch, LuSlidersHorizontal, LuSparkles, LuStar, LuTrophy, LuUsers, LuX
} from "react-icons/lu";
import { AuthContext } from "../context/AuthContext";
import {
    addFavorite, addGameToList, createCustomList, getCustomLists, getFavorites, removeFavorite, removeGameFromList,
    getGame, getGameMedia, getGameReviews, getGames, getCustomListGames,
    saveGameReview
} from "../services/gameService";

const shell = "neon-page relative mx-auto w-full max-w-[1440px] px-4 pb-16 pt-7 sm:px-6 lg:px-10 2xl:px-12";
const panel = "rounded-2xl border border-white/[0.08] bg-[#171c22]/95 shadow-[0_18px_50px_rgba(0,0,0,.18)]";
const muted = "text-sm text-[#8d98a5]";
const communityListSeeds = [
    { id: "cozy-worlds", name: "Cozy worlds to get lost in", description: "Warm, welcoming games for slow evenings and curious minds.", tone: "from-violet-500/20" },
    { id: "all-night-coop", name: "The all night co-op list", description: "Team up, make a little chaos, and keep the party going.", tone: "from-sky-500/20" },
    { id: "stories-that-stay", name: "Stories that stay with you", description: "Memorable journeys, unforgettable characters, lasting choices.", tone: "from-fuchsia-500/20" },
    { id: "indie-gems", name: "Indie gems worth finding", description: "Small teams, bold ideas, and games with a lot of heart.", tone: "from-amber-500/20" },
    { id: "strategy-minds", name: "For strategic minds", description: "Plan carefully, adapt quickly, and enjoy every hard-earned win.", tone: "from-cyan-500/20" },
    { id: "action-adrenaline", name: "Action and adrenaline", description: "Fast combat and big moments for players who like a challenge.", tone: "from-rose-500/20" },
    { id: "fantasy-realms", name: "Fantasy realms", description: "Explore strange lands, meet unlikely allies, and shape your legend.", tone: "from-indigo-500/20" },
    { id: "pixel-classics", name: "Pixel art favorites", description: "Colorful worlds and inventive adventures with a retro spirit.", tone: "from-pink-500/20" },
    { id: "short-and-sweet", name: "Short games, big impact", description: "Compact experiences that make every hour count.", tone: "from-teal-500/20" },
    { id: "survival-mode", name: "Survive the night", description: "Gather resources, stay alert, and see how long you last.", tone: "from-orange-500/20" },
    { id: "puzzle-break", name: "A clever little puzzle break", description: "Thoughtful puzzles and satisfying aha moments.", tone: "from-emerald-500/20" },
    { id: "open-world-roamers", name: "Open worlds to roam", description: "Take the scenic route and see what you find along the way.", tone: "from-blue-500/20" },
    { id: "weekend-racers", name: "Weekend racers", description: "Pick a ride, find a track, and race for one more lap.", tone: "from-red-500/20" },
];

function getCommunityLists(catalog) {
    return communityListSeeds.map((seed, index) => {
        const games = [];
        const gamesPerList = Math.min(3, catalog.length);
        for (let offset = 0; offset < gamesPerList; offset += 1) {
            const game = catalog[(index * 2 + offset) % catalog.length];
            if (!games.some((item) => String(item.id) === String(game.id))) games.push(game);
        }
        return { ...seed, games };
    });
}

function getMockGameReviews(game) {
    const genre = game.genres?.[0]?.description?.toLowerCase() || "this game";
    return [
        { id: `sample-${game.id}-1`, username: "Sample · PixelPilot", rating: 5, comment: `The world pulled me in right away. I especially enjoyed how much there is to discover in ${genre}.`, mock: true },
        { id: `sample-${game.id}-2`, username: "Sample · LunaPlays", rating: 4, comment: "A really memorable experience. A few rough edges, but I kept coming back for one more session.", mock: true },
        { id: `sample-${game.id}-3`, username: "Sample · SavePointSam", rating: 5, comment: "Great atmosphere, satisfying gameplay, and plenty to talk about after finishing it.", mock: true },
    ];
}

function useCatalog() {
    const [games, setGames] = useState([]);
    useEffect(() => { getGames().then(setGames).catch(() => setGames([])); }, []);
    return games;
}

function useLists() {
    const [lists, setLists] = useState([]);
    const refresh = async () => setLists(await getCustomLists());
    useEffect(() => {
        let cancelled = false;
        getCustomLists().then((value) => { if (!cancelled) setLists(value); }).catch(() => { if (!cancelled) setLists([]); });
        return () => { cancelled = true; };
    }, []);
    return [lists, refresh];
}

function getRecommendations(userCollections, catalog) {
    const savedIds = new Set(userCollections.flatMap((collection) => collection.games || []).map((game) => String(game.id)));
    const savedGames = userCollections.flatMap((collection) => collection.games || []);
    const interests = new Set(savedGames.flatMap((game) => [
        ...(game.genres || []).map((item) => typeof item === "string" ? item : item.description),
        ...(game.tags || [])
    ].filter(Boolean).map((value) => value.toLowerCase())));

    return catalog
        .filter((game) => !savedIds.has(String(game.id)))
        .map((game) => {
            const terms = [
                ...(game.genres || []).map((item) => typeof item === "string" ? item : item.description),
                ...(game.tags || [])
            ].filter(Boolean).map((value) => value.toLowerCase());
            return { game, score: terms.filter((term) => interests.has(term)).length };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map(({ game }) => game);
}

export function SearchBar({ value, onChange, onSubmit, placeholder = "Search games, genres, developers..." }) {
    return (
        <form onSubmit={onSubmit} className="neon-search flex w-full items-center gap-3 rounded-2xl border border-white/[0.09] bg-[#11171c]/95 p-1.5 pl-4 focus-within:border-[#7189ff]/60 sm:max-w-xl">
            <LuSearch className="shrink-0 text-[#a9b6ff]" size={19} />
            <input aria-label="Search games" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-[#77818c]" />
            <button type="submit" className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#7189ff] px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#7189ff]/20 transition hover:bg-[#899aff] active:scale-[.98]"><span className="hidden sm:inline">Search</span><LuArrowRight size={15} /></button>
        </form>
    );
}

export function GameCard({ game, onAddCollection }) {
    const score = game.metacritic?.score;
    return (
        <article className="neon-game-card group min-w-0 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#171c22] transition duration-200 hover:-translate-y-1 hover:border-[#7189ff]/40">
            <Link to={`/games/${game.id}`} className="game-card-art relative block aspect-[16/9] overflow-hidden bg-[#222831]">
                {game.header_image ? <img src={game.header_image} alt={game.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center text-[#65707c]"><LuGamepad2 size={42} /></div>}
                {score && <span className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-black/75 px-2.5 py-1.5 text-xs font-bold text-[#c5b8ff]"><LuStar size={13} fill="currentColor" />{score}</span>}
            </Link>
            <div className="p-4">
                <Link to={`/games/${game.id}`} className="block truncate font-semibold text-white hover:text-[#c5b8ff]">{game.name}</Link>
                <div className="mt-1 flex items-center justify-between gap-3">
                    <p className="truncate text-xs text-[#8d98a5]">{game.genres?.slice(0, 2).map((item) => item.description).join(" · ") || "Game"}</p>
                    {game.is_free ? <span className="text-xs font-semibold text-[#c5b8ff]">Free</span> : game.price_overview?.final_formatted && <span className="text-xs text-[#aeb7c1]">{game.price_overview.final_formatted}</span>}
                </div>
                {game.short_description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#8d98a5]">{game.short_description}</p>}
                {onAddCollection && <button onClick={() => onAddCollection(game)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[#7189ff]/30 bg-[#7189ff]/10 py-2.5 text-xs font-bold text-[#c5b8ff] shadow-sm shadow-[#7189ff]/5 transition hover:border-[#7189ff] hover:bg-[#7189ff] hover:text-white"><LuPlus size={15} /> Add to collection</button>}
            </div>
        </article>
    );
}

function SectionHeading({ eyebrow, title, action, to = "/discover", layout = "centered" }) {
    if (layout === "between") {
        return <div className="flex w-full flex-row items-end justify-between gap-4"><div className="min-w-0"><p className="neon-eyebrow mb-1 text-[10px] font-bold uppercase tracking-[.22em] text-[#93a4ff]">{eyebrow}</p><h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h2></div>{action && <Link to={to} className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-[#7189ff]/25 bg-[#7189ff]/[0.07] px-3 py-2 text-xs font-semibold text-[#c5b8ff] transition hover:border-[#7189ff]/50 hover:bg-[#7189ff]/[0.14] sm:text-sm">{action}<LuArrowRight size={15} /></Link>}</div>;
    }
    return <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-end gap-3"><span /> <div className="text-center"><p className="neon-eyebrow mb-1 text-[10px] font-bold uppercase tracking-[.22em] text-[#93a4ff]">{eyebrow}</p><h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2></div>{action ? <Link to={to} className="flex shrink-0 items-center gap-1 justify-self-end text-xs font-semibold text-[#aeb7c1] transition hover:text-[#c5b8ff] sm:text-sm">{action}<LuArrowRight size={15} /></Link> : <span />}</div>;
}

function CollectionModal({ game, onClose }) {
    const [lists, refresh] = useLists();
    const [selected, setSelected] = useState("");
    const [newName, setNewName] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setMessage("");
        try {
            let listId = selected;
            if (newName.trim()) {
                const created = await createCustomList(newName.trim());
                listId = created.id;
                await refresh();
            }
            if (!listId) { setMessage("Choose a collection or create one first."); return; }
            await addGameToList(listId, game.id);
            setMessage(`${game.name} added to your collection.`);
            window.setTimeout(onClose, 900);
        } catch (error) { setMessage(error.response?.data?.detail || "Could not update your collection."); }
        finally { setBusy(false); }
    }

    return <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
        <section role="dialog" aria-modal="true" aria-labelledby="collection-title" className={`${panel} w-full max-w-md p-6 shadow-2xl shadow-black/40`}>
            <div className="mb-6 flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#7189ff]">Save this game</p><h2 id="collection-title" className="mt-1 text-xl font-bold text-white">Add to collection</h2><p className={`${muted} mt-1`}>{game.name}</p></div><button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-[#8d98a5] hover:bg-white/5 hover:text-white"><LuX size={18} /></button></div>
            <form onSubmit={submit} className="space-y-4">
                <label className="block text-xs font-semibold text-[#cbd1d7]">Choose a collection<select value={selected} onChange={(event) => setSelected(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#101419] px-3 py-3 text-sm text-white outline-none focus:border-[#7189ff]/50"><option value="">Select a collection...</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}</select></label>
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-widest text-[#65707c]"><span className="h-px flex-1 bg-white/10" />or create new<span className="h-px flex-1 bg-white/10" /></div>
                <label className="block text-xs font-semibold text-[#cbd1d7]">Collection name<input maxLength={60} value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Weekend co-op" className="mt-2 w-full rounded-xl border border-white/10 bg-[#101419] px-3 py-3 text-sm text-white outline-none placeholder:text-[#65707c] focus:border-[#7189ff]/50" /></label>
                <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#7189ff] px-4 py-3 text-sm font-bold text-[#14180f] transition hover:bg-[#c5b8ff] disabled:opacity-60"><LuPlus size={16} />{busy ? "Saving..." : "Save to collection"}</button>
                {message && <p role="status" className={`flex items-center gap-2 text-sm ${message.includes("added") ? "text-[#c5b8ff]" : "text-amber-300"}`}>{message.includes("added") && <LuCheck size={15} />}{message}</p>}
            </form>
        </section>
    </div>;
}

export function Home() {
    const games = useCatalog();
    const { user } = useContext(AuthContext);
    const [query, setQuery] = useState("");
    const navigate = useNavigate();
    const trending = useMemo(() => [...games].sort((a, b) => (b.metacritic?.score || 0) - (a.metacritic?.score || 0)).slice(0, 4), [games]);
    const communityRows = useMemo(() => getCommunityLists(games).slice(0, 3), [games]);
    function submitSearch(event) { event.preventDefault(); navigate(`/discover?q=${encodeURIComponent(query)}`); }

    return <main className={shell}>
        <section className="home-hero relative mb-10 flex min-h-[330px] flex-col items-center justify-center overflow-hidden rounded-3xl border border-white/[0.07] bg-[#151b20] px-5 py-10 text-center sm:px-10">
            <div className="absolute -right-20 -top-24 h-80 w-80 rounded-full bg-[#7189ff]/10 blur-3xl" />
            <div className="relative z-10 flex w-full flex-col items-center"><span className="inline-flex items-center gap-2 rounded-full border border-[#7189ff]/20 bg-[#7189ff]/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-[#c5b8ff]"><LuSparkles size={13} /> Your gaming, together</span><h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-6xl">Find your next <span className="text-[#c5b8ff]">favorite game.</span></h1><p className="mt-4 max-w-xl text-sm leading-6 text-[#a1aab3] sm:text-base">Discover games, keep track of what you play, and share great recommendations with your people.</p><div className="mt-7 flex w-full justify-center"><SearchBar value={query} onChange={setQuery} onSubmit={submitSearch} /></div><p className="mt-3 text-xs text-[#77818c]">Welcome back, {user?.username || "player"}. What are we playing today?</p>{trending.length > 0 && <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs"><span className="mr-1 text-[#77818c]">Popular:</span>{trending.slice(0, 3).map((game) => <Link key={game.id} to={`/games/${game.id}`} className="rounded-full border border-white/10 bg-black/15 px-3 py-1.5 text-[#c7cdd3] transition hover:border-[#7189ff]/40 hover:text-white">{game.name}</Link>)}</div>}</div>
        </section>

        <section className="mb-12"><SectionHeading eyebrow="Handpicked for you" title="Trending games" action="Explore all" /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{trending.map((game) => <GameCard key={game.id} game={game} />)}</div>{!games.length && <p className={muted}>The catalog is loading or currently empty.</p>}</section>

        <div className="grid gap-10 lg:grid-cols-[1.2fr_.8fr]">
            <section id="activity"><SectionHeading eyebrow="Sample social feed" title="Friend activity" action="Open social" to="/social" /><div className={`${panel} divide-y divide-white/[0.07] px-5`}>
                {[{ initials: "JM", name: "Jordan M.", action: "just finished", game: trending[0]?.name || "a new adventure", time: "12 min ago", tint: "bg-violet-400/15 text-violet-200" }, { initials: "AK", name: "Alex K.", action: "added to their collection", game: trending[1]?.name || "a new favorite", time: "1 hr ago", tint: "bg-sky-400/15 text-sky-200" }, { initials: "SR", name: "Sam R.", action: "left a 5-star review for", game: trending[2]?.name || "a community pick", time: "3 hrs ago", tint: "bg-orange-400/15 text-orange-200" }].map((item) => <div key={item.initials} className="flex items-center gap-3 py-4"><div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${item.tint}`}>{item.initials}</div><div className="min-w-0 flex-1"><p className="text-sm text-[#dbe0e4]"><strong>{item.name}</strong> {item.action} <span className="font-medium text-white">{item.game}</span></p><p className="mt-1 text-xs text-[#77818c]">{item.time}</p></div><LuChevronRight className="text-[#65707c]" size={17} /></div>)}
            </div></section>
            <section><SectionHeading eyebrow="Made by players" title="Community lists" action="Browse all lists" to="/community-lists" /><div className="space-y-3">{communityRows.map((row) => <Link to={`/community-lists/${row.id}`} key={row.id} className={`${panel} group relative flex items-center gap-4 overflow-hidden p-4 transition hover:-translate-y-0.5 hover:border-[#7189ff]/35 hover:bg-[#1b222a]`}><div className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${row.tone} to-transparent`} /><div className="grid h-[68px] w-[88px] shrink-0 grid-cols-2 gap-0.5 overflow-hidden rounded-xl bg-[#242a31] ring-1 ring-white/10">{row.games.slice(0, 4).map((game) => <img key={game.id} className="h-full w-full object-cover" src={game.header_image} alt="" />)}</div><div className="min-w-0 flex-1"><span className="text-[9px] font-bold uppercase tracking-[.18em] text-[#93a4ff]">Community collection</span><h3 className="mt-1 truncate text-sm font-semibold text-white group-hover:text-[#c5b8ff]">{row.name}</h3><p className="mt-1 line-clamp-1 text-xs text-[#8d98a5]">{row.description}</p><p className="mt-2 text-[10px] text-[#77818c]">{row.games.length} featured games</p></div><LuArrowRight className="shrink-0 text-[#8d98a5] transition group-hover:translate-x-1 group-hover:text-[#c5b8ff]" size={17} /></Link>)}</div></section>
        </div>
    </main>;
}

export function CommunityLists() {
    const { listId } = useParams();
    const games = useCatalog();
    const lists = useMemo(() => getCommunityLists(games), [games]);
    const list = lists.find((item) => item.id === listId);

    if (listId && !list) {
        return <main className={shell}><Link to="/community-lists" className="mb-5 inline-flex items-center gap-2 text-xs text-[#8d98a5] hover:text-white"><LuChevronRight className="rotate-180" size={15} />All community lists</Link><section className={`${panel} px-6 py-16 text-center`}><LuLayers3 className="mx-auto mb-4 text-[#8d98a5]" size={32} /><h1 className="text-xl font-bold text-white">List not found</h1><p className={`${muted} mt-2`}>This community list is unavailable.</p></section></main>;
    }

    if (list) {
        return <main className={shell}>
            <Link to="/community-lists" className="mb-5 inline-flex items-center gap-2 text-xs text-[#8d98a5] hover:text-white"><LuChevronRight className="rotate-180" size={15} />All community lists</Link>
            <section className={`${panel} relative mb-8 overflow-hidden p-6 sm:p-8`}>
                {list.games[0]?.header_image && <img src={list.games[0].header_image} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-sm" />}
                <div className="absolute inset-0 bg-gradient-to-r from-[#111519] via-[#111519]/90 to-[#111519]/55" />
                <div className="relative max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#a9b6ff]">Player curated collection</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">{list.name}</h1><p className="mt-3 text-sm leading-6 text-[#c0c7cf]">{list.description}</p><div className="mt-5 flex items-center gap-2 text-xs text-[#aeb7c1]"><LuGamepad2 className="text-[#c5b8ff]" size={16} />{list.games.length} featured games <span className="text-[#65707c]">·</span> Curated by the PLAYSPACE community</div></div>
            </section>
            <section><SectionHeading eyebrow="The collection" title="Featured games" action="Discover more" to="/discover" /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{list.games.map((game) => <GameCard key={game.id} game={game} />)}</div></section>
        </main>;
    }

    return <main className={shell}>
        <header className="mb-8 text-center"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#93a4ff]">Made by players</p><h1 className="text-4xl font-bold tracking-tight text-white">Community lists</h1><p className={`${muted} mt-2`}>Handpicked game collections for every kind of player.</p></header>
        {lists.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{lists.map((item) => <Link key={item.id} to={`/community-lists/${item.id}`} className={`${panel} group overflow-hidden transition hover:-translate-y-1 hover:border-[#7189ff]/35`}><div className="relative grid h-40 grid-cols-3 gap-0.5 overflow-hidden bg-[#202731]">{item.games.map((game) => <img key={game.id} src={game.header_image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />)}<div className="absolute inset-0 bg-gradient-to-t from-[#111519] via-transparent to-transparent" /><span className="absolute bottom-3 left-4 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#dce2eb]">Community curated</span></div><div className="p-5"><h2 className="text-lg font-bold text-white group-hover:text-[#c5b8ff]">{item.name}</h2><p className="mt-2 min-h-10 text-sm leading-5 text-[#8d98a5]">{item.description}</p><div className="mt-4 flex items-center justify-between text-xs"><span className="text-[#77818c]">{item.games.length} featured games</span><span className="inline-flex items-center gap-1 font-semibold text-[#c5b8ff]">Explore list <LuArrowRight size={14} /></span></div></div></Link>)}</div> : <p className={`${muted} text-center`}>Community collections are loading or the catalog is empty.</p>}
    </main>;
}

export function Games() {
    const games = useCatalog();
    const [query, setQuery] = useState("");
    const filteredGames = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return games;
        return games.filter((game) => `${game.name} ${game.genres?.map((genre) => genre.description || genre).join(" ") || ""}`.toLowerCase().includes(term));
    }, [games, query]);

    return <main className={shell}>
        <header className="mb-8 flex flex-col items-center text-center"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#93a4ff]">Game catalog</p><h1 className="text-4xl font-bold tracking-tight text-white">Games</h1><p className={`${muted} mt-2`}>Browse the full game library.</p><div className="mt-5 w-full"><SearchBar value={query} onChange={setQuery} onSubmit={(event) => event.preventDefault()} placeholder="Search games by name or genre..." /></div></header>
        {filteredGames.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filteredGames.map((game) => <GameCard key={game.id} game={game} />)}</div> : <div className={`${panel} px-6 py-16 text-center`}><LuGamepad2 className="mx-auto mb-4 text-[#65707c]" size={32} /><h2 className="font-semibold text-white">{games.length ? "No games match your search" : "No games are available"}</h2><p className={`${muted} mt-2`}>{games.length ? "Try another title or genre." : "Games will appear here when the catalog is loaded."}</p></div>}
    </main>;
}

export function Discover() {
    const games = useCatalog();
    const [userCollections, setUserCollections] = useState([]);
    const [params, setParams] = useSearchParams();
    const [query, setQuery] = useState(params.get("q") || "");
    const [genre, setGenre] = useState("all");
    const [platform, setPlatform] = useState("all");
    const [popularity, setPopularity] = useState("all");
    const [modalGame, setModalGame] = useState(null);
    const [expandedCommunityList, setExpandedCommunityList] = useState(null);
    useEffect(() => {
        let cancelled = false;
        async function loadCollectionGames() {
            try {
                const lists = await getCustomLists();
                const collections = await Promise.all(lists.map(async (list) => ({
                    ...list,
                    games: await getCustomListGames(list.id).catch(() => [])
                })));
                if (!cancelled) setUserCollections(collections);
            } catch {
                if (!cancelled) setUserCollections([]);
            }
        }
        loadCollectionGames();
        return () => { cancelled = true; };
    }, []);
    const recommendations = useMemo(() => getRecommendations(userCollections, games), [userCollections, games]);
    const communityLists = useMemo(() => getCommunityLists(games), [games]);
    const genres = useMemo(() => [...new Set(games.flatMap((game) => game.genres?.map((item) => item.description) || []))].sort(), [games]);
    const filtered = useMemo(() => games.filter((game) => {
        const term = query.trim().toLowerCase();
        const matchesText = !term || `${game.name} ${game.short_description || ""} ${game.developers?.join(" ") || ""} ${game.genres?.map((item) => item.description).join(" ") || ""}`.toLowerCase().includes(term);
        const matchesGenre = genre === "all" || game.genres?.some((item) => item.description === genre);
        const matchesPlatform = platform === "all" || Boolean(game.platforms?.[platform]);
        const score = game.metacritic?.score || 0;
        const matchesPopularity = popularity === "all" || (popularity === "popular" ? score >= 75 : score >= 90);
        return matchesText && matchesGenre && matchesPlatform && matchesPopularity;
    }), [games, query, genre, platform, popularity]);
    function submitSearch(event) { event.preventDefault(); setParams(query ? { q: query } : {}); }

    return <main className={shell}><header className="mb-8 text-center"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#93a4ff]">Browse the catalog</p><h1 className="text-4xl font-bold tracking-tight text-white">Discover games</h1><p className={`${muted} mt-2`}>Find something worth staying up for.</p><div className="mt-5 flex justify-center"><SearchBar value={query} onChange={setQuery} onSubmit={submitSearch} /></div></header>
        {recommendations.length > 0 && <section className="mb-8"><SectionHeading eyebrow="Picked from your collections" title="Recommended based on your lists" /><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{recommendations.map((game) => <GameCard key={game.id} game={game} onAddCollection={setModalGame} />)}</div></section>}
        <section className="mb-9"><SectionHeading eyebrow="Player curated" title="Community lists" action="Browse all" to="/community-lists" /><div className="grid gap-4 md:grid-cols-3">{communityLists.map((list) => <article key={list.id} className={`${panel} overflow-hidden transition hover:border-[#7189ff]/30`}><button onClick={() => setExpandedCommunityList((current) => current === list.id ? null : list.id)} aria-expanded={expandedCommunityList === list.id} className="group flex w-full items-center gap-4 p-4 text-left"><div className="grid h-14 w-[72px] shrink-0 grid-cols-3 gap-0.5 overflow-hidden rounded-lg bg-[#222831]">{list.games.slice(0, 3).map((game) => <img key={game.id} src={game.header_image} alt="" className="h-full w-full object-cover" />)}</div><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-white group-hover:text-[#c5b8ff]">{list.name}</h2><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#8d98a5]">{list.description}</p><span className="mt-2 inline-block text-[10px] text-[#a9b6ff]">{list.games.length} games · {expandedCommunityList === list.id ? "Hide games" : "View games"}</span></div><LuChevronRight className={`shrink-0 text-[#8d98a5] transition ${expandedCommunityList === list.id ? "rotate-90" : ""}`} size={17} /></button>{expandedCommunityList === list.id && <div className="border-t border-white/[0.07] p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{list.games.map((game) => <GameCard key={game.id} game={game} onAddCollection={setModalGame} />)}</div></div>}</article>)}</div>{!communityLists.length && <p className={`${muted} ${panel} p-5 text-center`}>Community lists will appear when games are available in the catalog.</p>}</section>
        <div className="mb-7 flex justify-center"><div className="filter-bar flex w-full max-w-4xl flex-wrap items-center justify-center gap-2.5 sm:gap-3"><span className="flex items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-widest text-[#9aa5b3]"><LuSlidersHorizontal size={15} className="text-[#a9b6ff]" />Filters</span>{[[genre, setGenre, "Genre", genres.map((item) => [item, item])], [platform, setPlatform, "Platform", [["windows", "Windows"], ["mac", "Mac"], ["linux", "Linux"]]], [popularity, setPopularity, "Popularity", [["popular", "Popular"], ["top", "Top rated"]]]].map(([value, setter, label, options]) => <select key={label} aria-label={`${label} filter`} value={value} onChange={(event) => setter(event.target.value)} className="catalog-select"><option value="all">{label}: All</option>{options.map(([key, optionLabel]) => <option key={key} value={key}>{optionLabel}</option>)}</select>)}<span className="rounded-lg bg-white/[0.04] px-2.5 py-2 text-[11px] text-[#9aa5b3]">{filtered.length} games</span></div></div>
        {filtered.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{filtered.map((game) => <GameCard key={game.id} game={game} onAddCollection={setModalGame} />)}</div> : <div className={`${panel} px-6 py-16 text-center`}><LuGamepad2 className="mx-auto mb-4 text-[#65707c]" size={32} /><h2 className="font-semibold text-white">No games match those filters</h2><p className={`${muted} mt-2`}>Try another search or clear a filter.</p></div>}
        {modalGame && <CollectionModal game={modalGame} onClose={() => setModalGame(null)} />}
    </main>;
}

export function GameDetail() {
    const { gameId } = useParams();
    const games = useCatalog();
    const [game, setGame] = useState(null);
    const [reviews, setReviews] = useState({ reviews: [], average: null, count: 0 });
    const [media, setMedia] = useState(null);
    const [tab, setTab] = useState("Description");
    const [rating, setRating] = useState("5");
    const [comment, setComment] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [completed, setCompleted] = useState(() => JSON.parse(localStorage.getItem("completedGames") || "[]"));
    const [isFavorite, setIsFavorite] = useState(false);
    const [actionsOpen, setActionsOpen] = useState(false);

    useEffect(() => {
        getGame(gameId).then(setGame).catch(() => setGame(null));
        getGameReviews(gameId).then((result) => {
            setReviews(result.reviews?.length ? result : { ...result, reviews: getMockGameReviews({ id: gameId }), count: 3 });
        }).catch(() => setReviews({ reviews: getMockGameReviews({ id: gameId }), average: null, count: 3 }));
        getGameMedia(gameId).then(setMedia).catch(() => {});
    }, [gameId]);
    useEffect(() => { getFavorites().then((items) => setIsFavorite(items.some((item) => String(item.id) === String(gameId)))).catch(() => setIsFavorite(false)); }, [gameId]);
    const isCompleted = completed.includes(gameId);
    const similar = useMemo(() => game ? games.filter((item) => item.id !== game.id && item.genres?.some((genre) => game.genres?.some((own) => own.description === genre.description))).slice(0, 4) : [], [games, game]);
    function toggleCompleted() { const next = isCompleted ? completed.filter((id) => id !== gameId) : [...completed, gameId]; setCompleted(next); localStorage.setItem("completedGames", JSON.stringify(next)); }
    async function toggleFavorite() {
        try {
            if (isFavorite) await removeFavorite(gameId);
            else await addFavorite(gameId);
            setIsFavorite(!isFavorite);
        } catch (error) { setMessage(error.response?.data?.detail || "Could not update favorites."); }
    }
    async function removeFromFavoriteLists() {
        try { await removeFavorite(gameId); setIsFavorite(false); setActionsOpen(false); }
        catch (error) { setMessage(error.response?.data?.detail || "Could not update favorites."); }
    }
    async function removeFromCollections() {
        try {
            const lists = await getCustomLists();
            await Promise.all(lists.map(async (list) => {
                const listGames = await getCustomListGames(list.id).catch(() => []);
                if (listGames.some((item) => String(item.id) === String(gameId))) await removeGameFromList(list.id, gameId);
            }));
            setActionsOpen(false);
        } catch (error) { setMessage(error.response?.data?.detail || "Could not remove the game from collections."); }
    }
    async function submitReview(event) { event.preventDefault(); try { await saveGameReview(gameId, { rating: Number(rating), comment }); setReviews(await getGameReviews(gameId)); setComment(""); setMessage("Review saved. Thanks for sharing!"); } catch (error) { setMessage(error.response?.data?.detail || "Could not save your review."); } }
    if (!game) return <main className={shell}><p className={muted}>Loading game details...</p></main>;
    const tabs = ["Description", "Reviews", "Media", "Similar"];
    const descriptionParagraphs = (game.about_the_game || game.detailed_description || game.short_description || "No description available.")
        .replace(/<\/(p|h[1-6]|div|li)>/gi, "\n")
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<[^>]*>/g, " ")
        .split(/\n+/)
        .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
        .filter(Boolean);

    return <main className={shell}>
        <Link to="/discover" className="mb-5 inline-flex items-center gap-2 text-xs text-[#8d98a5] hover:text-white"><LuChevronRight className="rotate-180" size={15} />Back to discover</Link>
        <section className="detail-hero mb-7 flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-[#151b20] p-5 sm:flex-row sm:items-center sm:p-6">
            {game.header_image && <img src={game.header_image} alt={`${game.name} cover`} className="aspect-video w-full shrink-0 rounded-xl border border-white/10 object-cover shadow-lg shadow-black/25 sm:w-44" />}
            <div className="min-w-0 flex-1"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#c5b8ff]">{game.genres?.map((item) => item.description).join(" · ") || "Featured game"}</p><h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl">{game.name}</h1><p className="mt-2 line-clamp-2 max-w-2xl text-sm leading-6 text-[#aeb7c1]">{game.short_description || "Discover what players are saying about this game."}</p><div className="mt-4 flex flex-wrap items-center gap-2"><span className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"><LuStar className="text-[#c5b8ff]" size={15} fill="currentColor" />{reviews.average ? `${reviews.average} / 5` : "Not rated yet"}<span className="text-xs text-[#8d98a5]">({reviews.count})</span></span>{game.metacritic?.score && <span className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-[#d1d5d9]">Metacritic {game.metacritic.score}</span>}</div><div className="mt-4 flex flex-wrap gap-4"><button onClick={() => setTab("Reviews")} className="rounded-lg bg-[#7189ff] px-3.5 py-2.5 text-xs font-bold text-[#111326] transition hover:bg-[#9aaaff]"><LuStar className="mr-1.5 inline" size={14} />Rate game</button><button onClick={toggleCompleted} className={`rounded-lg border px-3.5 py-2.5 text-xs font-semibold ${isCompleted ? "border-[#7189ff]/40 bg-[#7189ff]/10 text-[#c5b8ff]" : "border-white/10 bg-black/10 text-white hover:bg-white/5"}`}><LuBookmarkCheck className="mr-1.5 inline" size={14} />{isCompleted ? "Completed" : "Mark completed"}</button><button onClick={() => setModalOpen(true)} className="rounded-lg border border-white/10 bg-black/10 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-white/5"><LuLayers3 className="mr-1.5 inline" size={14} />Add to collection</button></div></div>
        </section>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3"><section className="min-w-0 lg:col-span-2">
            <div className="mb-6 flex gap-6 overflow-x-auto border-b border-white/10 px-2">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`shrink-0 border-b-2 px-3 py-4 text-sm font-semibold transition ${tab === item ? "border-[#7189ff] text-[#c5b8ff]" : "border-transparent text-[#8d98a5] hover:text-white"}`}>{item}{item === "Reviews" && ` (${reviews.count})`}</button>)}</div>
            {tab === "Description" && <div className="space-y-8"><article className="max-w-none"><h2 className="mb-4 text-xl font-bold text-white">About this game</h2><div className="space-y-4">{descriptionParagraphs.map((paragraph, index) => <p key={index} className="text-sm leading-relaxed text-gray-300">{paragraph}</p>)}</div></article>
                <section className="space-y-4"><h2 className="text-xl font-bold text-white">Community Reviews</h2>{reviews.reviews.length ? <div className="space-y-3">{reviews.reviews.slice(0, 3).map((review) => <article key={review.id} className={`${panel} p-4`}><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7189ff]/15 text-xs font-bold text-[#c5b8ff]">{(review.username || "P").slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-white">{review.username || "Player"}</strong><span className="flex items-center gap-1 text-[#c5b8ff]">{Array.from({ length: 5 }, (_, index) => <LuStar key={index} size={13} fill={index < review.rating ? "currentColor" : "none"} />)}</span></div><p className="mt-2 text-sm leading-relaxed text-gray-300">{review.comment}</p></div></div></article>)}</div> : <p className={muted}>No community reviews yet. Be the first to share your thoughts.</p>}</section>
                <section className="space-y-4"><h2 className="text-xl font-bold text-white">Game Stats</h2><div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[["Total Players", game.total_players ?? "—"], ["Completions", game.completions ?? "—"], ["Average Playtime", game.average_playtime ? `${game.average_playtime} hrs` : "—"]].map(([label, value]) => <article key={label} className={`${panel} p-4`}><p className="text-xs text-[#8d98a5]">{label}</p><p className="mt-2 text-xl font-bold text-white">{value}</p></article>)}</div></section>
            </div>}
            {tab === "Reviews" && <section className="max-w-3xl"><h2 className="mb-5 text-xl font-bold text-white">Player reviews</h2><form onSubmit={submitReview} className={`${panel} mb-6 space-y-4 p-5`}><label className="block text-xs font-semibold text-[#aeb7c1]">Your rating<select value={rating} onChange={(event) => setRating(event.target.value)} className="ml-3 rounded-lg border border-white/10 bg-[#101419] px-3 py-2 text-white">{[5, 4, 3, 2, 1].map((score) => <option key={score} value={score}>{score} / 5</option>)}</select></label><textarea required maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="What should other players know?" className="min-h-28 w-full rounded-xl border border-white/10 bg-[#101419] p-3 text-sm text-white outline-none placeholder:text-[#65707c] focus:border-[#7189ff]/50" /><div className="flex items-center justify-between"><p className={`${muted} text-xs`}>{message}</p><button className="rounded-lg bg-[#7189ff] px-4 py-2 text-xs font-bold text-[#111326]">Write review</button></div></form><div className="space-y-3">{reviews.reviews.map((review) => <article key={review.id} className={`${panel} p-4`}><div className="flex items-center justify-between"><strong className="text-sm text-white">{review.username}</strong><span className="text-xs text-[#c5b8ff]">{"★".repeat(review.rating)} <span className="text-[#aeb7c1]">{review.rating}/5</span></span></div><p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#aeb7c1]">{review.comment}</p></article>)}{!reviews.count && <p className={muted}>Be the first to review this game.</p>}</div></section>}
            {tab === "Media" && <section><h2 className="mb-5 text-xl font-bold text-white">Screenshots & media</h2>{media?.screenshots?.length ? <div className="grid gap-3 sm:grid-cols-2">{media.screenshots.map((item) => <img key={item.id} src={item.full || item.thumbnail} alt={`${game.name} screenshot`} className="w-full rounded-xl border border-white/10" />)}</div> : <p className={muted}>No media is available for this game.</p>}</section>}
            {tab === "Similar" && <section><h2 className="mb-5 text-xl font-bold text-white">You might also like</h2>{similar.length ? <div className="grid gap-4 sm:grid-cols-2">{similar.map((item) => <GameCard key={item.id} game={item} />)}</div> : <p className={muted}>No similar games found yet.</p>}</section>}
        </section><aside className="space-y-4 lg:col-span-1"><div className={`${panel} p-5`}><h3 className="mb-4 text-sm font-bold text-white">Game details</h3><dl className="space-y-4 text-xs"><div><dt className="text-[#77818c]">Release date</dt><dd className="mt-1 text-[#dbe0e4]">{game.release_date?.date || game.release_date || "Unknown"}</dd></div><div><dt className="text-[#77818c]">Developer</dt><dd className="mt-1 text-[#dbe0e4]">{game.developers?.join(", ") || "Unknown"}</dd></div><div><dt className="text-[#77818c]">Platforms</dt><dd className="mt-1 text-[#dbe0e4]">{Object.entries(game.platforms || {}).filter(([, enabled]) => enabled).map(([name]) => name).join(", ") || "Unknown"}</dd></div></dl></div><div className="flex gap-2"><button onClick={toggleFavorite} className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${isFavorite ? "border-[#7189ff]/30 bg-[#7189ff]/10 text-[#c5b8ff]" : "border-white/10 text-[#dbe0e4] hover:border-[#7189ff]/40 hover:text-white"}`}><LuHeart size={16} fill={isFavorite ? "currentColor" : "none"} />{isFavorite ? "Remove from favorites" : "Add to favorites"}</button><div className="relative"><button aria-label="More game actions" aria-expanded={actionsOpen} onClick={() => setActionsOpen((open) => !open)} className="flex h-full items-center justify-center rounded-xl border border-white/10 px-3 text-[#dbe0e4] hover:border-[#7189ff]/40 hover:text-white"><LuEllipsisVertical size={18} /></button>{actionsOpen && <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-white/10 bg-[#171c22] p-1.5 shadow-xl"><button onClick={removeFromFavoriteLists} className="w-full rounded-lg px-3 py-2.5 text-left text-xs text-[#dbe0e4] hover:bg-white/5 hover:text-white">Remove from Favorite lists</button><button onClick={removeFromCollections} className="w-full rounded-lg px-3 py-2.5 text-left text-xs text-[#dbe0e4] hover:bg-white/5 hover:text-white">Remove from collection</button></div>}</div></div>{message && <p role="status" className={`${muted} text-xs`}>{message}</p>}</aside></div>
        {modalOpen && <CollectionModal game={game} onClose={() => setModalOpen(false)} />}
    </main>;
}

export function Profile() {
    const { user } = useContext(AuthContext);
    const games = useCatalog();
    const [favorites, setFavorites] = useState([]);
    const [lists, setLists] = useState([]);
    const [completed] = useState(() => JSON.parse(localStorage.getItem("completedGames") || "[]"));
    const [listGames, setListGames] = useState({});
    const [expandedListId, setExpandedListId] = useState(null);
    const [following, setFollowing] = useState(false);
    useEffect(() => { getFavorites().then(setFavorites).catch(() => {}); getCustomLists().then(setLists).catch(() => {}); }, []);
    const initials = (user?.username || "P").slice(0, 2).toUpperCase();
    async function showList(list) {
        if (expandedListId === list.id) { setExpandedListId(null); return; }
        setExpandedListId(list.id);
        if (!listGames[list.id]) {
            const found = await getCustomListGames(list.id).catch(() => []);
            setListGames((current) => ({ ...current, [list.id]: found }));
        }
    }

    return <main className={`${shell} flex flex-col gap-8`}><section className={`${panel} relative w-full flex flex-wrap justify-between items-center gap-5 p-6 overflow-hidden`}><div className="absolute -right-10 -top-24 h-64 w-64 rounded-full bg-[#7189ff]/10 blur-3xl" /><div className="relative flex min-w-0 flex-1 items-center gap-4 sm:gap-5"><div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-[#7189ff]/20 bg-[#7189ff]/10 text-2xl font-bold text-[#c5b8ff] sm:h-24 sm:w-24">{initials}</div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#7189ff]">Player profile</p><h1 className="mt-1 truncate text-2xl font-bold text-white sm:text-3xl">{user?.username || "Player"}</h1><p className={`${muted} mt-2`}>Collecting stories, one game at a time.</p></div></div><button onClick={() => setFollowing((value) => !value)} className={`z-10 shrink-0 whitespace-nowrap rounded-xl px-5 py-3 text-sm font-bold transition ${following ? "border border-white/10 bg-white/[0.04] text-[#dbe0e4] hover:bg-white/[0.08]" : "bg-[#7189ff] text-[#111326] shadow-md shadow-[#7189ff]/20 hover:bg-[#899aff]"}`}>{following ? "Following" : "Follow player"}</button></section>
        <section className="grid w-full grid-cols-4 gap-4">{[["Logged", favorites.length, LuGamepad2], ["Completed", completed.length, LuTrophy], ["Collections", lists.length, LuLayers3], ["Followers", following ? 1 : 0, LuUsers]].map(([label, value, Icon]) => <div className={`${panel} flex flex-col items-center gap-2 p-5 text-center`} key={label}><Icon className="text-[#a9b6ff]" size={18} /><p className="text-2xl font-bold text-white">{value}</p><p className="text-xs text-[#8d98a5]">{label}</p></div>)}</section>
        <section className="w-full"><SectionHeading eyebrow="Your library" title="Favorites" action="Find more games" layout="between" /><div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{favorites.slice(0, 4).map((game) => <GameCard key={game.id} game={game} />)}{!favorites.length && <p className={`${muted} col-span-full text-center`}>Games you favorite will show up here.</p>}</div></section>
        <section className="w-full"><SectionHeading eyebrow="Your shelves" title="Collections" action="Create a collection" to="/discover" layout="between" /><div className="mt-5 grid gap-3 md:grid-cols-2">{lists.map((list) => <article key={list.id} className={`${panel} overflow-hidden`}><div className="flex items-center justify-between gap-4 p-5"><div className="min-w-0"><h3 className="truncate font-semibold text-white">{list.name}</h3><p className={`${muted} mt-1`}>{list.game_ids?.length ?? listGames[list.id]?.length ?? 0} games</p></div><button onClick={() => showList(list)} aria-expanded={expandedListId === list.id} className="shrink-0 rounded-lg border border-[#7189ff]/25 bg-[#7189ff]/[0.07] px-3 py-2 text-xs font-semibold text-[#c5b8ff] hover:bg-[#7189ff]/15">{expandedListId === list.id ? "Hide games" : "View games"}</button></div>{expandedListId === list.id && <div className="border-t border-white/[0.07] p-5">{listGames[list.id]?.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{listGames[list.id].map((game) => <GameCard key={game.id} game={game} />)}</div> : <p className={muted}>This collection does not have any games yet.</p>}</div>}</article>)}{!lists.length && <p className={muted}>Create a collection from any game page.</p>}</div></section>
        <section className="w-full"><SectionHeading eyebrow="On your list" title="Completed games" action="Browse games" layout="between" /><div className="mt-5">{completed.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{games.filter((game) => completed.includes(game.id)).map((game) => <GameCard key={game.id} game={game} />)}</div> : <p className={`${muted} text-center`}>Mark a game completed to add it to your profile.</p>}</div></section>
    </main>;
}

export function Collections() {
    const games = useCatalog();
    const [myLists, setMyLists] = useState([]);
    const [myListGames, setMyListGames] = useState({});
    const [expandedListId, setExpandedListId] = useState(null);
    const [expandedCommunityId, setExpandedCommunityId] = useState(null);
    const communityLists = useMemo(() => getCommunityLists(games), [games]);

    useEffect(() => {
        getCustomLists().then(setMyLists).catch(() => setMyLists([]));
    }, []);

    async function toggleMyList(list) {
        if (expandedListId === list.id) {
            setExpandedListId(null);
            return;
        }
        setExpandedListId(list.id);
        if (myListGames[list.id]) return;
        const contents = await getCustomListGames(list.id).catch(() => []);
        setMyListGames((current) => ({ ...current, [list.id]: contents }));
    }

    return <main className={shell}>
        <header className="mb-9 text-center"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#93a4ff]">Your shelves, your inspiration</p><h1 className="text-4xl font-bold tracking-tight text-white">Collections</h1><p className={`${muted} mt-2`}>Your saved game lists and picks from the community.</p></header>

        <section className="mb-12">
            <SectionHeading eyebrow="Your library" title="My collections" action="Create a collection" to="/discover" layout="between" />
            <div className="mt-5 grid gap-4 md:grid-cols-2">{myLists.map((list) => <article key={list.id} className={`${panel} overflow-hidden`}><div className="flex items-center justify-between gap-4 p-5"><div className="min-w-0"><h2 className="truncate font-semibold text-white">{list.name}</h2><p className={`${muted} mt-1`}>{list.game_ids?.length ?? myListGames[list.id]?.length ?? 0} games · Your collection</p></div><button onClick={() => toggleMyList(list)} aria-expanded={expandedListId === list.id} className="shrink-0 rounded-lg border border-[#7189ff]/25 bg-[#7189ff]/[0.07] px-3 py-2 text-xs font-semibold text-[#c5b8ff] hover:bg-[#7189ff]/15">{expandedListId === list.id ? "Hide games" : "View games"}</button></div>{expandedListId === list.id && <div className="border-t border-white/[0.07] p-5">{myListGames[list.id]?.length ? <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{myListGames[list.id].map((game) => <GameCard key={game.id} game={game} />)}</div> : <p className={muted}>This collection does not have any games yet.</p>}</div>}</article>)}{!myLists.length && <div className={`${panel} flex flex-col items-center px-6 py-9 text-center md:col-span-2`}><LuLayers3 className="mb-3 text-[#a9b6ff]" size={24} /><h3 className="font-semibold text-white">Your collections will show up here</h3><p className={`${muted} mt-2`}>Save games into a list to build your own shelves.</p><Link to="/discover" className="mt-4 rounded-lg bg-[#7189ff] px-4 py-2.5 text-xs font-bold text-[#111326] hover:bg-[#9aaaff]">Find games</Link></div>}</div>
        </section>

        <section>
            <SectionHeading eyebrow="Made by players" title="Community collections" action="Explore Discover" to="/discover" layout="between" />
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{communityLists.map((list) => <article key={list.id} className={`${panel} overflow-hidden transition hover:border-[#7189ff]/25`}><button onClick={() => setExpandedCommunityId((current) => current === list.id ? null : list.id)} aria-expanded={expandedCommunityId === list.id} className="group flex w-full items-center gap-4 p-4 text-left"><div className="grid h-14 w-[72px] shrink-0 grid-cols-3 gap-0.5 overflow-hidden rounded-lg bg-[#222831]">{list.games.slice(0, 3).map((game) => <img key={game.id} src={game.header_image} alt="" className="h-full w-full object-cover" />)}</div><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-white group-hover:text-[#c5b8ff]">{list.name}</h2><p className="mt-1 line-clamp-2 text-xs leading-5 text-[#8d98a5]">{list.description}</p><span className="mt-2 inline-block text-[10px] text-[#a9b6ff]">{list.games.length} games · {expandedCommunityId === list.id ? "Hide games" : "View games"}</span></div><LuChevronRight className={`shrink-0 text-[#8d98a5] transition ${expandedCommunityId === list.id ? "rotate-90" : ""}`} size={17} /></button>{expandedCommunityId === list.id && <div className="border-t border-white/[0.07] p-4"><div className="grid gap-3 sm:grid-cols-2">{list.games.map((game) => <GameCard key={game.id} game={game} />)}</div></div>}</article>)}{!communityLists.length && <p className={`${muted} ${panel} p-5 text-center md:col-span-2 xl:col-span-3`}>Community collections will appear when games are available in the catalog.</p>}</div>
        </section>
    </main>;
}

export function Social() {
    const games = useCatalog();
    return <main className={shell}><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#7189ff]">Social feed preview</p><h1 className="text-4xl font-bold text-white">Social</h1><p className={`${muted} mt-2`}>A preview of how friend activity will look when social connections are available.</p><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]"><section className={`${panel} divide-y divide-white/[0.07] px-5`}>{games.slice(0, 6).map((game, index) => <article key={game.id} className="flex items-center gap-4 py-4"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#7189ff]/10 text-xs font-bold text-[#c5b8ff]">{["JM", "AK", "SR", "ML", "TD", "KC"][index]}</div><p className="flex-1 text-sm text-[#c7cdd3]"><strong className="text-white">{["Jordan M.", "Alex K.", "Sam R.", "Morgan L.", "Taylor D.", "Kai C."][index]}</strong> added <Link to={`/games/${game.id}`} className="font-semibold text-white hover:text-[#c5b8ff]">{game.name}</Link> to their recently played.</p><span className="hidden text-xs text-[#77818c] sm:block">{index + 1}h ago</span></article>)}{!games.length && <p className={`${muted} py-8`}>Activity will appear here as your community grows.</p>}</section><aside className={`${panel} h-fit p-5`}><div className="flex items-center gap-2 text-sm font-bold text-white"><LuUsers className="text-[#7189ff]" size={17} />Find your people</div><p className={`${muted} mt-2`}>Follow players to keep up with their games and recommendations.</p><Link to="/profile" className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-[#c5b8ff]">Your player profile<LuArrowRight size={14} /></Link></aside></div></main>;
}
