'use client';
import { usePathname } from 'next/navigation';
import ErrorBoundary from './ErrorBoundary.js';

export default function RouteErrorBoundary({ children }) {
  const pathname = usePathname();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}
