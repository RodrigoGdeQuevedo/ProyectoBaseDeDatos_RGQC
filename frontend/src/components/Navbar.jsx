import { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "../styles/navbar.css";

function Navbar() {
    const { user, logout } = useContext(AuthContext);
    const navigate = useNavigate();

    function handleLogout() {
        logout();
        navigate("/login");
    }

    return (
        <nav className="navbar">
            <Link to="/" className="navbar-brand">
                Steam Catalog
            </Link>

            <div className="navbar-links">
                {user ? (
                    <>
                        <span className="navbar-user">
                            {user.username || "Usuario"}
                            {user.role === "admin" && <strong className="navbar-user__role">Admin</strong>}
                        </span>

                        <button onClick={handleLogout} className="navbar-button">
                            Cerrar sesión
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login">Iniciar sesión</Link>
                        <Link to="/register">Registrarse</Link>
                    </>
                )}
            </div>
        </nav>
    );
}

export default Navbar;