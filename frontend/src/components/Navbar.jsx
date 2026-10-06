import { useContext } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LuCompass, LuGamepad2, LuLayers3, LuLogOut, LuUsers } from "react-icons/lu";
import { AuthContext } from "../context/AuthContext";

const navItems = [
    ["/discover", "Discover", LuCompass],
    ["/games", "Games", LuGamepad2],
    ["/collections", "Collections", LuLayers3],
    ["/social", "Social", LuUsers]
];

function Navbar() {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    function handleLogout() {
        logout();
        navigate("/login");
    }

    function renderNavItems(compact = false) {
        return navItems.map(([to, label, Icon]) => (
            <NavLink key={label} to={to} className={({ isActive }) => `flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${isActive ? "border-[#7189ff]/25 bg-[#7189ff]/10 text-[#c5b8ff] shadow-sm shadow-[#7189ff]/10" : "border-transparent text-[#8d98a5] hover:bg-white/[0.04] hover:text-white"} ${compact ? "px-2.5 text-[10px]" : ""}`}>
                <Icon size={15} />{label}
            </NavLink>
        ));
    }

    return (
        <nav className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#111519]/95 backdrop-blur-xl">
            <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between gap-4 px-5 sm:px-8 lg:px-12">
                <Link to="/" className="flex shrink-0 items-center gap-2.5 text-sm font-bold tracking-wide text-white sm:text-base">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#7189ff] text-[#111326]"><LuGamepad2 size={19} /></span>
                    <span>PLAY<span className="text-[#c5b8ff]">SPACE</span></span>
                </Link>

                {user && <div className="hidden items-center gap-1 md:flex">{renderNavItems()}</div>}

                <div className="flex items-center gap-3">
                    {user ? <>
                        <Link to="/profile" className="flex items-center gap-2 rounded-full border border-white/10 py-1 pl-1 pr-3 text-xs font-semibold text-[#dbe0e4] hover:border-[#7189ff]/30">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#7189ff]/15 text-[10px] font-bold text-[#c5b8ff]">{(user.username || "P").slice(0, 1).toUpperCase()}</span>
                            <span className="hidden sm:block">{user.username || "Player"}</span>
                        </Link>
                        <button onClick={handleLogout} aria-label="Sign out" title="Sign out" className="rounded-lg p-2 text-[#8d98a5] transition hover:bg-white/5 hover:text-white"><LuLogOut size={17} /></button>
                    </> : <>
                        <Link className="text-xs text-[#aeb7c1] hover:text-white" to="/login">Sign in</Link>
                        <Link className="rounded-lg bg-[#7189ff] px-3 py-2 text-xs font-bold text-[#111326] hover:bg-[#c5b8ff]" to="/register">Join community</Link>
                    </>}
                </div>
            </div>
            {user && <div className="flex items-center justify-center gap-1 border-t border-white/[0.05] px-2 py-2 md:hidden">{renderNavItems(true)}</div>}
        </nav>
    );
}

export default Navbar;
