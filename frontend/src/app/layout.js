import './globals.css';
import { AuthProvider } from '../hooks/useAuth.js';
import { ToastProvider } from '../components/ui/Toast.js';

export const metadata = {
  title: 'CRM — Sales Dashboard',
  description: 'Internal Sales CRM Platform',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
