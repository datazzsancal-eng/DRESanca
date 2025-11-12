

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '../../lib/supabaseClient';

// Type definitions
interface Cliente { id: string; cli_nome: string | null; }
interface CnpjRaiz { cnpj_raiz: string; reduz_emp: string | null; }
interface TipoLinha { id: number; tipo_linha: string | null; }
interface EstiloLinha { id: number; estilo_nome: string | null; }
interface PlanoConta { conta_estru: string; conta_descri: string | null; }
interface TemplateHeader {
  id?: string;
  cliente_id: string | null;
  dre_nome: string | null;
  dre_uso: string | null;
  dre_cont: string | null;
  dre_ativo_sn: string;
  cliente_cnpj: string | null;
}
interface TemplateLinha {
  id?: number;
  dre_template_id?: string;
  dre_linha_seq: number;
  tipo_linha_id: number | null;
  estilo_linha_id: number | null;
  dre_linha_descri: string | null;
  dre_linha_nivel: number | null;
  dre_linha_visivel: string;
  dre_linha_valor: string | null;
  dre_linha_valor_fonte?: 'VALOR' | 'CONTA' | 'FORMULA' | null;
}
interface TemplateLinhaForState extends TemplateLinha {
  _internalKey: string | number;
}


const initialHeaderState: TemplateHeader = {
  cliente_id: '',
  dre_nome: '',
  dre_uso: '',
  dre_cont: '',
  dre_ativo_sn: 'S',
  cliente_cnpj: '',
};

interface TemplateEditPageProps {
  templateId: string | 'new';
  onBack: () => void;
}

// Searchable Account Select Component
interface SearchableAccountSelectProps {
    accounts: PlanoConta[];
    selectedValue: string | null;
    onChange: (value: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

const SearchableAccountSelect: React.FC<SearchableAccountSelectProps> = ({ accounts, selectedValue, onChange, disabled, placeholder }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selectedAccount = useMemo(() => accounts.find(acc => acc.conta_estru === selectedValue), [accounts, selectedValue]);

    const filteredAccounts = useMemo(() => {
        if (!searchTerm) return accounts;
        const lowercasedFilter = searchTerm.toLowerCase();
        return accounts.filter(account =>
            account.conta_estru.toLowerCase().includes(lowercasedFilter) ||
            account.conta_descri?.toLowerCase().includes(lowercasedFilter)
        );
    }, [accounts, searchTerm]);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSelect = (account: PlanoConta) => {
        onChange(account.conta_estru);
        setIsOpen(false);
        setSearchTerm('');
    };

    const displayValue = selectedAccount
        ? `${selectedAccount.conta_estru} - ${selectedAccount.conta_descri}`
        : placeholder || 'Selecione uma conta';

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <button
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className="w-full px-2 py-1 text-left text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
                <span className="truncate">{displayValue}</span>
            </button>
            {isOpen && (
                <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg max-h-60">
                    <div className="p-2">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Buscar conta..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-2 py-1 text-white bg-gray-800 border border-gray-600 rounded-md"
                        />
                    </div>
                    <ul className="overflow-y-auto max-h-48">
                        {filteredAccounts.length > 0 ? (
                            filteredAccounts.map(account => (
                                <li
                                    key={account.conta_estru}
                                    onClick={() => handleSelect(account)}
                                    className="px-3 py-2 cursor-pointer hover:bg-indigo-600"
                                >
                                    {account.conta_estru} - {account.conta_descri}
                                </li>
                            ))
                        ) : (
                            <li className="px-3 py-2 text-gray-400">Nenhuma conta encontrada</li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

// ValorCell component renders the correct input for the "Valor" column
interface ValorCellProps {
  linha: TemplateLinha;
  index: number;
  tiposLinhaMap: Map<number, string | undefined>;
  headerData: TemplateHeader;
  planoContas: PlanoConta[];
  onLinhaChange: (index: number, field: keyof TemplateLinha, value: any) => void;
}

const ValorCell: React.FC<ValorCellProps> = ({ linha, index, tiposLinhaMap, headerData, planoContas, onLinhaChange }) => {
    const tipo = tiposLinhaMap.get(linha.tipo_linha_id as number);

    const renderContaSelect = () => (
      <SearchableAccountSelect
        accounts={planoContas}
        selectedValue={linha.dre_linha_valor || null}
        onChange={(value) => onLinhaChange(index, 'dre_linha_valor', value)}
        disabled={!headerData.cliente_cnpj || planoContas.length === 0}
        placeholder={planoContas.length > 0 ? 'Busque uma conta' : 'Nenhuma conta'}
      />
    );
    
    const renderFormulaInput = () => (
      <input type="text" value={linha.dre_linha_valor || ''} onChange={(e) => onLinhaChange(index, 'dre_linha_valor', e.target.value.toUpperCase())} className="w-full px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" placeholder="Ex: L1-L2"/>
    );

    switch (tipo) {
      case 'TITULO': case 'SEPARADOR':
        return <input type="text" value="N/A" disabled className="w-full px-2 py-1 text-gray-400 bg-gray-600 border-gray-500 rounded-md cursor-not-allowed" />;
      case 'CONTA':
        return renderContaSelect();
      case 'FORMULA':
        return renderFormulaInput();
      case 'CONSTANTE':
        const fonte = linha.dre_linha_valor_fonte || 'VALOR';
        switch (fonte) {
            case 'CONTA': return renderContaSelect();
            case 'FORMULA': return renderFormulaInput();
            case 'VALOR': default:
                return <input type="number" step="0.01" value={linha.dre_linha_valor || ''} onChange={(e) => onLinhaChange(index, 'dre_linha_valor', e.target.value)} className="w-full px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />;
        }
      default:
        return <input type="text" value={linha.dre_linha_valor || ''} disabled className="w-full px-2 py-1 text-gray-400 bg-gray-600 border border-gray-500 rounded-md cursor-not-allowed" />;
    }
};


const TemplateEditPage: React.FC<TemplateEditPageProps> = ({ templateId, onBack }) => {
  const [headerData, setHeaderData] = useState<TemplateHeader>(initialHeaderState);
  const [linhasData, setLinhasData] = useState<TemplateLinhaForState[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cnpjs, setCnpjs] = useState<CnpjRaiz[]>([]);
  const [tiposLinha, setTiposLinha] = useState<TipoLinha[]>([]);
  const [estilosLinha, setEstilosLinha] = useState<EstiloLinha[]>([]);
  const [planoContas, setPlanoContas] = useState<PlanoConta[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  const tiposLinhaMap = useMemo(() => new Map(tiposLinha.map(t => [t.id, t.tipo_linha?.toUpperCase()])), [tiposLinha]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientesRes, tiposRes, estilosRes] = await Promise.all([
        supabase.from('dre_cliente').select('*').order('cli_nome'),
        supabase.from('tab_tipo_linha').select('*').order('tipo_linha'),
        supabase.from('tab_estilo_linha').select('*').order('estilo_nome'),
      ]);
      if (clientesRes.error) throw clientesRes.error;
      if (tiposRes.error) throw tiposRes.error;
      if (estilosRes.error) throw estilosRes.error;

      setClientes(clientesRes.data);
      setTiposLinha(tiposRes.data);
      setEstilosLinha(estilosRes.data);

      if (templateId !== 'new') {
        const { data: templateData, error: templateError } = await supabase.from('dre_template').select('*').eq('id', templateId).single();
        if (templateError) throw templateError;
        setHeaderData(templateData);

        const { data: linhasDataFromDb, error: linhasError } = await supabase.from('dre_template_linhas').select('*').eq('dre_template_id', templateId).order('dre_linha_seq');
        if (linhasError) throw linhasError;
        
        const parsedLinhas = linhasDataFromDb.map(l => ({ ...l, _internalKey: l.id }));
        setLinhasData(parsedLinhas);
      }
    } catch (err: any) {
      setError(`Falha ao carregar dados do template: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  
  useEffect(() => {
    const fetchCnpjs = async () => {
      if (!headerData.cliente_id) { setCnpjs([]); setPlanoContas([]); return; }
      const { data, error } = await supabase.from('viw_cnpj_raiz').select('cnpj_raiz, reduz_emp').eq('cliente_id', headerData.cliente_id);
      if (error) setError(`Falha ao carregar CNPJs: ${error.message}`); else setCnpjs(data || []);
    };
    fetchCnpjs();
  }, [headerData.cliente_id]);
  
  useEffect(() => {
    const fetchPlanoContas = async () => {
        if (!headerData.cliente_cnpj) { setPlanoContas([]); return; }
        const { data, error } = await supabase.from('dre_plano_contabil').select('conta_estru, conta_descri').eq('cnpj_raiz', headerData.cliente_cnpj).order('conta_estru');
        if (error) setError(`Falha ao carregar plano de contas: ${error.message}`); else setPlanoContas(data || []);
    };
    fetchPlanoContas();
  }, [headerData.cliente_cnpj]);

  const handleHeaderChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setHeaderData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked ? 'S' : 'N' }));
    } else {
      setHeaderData(prev => ({ ...prev, [name]: value.toUpperCase() }));
    }
  };

  const handleLinhaChange = (index: number, field: keyof TemplateLinha, value: any) => {
    setLinhasData(currentLinhas => {
        const newLinhas = [...currentLinhas];
        const linhaToUpdate = { ...newLinhas[index] };
        (linhaToUpdate as any)[field] = value;

        if (field === 'tipo_linha_id') {
            linhaToUpdate.dre_linha_valor = ''; // Always clear value on type change
            const newTipo = tiposLinhaMap.get(Number(value));
            
            if (newTipo === 'CONSTANTE') {
              linhaToUpdate.dre_linha_valor_fonte = 'VALOR';
              linhaToUpdate.estilo_linha_id = null;
              linhaToUpdate.dre_linha_visivel = 'N'; // Set invisible for CONSTANTE
            } else {
              // Reset for other types
              linhaToUpdate.dre_linha_valor_fonte = null;
              linhaToUpdate.dre_linha_visivel = 'S'; // Set visible for others
            }
        }
        
        if (field === 'dre_linha_valor_fonte') {
            linhaToUpdate.dre_linha_valor = '';
        }

        newLinhas[index] = linhaToUpdate;
        return newLinhas;
    });
  };

  const addLinha = () => {
    const newLinha: TemplateLinhaForState = {
      _internalKey: `new_${Date.now()}`,
      dre_linha_seq: linhasData.length > 0 ? Math.max(...linhasData.map(l => l.dre_linha_seq)) + 1 : 1,
      tipo_linha_id: null,
      estilo_linha_id: null,
      dre_linha_descri: '',
      dre_linha_nivel: 0,
      dre_linha_visivel: 'S',
      dre_linha_valor: '',
      dre_linha_valor_fonte: null
    };
    setLinhasData(prev => [...prev, newLinha]);
  };

  const removeLinha = (key: string | number) => {
    setLinhasData(prev => prev.filter(l => l._internalKey !== key));
  };

  const handleDragSort = () => {
    if (dragItem.current === null || dragOverItem.current === null) return;
    const newLinhas = [...linhasData];
    const draggedItemContent = newLinhas.splice(dragItem.current, 1)[0];
    newLinhas.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setLinhasData(newLinhas);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    let currentTemplateId = templateId !== 'new' ? templateId : undefined;

    try {
      // Step 1: Save Header
      const { id, ...headerPayload } = headerData;
      if (templateId === 'new') {
        const { data, error } = await supabase.from('dre_template').insert(headerPayload).select().single();
        if (error) throw error;
        currentTemplateId = data.id;
      } else {
        const { error } = await supabase.from('dre_template').update(headerPayload).eq('id', currentTemplateId);
        if (error) throw error;
      }
      
      if (!currentTemplateId) throw new Error("Não foi possível obter o ID do template.");

      // Step 2: Delete existing lines
      const { error: deleteError } = await supabase.from('dre_template_linhas').delete().eq('dre_template_id', currentTemplateId);
      if (deleteError) throw deleteError;
      
      // Step 3: Prepare and insert new lines
      if (linhasData.length > 0) {
        const linhasPayload = linhasData.map((linha, index) => {
            const tipoLinha = tiposLinhaMap.get(linha.tipo_linha_id as number);
            return {
                dre_template_id: currentTemplateId,
                dre_linha_seq: index + 1,
                tipo_linha_id: linha.tipo_linha_id,
                estilo_linha_id: linha.estilo_linha_id,
                dre_linha_descri: linha.dre_linha_descri,
                dre_linha_nivel: linha.dre_linha_nivel,
                dre_linha_visivel: linha.dre_linha_visivel,
                dre_linha_valor: linha.dre_linha_valor,
                dre_linha_valor_fonte: tipoLinha === 'CONSTANTE' ? (linha.dre_linha_valor_fonte || 'VALOR') : null,
            };
        });

        const { error: insertError } = await supabase.from('dre_template_linhas').insert(linhasPayload);
        if (insertError) throw insertError;
      }
      onBack();
    } catch (err: any) {
        console.error("Save error:", err);
        setError(`Falha ao salvar template: ${err.message}`);
    } finally {
        setSaving(false);
    }
  };

  // Action Buttons Component
  const ActionButtons = ({ showTopBorder = false }: { showTopBorder?: boolean }) => (
    <div className={`flex justify-between items-center ${showTopBorder ? 'pt-4 mt-4 border-t border-gray-700' : 'pb-2'}`}>
      <button 
        onClick={onBack} 
        disabled={saving} 
        className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500 disabled:opacity-50"
      >
        Voltar
      </button>
      <div className="flex items-center space-x-3">
        <button onClick={addLinha} className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700">
          Adicionar Linha
        </button>
        <button onClick={handleSave} disabled={saving} className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait">
          {saving ? 'Salvando...' : 'Salvar Template'}
        </button>
      </div>
    </div>
  );


  if (loading) return <div className="flex items-center justify-center p-8"><div className="w-8 h-8 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div><span className="ml-4 text-gray-300">Carregando...</span></div>;

  return (
    <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg shadow-md space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">{templateId === 'new' ? 'Novo Template de DRE' : 'Editar Template de DRE'}</h2>
      </div>

      {error && <div className="p-3 text-red-300 bg-red-900/40 border border-red-700 rounded-md">{error}</div>}

      <div className="p-4 space-y-4 bg-gray-900/50 border border-gray-700 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300">Cliente</label>
            <select name="cliente_id" value={headerData.cliente_id || ''} onChange={handleHeaderChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500">
              <option value="">Selecione um cliente</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.cli_nome}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Nome do Template</label>
            <input type="text" name="dre_nome" value={headerData.dre_nome || ''} onChange={handleHeaderChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">CNPJ Raiz (Plano de Contas)</label>
            <select name="cliente_cnpj" value={headerData.cliente_cnpj || ''} onChange={handleHeaderChange} disabled={!headerData.cliente_id} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed">
              <option value="">Selecione um CNPJ</option>
              {cnpjs.map(c => <option key={c.cnpj_raiz} value={c.cnpj_raiz}>{c.reduz_emp} ({c.cnpj_raiz})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Uso do Template</label>
            <input type="text" name="dre_uso" value={headerData.dre_uso || ''} onChange={handleHeaderChange} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Controle</label>
            <input type="text" name="dre_cont" value={headerData.dre_cont || ''} onChange={handleHeaderChange} maxLength={10} className="w-full px-3 py-2 mt-1 text-white bg-gray-700 border border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500" />
          </div>
          <div className="flex items-end">
            <label className="flex items-center space-x-2 text-sm font-medium text-gray-300">
              <input type="checkbox" name="dre_ativo_sn" checked={headerData.dre_ativo_sn === 'S'} onChange={handleHeaderChange} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" />
              <span>Template Ativo?</span>
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">Linhas do Template</h3>
        
        <ActionButtons />
        
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-2 py-2"></th>
                <th className="px-2 py-2 text-xs text-left text-gray-400">SEQ</th>
                <th className="px-2 py-2 text-xs text-left text-gray-400 min-w-[250px]">Descrição</th>
                <th className="px-2 py-2 text-xs text-left text-gray-400">Nível</th>
                <th className="px-2 py-2 text-xs text-left text-gray-400 min-w-[120px]">Tipo</th>
                <th className="px-2 py-2 text-xs text-left text-gray-400 min-w-[150px]">Estilo / Fonte</th>
                <th className="px-2 py-2 text-xs text-left text-gray-400 min-w-[250px]">Valor / Conta / Fórmula</th>
                <th className="px-2 py-2 text-xs text-center text-gray-400">Visível</th>
                <th className="px-2 py-2"></th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {linhasData.map((linha, index) => {
                const isConstant = tiposLinhaMap.get(linha.tipo_linha_id as number) === 'CONSTANTE';
                return (
                  <tr key={linha._internalKey} draggable onDragStart={() => dragItem.current = index} onDragEnter={() => dragOverItem.current = index} onDragEnd={handleDragSort} onDragOver={(e) => e.preventDefault()} className="hover:bg-gray-700/50 cursor-move">
                    <td className="px-2 py-1 text-center text-gray-500">☰</td>
                    <td className="px-2 py-1 text-gray-400">{index + 1}</td>
                    <td className="px-1 py-1"><input type="text" value={linha.dre_linha_descri || ''} onChange={(e) => handleLinhaChange(index, 'dre_linha_descri', e.target.value)} className="w-full px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md"/></td>
                    <td className="px-1 py-1"><input type="number" value={linha.dre_linha_nivel || 0} onChange={(e) => handleLinhaChange(index, 'dre_linha_nivel', parseInt(e.target.value, 10))} className="w-16 px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md"/></td>
                    <td className="px-1 py-1">
                      <select value={linha.tipo_linha_id || ''} onChange={(e) => handleLinhaChange(index, 'tipo_linha_id', parseInt(e.target.value, 10))} className="w-full px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md">
                        <option value="" disabled>Selecione</option>
                        {tiposLinha.map(t => <option key={t.id} value={t.id}>{t.tipo_linha}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      {isConstant ? (
                        <select value={linha.dre_linha_valor_fonte || 'VALOR'} onChange={(e) => handleLinhaChange(index, 'dre_linha_valor_fonte', e.target.value as TemplateLinha['dre_linha_valor_fonte'])} className="w-full px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md">
                            <option value="VALOR">Valor Fixo</option>
                            <option value="CONTA">Conta Contábil</option>
                            <option value="FORMULA">Fórmula</option>
                        </select>
                      ) : (
                        <select value={linha.estilo_linha_id || ''} onChange={(e) => handleLinhaChange(index, 'estilo_linha_id', parseInt(e.target.value, 10))} className="w-full px-2 py-1 text-white bg-gray-700 border border-gray-600 rounded-md">
                            <option value="" disabled>Selecione</option>
                            {estilosLinha.map(e => <option key={e.id} value={e.id}>{e.estilo_nome}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="px-1 py-1">
                      <ValorCell linha={linha} index={index} tiposLinhaMap={tiposLinhaMap} headerData={headerData} planoContas={planoContas} onLinhaChange={handleLinhaChange} />
                    </td>
                    <td className="px-2 py-1 text-center"><input type="checkbox" checked={linha.dre_linha_visivel === 'S'} onChange={(e) => handleLinhaChange(index, 'dre_linha_visivel', e.target.checked ? 'S' : 'N')} className="w-4 h-4 text-indigo-600 bg-gray-700 border-gray-600 rounded focus:ring-indigo-500" /></td>
                    <td className="px-2 py-1 text-center"><button onClick={() => removeLinha(linha._internalKey)} className="text-red-500 hover:text-red-400">X</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <ActionButtons showTopBorder={true} />
      </div>
    </div>
  );
};

export default TemplateEditPage;