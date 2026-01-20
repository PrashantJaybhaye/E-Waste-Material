import React, { useState, useEffect, useRef } from 'react';
import { Search, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface LocationSearchProps {
    onLocationSelect: (location: string) => void;
    initialValue?: string;
    className?: string;
}

interface NominationResult {
    place_id: number;
    display_name: string;
}

export default function LocationSearch({ onLocationSelect, initialValue = '', className = '' }: LocationSearchProps) {
    const [query, setQuery] = useState(initialValue);
    const [suggestions, setSuggestions] = useState<NominationResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Close suggestions when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [wrapperRef]);

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            if (query && query.length > 2 && showSuggestions) {
                fetchSuggestions(query);
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [query, showSuggestions]);

    const fetchSuggestions = async (searchQuery: string) => {
        setIsLoading(true);
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                    searchQuery
                )}&limit=5`
            );
            if (!response.ok) {
                // handle error softly, maybe rate limit
                return;
            }
            const data = await response.json();
            setSuggestions(data);
        } catch (error) {
            console.error("Error fetching locations:", error);
            toast.error("Failed to fetch location suggestions");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelect = (result: NominationResult) => {
        setQuery(result.display_name);
        onLocationSelect(result.display_name);
        setSuggestions([]);
        setShowSuggestions(false);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value);
        onLocationSelect(e.target.value); // Allow typing without selection
        setShowSuggestions(true);
    }

    return (
        <div ref={wrapperRef} className={`relative w-full ${className}`}>
            <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-xl leading-5 bg-gray-100 placeholder-gray-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm transition-all duration-300"
                    placeholder="Enter waste location"
                    value={query}
                    onChange={handleChange}
                    onFocus={() => setShowSuggestions(true)}
                    required
                />
                {isLoading && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <div className="animate-spin h-4 w-4 border-2 border-green-500 rounded-full border-t-transparent"></div>
                    </div>
                )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
                    {suggestions.map((suggestion) => (
                        <li
                            key={suggestion.place_id}
                            className="group cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-green-50 transition-colors duration-150"
                            onClick={() => handleSelect(suggestion)}
                        >
                            <div className="flex items-center">
                                <MapPin className="h-4 w-4 text-gray-400 group-hover:text-green-500 mr-3 shrink-0" />
                                <span className="block truncate text-gray-700 group-hover:text-gray-900">
                                    {suggestion.display_name}
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
