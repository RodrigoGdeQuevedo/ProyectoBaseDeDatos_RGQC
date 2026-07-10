import { createContext, useState } from "react";

export const AuthContext = createContext();

export function AuthProvider({ children }) {

    const [user, setUser] = useState(
        localStorage.getItem("token")
    );

    function login(token){

        localStorage.setItem("token", token);

        setUser(token);
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