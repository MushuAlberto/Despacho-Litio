import { useEffect, useState } from 'react';
import { flushOutboxQueue, OutboxMutationItem, subscribeOutbox } from '../services/offlineDb';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [outboxQueue, setOutboxQueue] = useState<OutboxMutationItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      flushOutboxQueue().catch(() => {});
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = subscribeOutbox((items, syncing) => {
      setOutboxQueue(items);
      setIsSyncing(syncing);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  const triggerSync = () => flushOutboxQueue();

  return {
    isOnline,
    outboxCount: outboxQueue.length,
    outboxQueue,
    isSyncing,
    triggerSync,
  };
}
