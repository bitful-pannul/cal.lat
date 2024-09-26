import React, { useState, useRef } from 'react';
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
    const [zoom, setZoom] = useState(1);

    const events = locations.map(location => ({
        id: location.id,
        title: `${location.owner}: ${location.description}`,
        start: new Date(location.start_date * 1000),
        end: new Date(location.end_date * 1000),
        resource: location,
    }));

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
        const totalSeconds = maxDate - minDate;
        const containerWidth = waterfallRef.current ? waterfallRef.current.clientWidth : 1000; // Fallback width
        const pixelsPerSecond = (containerWidth / totalSeconds) * zoom;

        return (
            <div className="waterfall-container" style={{ height: '500px', overflow: 'auto' }}>
                <div className="waterfall-controls">
                    <button onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}>Zoom Out</button>
                    <button onClick={() => setZoom(prev => Math.min(5, prev + 0.1))}>Zoom In</button>
                    <span>Zoom: {(zoom * 100).toFixed(0)}%</span>
                </div>
                <div
                    className="waterfall-view"
                    ref={waterfallRef}
                    style={{
                        position: 'relative',
                        height: `${locations.length * 30}px`,
                        width: `${totalSeconds * pixelsPerSecond}px`,
                        minWidth: '100%'
                    }}
                >
                    {locations.map((location, index) => (
                        <div
                            key={location.id}
                            className="waterfall-item"
                            style={{
                                position: 'absolute',
                                top: `${index * 30}px`,
                                left: `${(location.start_date - minDate) * pixelsPerSecond}px`,
                                width: `${(location.end_date - location.start_date) * pixelsPerSecond}px`,
                                height: '25px',
                                backgroundColor: '#3498db',
                                color: 'white',
                                padding: '5px',
                                borderRadius: '3px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
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
            </div>
        );
    };

    return (
        <div className="calendar-view" style={{ height: '100%' }}>
            <div className="view-controls">
                <button onClick={() => setView('month')} className={view === 'month' ? 'active' : ''}>Month</button>
                <button onClick={() => setView('waterfall')} className={view === 'waterfall' ? 'active' : ''}>Waterfall</button>
            </div>
            {view === 'month' ? renderMonthView() : renderWaterfallView()}
        </div>
    );
};

export default CalendarView;