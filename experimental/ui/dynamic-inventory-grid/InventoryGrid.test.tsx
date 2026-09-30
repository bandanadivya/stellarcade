import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InventoryGrid } from './InventoryGrid';
import { InventoryItem, SlotType } from './types';

const items: InventoryItem[] = [
  {
    id: 'kora-frame',
    name: 'Kora Avatar Frame',
    icon: '🖼️',
    slot: 'avatarFrame',
    rarity: 'Rare',
    description: 'A polished frame for your guild avatar.',
    lore: 'Forged in the moonlit forge for the first rank battlers.',
    edition: 12,
    stats: ['+4 style', '+2 flair', '+1 social boost'],
  },
  {
    id: 'ember-dice',
    name: 'Ember Dice Skin',
    icon: '🎲',
    slot: 'diceSkin',
    rarity: 'Epic',
    description: 'Crystal dice with a blazing edge.',
    lore: 'The dice still glow with the heat of a dying comet.',
    edition: 7,
    stats: ['+5 crit sparkle', '+2 lucky trail'],
  },
  {
    id: 'moon-board',
    name: 'Moonlit Board Theme',
    icon: '🪐',
    slot: 'boardTheme',
    rarity: 'Legendary',
    description: 'A dreamy board treatment.',
    lore: 'The moon reflects across the table while the stars hum a tune.',
    edition: 51,
    stats: ['+6 elegance', '+3 galaxy drift'],
  },
  {
    id: 'echo-sound',
    name: 'Echo Sound Pack',
    icon: '🔊',
    slot: 'victorySoundFx',
    rarity: 'Common',
    description: 'A basic but dependable sound set.',
    lore: 'Low hums and bright chimes for modest victories.',
    edition: 99,
    stats: ['+1 volume', '+1 clarity'],
  },
];

describe('InventoryGrid', () => {
  it('renders items with correct rarity styling', () => {
    render(
      <InventoryGrid
        items={items}
        equippedSlots={{
          avatarFrame: null,
          diceSkin: null,
          boardTheme: null,
          victorySoundFx: null,
        }}
        onEquip={vi.fn()}
        onUnequip={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: /inspect kora avatar frame/i });
    expect(button).toHaveClass('border-blue-400');
  });

  it('selects item and clicking equip calls onEquip callback', () => {
    const onEquip = vi.fn();

    render(
      <InventoryGrid
        items={items}
        equippedSlots={{
          avatarFrame: null,
          diceSkin: null,
          boardTheme: null,
          victorySoundFx: null,
        }}
        onEquip={onEquip}
        onUnequip={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /inspect kora avatar frame/i }));
    fireEvent.click(screen.getByRole('button', { name: /equip to avatar frame/i }));

    expect(onEquip).toHaveBeenCalledWith(items[0], 'avatarFrame');
  });

  it('unequipping removes item from target socket', () => {
    const onUnequip = vi.fn();

    render(
      <InventoryGrid
        items={items}
        equippedSlots={{
          avatarFrame: items[0],
          diceSkin: null,
          boardTheme: null,
          victorySoundFx: null,
        }}
        onEquip={vi.fn()}
        onUnequip={onUnequip}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /unequip avatar frame/i }));

    expect(onUnequip).toHaveBeenCalledWith('avatarFrame');
  });
});
