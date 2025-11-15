
import React, { useState, useMemo } from 'react';

interface ShuttleItem {
  id: string;
  label: string;
}

interface ShuttleProps {
  items: ShuttleItem[];
  selectedIds: Set<string>;
  onChange: (newSelectedIds: Set<string>) => void;
  availableTitle?: string;
  selectedTitle?: string;
  height?: string;
}

const Shuttle: React.FC<ShuttleProps> = ({
  items,
  selectedIds,
  onChange,
  availableTitle = 'Disponíveis',
  selectedTitle = 'Selecionados',
  height = '300px'
}) => {
  const [availableFilter, setAvailableFilter] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('');
  const [highlightedAvailable, setHighlightedAvailable] = useState<Set<string>>(new Set());
  // FIX: Corrected typo in state setter from setSelectedSelected to setHighlightedSelected for consistency.
  const [highlightedSelected, setHighlightedSelected] = useState<Set<string>>(new Set());

  const { availableItems, selectedItems } = useMemo(() => {
    const available: ShuttleItem[] = [];
    const selected: ShuttleItem[] = [];
    items.forEach(item => {
      if (selectedIds.has(item.id)) {
        selected.push(item);
      } else {
        available.push(item);
      }
    });
    return { availableItems: available, selectedItems: selected };
  }, [items, selectedIds]);
  
  const filteredAvailable = useMemo(() => 
    availableItems.filter(item => item.label.toLowerCase().includes(availableFilter.toLowerCase())),
    [availableItems, availableFilter]
  );

  const filteredSelected = useMemo(() =>
    selectedItems.filter(item => item.label.toLowerCase().includes(selectedFilter.toLowerCase())),
    [selectedItems, selectedFilter]
  );

  const handleHighlight = (
    id: string,
    setter: React.Dispatch<React.SetStateAction<Set<string>>>
  ) => {
    setter(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };
  
  const moveItems = (direction: 'toSelected' | 'toAvailable') => {
    const newSelectedIds = new Set(selectedIds);
    if (direction === 'toSelected') {
      highlightedAvailable.forEach(id => newSelectedIds.add(id));
      setHighlightedAvailable(new Set());
    } else {
      highlightedSelected.forEach(id => newSelectedIds.delete(id));
      // FIX: Using the corrected state setter name. This resolves the error on line 75.
      setHighlightedSelected(new Set());
    }
    onChange(newSelectedIds);
  };
  
  const moveAllItems = (direction: 'toSelected' | 'toAvailable') => {
    if (direction === 'toSelected') {
        const allAvailableIds = availableItems.map(item => item.id);
        onChange(new Set([...selectedIds, ...allAvailableIds]));
    } else { // 'toAvailable'
        const selectedItemIds = new Set(selectedItems.map(i => i.id));
        const newSelectedIds = new Set([...selectedIds].filter(id => !selectedItemIds.has(id)));
        onChange(newSelectedIds);
    }
    setHighlightedAvailable(new Set());
    // FIX: Using the corrected state setter name. This resolves the error on line 90.
    setHighlightedSelected(new Set());
  };
  
  const ListBox = ({ title, items, filter, setFilter, highlighted, setHighlighted }: any) => (
    <div className="flex flex-col w-full bg-gray-900 border border-gray-700 rounded-md">
      <div className="p-2 border-b border-gray-700">
        <h3 className="font-semibold text-white">{title} ({items.length})</h3>
        <input
          type="text"
          placeholder="Buscar..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-2 py-1 mt-2 text-sm text-gray-200 bg-gray-800 border border-gray-600 rounded-md"
        />
      </div>
      <ul className="flex-1 overflow-y-auto" style={{ height }}>
        {items.map((item: ShuttleItem) => (
          <li
            key={item.id}
            onClick={() => handleHighlight(item.id, setHighlighted)}
            className={`px-3 py-2 text-sm cursor-pointer transition-colors duration-150 ${
              highlighted.has(item.id)
                ? 'bg-indigo-600 text-white'
                : 'text-gray-300 hover:bg-gray-700/50'
            }`}
          >
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="flex items-stretch gap-4">
      {/* Available List */}
      <ListBox
        title={availableTitle}
        items={filteredAvailable}
        filter={availableFilter}
        setFilter={setAvailableFilter}
        highlighted={highlightedAvailable}
        setHighlighted={setHighlightedAvailable}
      />

      {/* Action Buttons */}
      <div className="flex flex-col items-center justify-center gap-2 px-2">
        <button
          onClick={() => moveAllItems('toSelected')}
          disabled={availableItems.length === 0}
          className="p-2 text-gray-300 bg-gray-700 rounded-full hover:bg-indigo-600 hover:text-white disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
          aria-label="Move all to right"
          title="Mover Todos para Selecionados"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
        </button>
        <button
          onClick={() => moveItems('toSelected')}
          disabled={highlightedAvailable.size === 0}
          className="p-2 text-gray-300 bg-gray-700 rounded-full hover:bg-indigo-600 hover:text-white disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
          aria-label="Move selected to right"
          title="Mover Destaque"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
        <button
          onClick={() => moveItems('toAvailable')}
          disabled={highlightedSelected.size === 0}
          className="p-2 text-gray-300 bg-gray-700 rounded-full hover:bg-indigo-600 hover:text-white disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
          aria-label="Move selected to left"
          title="Remover Destaque"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
         <button
          onClick={() => moveAllItems('toAvailable')}
          disabled={selectedItems.length === 0}
          className="p-2 text-gray-300 bg-gray-700 rounded-full hover:bg-indigo-600 hover:text-white disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
          aria-label="Move all to left"
          title="Remover Todos dos Selecionados"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
        </button>
      </div>

      {/* Selected List */}
      <ListBox
        title={selectedTitle}
        items={filteredSelected}
        filter={selectedFilter}
        setFilter={setSelectedFilter}
        highlighted={highlightedSelected}
        setHighlighted={setHighlightedSelected}
      />
    </div>
  );
};

export default Shuttle;