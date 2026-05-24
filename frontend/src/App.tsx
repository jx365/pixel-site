import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminPage from "./pages/AdminPage";
import BatchPage from "./pages/BatchPage";
import CommunityPage from "./pages/CommunityPage";
import CreatePage from "./pages/CreatePage";
import LoginPage from "./pages/LoginPage";
import MessagesPage from "./pages/MessagesPage";
import PaletteNewPage from "./pages/PaletteNewPage";
import PalettesPage from "./pages/PalettesPage";
import ResultPage from "./pages/ResultPage";
import WorkDetailPage from "./pages/WorkDetailPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
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
        <Route path="community" element={<CommunityPage />} />
        <Route path="community/:workId" element={<WorkDetailPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}
