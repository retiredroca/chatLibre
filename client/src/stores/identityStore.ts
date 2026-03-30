import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface Identity {
  publicKey: string;
  userId: string;
  hasIdentity: boolean;
  isLoading: boolean;
  error: string | null;
}

interface IdentityActions {
  setIdentity: (identity: Partial<Identity>) => void;
  clearIdentity: () => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  loadExistingIdentity: () => Promise<Identity | null>;
}

type IdentityState = Identity;

const initialState: IdentityState = {
  publicKey: '',
  userId: '',
  hasIdentity: false,
  isLoading: false,
  error: null,
};

export const useIdentityStore = create<IdentityState & IdentityActions>()(
  persist(
    (set) => ({
      ...initialState,
      
      setIdentity: (identity) =>
        set((state) => ({
          ...state,
          ...identity,
          error: null,
        })),
      
      clearIdentity: () =>
        set({
          ...initialState,
        }),
      
      setIsLoading: (loading) =>
        set((state) => ({
          ...state,
          isLoading: loading,
        })),
      
      setError: (error) =>
        set((state) => ({
          ...state,
          error,
          isLoading: false,
        })),

      loadExistingIdentity: async () => {
        try {
          const stored = localStorage.getItem('chatlibre-identity');
          if (stored) {
            const parsed = JSON.parse(stored);
            return {
              publicKey: parsed.state?.publicKey || '',
              userId: parsed.state?.userId || '',
              hasIdentity: parsed.state?.hasIdentity || false,
              isLoading: false,
              error: null,
            };
          }
          return null;
        } catch {
          return null;
        }
      },
    }),
    {
      name: 'chatlibre-identity',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        publicKey: state.publicKey,
        userId: state.userId,
        hasIdentity: state.hasIdentity,
      }),
    }
  )
);
