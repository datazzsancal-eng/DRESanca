
import React from 'react';

export interface DreDataRow {
    seq: number; desc: string; jan: number; fev: number; mar: number; abr: number; mai: number; jun: number; jul: number; ago: number; set: number; out: number; nov: number; dez: number;
    accumulated: number; percentage: number; isBold: boolean; isItalic: boolean; indentationLevel: number;
}

interface DreTableProps { 
  data: DreDataRow[]; 
  selectedPeriod: number | ''; 
}

const safeFormatNumber = (val: any): string => {
    const n = Number(val);
    if (val === null || val === undefined || isNaN(n) || n === 0) return '-';
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const safeFormatPercentage = (val: any): string => {
    const n = Number(val);
    if (val === null || val === undefined || isNaN(n) || n === 0) return '-';
    return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
};

const DreTable: React.FC<DreTableProps> = ({ data, selectedPeriod }) => {
    const allMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const visibleMonths = allMonths.slice(0, selectedPeriod ? (Number(selectedPeriod) % 100) : 12);

    return (
        <div className="overflow-auto bg-gray-800 border border-gray-700 rounded-lg shadow-md max-h-[70vh]">
            <table className="min-w-full text-sm divide-y divide-gray-700 border-separate border-spacing-0">
                <thead className="bg-gray-700">
                    <tr>
                        <th className="sticky left-0 top-0 z-20 bg-gray-700 px-3 py-2 text-xs font-semibold text-left text-gray-400 uppercase shadow-[1px_0_0_0_rgba(75,85,99,1)]">Descrição</th>
                        {visibleMonths.map((m: string) => (
                          <th
                            key={m}
                            className="sticky top-0 z-10 bg-gray-700 px-3 py-2 text-xs font-semibold text-right text-gray-400 uppercase"
                          >
                            {m}
                          </th>
                        ))}
                        <th className="sticky top-0 z-10 bg-gray-700 px-3 py-2 text-xs font-semibold text-right text-gray-400 uppercase">Acumulado</th>
                        <th className="sticky top-0 z-10 bg-gray-700 px-3 py-2 text-xs font-semibold text-right text-gray-400 uppercase">%</th>
                    </tr>
                </thead>
                <tbody className="bg-gray-800 divide-y divide-gray-700">
                    {data.map((row: DreDataRow, idx: number) => (
                        <tr key={idx} className="group hover:bg-gray-700/50">
                            <td className="sticky left-0 z-10 bg-gray-800 group-hover:bg-gray-700 px-3 py-2 whitespace-nowrap text-gray-300 shadow-[1px_0_0_0_rgba(55,65,81,1)]" style={{ fontWeight: row.isBold ? 'bold' : 'normal', fontStyle: row.isItalic ? 'italic' : 'normal', paddingLeft: `calc(0.75rem + ${row.indentationLevel}ch)` }}>{row.desc}</td>
                            {visibleMonths.map((m: string) => (
                              <td
                                key={m}
                                className={`px-3 py-2 text-right whitespace-nowrap ${
                                  (row[m.toLowerCase() as keyof DreDataRow] as number) < 0
                                    ? 'text-red-500'
                                    : 'text-gray-200'
                                }`}
                              >
                                {safeFormatNumber(row[m.toLowerCase() as keyof DreDataRow])}
                              </td>
                            ))}
                            <td className={`px-3 py-2 text-right whitespace-nowrap font-medium ${row.accumulated < 0 ? 'text-red-500' : 'text-white'}`}>{safeFormatNumber(row.accumulated)}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-gray-400">{safeFormatPercentage(row.percentage)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default DreTable;
