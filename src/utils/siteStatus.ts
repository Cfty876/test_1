export interface MaintenanceSettings {
  enabled: boolean;
  message: string;
  version: number;
  updatedAt?: string;
}
export interface SiteStatus extends MaintenanceSettings { canManage: boolean }
export const DEFAULT_MAINTENANCE_MESSAGE = 'Мы обновляем платформу и проверяем данные. Заявки, проекты и баллы сохранены. Пожалуйста, зайди немного позже.';
export const DEFAULT_MAINTENANCE: MaintenanceSettings = { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE, version: 0 };
