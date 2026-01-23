import React, { useState, useEffect, useRef } from 'react';
import { Input } from './input';
import { cn } from '../../lib/utils';

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (item: any) => void;
  suggestions: any[];
  placeholder?: string;
  className?: string;
  displayField?: string;
  codeField?: string;
  minChars?: number;
  maxSuggestions?: number;
}

export function AutocompleteInput({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder = "Buscar...",
  className,
  displayField = 'descripcion',
  codeField = 'codigo',
  minChars = 2,
  maxSuggestions = 8
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = value.length >= minChars 
    ? suggestions
        .filter(item =>
          item[codeField].toLowerCase().includes(value.toLowerCase()) ||
          item[displayField].toLowerCase().includes(value.toLowerCase()) ||
          (item.norma && item.norma.toLowerCase().includes(value.toLowerCase()))
        )
        .slice(0, maxSuggestions)
    : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0) {
          onSelect(filteredSuggestions[highlightedIndex]);
          setIsOpen(false);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const handleSelect = (item: any) => {
    onSelect(item);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => value.length >= minChars && setIsOpen(true)}
        placeholder={placeholder}
        className={className}
      />
      
      {isOpen && filteredSuggestions.length > 0 && (
        <div
          className="absolute z-[9999] left-0 top-full mt-1 min-w-[400px] max-w-[500px] bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-auto"
          style={{ 
            boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
          }}
        >
          <div className="sticky top-0 bg-gray-50 px-3 py-2 border-b text-xs text-gray-500 font-medium">
            {filteredSuggestions.length} resultado{filteredSuggestions.length !== 1 ? 's' : ''} encontrado{filteredSuggestions.length !== 1 ? 's' : ''}
          </div>
          {filteredSuggestions.map((item, index) => (
            <div
              key={item[codeField]}
              className={cn(
                "px-3 py-3 cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors",
                highlightedIndex === index && "bg-blue-50"
              )}
              onClick={() => handleSelect(item)}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-800">
                  {item[codeField]}
                </span>
                <span className="font-medium text-gray-900 text-sm truncate">
                  {item[displayField]}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                {item.norma && <span>📋 {item.norma}</span>}
                {item.precio !== undefined && <span className="text-green-600 font-medium">S/. {item.precio}</span>}
                {item.tiempo && <span>⏱️ {item.tiempo}</span>}
                {item.acreditado === 'SI' && <span className="text-blue-600">✓ Acreditado</span>}
              </div>
              {item.codigosRelacionados && item.codigosRelacionados.length > 0 && (
                <div className="text-xs text-orange-600 mt-1 bg-orange-50 px-2 py-1 rounded">
                  ⚠️ Requiere: {item.codigosRelacionados.join(', ')}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
