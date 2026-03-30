import { useState, useCallback } from 'react';
import { useIdentityStore, Identity } from '../stores/identityStore';

export interface RecoveryInfo {
  mnemonic: string;
  public_key: string;
  user_id: string;
}

export function useIdentity() {
  const { 
    publicKey,
    userId,
    hasIdentity,
    setIdentity,
    isLoading,
    setIsLoading,
    error,
    setError,
    loadExistingIdentity: loadFromStore
  } = useIdentityStore();
  
  const [recoveryInfo, setRecoveryInfo] = useState<RecoveryInfo | null>(null);

  const generateIdentity = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result: RecoveryInfo = {
        mnemonic: 'sample recovery phrase for demo',
        public_key: `pk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: `u_${Date.now()}`,
      };
      setRecoveryInfo(result);
      setIdentity({
        publicKey: result.public_key,
        userId: result.user_id,
        hasIdentity: true,
      });
      return result;
    } catch (err) {
      setError(String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setIdentity, setIsLoading, setError]);

  const importFromRecovery = useCallback(async (mnemonic: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result: RecoveryInfo = {
        mnemonic,
        public_key: `pk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: `u_${Date.now()}`,
      };
      setRecoveryInfo(result);
      setIdentity({
        publicKey: result.public_key,
        userId: result.user_id,
        hasIdentity: true,
      });
      return result;
    } catch (err) {
      setError(String(err));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [setIdentity, setIsLoading, setError]);

  const loadExistingIdentity = useCallback(async () => {
    const existing = await loadFromStore();
    if (existing) {
      setIdentity({
        publicKey: existing.publicKey,
        userId: existing.userId,
        hasIdentity: existing.hasIdentity,
      });
    }
    return existing;
  }, [loadFromStore, setIdentity]);

  return {
    identity: { publicKey, userId, hasIdentity } as Identity,
    recoveryInfo,
    isLoading,
    error,
    generateIdentity,
    importFromRecovery,
    loadExistingIdentity,
  };
}

export function usePublicKey() {
  const { publicKey } = useIdentityStore();
  return publicKey || '';
}
