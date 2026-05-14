import { useEffect } from 'react';
import api from '../services/api';

/**
 * Registers the browser's FCM token with the notification service.
 * 
 * Setup:
 * 1. Add Firebase web config to your project
 * 2. Import this component in App.tsx
 * 
 * For production: use firebase/messaging from firebase SDK
 * This is a lightweight registration hook that works with the backend FCM service.
 */

const FCM_TOKEN_KEY = 'iuh-fcm-token';

export function useFcmRegistration() {
  useEffect(() => {
    registerFcmToken();
  }, []);

  const registerFcmToken = async () => {
    try {
      // Check if Notification API is available (web push)
      if (!('Notification' in window)) {
        console.log('Push notifications not supported in this browser');
        return;
      }

      // Request permission
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.log('Notification permission denied');
          return;
        }
      }

      if (Notification.permission !== 'granted') return;

      // For web push, you'd normally use firebase/messaging here
      // to get the FCM token. This is a placeholder that stores
      // a registration marker.
      const existingToken = localStorage.getItem(FCM_TOKEN_KEY);
      if (existingToken) {
        // Token already registered
        return;
      }

      // In production, replace with:
      // import { getMessaging, getToken } from 'firebase/messaging';
      // const token = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' });
      
      // For now, register a web device marker
      const webDeviceId = `web-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      
      await api.post('/notifications/fcm/register', {
        token: webDeviceId,
        deviceType: 'web',
        deviceName: navigator.userAgent.substring(0, 100),
      });

      localStorage.setItem(FCM_TOKEN_KEY, webDeviceId);
      console.log('FCM registration successful');
    } catch (err) {
      console.warn('FCM registration failed:', err);
    }
  };
}

/**
 * Show a browser notification (in-app push).
 */
export function showBrowserNotification(title: string, body: string, url?: string) {
  if (Notification.permission !== 'granted') return;

  const notification = new Notification(title, {
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
  } as NotificationOptions & { vibrate?: number[] });

  notification.onclick = () => {
    window.focus();
    if (url) window.location.href = url;
    notification.close();
  };

  // Auto-close after 5s
  setTimeout(() => notification.close(), 5000);
}
