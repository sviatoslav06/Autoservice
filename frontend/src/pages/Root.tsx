import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Header } from '../components/Header';
import { AuthModal } from '../components/AuthModal';

const RootContent: React.FC = () => {
  const { user, token } = useAuth();
  const [showAuthModal, setShowAuthModal] = React.useState(false);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!token) {
      setShowAuthModal(true);
    } else {
      setShowAuthModal(false);
    }
  }, [token]);

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
  };

  const handleAuthModalClose = () => {
    if (!token) return;
    setShowAuthModal(false);
  };

  if (!token) {
    return <AuthModal isOpen={showAuthModal} onClose={handleAuthModalClose} onSuccess={handleAuthSuccess} />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main className="pt-16">
        <Outlet />
      </main>
    </div>
  );
};

export const Root: React.FC = () => {
  return (
    <RootContent />
  );
};
