import { createContext, useState } from "react";
import { jwtDecode } from "jwt-decode";

export const AuthContext = createContext();

function getSessionFromToken(token) {
    if (!token) {
        return null;
    }

    try {
        const payload = jwtDecode(token);

        return {
            token,
            username: payload.sub || "",
            role: payload.role || "user"
        };
    } catch {
        localStorage.removeItem("token");
        return null;
    }
}

export function AuthProvider({ children }) {

    const [user, setUser] = useState(
        getSessionFromToken(localStorage.getItem("token"))
    );

    function login(token){

        localStorage.setItem("token", token);

        setUser(getSessionFromToken(token));
    }

    function logout(){

        localStorage.removeItem("token");

        setUser(null);
    }

    return (

        <AuthContext.Provider
            value={{
                user,
                login,
                logout
            }}
        >

            {children}

        </AuthContext.Provider>

    );

}