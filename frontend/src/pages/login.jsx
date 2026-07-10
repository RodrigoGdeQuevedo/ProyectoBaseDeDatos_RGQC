import "../styles/login.css";
import { useState, useContext } from "react";
import { login as loginService } from "../services/authService";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

function Login() {
    const navigate = useNavigate();
    const { login } = useContext(AuthContext);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    async function handleSubmit(e){
        e.preventDefault();
        try{
            const data = await loginService(username,password);
            login(data.access_token);
            navigate("/");
        }
        catch{
            alert("Usuario o contraseña incorrectos");
        }
    }
    return(
        <div className="login-container">
            <h1>Iniciar sesión</h1>
            <form onSubmit={handleSubmit}>
                <input
                    placeholder="Usuario"
                    value={username}
                    onChange={(e)=>setUsername(e.target.value)}
                />
                <br/><br/>
                <input
                    type="password"
                    placeholder="Contraseña"
                    value={password}
                    onChange={(e)=>setPassword(e.target.value)}
                />
                <br/><br/>
                <button>
                    Entrar
                </button>
            </form>
        </div>
    );
}

export default Login;