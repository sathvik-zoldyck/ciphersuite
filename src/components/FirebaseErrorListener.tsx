'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import type { FirestorePermissionError } from '@/firebase/errors';

// This component is designed to be placed at the root of the application.
// It listens for 'permission-error' events from the global errorEmitter.
// When an error is caught, it throws it. In a Next.js development environment,
// this will trigger the development overlay, displaying the rich, contextual
// error message from FirestorePermissionError. This provides immediate,
// actionable feedback for developers working on security rules.
// This component renders nothing and has no effect in production.
export function FirebaseErrorListener() {
  useEffect(() => {
    // Handler for the 'permission-error' event.
    const handleError = (error: FirestorePermissionError) => {
      // Throwing the error will cause Next.js to display its error overlay.
      throw error;
    };

    // Subscribe to the event when the component mounts.
    // The `on` method returns an unsubscribe function.
    const unsubscribe = errorEmitter.on('permission-error', handleError);

    // Return the unsubscribe function to be called on component unmount.
    return unsubscribe;
  }, []);

  // This component does not render any UI.
  return null;
}
