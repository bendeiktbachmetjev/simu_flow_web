import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import appIcon from '../assets/app-icon.png';

export default function GuestRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    country: '',
    affiliation: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('guests')
        .insert([{
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim().toLowerCase(),
          country: form.country.trim(),
          affiliation: form.affiliation.trim(),
        }]);

      if (insertError) throw insertError;
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-[#FFFFFF] flex flex-col justify-center items-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#78003F] to-[#E64164] rounded-[24px] mx-auto flex items-center justify-center mb-6 shadow-[0_8px_20px_rgba(65,65,65,0.08)]">
            <CheckCircle2 className="text-white w-10 h-10" />
          </div>
          <h2 className="text-3xl font-extrabold text-[#414141] mb-3">
            You're All Set!
          </h2>
          <p className="text-[#414141]/80 font-semibold text-lg mb-2">
            Welcome, {form.first_name}!
          </p>
          <p className="text-[#414141]/70 font-medium">
            Your guest registration has been recorded. Enjoy your visit!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex flex-col items-center p-4 pt-8">
      <div className="max-w-md w-full">
        {/* Back button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-[#414141]/70 hover:text-[#414141] font-semibold mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Form card */}
        <div className="bg-[#FFFFFF] rounded-[24px] shadow-[0_8px_20px_rgba(65,65,65,0.08)] border border-[#DCDCDC]/60 p-8">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-[#DCDCDC]/40 rounded-[16px] mx-auto flex items-center justify-center mb-4 shadow-[0_8px_20px_rgba(65,65,65,0.08)] overflow-hidden">
              <img src={appIcon} alt="SimuFlow" className="w-full h-full object-cover" />
            </div>
            <h2 className="text-2xl font-extrabold text-[#414141]">
              Guest Registration
            </h2>
            <p className="text-[#414141]/70 mt-2 font-medium">
              Please fill in your details below
            </p>
          </div>

          {error && (
            <div className="bg-[#E64164]/10 text-[#E64164] text-sm font-semibold p-4 rounded-[16px] mb-6 border border-[#E64164]/20">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-[#414141] mb-1.5">
                First Name
              </label>
              <input
                type="text"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                required
                placeholder="John"
                className="w-full px-4 py-3 rounded-[16px] border border-transparent bg-[#DCDCDC]/40 text-[#414141] font-medium placeholder:text-[#414141]/40 focus:outline-none focus:ring-2 focus:ring-[#78003F] focus:bg-[#DCDCDC]/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#414141] mb-1.5">
                Last Name
              </label>
              <input
                type="text"
                name="last_name"
                value={form.last_name}
                onChange={handleChange}
                required
                placeholder="Doe"
                className="w-full px-4 py-3 rounded-[16px] border border-transparent bg-[#DCDCDC]/40 text-[#414141] font-medium placeholder:text-[#414141]/40 focus:outline-none focus:ring-2 focus:ring-[#78003F] focus:bg-[#DCDCDC]/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#414141] mb-1.5">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="name@example.com"
                autoComplete="email"
                inputMode="email"
                className="w-full px-4 py-3 rounded-[16px] border border-transparent bg-[#DCDCDC]/40 text-[#414141] font-medium placeholder:text-[#414141]/40 focus:outline-none focus:ring-2 focus:ring-[#78003F] focus:bg-[#DCDCDC]/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#414141] mb-1.5">
                Country
              </label>
              <input
                type="text"
                name="country"
                value={form.country}
                onChange={handleChange}
                required
                autoComplete="country-name"
                placeholder="e.g. Germany"
                className="w-full px-4 py-3 rounded-[16px] border border-transparent bg-[#DCDCDC]/40 text-[#414141] font-medium placeholder:text-[#414141]/40 focus:outline-none focus:ring-2 focus:ring-[#78003F] focus:bg-[#DCDCDC]/30 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-[#414141] mb-1.5">
                Affiliation
              </label>
              <input
                type="text"
                name="affiliation"
                value={form.affiliation}
                onChange={handleChange}
                required
                placeholder="Institute or organization"
                className="w-full px-4 py-3 rounded-[16px] border border-transparent bg-[#DCDCDC]/40 text-[#414141] font-medium placeholder:text-[#414141]/40 focus:outline-none focus:ring-2 focus:ring-[#78003F] focus:bg-[#DCDCDC]/30 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-br from-[#78003F] to-[#E64164] text-white font-bold py-4 rounded-full transition-all shadow-[0_8px_20px_rgba(65,65,65,0.08)] flex items-center justify-center gap-2 text-lg disabled:opacity-70 active:scale-[0.98] mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Registration'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
