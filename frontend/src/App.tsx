import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import BatchPage from "./pages/BatchPage";
import CreatePage from "./pages/CreatePage";
import LoginPage from "./pages/LoginPage";
import PaletteNewPage from "./pages/PaletteNewPage";
import PalettesPage from "./pages/PalettesPage";
import RegisterPage from "./pages/RegisterPage";
import ResultPage from "./pages/ResultPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/create" replace />} />
        <Route path="palettes" element={<PalettesPage />} />
        <Route path="palettes/new" element={<PaletteNewPage />} />
        <Route path="create" element={<CreatePage />} />
        <Route path="create/:projectId/batch" element={<BatchPage />} />
        <Route path="results/:id" element={<ResultPage />} />
      </Route>
    </Routes>
  );
}
