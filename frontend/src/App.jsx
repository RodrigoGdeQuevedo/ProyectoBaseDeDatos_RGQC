import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Catalog from "./pages/Catalog";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { Collections, CommunityLists, Discover, GameDetail, Games, Home, Profile, Social } from "./pages/platform";

function App() {
    return (
        <BrowserRouter>
            <Navbar />
            <Routes>
                <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/discover" element={<ProtectedRoute><Discover /></ProtectedRoute>} />
                <Route path="/games" element={<ProtectedRoute><Games /></ProtectedRoute>} />
                <Route path="/games/:gameId" element={<ProtectedRoute><GameDetail /></ProtectedRoute>} />
                <Route path="/collections" element={<ProtectedRoute><Collections /></ProtectedRoute>} />
                <Route path="/community-lists" element={<ProtectedRoute><CommunityLists /></ProtectedRoute>} />
                <Route path="/community-lists/:listId" element={<ProtectedRoute><CommunityLists /></ProtectedRoute>} />
                <Route path="/social" element={<ProtectedRoute><Social /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
