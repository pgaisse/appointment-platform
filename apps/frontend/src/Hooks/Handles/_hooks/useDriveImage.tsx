import { useEffect, useState } from 'react';

interface UseDriveImageResult {
  imageUrl: string | null;
  loading: boolean;
  error: string | null;
}

export const useDriveImage = (fileId: string): UseDriveImageResult => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) return;

    const controller = new AbortController();

    const fetchImage = async () => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/image/${fileId}`, {
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);

        setImageUrl(objectUrl);
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          setError(err.message || 'Unknown error');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchImage();

    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl); // Limpia blob viejo
      controller.abort();
    };
  }, [fileId]);

  return { imageUrl, loading, error };
};
