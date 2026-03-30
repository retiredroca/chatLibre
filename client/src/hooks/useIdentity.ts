import { useState, useCallback } from 'react';
import { useIdentityStore, Identity } from '../stores/identityStore';

export interface RecoveryInfo {
  mnemonic: string;
  public_key: string;
  user_id: string;
}

function generateSecureId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
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
        public_key: `pk_${Date.now()}_${generateSecureId()}`,
        user_id: `u_${Date.now()}_${generateSecureId().slice(0, 8)}`,
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
        public_key: `pk_${Date.now()}_${generateSecureId()}`,
        user_id: `u_${Date.now()}_${generateSecureId().slice(0, 8)}`,
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
