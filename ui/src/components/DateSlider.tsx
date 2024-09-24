import React, { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';

interface DateRangeSliderProps {
    startDate: Date;
    endDate: Date;
    onChange: (start: string, end: string) => void; // Change to string
}

const DateRangeSlider: React.FC<DateRangeSliderProps> = ({ startDate, endDate, onChange }) => {
    const [start, setStart] = useState<number>(startDate.getTime());
    const [end, setEnd] = useState<number>(endDate.getTime());

    const minDate = new Date(2024, 0, 1).getTime();
    const maxDate = new Date(2044, 11, 31).getTime();

    useEffect(() => {
        setStart(startDate.getTime());
        setEnd(endDate.getTime());
    }, [startDate, endDate]);

    const debouncedOnChange = useCallback(debounce(onChange, 300), [onChange]);

    const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseInt(e.target.value);
        if (e.target.name === 'start') {
            setStart(value);
            debouncedOnChange(formatDate(value), formatDate(end));
        } else {
            setEnd(value);
            debouncedOnChange(formatDate(start), formatDate(value));
        }
    };

    const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = new Date(e.target.value).getTime();
        if (e.target.name === 'start-date') {
            setStart(value);
            debouncedOnChange(formatDate(value), formatDate(end));
        } else {
            setEnd(value);
            debouncedOnChange(formatDate(start), formatDate(value));
        }
    };

    const formatDate = (date: number) => new Date(date).toISOString().split('T')[0];

    return (
        <div className="date-range-slider">
            <div className="date-inputs">
                <input
                    type="date"
                    name="start-date"
                    value={formatDate(start)}
                    onChange={handleDateInputChange}
                    min={formatDate(minDate)}
                    max={formatDate(maxDate)}
                />
                <input
                    type="date"
                    name="end-date"
                    value={formatDate(end)}
                    onChange={handleDateInputChange}
                    min={formatDate(minDate)}
                    max={formatDate(maxDate)}
                />
            </div>
            <input
                type="range"
                name="start"
                min={minDate}
                max={maxDate}
                value={start}
                onChange={handleSliderChange}
                className="slider start-slider"
            />
            <input
                type="range"
                name="end"
                min={minDate}
                max={maxDate}
                value={end}
                onChange={handleSliderChange}
                className="slider end-slider"
            />
        </div>
    );
};

export default DateRangeSlider;