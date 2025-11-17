import React, { useState } from 'react';
import { TemplateListPage } from './TemplateListPage';
import TemplateEditPage from './TemplateEditPage';

const TemplatePage: React.FC = () => {
  const [editingTemplateId, setEditingTemplateId] = useState<string | 'new' | null>(null);

  const handleEditTemplate = (id: string) => {
    setEditingTemplateId(id);
  };

  const handleAddNewTemplate = () => {
    setEditingTemplateId('new');
  };

  const handleBackToList = () => {
    setEditingTemplateId(null);
  };

  if (editingTemplateId) {
    return <TemplateEditPage templateId={editingTemplateId} onBack={handleBackToList} />;
  }

  return <TemplateListPage onEditTemplate={handleEditTemplate} onAddNew={handleAddNewTemplate} />;
};

export default TemplatePage;
