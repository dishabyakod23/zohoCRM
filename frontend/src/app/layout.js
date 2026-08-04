import './globals.css';
import { Inter } from 'next/font/google';
import { AuthProvider } from '../hooks/useAuth.js';
import { ToastProvider } from '../components/ui/Toast.js';
import RouteErrorBoundary from '../components/ui/RouteErrorBoundary.js';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata = {
  title: 'CRM — Sales Platform',
  description: 'Industry-standard Sales CRM',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans`}>
        <AuthProvider>
          <ToastProvider>
            <RouteErrorBoundary>{children}</RouteErrorBoundary>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
