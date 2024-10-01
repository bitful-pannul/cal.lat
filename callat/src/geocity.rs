use kinode_process_lib::{vfs, Address};
use rstar::{PointDistance, RTree, RTreeObject, AABB};
use serde::{Deserialize, Serialize};

use crate::state::FriendType;

pub fn load_cities_from_file(our: &Address) -> anyhow::Result<Vec<City>> {
    let file_path = format!("{}/pkg/10cities.json", our.package_id());
    let file = vfs::open_file(&file_path, false, None)?;
    let bytes = file.read()?;
    let cities: Vec<City> = serde_json::from_slice(&bytes)?;
    Ok(cities)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct City {
    pub name: String,
    pub country: String,
    pub latitude: f64,
    pub longitude: f64,
}

impl RTreeObject for City {
    type Envelope = AABB<[f64; 2]>;

    fn envelope(&self) -> Self::Envelope {
        AABB::from_point([self.longitude, self.latitude])
    }
}

impl PointDistance for City {
    fn distance_2(&self, point: &[f64; 2]) -> f64 {
        let dx = self.longitude - point[0];
        let dy = self.latitude - point[1];
        dx * dx + dy * dy
    }
}

pub struct GranularityProtocol {
    city_tree: RTree<City>,
}

impl GranularityProtocol {
    pub fn new(cities: Vec<City>) -> Self {
        Self {
            city_tree: RTree::bulk_load(cities),
        }
    }

    pub fn closest_city(&self, longitude: f64, latitude: f64) -> Option<&City> {
        self.city_tree.nearest_neighbor(&[longitude, latitude])
    }

    pub fn fuzz_location(
        &self,
        longitude: f64,
        latitude: f64,
        friend_type: &FriendType,
    ) -> (f64, f64) {
        match friend_type {
            FriendType::Best => (longitude, latitude), // exact location
            FriendType::CloseFriend => {
                // return coordinates of the nearest city
                if let Some(city) = self.closest_city(longitude, latitude) {
                    (city.longitude, city.latitude)
                } else {
                    (longitude, latitude) // fallback to exact location if no city found
                }
            }
            FriendType::Acquaintance => {
                // return coordinates of the nearest country
                // todo: add random country centroid
                if let Some(city) = self.closest_city(longitude, latitude) {
                    (city.longitude, city.latitude)
                } else {
                    (longitude, latitude) // Fallback to exact location if no city found
                }
            }
        }
    }
}
