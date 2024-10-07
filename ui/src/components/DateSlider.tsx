import React, { useState, useEffect, useCallback, useRef } from 'react';
import { format } from 'date-fns';
import { debounce } from 'lodash';

interface DateSliderProps {
    startDate: Date;
    endDate: Date;
    onChange: (start: Date, end: Date) => void;
    minDate?: Date;
    maxDate?: Date;
}

const DateSlider: React.FC<DateSliderProps> = ({ startDate, endDate, onChange, minDate: propMinDate, maxDate: propMaxDate }) => {
    const [start, setStart] = useState<number>(startDate.getTime());
    const [end, setEnd] = useState<number>(endDate.getTime());
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const [hoveredDate, setHoveredDate] = useState<number | null>(null);
    const sliderRef = useRef<HTMLDivElement>(null);

    const minDate = propMinDate ? propMinDate.getTime() : new Date(2024, 0, 1).getTime();
    const maxDate = propMaxDate ? propMaxDate.getTime() : new Date(2027, 11, 31).getTime();

    useEffect(() => {
        setStart(startDate.getTime());
        setEnd(endDate.getTime());
    }, [startDate, endDate]);

    const debouncedOnChange = useCallback(
        debounce((newStart: Date, newEnd: Date) => {
            onChange(newStart, newEnd);
        }, 300),
        [onChange]
    );

    useEffect(() => {
        if (!isDragging) {
            debouncedOnChange(new Date(start), new Date(end));
        }
    }, [start, end, isDragging, debouncedOnChange]);

    const handleMouseDown = useCallback((e: React.MouseEvent, isStartThumb: boolean) => {
        e.preventDefault();
        setIsDragging(true);
        const slider = sliderRef.current;
        if (!slider) return;

        const updatePosition = (clientX: number) => {
            const rect = slider.getBoundingClientRect();
            const percentage = (clientX - rect.left) / rect.width;
            const newValue = Math.round(minDate + percentage * (maxDate - minDate));

            if (isStartThumb) {
                const newStart = Math.min(Math.max(newValue, minDate), end - 86400000);
                setStart(newStart);
                setHoveredDate(newStart);
            } else {
                const newEnd = Math.max(Math.min(newValue, maxDate), start + 86400000);
                setEnd(newEnd);
                setHoveredDate(newEnd);
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            updatePosition(e.clientX);
        };

        const handleMouseUp = () => {
            setIsDragging(false);
            setHoveredDate(null);
            debouncedOnChange(new Date(start), new Date(end));
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [start, end, minDate, maxDate, debouncedOnChange]);

    const handleSliderHover = useCallback((e: React.MouseEvent) => {
        if (isDragging) return;
        const slider = sliderRef.current;
        if (!slider) return;

        const rect = slider.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        const hoverDate = Math.round(minDate + percentage * (maxDate - minDate));
        setHoveredDate(hoverDate);
    }, [isDragging, minDate, maxDate]);

    const handleSliderLeave = useCallback(() => {
        if (!isDragging) {
            setHoveredDate(null);
        }
    }, [isDragging]);

    const formatDate = useCallback((date: number) => format(new Date(date), 'yyyy-MM-dd'), []);

    const getLeftPosition = useCallback((value: number) => {
        return ((value - minDate) / (maxDate - minDate)) * 100;
    }, [minDate, maxDate]);

    return (
        <div className="date-range-slider">
            <div className="date-inputs">
                <input
                    type="date"
                    value={formatDate(start)}
                    onChange={(e) => {
                        const newStart = new Date(e.target.value).getTime();
                        setStart(Math.min(newStart, end - 86400000));
                    }}
                    min={formatDate(minDate)}
                    max={formatDate(maxDate)}
                />
                <input
                    type="date"
                    value={formatDate(end)}
                    onChange={(e) => {
                        const newEnd = new Date(e.target.value).getTime();
                        setEnd(Math.max(newEnd, start + 86400000));
                    }}
                    min={formatDate(minDate)}
                    max={formatDate(maxDate)}
                />
            </div>
            <div
                className="slider-track"
                ref={sliderRef}
                onMouseMove={handleSliderHover}
                onMouseLeave={handleSliderLeave}
            >
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
                {hoveredDate && (
                    <div
                        className="date-bubble"
                        style={{ left: `${getLeftPosition(hoveredDate)}%` }}
                    >
                        {formatDate(hoveredDate)}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DateSlider;