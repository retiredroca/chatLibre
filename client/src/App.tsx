import { useEffect } from 'react';
import { useIdentityStore } from './stores/identityStore';
import { Onboarding } from './pages/Onboarding';
import { MainLayout } from './components/Layout/MainLayout';

function App() {
  const { hasIdentity, loadExistingIdentity } = useIdentityStore();

  useEffect(() => {
    loadExistingIdentity();
  }, [loadExistingIdentity]);

  if (!hasIdentity) {
    return <Onboarding />;
  }

  return <MainLayout />;
}

export default App;
