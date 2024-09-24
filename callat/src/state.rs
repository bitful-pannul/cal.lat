use anyhow::{anyhow, Result};
// use chrono::{DateTime, Utc}; these are all annoying
use kinode_process_lib::{
    sqlite::{self, Sqlite},
    Address, NodeId,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Location {
    pub uuid: Uuid,
    pub start_date: i64, // Store as Unix timestamp?
    pub end_date: i64,   // Store as Unix timestamp?
    pub owner: NodeId,
    pub description: String,
    pub latitude: f64,
    pub longitude: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub enum FriendType {
    Best,         // full granularity: exact dates and times, exact locations
    CloseFriend,  // time-granularity of "day", location-granularity of "city"
    Acquaintance, // time-granularity of "week", location-granularity of "country"
}

pub type Friends = HashMap<NodeId, FriendType>;

pub struct State {
    pub db: DB,
    pub friends: Friends,
}

impl State {
    pub fn new(our: &Address) -> Result<Self> {
        Ok(Self {
            db: DB::connect(our)?,
            friends: HashMap::new(),
        })
    }

    pub fn add_location(&mut self, location: Location) -> Result<()> {
        self.db.insert_location(&location)
    }

    pub fn update_location(&mut self, location: Location) -> Result<()> {
        self.db.update_location(&location)
    }

    pub fn get_location(&self, uuid: &Uuid) -> Result<Option<Location>> {
        self.db.get_location(uuid)
    }

    pub fn get_all_locations(&self) -> Result<Vec<Location>> {
        self.db.get_all_locations()
    }

    pub fn get_locations_in_range(&self, start: i64, end: i64) -> Result<Vec<Location>> {
        self.db.get_locations_in_range(start, end)
    }

    pub fn add_friend(&mut self, node_id: NodeId, friend_type: FriendType) {
        self.friends.insert(node_id, friend_type);
    }

    pub fn remove_friend(&mut self, node_id: &NodeId) {
        self.friends.remove(node_id);
    }

    pub fn get_friend_type(&self, node_id: &NodeId) -> Option<&FriendType> {
        self.friends.get(node_id)
    }
}

pub struct DB {
    pub inner: Sqlite,
}

impl DB {
    pub fn connect(our: &Address) -> Result<Self> {
        let inner = sqlite::open(our.package_id(), "nomad_social.sqlite", Some(10))?;
        inner.write(CREATE_LOCATIONS_TABLE.to_string(), vec![], None)?;
        Ok(Self { inner })
    }

    pub fn insert_location(&self, location: &Location) -> Result<()> {
        let query = "INSERT INTO locations (uuid, start_date, end_date, owner, description, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?)";
        let params = vec![
            location.uuid.to_string().into(),
            location.start_date.into(),
            location.end_date.into(),
            location.owner.to_string().into(),
            location.description.clone().into(),
            location.latitude.into(),
            location.longitude.into(),
        ];
        self.inner.write(query.to_string(), params, None)?;
        Ok(())
    }

    pub fn update_location(&self, location: &Location) -> Result<()> {
        let query = "UPDATE locations SET start_date = ?, end_date = ?, description = ?, latitude = ?, longitude = ? WHERE uuid = ?";
        let params = vec![
            location.start_date.into(),
            location.end_date.into(),
            location.description.clone().into(),
            location.latitude.into(),
            location.longitude.into(),
            location.uuid.to_string().into(),
        ];
        self.inner.write(query.to_string(), params, None)?;
        Ok(())
    }

    pub fn get_all_locations(&self) -> Result<Vec<Location>> {
        let query = "SELECT * FROM locations";
        let results = self.inner.read(query.to_string(), vec![])?;
        results
            .into_iter()
            .map(|row| self.row_to_location(&row))
            .collect()
    }

    pub fn get_location(&self, uuid: &Uuid) -> Result<Option<Location>> {
        let query = "SELECT * FROM locations WHERE uuid = ?";
        let params = vec![uuid.to_string().into()];
        let results = self.inner.read(query.to_string(), params)?;
        if let Some(row) = results.get(0) {
            Ok(Some(self.row_to_location(row)?))
        } else {
            Ok(None)
        }
    }

    pub fn get_locations_in_range(&self, start: i64, end: i64) -> Result<Vec<Location>> {
        let query =
            "SELECT * FROM locations WHERE start_date <= ? AND (end_date >= ? OR end_date IS NULL)";
        let params = vec![end.into(), start.into()];
        let results = self.inner.read(query.to_string(), params)?;
        results
            .into_iter()
            .map(|row| self.row_to_location(&row))
            .collect()
    }

    fn row_to_location(&self, row: &HashMap<String, serde_json::Value>) -> Result<Location> {
        Ok(Location {
            uuid: Uuid::parse_str(
                row["uuid"]
                    .as_str()
                    .ok_or_else(|| anyhow::anyhow!("Invalid UUID"))?,
            )?,
            start_date: row["start_date"]
                .as_i64()
                .ok_or_else(|| anyhow::anyhow!("Invalid start_date"))?,
            end_date: row["end_date"]
                .as_i64()
                .ok_or_else(|| anyhow::anyhow!("Invalid end_date"))?,
            owner: row["owner"]
                .as_str()
                .ok_or_else(|| anyhow!("Invalid owner"))?
                .parse()?,
            description: row["description"]
                .as_str()
                .ok_or_else(|| anyhow!("Invalid description"))?
                .to_string(),
            latitude: row["latitude"]
                .as_f64()
                .ok_or_else(|| anyhow!("Invalid latitude"))?,
            longitude: row["longitude"]
                .as_f64()
                .ok_or_else(|| anyhow!("Invalid longitude"))?,
        })
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewLocation {
    pub start_date: i64,
    pub end_date: i64,
    pub description: String,
    pub latitude: f64,
    pub longitude: f64,
}

const CREATE_LOCATIONS_TABLE: &str = "
CREATE TABLE IF NOT EXISTS locations (
    uuid TEXT PRIMARY KEY,
    start_date INTEGER NOT NULL,
    end_date INTEGER,
    owner TEXT NOT NULL,
    description TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL
);";
