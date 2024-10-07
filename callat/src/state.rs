use anyhow::{anyhow, Result};
use chrono::{DateTime, Datelike, Duration, Utc};
use kinode_process_lib::{
    sqlite::{self, Sqlite},
    Address, NodeId, ProcessId, Request,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, str::FromStr};
use uuid::Uuid;

use crate::{
    geocity::{load_cities_from_file, GranularityProtocol},
    RemoteRequest,
};

const PROCESS_ID: &str = "callat:callat:template.os";

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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Friend {
    pub node_id: NodeId,
    pub friend_type: FriendType,
    pub last_pinged: i64, // unix timestamp
}

pub type Friends = HashMap<NodeId, Friend>;
pub type CustomLists = HashMap<String, Vec<NodeId>>; // not in active use yet.
pub type PendingFriendRequests = Vec<(Friend, bool)>; // (node_id, is_local)

pub struct State {
    pub db: DB,
    pub friends: Friends,
    pub pending_friend_requests: PendingFriendRequests,
    pub custom_lists: CustomLists,
    pub geo_protocol: GranularityProtocol,
}

impl State {
    pub fn new(our: &Address) -> Result<Self> {
        let cities = load_cities_from_file(our).expect("Failed to load cities json");
        Ok(Self {
            db: DB::connect(our)?,
            friends: HashMap::new(),
            pending_friend_requests: Vec::new(),
            custom_lists: HashMap::new(),
            geo_protocol: GranularityProtocol::new(cities),
        })
    }

    pub fn add_location(&mut self, location: Location) -> Result<()> {
        self.db.insert_location(&location)?;

        for friend in self.friends.values() {
            let fuzzed_location = self
                .geo_protocol
                .fuzz_location(&location, &friend.friend_type);
            let req = RemoteRequest::Sync {
                locations: vec![fuzzed_location],
            };
            let address = Address::new(
                friend.node_id.clone(),
                ProcessId::from_str(PROCESS_ID).unwrap(),
            );
            Request::to(address)
                .body(serde_json::to_vec(&req)?)
                .send()
                .unwrap();
        }
        Ok(())
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

    pub fn get_locations_by_owner(&self, owner: &NodeId) -> Result<Vec<Location>> {
        self.db.get_locations_by_owner(owner)
    }

    pub fn ping_node(&mut self, node_id: NodeId) {
        if let Some(friend) = self.friends.get_mut(&node_id) {
            friend.last_pinged = Utc::now().timestamp();
        }
        Request::to(Address::new(
            node_id,
            ProcessId::from_str(PROCESS_ID).unwrap(),
        ))
        .body(serde_json::to_vec(&RemoteRequest::Ping).unwrap())
        .send()
        .unwrap();
    }

    pub fn add_friend(&mut self, node_id: NodeId, friend_type: FriendType) {
        self.friends.insert(
            node_id.clone(),
            Friend {
                node_id: node_id.clone(),
                friend_type,
                last_pinged: Utc::now().timestamp(),
            },
        );
        Request::to(Address::new(
            node_id,
            ProcessId::from_str(PROCESS_ID).unwrap(),
        ))
        .body(serde_json::to_vec(&RemoteRequest::FriendResponse).unwrap())
        .send()
        .unwrap();
    }

    pub fn send_friend_request(&mut self, node_id: NodeId, friend_type: FriendType) {
        self.pending_friend_requests.push((
            Friend {
                node_id: node_id.clone(),
                friend_type,
                last_pinged: Utc::now().timestamp(),
            },
            true, // is_local
        ));
        println!("sending friend request to {}", node_id);
        Request::to(Address::new(
            node_id,
            ProcessId::from_str(PROCESS_ID).unwrap(),
        ))
        .body(serde_json::to_vec(&RemoteRequest::FriendRequest).unwrap())
        .send()
        .unwrap();
    }

    pub fn add_pending_friend_request(&mut self, node_id: NodeId) {
        self.pending_friend_requests.push((
            Friend {
                node_id,
                friend_type: FriendType::Acquaintance, // default, user can choose other when confirming.
                last_pinged: Utc::now().timestamp(),
            },
            false, // is_local
        ));
    }

    pub fn accept_friend_request(
        &mut self,
        node_id: NodeId,
        friend_type: FriendType,
    ) -> Result<()> {
        if let Some(index) = self
            .pending_friend_requests
            .iter()
            .position(|(friend, _)| friend.node_id == node_id)
        {
            let (friend, is_local) = self.pending_friend_requests.remove(index);
            if !is_local {
                self.add_friend(friend.node_id, friend_type);
                Ok(())
            } else {
                Err(anyhow!("Cannot accept a local friend request"))
            }
        } else {
            Err(anyhow!(
                "No pending friend request found for the given NodeId"
            ))
        }
    }

    pub fn reject_friend_request(&mut self, node_id: NodeId) {
        if let Some(index) = self
            .pending_friend_requests
            .iter()
            .position(|(friend, _)| friend.node_id == node_id)
        {
            self.pending_friend_requests.remove(index);
        }
    }

    //hmmm...
    pub fn handle_friend_request(&mut self, node_id: NodeId, friend_type: FriendType) {
        if self
            .pending_friend_requests
            .iter()
            .any(|(friend, _)| friend.node_id == node_id)
        {
            // If we already have a pending request from this node, accept it
            self.accept_friend_request(node_id, friend_type).unwrap();
        } else {
            // Otherwise, add it as a received request
            self.add_pending_friend_request(node_id);
        }
    }

    pub fn ping_friend(&mut self, node_id: NodeId) {
        if let Some(friend) = self.friends.get_mut(&node_id) {
            Request::to(Address::new(
                node_id,
                ProcessId::from_str(PROCESS_ID).unwrap(),
            ))
            .body(serde_json::to_vec(&RemoteRequest::Ping).unwrap())
            .send()
            .unwrap();
            friend.last_pinged = Utc::now().timestamp();
        }
    }

    pub fn handle_friend_response(&mut self, node_id: NodeId) {
        if let Some(index) = self
            .pending_friend_requests
            .iter()
            .position(|(friend, is_local)| friend.node_id == node_id && *is_local)
        {
            let (friend, _) = self.pending_friend_requests.remove(index);
            self.add_friend(node_id, friend.friend_type);
        }
    }
    pub fn remove_friend(&mut self, node_id: &NodeId) {
        self.friends.remove(node_id);
        for list in self.custom_lists.values_mut() {
            list.retain(|id| id != node_id);
        }
    }

    pub fn get_friend(&self, node_id: &NodeId) -> Option<&Friend> {
        self.friends.get(node_id)
    }

    pub fn add_to_custom_list(&mut self, list_name: String, node_id: NodeId) {
        self.custom_lists
            .entry(list_name)
            .or_default()
            .push(node_id);
    }

    pub fn remove_from_custom_list(&mut self, list_name: &str, node_id: &NodeId) {
        if let Some(list) = self.custom_lists.get_mut(list_name) {
            list.retain(|id| id != node_id);
        }
    }

    pub fn get_custom_list(&self, list_name: &str) -> Option<&Vec<NodeId>> {
        self.custom_lists.get(list_name)
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

    pub fn get_locations_by_owner(&self, owner: &NodeId) -> Result<Vec<Location>> {
        let query = "SELECT * FROM locations WHERE owner = ?";
        let params = vec![owner.to_string().into()];
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

// time granularity helpers

/// Rounds a timestamp to the nearest day. For FriendType::CloseFriend
pub fn round_to_day(timestamp: i64) -> i64 {
    let datetime = DateTime::from_timestamp(timestamp, 0).unwrap_or_default();
    let rounded = datetime.date_naive().and_hms_opt(0, 0, 0).unwrap();
    rounded.and_utc().timestamp()
}

/// Rounds a timestamp to the nearest week. For FriendType::Aacquaintance
pub fn round_to_week(timestamp: i64) -> i64 {
    let datetime = DateTime::from_timestamp(timestamp, 0).unwrap_or_default();
    let weekday = datetime.weekday().num_days_from_monday() as i64;
    let rounded = datetime.date_naive().and_hms_opt(0, 0, 0).unwrap() - Duration::days(weekday);
    rounded.and_utc().timestamp()
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
