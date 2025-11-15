import React, { useState } from 'react';
import VisaoListPage from './VisaoListPage';
import VisaoEditPage from './VisaoEditPage';

const VisaoPage: React.FC = () => {
  const [editingVisaoId, setEditingVisaoId] = useState<string | 'new' | null>(null);

  const handleEdit = (id: string) => {
    setEditingVisaoId(id);
  };

  const handleAddNew = () => {
    setEditingVisaoId('new');
  };
  
  const handleBack = () => {
    setEditingVisaoId(null);
  };

  if (editingVisaoId) {
    return <VisaoEditPage visaoId={editingVisaoId} onBack={handleBack} />;
  }

  return <VisaoListPage onEditVisao={handleEdit} onAddNew={handleAddNew} />;
};

export default VisaoPage;
