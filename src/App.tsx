import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import LandingPage from './pages/LandingPage';
import ExplorerPage from './pages/ExplorerPage';
import RoutePlannerPage from './pages/RoutePlannerPage';
import SimulatePage from './pages/SimulatePage';
import DashboardPage from './pages/DashboardPage';
import AboutPage from './pages/AboutPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Layout>
              <LandingPage />
            </Layout>
          }
        />
        <Route
          path="/explore"
          element={
            <Layout>
              <ExplorerPage />
            </Layout>
          }
        />
        <Route
          path="/route"
          element={
            <Layout>
              <RoutePlannerPage />
            </Layout>
          }
        />
        <Route
          path="/simulate"
          element={
            <Layout>
              <SimulatePage />
            </Layout>
          }
        />
        <Route
          path="/dashboard"
          element={
            <Layout>
              <DashboardPage />
            </Layout>
          }
        />
        <Route
          path="/about"
          element={
            <Layout>
              <AboutPage />
            </Layout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}