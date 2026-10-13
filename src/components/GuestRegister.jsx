import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';
import appIcon from '../assets/app-icon.png';

const COUNTRIES = [
  'Afghanistan',
  'Albania',
  'Algeria',
  'Andorra',
  'Angola',
  'Antigua and Barbuda',
  'Argentina',
  'Armenia',
  'Australia',
  'Austria',
  'Azerbaijan',
  'Bahamas',
  'Bahrain',
  'Bangladesh',
  'Barbados',
  'Belarus',
  'Belgium',
  'Belize',
  'Benin',
  'Bhutan',
  'Bolivia',
  'Bosnia and Herzegovina',
  'Botswana',
  'Brazil',
  'Brunei',
  'Bulgaria',
  'Burkina Faso',
  'Burundi',
  'Cabo Verde',
  'Cambodia',
  'Cameroon',
  'Canada',
  'Central African Republic',
  'Chad',
  'Chile',
  'China',
  'Colombia',
  'Comoros',
  'Congo (Congo-Brazzaville)',
  'Costa Rica',
  'Croatia',
  'Cuba',
  'Cyprus',
  'Czechia',
  'Democratic Republic of the Congo',
  'Denmark',
  'Djibouti',
  'Dominica',
  'Dominican Republic',
  'Ecuador',
  'Egypt',
  'El Salvador',
  'Equatorial Guinea',
  'Eritrea',
  'Estonia',
  'Eswatini',
  'Ethiopia',
  'Fiji',
  'Finland',
  'France',
  'Gabon',
  'Gambia',
  'Georgia',
  'Germany',
  'Ghana',
  'Greece',
  'Grenada',
  'Guatemala',
  'Guinea',
  'Guinea-Bissau',
  'Guyana',
  'Haiti',
  'Honduras',
  'Hungary',
  'Iceland',
  'India',
  'Indonesia',
  'Iran',
  'Iraq',
  'Ireland',
  'Israel',
  'Italy',
  'Jamaica',
  'Japan',
  'Jordan',
  'Kazakhstan',
  'Kenya',
  'Kiribati',
  'Kuwait',
  'Kyrgyzstan',
  'Laos',
  'Latvia',
  'Lebanon',
  'Lesotho',
  'Liberia',
  'Libya',
  'Liechtenstein',
  'Lithuania',
  'Luxembourg',
  'Madagascar',
  'Malawi',
  'Malaysia',
  'Maldives',
  'Mali',
  'Malta',
  'Marshall Islands',
  'Mauritania',
  'Mauritius',
  'Mexico',
  'Micronesia',
  'Moldova',
  'Monaco',
  'Mongolia',
  'Montenegro',
  'Morocco',
  'Mozambique',
  'Myanmar (Burma)',
  'Namibia',
  'Nauru',
  'Nepal',
  'Netherlands',
  'New Zealand',
  'Nicaragua',
  'Niger',
  'Nigeria',
  'North Korea',
  'North Macedonia',
  'Norway',
  'Oman',
  'Pakistan',
  'Palau',
  'Panama',
  'Papua New Guinea',
  'Paraguay',
  'Peru',
  'Philippines',
  'Poland',
  'Portugal',
  'Qatar',
  'Romania',
  'Russia',
  'Rwanda',
  'Saint Kitts and Nevis',
  'Saint Lucia',
  'Saint Vincent and the Grenadines',
  'Samoa',
  'San Marino',
  'Sao Tome and Principe',
  'Saudi Arabia',
  'Senegal',
  'Serbia',
  'Seychelles',
  'Sierra Leone',
  'Singapore',
  'Slovakia',
  'Slovenia',
  'Solomon Islands',
  'Somalia',
  'South Africa',
  'South Korea',
  'South Sudan',
  'Spain',
  'Sri Lanka',
  'Sudan',
  'Suriname',
  'Sweden',
  'Switzerland',
  'Syria',
  'Taiwan',
  'Tajikistan',
  'Tanzania',
  'Thailand',
  'Timor-Leste',
  'Togo',
  'Tonga',
  'Trinidad and Tobago',
  'Tunisia',
  'Turkey',
  'Turkmenistan',
  'Tuvalu',
  'Uganda',
  'Ukraine',
  'United Arab Emirates',
  'United Kingdom',
  'United States',
  'Uruguay',
  'Uzbekistan',
  'Vanuatu',
  'Vatican City',
  'Venezuela',
  'Vietnam',
  'Yemen',
  'Zambia',
  'Zimbabwe',
];

const COUNTRY_SET = new Set(COUNTRIES.map((c) => c.toLowerCase()));

// The "Information for registrants" text the guest confirms. The version is
// saved with the registration (guests.notice_version); the database stamps the
// time itself (migration 042). It is the same notice and version as in the
// app, so change the text and the version there and here together.
const REGISTRANT_NOTICE_VERSION = '2026-10-13';

const REGISTRANT_NOTICE = {
  en: {
    toggle: 'Lietuviškai',
    title: 'Information for registrants',
    data: 'The personal data you provide when registering is processed to register participants and to organise and keep records of activities. The data controller is Vilnius University. The data is processed in accordance with the General Data Protection Regulation and other applicable laws.',
    photo: 'Activities may be photographed and filmed. Photos and videos may be used to document the project, to report on it and to publicise it.',
    more: 'More about how personal data is processed',
    href: '/privacy?lang=en',
    checkbox: 'I have read this information',
  },
  lt: {
    toggle: 'English',
    title: 'Informacija besiregistruojantiems',
    data: 'Registracijos metu pateikti asmens duomenys tvarkomi dalyvių registracijos, veiklų organizavimo ir apskaitos tikslais. Asmens duomenų valdytojas – Vilniaus universitetas. Duomenys tvarkomi vadovaujantis Bendruoju duomenų apsaugos reglamentu ir kitais galiojančiais teisės aktais.',
    photo: 'Veiklų metu gali būti fotografuojama ir filmuojama. Vaizdo medžiaga gali būti naudojama projekto dokumentavimo, atsiskaitymo ir viešinimo tikslais.',
    more: 'Išsamiau apie asmens duomenų tvarkymą',
    href: '/privacy?lang=lt',
    checkbox: 'Susipažinau su pateikta informacija',
  },
};

export default function GuestRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    country: '',
    affiliation: '',
    noticeAccepted: false,
    termsAccepted: false,
    marketingOptIn: false,
  });
  const [noticeLang, setNoticeLang] = useState('en');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const notice = REGISTRANT_NOTICE[noticeLang];

  const handleChange = (e) => {
    const { name, type, checked, value } = e.target;
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!form.noticeAccepted) {
        throw new Error('Please tick the box to confirm that you have read the information.');
      }

      if (!form.termsAccepted) {
        throw new Error('You must agree to the Terms to continue.');
      }

      const countryInput = form.country.trim();
      if (!COUNTRY_SET.has(countryInput.toLowerCase())) {
        throw new Error('Please select a country from the list.');
      }

      const { error: insertError } = await supabase
        .from('guests')
        .insert([{
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim().toLowerCase(),
          country: countryInput,
          affiliation: form.affiliation.trim(),
          terms_accepted: true,
          marketing_opt_in: form.marketingOptIn,
          notice_version: REGISTRANT_NOTICE_VERSION,
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
                placeholder="Start typing to search..."
                list="country-list"
                className="w-full px-4 py-3 rounded-[16px] border border-transparent bg-[#DCDCDC]/40 text-[#414141] font-medium placeholder:text-[#414141]/40 focus:outline-none focus:ring-2 focus:ring-[#78003F] focus:bg-[#DCDCDC]/30 transition-all"
              />
              <datalist id="country-list">
                {COUNTRIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
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

            <div
              lang={noticeLang}
              className="bg-[#DCDCDC]/20 rounded-[16px] border border-[#DCDCDC]/60 p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-extrabold text-[#414141] pt-1">
                  {notice.title}
                </h3>
                <button
                  type="button"
                  lang={noticeLang === 'en' ? 'lt' : 'en'}
                  onClick={() => setNoticeLang(noticeLang === 'en' ? 'lt' : 'en')}
                  className="shrink-0 px-3 py-1 rounded-full border border-[#DCDCDC] bg-[#FFFFFF] text-xs font-bold text-[#78003F] hover:border-[#78003F]/40 transition-colors"
                >
                  {notice.toggle}
                </button>
              </div>
              <p className="text-sm font-medium text-[#414141]/80 leading-relaxed">
                {notice.data}
              </p>
              <p className="text-sm font-medium text-[#414141]/80 leading-relaxed">
                {notice.photo}
              </p>
              <a
                href={notice.href}
                target="_blank"
                rel="noreferrer"
                className="inline-block text-sm font-semibold text-[#78003F] hover:underline"
              >
                {notice.more}
              </a>

              <label className="flex items-start gap-3 select-none pt-1">
                <input
                  type="checkbox"
                  name="noticeAccepted"
                  checked={form.noticeAccepted}
                  onChange={handleChange}
                  className="mt-1 h-5 w-5 rounded border-[#DCDCDC] text-[#78003F] focus:ring-[#78003F]"
                  required
                />
                <span className="text-sm font-semibold text-[#414141]/90 leading-relaxed">
                  {notice.checkbox}
                </span>
              </label>
            </div>

            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 select-none">
                <input
                  type="checkbox"
                  name="termsAccepted"
                  checked={form.termsAccepted}
                  onChange={handleChange}
                  className="mt-1 h-5 w-5 rounded border-[#DCDCDC] text-[#78003F] focus:ring-[#78003F]"
                  required
                />
                <span className="text-sm font-semibold text-[#414141]/90 leading-relaxed">
                  I agree to the{' '}
                  <a
                    href="/terms"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#78003F] hover:underline"
                  >
                    Terms of Use
                  </a>{' '}
                  and{' '}
                  <a
                    href="/privacy"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#78003F] hover:underline"
                  >
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>

              <label className="flex items-start gap-3 select-none">
                <input
                  type="checkbox"
                  name="marketingOptIn"
                  checked={form.marketingOptIn}
                  onChange={handleChange}
                  className="mt-1 h-5 w-5 rounded border-[#DCDCDC] text-[#78003F] focus:ring-[#78003F]"
                />
                <span className="text-sm font-semibold text-[#414141]/80 leading-relaxed">
                  I want to receive emails and updates.
                </span>
              </label>
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
