use anyhow::{anyhow, Result};
use automerge::AutoCommit;
use autosurgeon::{Hydrate, Reconcile};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Location {
    pub id: Uuid,
    pub owner: String,
    pub description: String,
    pub time_range: TimeRange,
    pub coordinate: Coordinate,
    #[serde(skip)]
    pub comments: AutoCommit,
    #[serde(skip)]
    pub members: AutoCommit,
}

#[derive(Debug, Serialize, Deserialize, Clone, Hydrate, Reconcile)]
pub struct Comment {
    timestamp: i64, // unix timestamp
    author: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Hydrate, Reconcile)]
pub struct Comments {
    comments: Vec<Comment>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TimeRange {
    start: OffsetDateTime,
    end: OffsetDateTime,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Coordinate {
    latitude: f64,
    longitude: f64,
}

impl Location {
    pub fn new(
        id: Uuid,
        owner: String,
        description: String,
        time_range: TimeRange,
        coordinate: Coordinate,
    ) -> Self {
        Location {
            id,
            owner,
            description,
            time_range,
            coordinate,
            comments: AutoCommit::new(),
            members: AutoCommit::new(),
        }
    }

    pub fn add_comment(&mut self, author: String, content: String) -> Result<()> {
        let comment = Comment {
            timestamp: OffsetDateTime::now_utc().unix_timestamp(),
            author,
            content,
        };
        let mut comments: Comments =
            autosurgeon::hydrate(&self.comments).unwrap_or_else(|_| Comments::new());
        comments.comments.push(comment);
        autosurgeon::reconcile(&mut self.comments, &comments)?;
        Ok(())
    }

    pub fn get_comments(&self) -> Result<Vec<Comment>> {
        let comments: Comments =
            autosurgeon::hydrate(&self.comments).unwrap_or_else(|_| Comments::new());
        Ok(comments.comments)
    }

    pub fn add_member(&mut self, member: String) -> Result<()> {
        let mut members: Vec<String> = autosurgeon::hydrate(&self.members).unwrap_or_default();
        if !members.contains(&member) {
            members.push(member);
            autosurgeon::reconcile(&mut self.members, &members)?;
        }
        Ok(())
    }

    pub fn remove_member(&mut self, member: &str) -> Result<()> {
        let mut members: Vec<String> = autosurgeon::hydrate(&self.members).unwrap_or_default();
        members.retain(|m| m != member);
        autosurgeon::reconcile(&mut self.members, &members)?;
        Ok(())
    }

    pub fn is_member(&self, member: &str) -> Result<bool> {
        let members: Vec<String> = autosurgeon::hydrate(&self.members).unwrap_or_default();
        Ok(members.contains(&member.to_string()))
    }

    pub fn set_description(&mut self, description: String) {
        self.description = description;
    }

    pub fn set_time_range(&mut self, time_range: TimeRange) {
        self.time_range = time_range;
    }

    pub fn set_coordinate(&mut self, coordinate: Coordinate) {
        self.coordinate = coordinate;
    }

    pub fn serialize_crdt_data(&mut self) -> Result<(Vec<u8>, Vec<u8>)> {
        Ok((self.comments.save(), self.members.save()))
    }

    pub fn deserialize_crdt_data(&mut self, comments: &[u8], members: &[u8]) -> Result<()> {
        self.comments = AutoCommit::load(comments)?;
        self.members = AutoCommit::load(members)?;
        Ok(())
    }
}

impl Comments {
    pub fn new() -> Self {
        Comments {
            comments: Vec::new(),
        }
    }
}

pub struct State {
    pub locations: HashMap<Uuid, Location>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SerializableState {
    pub locations: HashMap<Uuid, SerializableLocation>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SerializableLocation {
    #[serde(flatten)]
    pub location: Location,
    pub comments: Vec<u8>,
    pub members: Vec<u8>,
}

impl State {
    pub fn new() -> Self {
        State {
            locations: HashMap::new(),
        }
    }

    pub fn add_location(&mut self, location: Location) {
        self.locations.insert(location.id, location);
    }

    pub fn get_location(&self, id: &Uuid) -> Option<&Location> {
        self.locations.get(id)
    }

    pub fn get_location_mut(&mut self, id: &Uuid) -> Option<&mut Location> {
        self.locations.get_mut(id)
    }

    pub fn remove_location(&mut self, id: &Uuid) -> Option<Location> {
        self.locations.remove(id)
    }

    pub fn add_comment_to_location(
        &mut self,
        location_id: &Uuid,
        author: String,
        content: String,
    ) -> Result<()> {
        self.locations
            .get_mut(location_id)
            .ok_or_else(|| anyhow!("Location not found"))?
            .add_comment(author, content)
    }

    pub fn add_member_to_location(&mut self, location_id: &Uuid, member: String) -> Result<()> {
        self.locations
            .get_mut(location_id)
            .ok_or_else(|| anyhow!("Location not found"))?
            .add_member(member)
    }

    pub fn remove_member_from_location(&mut self, location_id: &Uuid, member: &str) -> Result<()> {
        self.locations
            .get_mut(location_id)
            .ok_or_else(|| anyhow!("Location not found"))?
            .remove_member(member)
    }

    pub fn serialize(&mut self) -> Result<Vec<u8>> {
        let serializable_state = SerializableState {
            locations: self
                .locations
                .iter_mut()
                .map(|(id, location)| {
                    let (comments, members) = location
                        .serialize_crdt_data()
                        .expect("Failed to serialize CRDT data");
                    (
                        *id,
                        SerializableLocation {
                            location: location.clone(),
                            comments,
                            members,
                        },
                    )
                })
                .collect(),
        };
        Ok(serde_json::to_vec(&serializable_state)?)
    }

    pub fn deserialize(data: &[u8]) -> Result<Self> {
        let serializable_state: SerializableState = serde_json::from_slice(data)?;
        let mut state = State::new();
        for (id, serializable_location) in serializable_state.locations {
            let mut location = serializable_location.location;
            location.deserialize_crdt_data(
                &serializable_location.comments,
                &serializable_location.members,
            )?;
            state.locations.insert(id, location);
        }
        Ok(state)
    }
}
