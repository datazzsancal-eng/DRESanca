import React, { useState } from 'react';
import { TemplateListPage } from './TemplateListPage';
import TemplateEditPage from './TemplateEditPage';
import TemplateCardPage from './TemplateCardPage';

const TemplatePage: React.FC = () => {
  const [editingTemplateId, setEditingTemplateId] = useState<string | 'new' | null>(null);
  const [managingCardsTemplateId, setManagingCardsTemplateId] = useState<string | null>(null);

  const handleEditTemplate = (id: string) => {
    setEditingTemplateId(id);
    setManagingCardsTemplateId(null);
  };

  const handleAddNewTemplate = () => {
    setEditingTemplateId('new');
    setManagingCardsTemplateId(null);
  };
  
  const handleManageCards = (id: string) => {
    setManagingCardsTemplateId(id);
    setEditingTemplateId(null);
  }

  const handleBackToList = () => {
    setEditingTemplateId(null);
    setManagingCardsTemplateId(null);
  };

  if (editingTemplateId) {
    return <TemplateEditPage templateId={editingTemplateId} onBack={handleBackToList} />;
  }
  
  if (managingCardsTemplateId) {
    return <TemplateCardPage templateId={managingCardsTemplateId} onBack={handleBackToList} />;
  }

  return <TemplateListPage onEditTemplate={handleEditTemplate} onAddNew={handleAddNewTemplate} onManageCards={handleManageCards} />;
};

export default TemplatePage;