~~`cal.lat` domain available...~~ not anymore :/

this is a p2p social app designed for digital nomads and other frequent travelers who want to coordinate with their friends, and share aspects of their lifestyle with the world. the basic premise is that it combines three primitives: a global map, a social calendar, and a photo feed, into one multidimensional interface while allowing for granular privacy controls for sharing with friends.

MAP: zoomable, detailed global map based on OpenStreetMap API with a draggable "time" dimension
CALENDAR: a set of events with dates and map locations attached
PHOTO FEED: photos are just events with image(s) attached

the key "user stories":

**travel**: Alice is deciding where to spend the month of June, so she goes to her map and drags "time" through June. She sees that Bob and Charlie will both overlap in Paris around the middle of the month and decides to anchor her trip around that. Since she's a close friend with Bob, she can see the exact address he'll be staying at and books a hotel nearby.

**coordination**: Alice and Bob want to plan a trip to San Francisco, so they look at a shared timeline containing both of their planned-locations over the next 6 months and see an open window in July. Alice marks her calendar for July 4-15 with the location set to the general SF area, and Bob marks his for July 1-15 with the exact address of the Airbnb he just booked. However, only his "close friends" can see the exact address -- regular friends just see "SF".

**photos**: Charlie has been having a great time in Spain and posts an album of photos. Each photo appears with the time it was taken along with the exact location, but only his close friends can see that -- others see just "Spain". Alice can tab over to a feed which shows the photos all her friends have posted, sorted chronologically with locations attached.

**chat**: When Alice adds a trip to Paris event on her calendar, 3 days before arrival, she is automatically added to a groupchat shared by her friends who are also there. These chats are created at the city-level -- every time you mark a location, the nearest city is applied. (this also enables the granularity-of-location feature noted above). When she leaves Paris, she is automatically removed from the chat. (*note: This gets hairy when Alice and Bob are friends, Bob and Charlie are friends, but Alice and Charlie aren't friends. for now, we can simply merge it all together such that a continuous social graph becomes a single chat. in the future, we'll need to figure out a better approach*.)

friends / privacy controls / granularity:

* friendship is simple, bidirectional
	* add friend / remove friend, accept friend / reject friend
* each friend can be toggled between 3 categories
* categories are defined by what they see:
	* full access ("best friends"): exact dates and times, exact locations
	* some access ("close friends"): time-granularity of "day", location-granularity of "city"
	* limited access ("friends"): time-granularity of "week", location-granularity of "country"
* photos can be friends-only or public

side notes:

* time zones will be generally painful, but also useful: imagine seeing two times for an event: the one in the time zone of attached location, and the one in the time zone you're viewing from
* personal node does some really nice things for the questions of EXIF data management and photo scaling. we can use the user-node to automatically scale/resize photos to make them web-friendly, and strip EXIF data but still use it to automatically attach data for close friends.
* the chats could be auto-constructed via telegram bots, or native to the app...