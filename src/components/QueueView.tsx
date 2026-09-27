import React from 'react';
import {
  Language,
  QueueItem,
  QueueMember,
  QuickItem,
  GeneralItem,
  User,
  DiamondVaultRecord,
  QueueAnnouncementSettings
} from '../types';
import { GeneralItemQueueCard } from './GeneralItemQueueCard';

interface QueueViewProps {
  lang: Language;
  currentUser: User | null;
  allMembers: User[];
  queueItems?: QueueItem[];
  quickItems?: QuickItem[];
  generalItems?: GeneralItem[];
  queueAnnouncement?: QueueAnnouncementSettings | null;
  onSaveQueueAnnouncement?: (settings: QueueAnnouncementSettings) => Promise<void>;
  onAddGeneralItem?: (item: Omit<GeneralItem, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateGeneralItem?: (id: string, updates: Partial<Omit<GeneralItem, 'id' | 'createdAt'>>) => Promise<void>;
  onReorderGeneralItem?: (items: GeneralItem[]) => Promise<void>;
  onDeleteGeneralItem?: (id: string) => Promise<void>;
  onRecordDiamondLog?: (record: Omit<DiamondVaultRecord, 'id' | 'timestamp'>) => Promise<void>;
  onAddDistributedVaultItem?: (
    itemData: any,
    directDistribution?: any
  ) => Promise<void>;
  onOpenQuickItemsModal?: () => void;
  onCreateQueueItem?: (item: Omit<QueueItem, 'id' | 'createdAt'>) => Promise<void>;
  onDeleteQueueItem?: (queueId: string) => Promise<void>;
  onUpdateQueueMembers?: (queueId: string, members: QueueMember[]) => Promise<void>;
  onOpenOwnerResetModal?: () => void;
  onOpenAuth?: () => void;
  showToast?: (msg: string, type: 'info' | 'success' | 'warning' | 'error') => void;
  onViewImageZoom?: (url: string, title?: string) => void;
}

export const QueueView: React.FC<QueueViewProps> = ({
  lang,
  currentUser,
  allMembers,
  quickItems,
  generalItems,
  onAddGeneralItem,
  onUpdateGeneralItem,
  onReorderGeneralItem,
  onDeleteGeneralItem,
  onRecordDiamondLog,
  onAddDistributedVaultItem,
  showToast,
  onViewImageZoom
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div id="item-queue-main">
        <GeneralItemQueueCard
          lang={lang}
          currentUser={currentUser}
          items={generalItems || []}
          quickItems={quickItems}
          allMembers={allMembers}
          onAdd={onAddGeneralItem || (async () => {})}
          onUpdate={onUpdateGeneralItem || (async () => {})}
          onReorder={onReorderGeneralItem}
          onDelete={onDeleteGeneralItem || (async () => {})}
          onRecordDiamondLog={onRecordDiamondLog}
          onAddDistributedVaultItem={onAddDistributedVaultItem}
          onViewImageZoom={onViewImageZoom}
          showToast={showToast}
        />
      </div>
    </div>
  );
};
