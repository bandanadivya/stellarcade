export type SlotType =
  | 'avatarFrame'
  | 'diceSkin'
  | 'boardTheme'
  | 'victorySoundFx';

export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

export interface InventoryItem {
  id: string;
  name: string;
  icon: string;
  slot: SlotType;
  rarity: Rarity;
  description: string;
  lore: string;
  edition: number;
  stats: string[];
}

export interface InventoryGridProps {
  items: InventoryItem[];
  equippedSlots: Record<SlotType, InventoryItem | null>;
  onEquip: (item: InventoryItem, slot: SlotType) => void;
  onUnequip: (slot: SlotType) => void;
}
