import { useState } from 'react';
import { useIdentity } from '../hooks/useIdentity';
import { useServerStore } from '../stores/serverStore';

export function Onboarding() {
  const { generateIdentity, importFromRecovery, isLoading, error, recoveryInfo } = useIdentity();
  const { addServer, connect } = useServerStore();
  const [activeTab, setActiveTab] = useState<'create' | 'import'>('create');
  const [mnemonicInput, setMnemonicInput] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);
  const [serverUrl, setServerUrl] = useState('');

  const handleCreate = async () => {
    await generateIdentity();
    setShowRecovery(true);
  };

  const handleImport = async () => {
    const words = mnemonicInput.trim().split(/\s+/);
    if (words.length !== 24) {
      alert('Please enter all 24 words of your recovery phrase');
      return;
    }
    
    await importFromRecovery(mnemonicInput.trim());
    setShowRecovery(true);
  };

  const handleConnect = async () => {
    if (!serverUrl) return;
    
    try {
      await connect(serverUrl);
      addServer({
        id: serverUrl,
        url: serverUrl,
        name: new URL(serverUrl).hostname,
        publicKey: '',
        isTrusted: false,
        memberCount: 1,
        iconColor: '#5865F2',
      });
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  };

  if (!showRecovery && !recoveryInfo) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
        <div className="bg-[#161B22] p-8 rounded-lg max-w-md w-full">
          <h1 className="text-2xl font-bold text-[#E6EDF3] mb-6">Welcome to chatLibre</h1>
          
          <div className="flex mb-6">
            <button
              onClick={() => setActiveTab('create')}
              className={`flex-1 py-2 ${
                activeTab === 'create' 
                  ? 'border-b-2 border-[#58A6FF] text-[#E6EDF3]' 
                  : 'text-[#8B949E]'
              }`}
            >
              Create Identity
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`flex-1 py-2 ${
                activeTab === 'import' 
                  ? 'border-b-2 border-[#58A6FF] text-[#E6EDF3]' 
                  : 'text-[#8B949E]'
              }`}
            >
              Import Identity
            </button>
          </div>

          {activeTab === 'create' ? (
            <div>
              <p className="text-[#8B949E] mb-4">
                Your identity will be a cryptographic keypair. The private key will be 
                generated locally and never leaves your device.
              </p>
              <button
                onClick={handleCreate}
                disabled={isLoading}
                className="w-full bg-[#238636] hover:bg-[#2EA043] text-white py-3 rounded font-medium disabled:opacity-50"
              >
                {isLoading ? 'Generating...' : 'Generate Identity'}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-[#8B949E] mb-4">
                Enter your 24-word recovery phrase to restore your identity.
              </p>
              <textarea
                value={mnemonicInput}
                onChange={(e) => setMnemonicInput(e.target.value)}
                placeholder="word1 word2 word3 ... word24"
                className="w-full bg-[#0D1117] text-[#E6EDF3] p-3 rounded border border-[#30363D] mb-4 font-mono text-sm h-24"
              />
              <button
                onClick={handleImport}
                disabled={isLoading}
                className="w-full bg-[#238636] hover:bg-[#2EA043] text-white py-3 rounded font-medium disabled:opacity-50"
              >
                {isLoading ? 'Importing...' : 'Import Identity'}
              </button>
            </div>
          )}

          {error && (
            <p className="text-[#F85149] mt-4">{error}</p>
          )}
        </div>
      </div>
    );
  }

  if (showRecovery && recoveryInfo) {
    return (
      <div className="min-h-screen bg-[#0D1117] flex items-center justify-center">
        <div className="bg-[#161B22] p-8 rounded-lg max-w-md w-full">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🔑</span>
            <h1 className="text-xl font-bold text-[#E6EDF3]">Save Your Recovery Phrase</h1>
          </div>
          
          <div className="bg-[#0D1117] p-4 rounded border border-[#F85149] mb-4">
            <p className="text-[#F85149] font-medium mb-2">⚠️ Critical Security Information</p>
            <p className="text-[#8B949E] text-sm mb-4">
              This is your ONLY way to recover your account. Write it down and store it 
              securely. If you lose this phrase, your account cannot be recovered.
            </p>
          </div>

          <div className="bg-[#0D1117] p-4 rounded border border-[#30363D] mb-4">
            <div className="grid grid-cols-3 gap-2">
              {recoveryInfo.mnemonic.split(' ').map((word, i) => (
                <div key={i} className="flex items-center gap-1 text-sm">
                  <span className="text-[#8B949E]">{i + 1}.</span>
                  <span className="text-[#E6EDF3] font-mono">{word}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-[#8B949E] text-sm mb-2">
              Server URL (optional)
            </label>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="wss://your-server.com/ws"
              className="w-full bg-[#0D1117] text-[#E6EDF3] p-3 rounded border border-[#30363D]"
            />
          </div>

          <button
            onClick={handleConnect}
            className="w-full bg-[#58A6FF] hover:bg-[#79B8FF] text-white py-3 rounded font-medium"
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  return null;
}
