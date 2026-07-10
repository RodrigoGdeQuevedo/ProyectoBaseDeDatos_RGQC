import { useState } from "react";
import { register as registerService } from "../services/authService";
import { useNavigate } from "react-router-dom";
import "../styles/register.css";

function Register() {
    const navigate = useNavigate();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        try {
            await registerService({ username, email, password });
            navigate("/login");
        } catch (err) {
            const detail = err.response?.data?.detail;
            setError(detail || "No se pudo registrar el usuario");
        }
    }

    return (
        <div className="register-container">
            <h1>Crear cuenta</h1>

            {error && <p className="register-error">{error}</p>}

            <form onSubmit={handleSubmit}>
                <input
                    placeholder="Usuario"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />
                <br /><br />
                <input
                    type="email"
                    placeholder="Correo electrónico"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                />
                <br /><br />
                <input
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />
                <br /><br />
                <button type="submit">Crear cuenta</button>
            </form>
        </div>
    );
}

export default Register;