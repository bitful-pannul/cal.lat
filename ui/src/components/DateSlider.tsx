import React, { useState, useEffect, useCallback, useRef } from 'react';
import { debounce } from 'lodash';
import { format } from 'date-fns';

interface DateSliderProps {
    startDate: Date;
    endDate: Date;
    onChange: (start: Date, end: Date) => void;
}

const DateSlider: React.FC<DateSliderProps> = ({ startDate, endDate, onChange }) => {
    const [start, setStart] = useState<number>(startDate.getTime());
    const [end, setEnd] = useState<number>(endDate.getTime());
    const sliderRef = useRef<HTMLDivElement>(null);
    const isInitialMount = useRef(true);

    const minDate = new Date(2024, 0, 1).getTime();
    const maxDate = new Date(2027, 11, 31).getTime();

    useEffect(() => {
        setStart(startDate.getTime());
        setEnd(endDate.getTime());
    }, [startDate, endDate]);

    const debouncedOnChange = useCallback(debounce(onChange, 200), [onChange]);

    useEffect(() => {
        if (isInitialMount.current) {
            isInitialMount.current = false;
            onChange(new Date(start), new Date(end));
        } else {
            debouncedOnChange(new Date(start), new Date(end));
        }
    }, [start, end, onChange, debouncedOnChange]);

    const handleMouseDown = (e: React.MouseEvent, isStart: boolean) => {
        e.preventDefault();
        const slider = sliderRef.current;
        if (!slider) return;

        const updatePosition = (clientX: number) => {
            const rect = slider.getBoundingClientRect();
            const percentage = (clientX - rect.left) / rect.width;
            const newValue = Math.round(minDate + percentage * (maxDate - minDate));

            if (isStart) {
                const newStart = Math.min(newValue, end - 86400000);
                setStart(newStart);
            } else {
                const newEnd = Math.max(newValue, start + 86400000);
                setEnd(newEnd);
            }
        };

        const handleMouseMove = (e: MouseEvent) => updatePosition(e.clientX);

        const handleMouseUp = () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const formatDate = (date: number) => format(new Date(date), 'yyyy-MM-dd');

    const getLeftPosition = (value: number) => {
        return ((value - minDate) / (maxDate - minDate)) * 100;
    };

    return (
        <div className="date-range-slider">
            <div className="date-inputs">
                <input
                    type="date"
                    value={formatDate(start)}
                    onChange={(e) => {
                        const newStart = new Date(e.target.value).getTime();
                        setStart(newStart);
                    }}
                    min={formatDate(minDate)}
                    max={formatDate(maxDate)}
                />
                <input
                    type="date"
                    value={formatDate(end)}
                    onChange={(e) => {
                        const newEnd = new Date(e.target.value).getTime();
                        setEnd(newEnd);
                    }}
                    min={formatDate(minDate)}
                    max={formatDate(maxDate)}
                />
            </div>
            <div className="slider-track" ref={sliderRef}>
                <div
                    className="slider-range"
                    style={{
                        left: `${getLeftPosition(start)}%`,
                        width: `${getLeftPosition(end) - getLeftPosition(start)}%`
                    }}
                />
                <div
                    className="slider-thumb start-thumb"
                    style={{ left: `${getLeftPosition(start)}%` }}
                    onMouseDown={(e) => handleMouseDown(e, true)}
                />
                <div
                    className="slider-thumb end-thumb"
                    style={{ left: `${getLeftPosition(end)}%` }}
                    onMouseDown={(e) => handleMouseDown(e, false)}
                />
            </div>
        </div>
    );
};

export default DateSlider;