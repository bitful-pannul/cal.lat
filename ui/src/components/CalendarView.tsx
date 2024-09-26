import React, { useState, useEffect, useRef } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import 'react-big-calendar/lib/css/react-big-calendar.css';

moment.locale('en-GB');
const localizer = momentLocalizer(moment);

interface Location {
    id: string;
    description: string;
    latitude: number;
    longitude: number;
    owner: string;
    start_date: number;
    end_date: number;
}

interface CalendarViewProps {
    locations: Location[];
    onSelectLocation: (location: Location | null) => void;
}

const CalendarView: React.FC<CalendarViewProps> = ({ locations, onSelectLocation }) => {
    const [view, setView] = useState<'month' | 'waterfall'>('month');
    const waterfallRef = useRef<HTMLDivElement>(null);

    const events = locations.map(location => ({
        id: location.id,
        title: `${location.owner}: ${location.description}`,
        start: new Date(location.start_date * 1000),
        end: new Date(location.end_date * 1000),
        resource: location,
    }));

    useEffect(() => {
        if (view === 'waterfall' && waterfallRef.current) {
            const container = waterfallRef.current;
            const items = container.getElementsByClassName('waterfall-item');
            let maxHeight = 0;

            Array.from(items).forEach((item: Element) => {
                const rect = item.getBoundingClientRect();
                maxHeight = Math.max(maxHeight, rect.bottom - container.getBoundingClientRect().top);
            });

            container.style.height = `${maxHeight + 20}px`;
        }
    }, [view, locations]);

    const renderMonthView = () => (
        <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 500 }}
            onSelectEvent={(event) => onSelectLocation(event.resource)}
        />
    );

    const renderWaterfallView = () => {
        const minDate = Math.min(...locations.map(loc => loc.start_date));
        const maxDate = Math.max(...locations.map(loc => loc.end_date));
        const totalDays = (maxDate - minDate) / (24 * 60 * 60);
        const pixelsPerDay = 20;

        return (
            <div className="waterfall-view" ref={waterfallRef}>
                {locations.map((location, index) => (
                    <div
                        key={location.id}
                        className="waterfall-item"
                        style={{
                            top: `${index * 30}px`,
                            left: `${((location.start_date - minDate) / (24 * 60 * 60)) * pixelsPerDay}px`,
                            width: `${((location.end_date - location.start_date) / (24 * 60 * 60)) * pixelsPerDay}px`,
                        }}
                        onClick={() => onSelectLocation(location)}
                    >
                        <span className="waterfall-item-content">
                            {location.owner}: {location.description}
                            <span className="date-range">
                                {moment(location.start_date * 1000).format('MMM D')} - {moment(location.end_date * 1000).format('MMM D')}
                            </span>
                        </span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="calendar-view">
            <div className="view-controls">
                <button onClick={() => setView('month')} className={view === 'month' ? 'active' : ''}>Month</button>
                <button onClick={() => setView('waterfall')} className={view === 'waterfall' ? 'active' : ''}>Waterfall</button>
            </div>
            {view === 'month' ? renderMonthView() : renderWaterfallView()}
        </div>
    );
};

export default CalendarView;