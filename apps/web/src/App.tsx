import type { JSX } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthBootstrap } from './features/auth/AuthBootstrap';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { AnalyticsPage } from './routes/AnalyticsPage';
import { AuditPage } from './routes/AuditPage';
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
              <ProtectedRoute permission="catalog.write">
                <CatalogPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reportes"
            element={
              <ProtectedRoute permission="reports.view">
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/compras"
            element={
              <ProtectedRoute permission="suppliers.write">
                <SuppliersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/auditoria"
            element={
              <ProtectedRoute permission="audit.view">
                <AuditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analitica"
            element={
              <ProtectedRoute permission="reports.view">
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthBootstrap>
    </BrowserRouter>
  );
}
