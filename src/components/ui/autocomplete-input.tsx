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
}

export function AutocompleteInput({
  value,
  onChange,
  onSelect,
  suggestions,
  placeholder = "Buscar...",
  className,
  displayField = 'descripcion',
  codeField = 'codigo'
}: AutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = suggestions.filter(item =>
    item[codeField].toLowerCase().includes(value.toLowerCase()) ||
    item[displayField].toLowerCase().includes(value.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        className={className}
      />
      
      {isOpen && filteredSuggestions.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {filteredSuggestions.map((item, index) => (
            <div
              key={item[codeField]}
              className={cn(
                "px-3 py-2 cursor-pointer hover:bg-gray-100 text-sm",
                highlightedIndex === index && "bg-blue-50"
              )}
              onClick={() => handleSelect(item)}
            >
              <div className="font-medium text-gray-900">
                {item[codeField]} - {item[displayField]}
              </div>
              <div className="text-xs text-gray-500">
                {item.norma && `Norma: ${item.norma}`}
                {item.precio && ` | S/. ${item.precio}`}
                {item.tiempo && ` | ${item.tiempo}`}
              </div>
              {item.codigosRelacionados && item.codigosRelacionados.length > 0 && (
                <div className="text-xs text-orange-600 mt-1">
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
