import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AdminRoute from './admin/AdminRoute';
import Login from './components/Login';
import GuestRegister from './components/GuestRegister';
import Landing from './components/Landing';
import PrivacyPolicy from './components/PrivacyPolicy';
import TermsOfUse from './components/TermsOfUse';
import ResetPassword from './components/ResetPassword';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfUse />} />
        <Route path="/admin/*" element={<AdminRoute />} />
        <Route path="/guest/register" element={<GuestRegister />} />
        <Route path="/forgot-password" element={<Login initialView="forgot" />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  );
}
