import React, { useState, useRef } from 'react';
import { Calendar, momentLocalizer } from 'react-big-calendar';
import moment from 'moment';
import { Location } from '../store';
import 'react-big-calendar/lib/css/react-big-calendar.css';


moment.locale('en-GB');
const localizer = momentLocalizer(moment);


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
        tooltip: `Owner: ${location.owner}\nDescription: ${location.description}`
    }));

    const renderMonthView = () => (
        <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 500 }}
            onSelectEvent={(event) => onSelectLocation(event.resource)}
            components={{
                event: (props) => (
                    <div title={props.event.tooltip}>
                        {props.title}
                    </div>
                )
            }}
        />
    );

    const renderWaterfallView = () => {
        const minDate = startDate.getTime() / 1000;
        const maxDate = endDate.getTime() / 1000;
        const totalSeconds = maxDate - minDate;

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
                            height: `${Math.min(locations.length * 30, 500)}px`,
                            width: '100%',
                        }}
                    >
                        {locations.map((location, index) => {
                            const start = Math.max(location.start_date, minDate);
                            const end = Math.min(location.end_date, maxDate);
                            const leftPosition = ((start - minDate) / totalSeconds) * 100;
                            const width = ((end - start) / totalSeconds) * 100;

                            return (
                                <div
                                    key={location.id}
                                    className="waterfall-item"
                                    style={{
                                        top: `${index * 30}px`,
                                        left: `${leftPosition}%`,
                                        width: `${width}%`,
                                    }}
                                    onClick={() => onSelectLocation(location)}
                                    title={`Owner: ${location.owner}\nDescription: ${location.description}`}
                                >
                                    <span className="waterfall-item-content">
                                        {location.owner}: {location.description}
                                        <span className="date-range">
                                            {moment(location.start_date * 1000).format('MMM D')} - {moment(location.end_date * 1000).format('MMM D')}
                                        </span>
                                    </span>
                                </div>
                            );
                        })}
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