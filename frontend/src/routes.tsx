import { createBrowserRouter, Navigate } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Root } from './pages/Root';
import { MyVehicles } from './pages/MyVehicles';
import { BookingFlow } from './pages/BookingFlow';
import { MyOrders } from './pages/MyOrders';
import { ManagerOrders } from './pages/ManagerOrders';
import { MechanicWorkplace } from './pages/MechanicWorkplace';
import { Analytics } from './pages/Analytics';
import { Finance } from './pages/Finance';
import { Admin } from './pages/Admin';
import { Profile } from './pages/Profile';
import { ManagerParts } from './pages/ManagerParts';
import { ManagerServices } from './pages/ManagerServices';
import { ManagerBays } from './pages/ManagerBays';
import { DataImport } from './pages/DataImport';

// Захищений маршрут
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token } = useAuth();
  return token ? <>{children}</> : <Navigate to="/login" />;
};

const RoleRoute = ({
  children,
  roles
}: {
  children: React.ReactNode;
  roles: Array<'Client' | 'Manager' | 'Mechanic' | 'Accountant' | 'Admin'>;
}) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  return roles.includes(user.role) ? <>{children}</> : <Navigate to="/" />;
};

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Root />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'my-vehicles', element: <MyVehicles /> },
      { path: 'my-orders', element: <MyOrders /> },
      { path: 'booking', element: <BookingFlow /> },
      { path: 'manager/orders', element: <ManagerOrders /> },
      { path: 'manager/parts', element: <ManagerParts /> },
      { path: 'manager/services', element: <ManagerServices /> },
      { path: 'manager/bays', element: <ManagerBays /> },
      {
        path: 'analytics',
        element: (
          <RoleRoute roles={['Admin', 'Accountant']}>
            <Analytics />
          </RoleRoute>
        )
      },
      { path: 'finance', element: <Finance /> },
      { path: 'admin', element: <RoleRoute roles={['Admin']}><Admin /></RoleRoute> },
      { path: 'admin/data-import', element: <RoleRoute roles={['Admin']}><DataImport /></RoleRoute> },
      { path: 'profile', element: <Profile /> },
      { path: 'mechanic/workplace', element: <MechanicWorkplace /> }
    ],
  },
]);
