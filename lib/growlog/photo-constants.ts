/**
 * ADR-010: единая версия анализа и лимиты для vision-воркера / retrieval.
 * Меняя версию, добавьте миграцию или backfill под новую схему сигналов.
 */
export const DEFAULT_PHOTO_ANALYSIS_VERSION = 'v1';

/** Дефолтный лимит (20 MiB); совпадает с сервером, если env не заданы. */
export const DEFAULT_MAX_PHOTO_BYTES_VISION = 20 * 1024 * 1024;

const parsedServerMax = Number(process.env.GROWLOG_MAX_PHOTO_BYTES_VISION ?? '');
/** Worker / server: `GROWLOG_MAX_PHOTO_BYTES_VISION`. */
export const MAX_PHOTO_BYTES_VISION =
  Number.isFinite(parsedServerMax) && parsedServerMax > 0
    ? parsedServerMax
    : DEFAULT_MAX_PHOTO_BYTES_VISION;

/**
 * Клиент (браузер): в бандл попадает только `NEXT_PUBLIC_*`.
 * Для совпадения с воркером задайте то же значение, что и `GROWLOG_MAX_PHOTO_BYTES_VISION`.
 */
export function getMaxPhotoBytesVisionClient(): number {
  const n = Number(process.env.NEXT_PUBLIC_GROWLOG_MAX_PHOTO_BYTES_VISION ?? '');
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MAX_PHOTO_BYTES_VISION;
}

export function formatPhotoSizeLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${Math.round(bytes / (1024 * 1024))} МБ`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} КБ`;
  }
  return `${bytes} Б`;
}
