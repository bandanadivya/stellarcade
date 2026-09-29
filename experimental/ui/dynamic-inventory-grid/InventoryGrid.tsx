import * as React from 'react';

import { InventoryGridProps, InventoryItem, SlotType } from './types';

const SLOT_LABELS: Record<SlotType, string> = {
  avatarFrame: 'Avatar Frame',
  diceSkin: 'Dice Skin',
  boardTheme: 'Board Theme',
  victorySoundFx: 'Victory Sound FX',
};

const SLOT_ORDER: SlotType[] = [
  'avatarFrame',
  'diceSkin',
  'boardTheme',
  'victorySoundFx',
];

const RARITY_STYLES: Record<InventoryItem['rarity'], string> = {
  Common: 'border-slate-400/80 bg-slate-900/40 text-slate-100',
  Rare: 'border-blue-400/80 bg-blue-950/40 text-blue-100',
  Epic: 'border-violet-400/80 bg-violet-950/40 text-violet-100',
  Legendary: 'border-amber-400/80 bg-amber-950/30 text-amber-100',
};

const rarityGlow: Record<InventoryItem['rarity'], string> = {
  Common: 'shadow-slate-500/20',
  Rare: 'shadow-blue-500/20',
  Epic: 'shadow-violet-500/20',
  Legendary: 'shadow-amber-500/20',
};

function getItemById(items: InventoryItem[], id: string | null) {
  return items.find((item) => item.id === id) ?? null;
}

export function InventoryGrid({
  items,
  equippedSlots,
  onEquip,
  onUnequip,
}: InventoryGridProps) {
  const [selectedItemId, setSelectedItemId] = React.useState<string | null>(
    items[0]?.id ?? null
  );
  const [inspectId, setInspectId] = React.useState<string | null>(
    items[0]?.id ?? null
  );
  const [activeSlot, setActiveSlot] = React.useState<SlotType>('avatarFrame');

  const selectedItem = getItemById(items, selectedItemId);
  const inspectItem = getItemById(items, inspectId) ?? selectedItem;

  const onEquipCurrent = () => {
    if (!selectedItem) return;
    onEquip(selectedItem, activeSlot);
  };

  const onUnequipCurrent = () => {
    onUnequip(activeSlot);
  };

  return (
    <div className="w-full max-w-6xl rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-slate-100 shadow-2xl shadow-slate-950/40">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
            Loadout
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            Cosmetic Inventory
          </h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {SLOT_ORDER.map((slot) => {
            const equipped = equippedSlots[slot];
            const isActive = slot === activeSlot;

            return (
              <button
                key={slot}
                type="button"
                onClick={() => setActiveSlot(slot)}
                className={[
                  'min-w-[170px] rounded-xl border px-3 py-2 text-left transition',
                  isActive
                    ? 'border-white/40 bg-white/10'
                    : 'border-slate-700 bg-slate-900/70 hover:border-slate-500',
                ].join(' ')}
                aria-label={`Select ${SLOT_LABELS[slot]} socket`}
              >
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  {SLOT_LABELS[slot]}
                </div>
                <div className="mt-1 text-sm font-medium text-white">
                  {equipped ? equipped.name : 'Empty socket'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Bag</h3>
            <span className="text-sm text-slate-400">
              {items.length} owned items
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => {
              const isSelected = selectedItemId === item.id;
              const isEquipped = Object.values(equippedSlots).some(
                (equipped) => equipped?.id === item.id
              );

              return (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Inspect ${item.name}`}
                  onMouseEnter={() => setInspectId(item.id)}
                  onFocus={() => setInspectId(item.id)}
                  onMouseLeave={() => setInspectId(selectedItemId)}
                  onBlur={() => setInspectId(selectedItemId)}
                  onClick={() => {
                    setSelectedItemId(item.id);
                    setInspectId(item.id);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelectedItemId(item.id);
                      setInspectId(item.id);
                    }
                  }}
                  className={[
                    'group relative flex min-h-[150px] flex-col items-start justify-between rounded-2xl border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-white/40',
                    RARITY_STYLES[item.rarity],
                    rarityGlow[item.rarity],
                    isSelected ? 'ring-2 ring-white/90 ring-offset-2 ring-offset-slate-950' : '',
                    isEquipped ? 'opacity-100' : '',
                  ].join(' ')}
                >
                  <div className="flex w-full items-center justify-between">
                    <span className="text-3xl">{item.icon}</span>
                    <span className="rounded-full border border-white/15 bg-black/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-slate-200">
                      {item.rarity}
                    </span>
                  </div>

                  <div className="w-full">
                    <div className="text-base font-semibold text-white">
                      {item.name}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-slate-300">
                      {item.slot === 'avatarFrame'
                        ? 'Avatar'
                        : item.slot === 'diceSkin'
                          ? 'Dice'
                          : item.slot === 'boardTheme'
                            ? 'Board'
                            : 'Audio'}
                    </div>
                  </div>

                  <div className="mt-2 flex w-full items-center justify-between text-[11px] text-slate-200">
                    <span>#{item.edition}</span>
                    <span>{isEquipped ? 'Equipped' : 'Owned'}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="mb-3">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
              Inspect
            </p>
            <h3 className="mt-2 text-xl font-semibold text-white">
              {inspectItem ? inspectItem.name : 'No item selected'}
            </h3>
          </div>

          {inspectItem ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-4xl">{inspectItem.icon}</div>
                <div
                  className={[
                    'rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.2em]',
                    RARITY_STYLES[inspectItem.rarity],
                  ].join(' ')}
                >
                  {inspectItem.rarity}
                </div>
              </div>

              <p className="text-sm leading-6 text-slate-300">
                {inspectItem.lore}
              </p>

              <div className="mt-4 grid gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Edition</span>
                  <span className="font-medium text-white">
                    #{inspectItem.edition}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Slot</span>
                  <span className="font-medium text-white">
                    {SLOT_LABELS[inspectItem.slot]}
                  </span>
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                  Stats
                </p>
                <ul className="space-y-2 text-sm text-slate-200">
                  {inspectItem.stats.map((stat) => (
                    <li key={stat} className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-sky-400" />
                      {stat}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={onEquipCurrent}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onEquipCurrent();
                    }
                  }}
                  className="rounded-xl bg-white px-4 py-2.5 font-medium text-slate-900 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-white/60"
                  aria-label={`Equip to ${SLOT_LABELS[activeSlot]}`}
                >
                  Equip to {SLOT_LABELS[activeSlot]}
                </button>

                <button
                  type="button"
                  onClick={onUnequipCurrent}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onUnequipCurrent();
                    }
                  }}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 font-medium text-slate-100 hover:border-slate-500 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
                  aria-label={`Unequip ${SLOT_LABELS[activeSlot]}`}
                >
                  Unequip {SLOT_LABELS[activeSlot]}
                </button>
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
