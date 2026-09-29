# Dynamic Inventory Grid

A compact cosmetic inventory for the experimental UI workspace. Players can browse owned items, inspect their lore, and equip them into loadout sockets.

## Features

- 4-slot equipment area:
  - Avatar Frame
  - Dice Skin
  - Board Theme
  - Victory Sound FX
- 4x4 style bag grid for owned cosmetics
- Rarity borders:
  - Common: gray
  - Rare: blue
  - Epic: purple
  - Legendary: gold
- Hover/focus inspection panel with lore, edition, and stats
- Keyboard support with Enter/Space to inspect and equip
- Active socket selection for loadout updates

## Props

```tsx
type SlotType =
  | 'avatarFrame'
  | 'diceSkin'
  | 'boardTheme'
  | 'victorySoundFx';

type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

interface InventoryItem {
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

interface InventoryGridProps {
  items: InventoryItem[];
  equippedSlots: Record<SlotType, InventoryItem | null>;
  onEquip: (item: InventoryItem, slot: SlotType) => void;
  onUnequip: (slot: SlotType) => void;
}
```

## Example

```tsx
<InventoryGrid
  items={items}
  equippedSlots={equippedSlots}
  onEquip={(item, slot) => {
    console.log('equipped', item.name, slot);
  }}
  onUnequip={(slot) => {
    console.log('unequipped', slot);
  }}
/>
```
