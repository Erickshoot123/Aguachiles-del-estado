import type { JSX } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthBootstrap } from './features/auth/AuthBootstrap';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { CashPage } from './routes/CashPage';
import { CatalogPage } from './routes/CatalogPage';
import { LoginPage } from './routes/LoginPage';
import { OrdersBoardPage } from './routes/OrdersBoardPage';
import { ReportsPage } from './routes/ReportsPage';
import { SuppliersPage } from './routes/SuppliersPage';

export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <AuthBootstrap>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <OrdersBoardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/caja"
            element={
              <ProtectedRoute>
                <CashPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/menu"
            element={
              <ProtectedRoute>
                <CatalogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reportes"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compras"
            element={
              <ProtectedRoute>
                <SuppliersPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthBootstrap>
    </BrowserRouter>
  );
}
