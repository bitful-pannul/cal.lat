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
    startDate: Date;
    endDate: Date;
}

const CalendarView: React.FC<CalendarViewProps> = ({ locations, onSelectLocation, startDate, endDate }) => {
    const [view, setView] = useState<'month' | 'waterfall'>('month');
    const waterfallRef = useRef<HTMLDivElement>(null);

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
            date={startDate}
            onNavigate={() => { }}
        />
    );

    const renderWaterfallView = () => {
        const minDate = startDate.getTime() / 1000;
        const maxDate = endDate.getTime() / 1000;
        const totalSeconds = maxDate - minDate;
        const containerWidth = waterfallRef.current ? waterfallRef.current.clientWidth : 1000;
        const pixelsPerSecond = containerWidth / totalSeconds;

        return (
            <div className="waterfall-container">
                <div className="waterfall-date-range">
                    {moment(startDate).format('MMMM D, YYYY')} - {moment(endDate).format('MMMM D, YYYY')}
                </div>
                <div className="waterfall-view-wrapper">
                    <div
                        className="waterfall-view"
                        ref={waterfallRef}
                        style={{
                            height: `${locations.length * 30}px`,
                            width: `${totalSeconds * pixelsPerSecond}px`,
                        }}
                    >
                        {locations.map((location, index) => (
                            <div
                                key={location.id}
                                className="waterfall-item"
                                style={{
                                    top: `${index * 30}px`,
                                    left: `${Math.max(0, (location.start_date - minDate) * pixelsPerSecond)}px`,
                                    width: `${Math.min((location.end_date - location.start_date) * pixelsPerSecond, (maxDate - location.start_date) * pixelsPerSecond)}px`,
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