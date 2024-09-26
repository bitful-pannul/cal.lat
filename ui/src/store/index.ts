import { create } from 'zustand';

export interface Location {
    id: string;
    description: string;
    latitude: number;
    longitude: number;
    owner: string;
    start_date: number;
    end_date: number;
}

interface DateRange {
    start: Date;
    end: Date;
}

interface AppState {
    locations: Location[];
    selectedLocation: Location | null;
    dateRange: DateRange;
    setLocations: (locations: Location[]) => void;
    setSelectedLocation: (location: Location | null) => void;
    setDateRange: (range: DateRange) => void;
}

const useStore = create<AppState>((set) => ({
    locations: [],
    selectedLocation: null,
    dateRange: {
        start: new Date(2024, 0, 1),
        end: new Date(2024, 11, 31),
    },
    setLocations: (locations) => set({ locations }),
    setSelectedLocation: (location) => set({ selectedLocation: location }),
    setDateRange: (range) => set({ dateRange: range }),
}));

export default useStore;