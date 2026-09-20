import { createContext, useContext } from 'react';

// Value: { user, admin: { id, name, surname, university }, signOut(), isDemo }
// Provided by AdminGate once the administrator check has passed.
const AdminContext = createContext(null);

export const AdminProvider = AdminContext.Provider;

export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error('useAdmin must be used inside AdminGate');
  return value;
}
