
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Type definitions
interface Template {
  id: string;
  dre_nome: string | null;
}
interface TemplateLinha {
  id: number;
  dre_linha_seq: number;
  dre_linha_descri: string | null;
}
interface TemplateCard {
  id?: number;
  dre_template_id: string;
  dre_template_linha_id: number | null;
  dre_linha_seq: number | null; // Added field
  vlr_linha_01: 'ACUM' | 'PERC';
  vlr_linha_02: 'ACUM' | 'PERC';
  crd_posicao: number;
  tit_card_dre: string | null;
  tit_card_ajust: string | null;
}

interface TemplateCardPageProps {
  templateId: string;
  onBack: () => void;
}

const TemplateCardPage: React.FC<TemplateCardPageProps> = ({ templateId, onBack }) => {
  const [template, setTemplate] = useState<Template | null>(null);
  const [linhas, setLinhas] = useState<TemplateLinha[]>([]);
  const [cards, setCards] = useState<TemplateCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardPositions = [1, 2, 3, 4];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [templateRes, linhasRes, cardsRes] = await Promise.all([
        supabase.from('dre_template').select('id, dre_nome').eq('id', templateId).single(),
        supabase.from('dre_template_linhas').select('id, dre_linha_seq, dre_linha_descri').eq('dre_template_id', templateId).order('dre_linha_seq'),
        supabase.from('dre_template_card').select('*').eq('dre_template_id', templateId),
      ]);

      if (templateRes.error) throw templateRes.error;
      if (linhasRes.error) throw linhasRes.error;
      if (cardsRes.error) throw cardsRes.error;
      
      setTemplate(templateRes.data);
      // FIX: Handle potential null data from Supabase
      setLinhas(linhasRes.data || []);
      
      // Initialize cards for all 4 positions
      // FIX: Explicitly type data from Supabase and handle null to fix type error
      const existingCardsData: TemplateCard[] = cardsRes.data || [];
      const existingCards = new Map(existingCardsData.map(c => [c.crd_posicao, c]));
      const initializedCards: TemplateCard[] = cardPositions.map(pos => {
        return existingCards.get(pos) || {
            dre_template_id: templateId,
            dre_template_linha_id: null,
            dre_linha_seq: null,
            vlr_linha_01: 'ACUM',
            vlr_linha_02: 'PERC',
            crd_posicao: pos,
            tit_card_dre: '',
            tit_card_ajust: '',
        };
      });
      setCards(initializedCards);

    } catch (err: any) {
      setError(`Falha ao carregar dados: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCardChange = (posicao: number, field: keyof TemplateCard, value: any) => {
    setCards(prevCards => {
        const newCards = [...prevCards];
        const cardIndex = newCards.findIndex(c => c.crd_posicao === posicao);
        if (cardIndex === -1) return prevCards;

        const updatedCard = { ...newCards[cardIndex], [field]: value };

        if (field === 'dre_template_linha_id') {
            const selectedLinhaId = value; // Value from onChange is already a number or null
            if (selectedLinhaId) {
                const selectedLinha = linhas.find(l => l.id === selectedLinhaId);
                if (selectedLinha) {
                    updatedCard.dre_linha_seq = selectedLinha.dre_linha_seq;
                    updatedCard.tit_card_dre = selectedLinha.dre_linha_descri || '';
                    // Pre-fill adjusted title only if it's currently empty
                    if (!updatedCard.tit_card_ajust) {
                        updatedCard.tit_card_ajust = selectedLinha.dre_linha_descri || '';
                    }
                }
            } else {
                // Clear fields when "-- Limpar Card --" is selected
                updatedCard.dre_linha_seq = null;
                updatedCard.tit_card_dre = '';
                updatedCard.tit_card_ajust = '';
            }
        }

        // Validation to prevent selecting the same value for both fields
        if (field === 'vlr_linha_01' && value === updatedCard.vlr_linha_02) {
            updatedCard.vlr_linha_02 = value === 'ACUM' ? 'PERC' : 'ACUM';
        }
        if (field === 'vlr_linha_02' && value === updatedCard.vlr_linha_01) {
            updatedCard.vlr_linha_01 = value === 'ACUM' ? 'PERC' : 'ACUM';
        }

        newCards[cardIndex] = updatedCard;
        return newCards;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
        // 1. Delete all existing cards for this template
        const { error: deleteError } = await supabase
            .from('dre_template_card')
            .delete()
            .eq('dre_template_id', templateId);
        if (deleteError) throw deleteError;

        // 2. Insert new configurations for cards that have a line selected
        const cardsToInsert = cards
            .filter(c => c.dre_template_linha_id !== null && c.dre_template_linha_id !== 0)
            .map(({ id, ...rest }) => rest); // remove transient id if it exists
        
        if (cardsToInsert.length > 0) {
            const { error: insertError } = await supabase
                .from('dre_template_card')
                .insert(cardsToInsert);
            if (insertError) throw insertError;
        }

        onBack();

    } catch (err: any) {
        setError(`Falha ao salvar configurações dos cards: ${err.message}`);
    } finally {
        setSaving(false);
    }
  };


  if (loading) return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;
  if (error) return <div className="p-4 text-center text-red-400 bg-red-900/20 border border-red-800 rounded-lg">{error}</div>;

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Gerenciar Cards do Dashboard</h2>
        <h3 className="text-lg font-medium text-gray-300">{template?.dre_nome}</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cardPositions.map(pos => {
          const cardData = cards.find(c => c.crd_posicao === pos);
          if (!cardData) return null;

          return (
            <div key={pos} className="p-4 space-y-3 bg-gray-900/50 border border-gray-700 rounded-lg">
              <h4 className="font-bold text-white">Posição {pos}</h4>
              <div>
                <label className="block text-sm font-medium text-gray-400">Linha DRE</label>
                <select 
                  value={cardData.dre_template_linha_id || ''}
                  onChange={(e) => handleCardChange(pos, 'dre_template_linha_id', e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md"
                >
                  <option value="">-- Limpar Card --</option>
                  {linhas.map(l => <option key={l.id} value={l.id}>{`${l.dre_linha_seq} - ${l.dre_linha_descri}`}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400">Título do Card (Ajustado)</label>
                <input 
                  type="text"
                  value={cardData.tit_card_ajust || ''}
                  onChange={(e) => handleCardChange(pos, 'tit_card_ajust', e.target.value.toUpperCase())}
                  disabled={!cardData.dre_template_linha_id}
                  className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500 truncate" title={cardData.tit_card_dre || ''}>
                  Original: {cardData.tit_card_dre || '-'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                    <label className="block text-sm font-medium text-gray-400">Valor 1</label>
                    <select 
                        value={cardData.vlr_linha_01}
                        onChange={(e) => handleCardChange(pos, 'vlr_linha_01', e.target.value)}
                        disabled={!cardData.dre_template_linha_id}
                        className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md disabled:bg-gray-600"
                    >
                        <option value="ACUM">Acumulado</option>
                        <option value="PERC">Percentual</option>
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-400">Valor 2</label>
                    <select 
                        value={cardData.vlr_linha_02}
                        onChange={(e) => handleCardChange(pos, 'vlr_linha_02', e.target.value)}
                        disabled={!cardData.dre_template_linha_id}
                        className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md disabled:bg-gray-600"
                    >
                        <option value="ACUM">Acumulado</option>
                        <option value="PERC">Percentual</option>
                    </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-700">
        <button onClick={onBack} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500 disabled:opacity-50">
          Voltar
        </button>
        <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait">
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
};

export default TemplateCardPage;
