import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import { useAuthStore } from './store/authStore';

import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import CreateProduct from './pages/CreateProduct';
import ProductDetail from './pages/ProductDetail';
import LostFoundCenter from './pages/LostFoundCenter';
import ReportLostFound from './pages/ReportLostFound_FIX';
import LostFoundDetail from './pages/LostFoundDetail';
import Profile from './pages/Profile';
import Products from './pages/Products';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import AdminWorkspace from './pages/AdminWorkspace';
import OrderDetail from './pages/OrderDetail';
import KarmaHistory from './pages/KarmaHistory';
import MyReports from './pages/MyReports';
import PaymentCallback from './pages/PaymentCallback';

const NotFound = () => <div className="text-center py-20"><h1 className="text-9xl font-black text-indigo-100 mb-4">404</h1><h2 className="text-2xl font-bold text-slate-800 mb-6">Trang không được tìm thấy</h2><button onClick={() => window.history.back()} className="px-8 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Quay lại</button></div>;

const App: React.FC = () => {
  const restoreAuth = useAuthStore((s) => s.restoreAuth);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    restoreAuth();
  }, [restoreAuth]);

  // Show loading spinner while restoring auth (prevents flash of login page)
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="ADMIN" redirectTo="/admin/login" unauthorizedTo="/">
              <AdminWorkspace>
                <AdminDashboard />
              </AdminWorkspace>
            </ProtectedRoute>
          }
        />

        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route path="products" element={<Products />} />
          <Route path="products/new" element={<CreateProduct />} />
          <Route path="products/:id/edit" element={<CreateProduct />} />
          <Route path="login" element={<Login />} />
          <Route path="lost-found" element={<LostFoundCenter />} />
          <Route path="lost-found/new" element={<ReportLostFound />} />
          <Route path="lost-found/:id" element={<LostFoundDetail />} />
          <Route path="register" element={<Register />} />
          <Route path="profile" element={<Profile />} />
          <Route path="forgot-password" element={<ForgotPassword />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="payment/callback" element={<PaymentCallback />} />
          <Route path="karma-history" element={<KarmaHistory />} />
          <Route path="my-reports" element={<MyReports />} />
          <Route path="not-found" element={<NotFound />} />

          <Route path="*" element={<Navigate to="/not-found" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
