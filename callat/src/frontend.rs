use crate::state::{Friend, FriendType, Location, NewLocation, State};
use anyhow::{anyhow, Result};
use kinode_process_lib::{get_blob, http, println, Address, LazyLoadBlob, Message};
use serde_json::json;
use uuid::Uuid;

pub fn serve(our: &Address) -> http::server::HttpServer {
    let mut server = http::server::HttpServer::new(10);
    let config = http::server::HttpBindingConfig::default();
    server
        .serve_ui(our, "ui", vec!["/"], config.clone())
        .expect("failed to serve ui");
    server
        .bind_http_path("/api/locations", config.clone())
        .expect("failed to bind /api/locations");
    server
        .bind_http_path("/api/friends/pending", config.clone())
        .expect("failed to bind /api/friends/pending");
    server
        .bind_http_path("/api/friends", config.clone())
        .expect("failed to bind /api/friends");
    server
        .bind_http_path("/api/friends/sync", config.clone())
        .expect("failed to bind /api/friends/ping");
    server
        .bind_http_path("/api/friends/accept", config.clone())
        .expect("failed to bind /api/friends/accept");
    server
        .bind_http_path("/api/friends/reject", config.clone())
        .expect("failed to bind /api/friends/reject");
    server
        .bind_http_path("/api/friends/cancel", config.clone())
        .expect("failed to bind /api/friends/cancel");
    server
        .bind_http_path("/api/locations/:id", config)
        .expect("failed to bind /api/locations/:id");
    server
}

pub fn handle_request(
    our: &Address,
    server: &mut http::server::HttpServer,
    message: &Message,
    state: &mut State,
) -> Result<()> {
    let request = server.parse_request(message.body())?;

    server.handle_request(
        request,
        |req| {
            let method = req.method().unwrap_or_default();
            let path = req.path().unwrap_or_default();

            println!("method: {:?}, path: {:?}", method, path);
            let result = match (method.as_str(), path.as_str()) {
                ("GET", "/api/locations") => handle_get_locations(req, state),
                ("POST", "/api/locations") => handle_add_location(req, state, our),
                ("GET", p) if p.starts_with("/api/locations/") => handle_get_location(req, state),
                ("PUT", p) if p.starts_with("/api/locations/") => {
                    handle_update_location(req, state)
                }
                ("GET", "/api/friends") => handle_get_friends(state),
                ("POST", "/api/friends") => handle_add_friend(state),
                ("GET", "/api/friends/pending") => handle_get_pending_friends(state),
                ("POST", "/api/friends/accept") => handle_accept_friend(state),
                ("POST", "/api/friends/reject") => handle_reject_friend(state),
                ("POST", "/api/friends/remove") => handle_remove_friend(state),
                ("POST", "/api/friends/cancel") => handle_cancel_friend(state),
                ("POST", "/api/friends/ping") => handle_ping_friend(state),

                ("GET", "/api/ping") => handle_ping(state),
                ("GET", "/api/custom_lists") => handle_get_custom_lists(state),
                ("POST", "/api/custom_lists") => handle_add_custom_list(state),
                _ => Err(anyhow!("Not Found")),
            };

            match result {
                Ok(response) => response,
                Err(e) => error_response(e),
            }
        },
        |_, _, _| {}, // ignore ws pushes for now
    );

    Ok(())
}

fn handle_get_locations(
    req: http::server::IncomingHttpRequest,
    state: &State,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let start = req
        .query_params()
        .get("start")
        .and_then(|s| s.parse::<i64>().ok());
    let end = req
        .query_params()
        .get("end")
        .and_then(|s| s.parse::<i64>().ok());

    let locations = match (start, end) {
        (Some(start), Some(end)) => state.get_locations_in_range(start, end)?,
        _ => state.db.get_all_locations()?,
    };

    ok_response(&locations)
}

fn handle_add_location(
    _req: http::server::IncomingHttpRequest,
    state: &mut State,
    our: &Address,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let body = get_blob().ok_or_else(|| anyhow!("no blob in request"))?;
    let new_location: NewLocation = serde_json::from_slice(body.bytes())?;

    let location = Location {
        uuid: Uuid::new_v4(),
        start_date: new_location.start_date,
        end_date: new_location.end_date,
        description: new_location.description,
        latitude: new_location.latitude,
        longitude: new_location.longitude,
        owner: our.node().to_string(),
        photos: new_location.photos,
    };

    println!("adding location: {:?}", location);
    state.add_location(location)?;
    ok_response(&json!({"message": "location added successfully"}))
}

fn handle_ping(state: &mut State) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let body = get_blob().ok_or_else(|| anyhow!("no blob in request"))?;
    let data: serde_json::Value = serde_json::from_slice(body.bytes())?;
    let node_id = data["node_id"]
        .as_str()
        .ok_or_else(|| anyhow!("invalid node ID"))?
        .parse()?;

    state.ping_node(node_id);

    ok_response(&json!({"message": "ping sent successfully"}))
}

fn handle_add_custom_list(
    state: &mut State,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let body = get_blob().ok_or_else(|| anyhow!("no blob in request"))?;
    let data: serde_json::Value = serde_json::from_slice(body.bytes())?;
    let list_name = data["list_name"]
        .as_str()
        .ok_or_else(|| anyhow!("Invalid list name"))?;
    let node_id = data["node_id"]
        .as_str()
        .ok_or_else(|| anyhow!("Invalid node ID"))?
        .parse()?;

    state.add_to_custom_list(list_name.to_string(), node_id);
    ok_response(&json!({"message": "node {node_id} added to list {list_name} successfully"}))
}

fn handle_get_friends(state: &State) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let friends: Vec<&Friend> = state.friends.values().collect();
    println!("friends: {:?}", friends);
    ok_response(&friends)
}

fn handle_get_pending_friends(
    state: &State,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let incoming = state
        .pending_friend_requests
        .iter()
        .filter(|(_, is_local)| !is_local)
        .map(|(friend, _)| friend)
        .collect::<Vec<_>>();
    let outgoing = state
        .pending_friend_requests
        .iter()
        .filter(|(_, is_local)| *is_local)
        .map(|(friend, _)| friend)
        .collect::<Vec<_>>();
    ok_response(&json!({
        "incoming": incoming,
        "outgoing": outgoing
    }))
}

fn handle_cancel_friend(
    state: &mut State,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let body = get_blob().ok_or_else(|| anyhow!("no blob in request"))?;
    let data: serde_json::Value = serde_json::from_slice(body.bytes())?;
    let node_id = data["node_id"]
        .as_str()
        .ok_or_else(|| anyhow!("Invalid node ID"))?;

    state
        .pending_friend_requests
        .retain(|(friend, _)| friend.node_id != node_id);

    ok_response(&json!({"message": "friend request canceled successfully"}))
}

fn handle_add_friend(
    state: &mut State,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let body = get_blob().ok_or_else(|| anyhow!("no blob in request"))?;
    let data: serde_json::Value = serde_json::from_slice(body.bytes())?;
    // todo, maybe custom AddFriend type?
    let node_id = data["node_id"]
        .as_str()
        .ok_or_else(|| anyhow!("Invalid node ID"))?
        .parse()?;

    let friend_type = data["friend_type"]
        .as_str()
        .ok_or_else(|| anyhow!("Invalid friend type"))?;

    let friend_type = match friend_type {
        "Best" => FriendType::Best,
        "CloseFriend" => FriendType::CloseFriend,
        "Acquaintance" => FriendType::Acquaintance,
        _ => return Err(anyhow!("Invalid friend type")),
    };

    state.send_friend_request(node_id, friend_type);

    ok_response(&json!({"message": "friend added successfully"}))
}

fn handle_accept_friend(
    state: &mut State,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let body = get_blob().ok_or_else(|| anyhow!("no blob in request"))?;
    let data: serde_json::Value = serde_json::from_slice(body.bytes())?;
    let node_id = data["node_id"]
        .as_str()
        .ok_or_else(|| anyhow!("Invalid node ID"))?
        .parse()?;

    let friend_type = match data["friend_type"].as_str() {
        Some("Best") => FriendType::Best,
        Some("CloseFriend") => FriendType::CloseFriend,
        Some("Acquaintance") => FriendType::Acquaintance,
        _ => return Err(anyhow!("Invalid friend type")),
    };

    state.accept_friend_request(node_id, friend_type)?;
    ok_response(&json!({"message": "friend request accepted successfully"}))
}

fn handle_ping_friend(
    state: &mut State,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let body = get_blob().ok_or_else(|| anyhow!("no blob in request"))?;
    let data: serde_json::Value = serde_json::from_slice(body.bytes())?;
    let node_id = data["node_id"]
        .as_str()
        .ok_or_else(|| anyhow!("Invalid node ID"))?
        .parse()?;

    state.ping_friend(node_id);
    ok_response(&json!({"message": "friend pinged successfully"}))
}

fn handle_reject_friend(
    state: &mut State,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let body = get_blob().ok_or_else(|| anyhow!("no blob in request"))?;
    let data: serde_json::Value = serde_json::from_slice(body.bytes())?;
    let node_id = data["node_id"]
        .as_str()
        .ok_or_else(|| anyhow!("Invalid node ID"))?
        .parse()?;

    state.reject_friend_request(node_id);
    ok_response(&json!({"message": "friend request rejected successfully"}))
}

fn handle_remove_friend(
    state: &mut State,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let body = get_blob().ok_or_else(|| anyhow!("no blob in request"))?;
    let data: serde_json::Value = serde_json::from_slice(body.bytes())?;
    let node_id = data["node_id"]
        .as_str()
        .ok_or_else(|| anyhow!("Invalid node ID"))?
        .parse()?;

    state.remove_friend(&node_id);
    ok_response(&json!({"message": "friend removed successfully"}))
}

fn handle_get_custom_lists(
    state: &State,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    ok_response(&state.custom_lists)
}

fn handle_get_location(
    req: http::server::IncomingHttpRequest,
    state: &State,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let uuid = get_uuid_from_path(&req)?;
    let location = state
        .get_location(&uuid)?
        .ok_or_else(|| anyhow!("location not found"))?;
    ok_response(&location)
}

fn handle_update_location(
    req: http::server::IncomingHttpRequest,
    state: &mut State,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    let uuid = get_uuid_from_path(&req)?;
    let body = get_blob().ok_or_else(|| anyhow!("no blob in request"))?;
    let mut location: Location = serde_json::from_slice(body.bytes())?;
    location.uuid = uuid;
    state.update_location(location)?;
    ok_response(&json!({"message": "location updated successfully"}))
}

fn get_uuid_from_path(req: &http::server::IncomingHttpRequest) -> Result<Uuid> {
    let path = req.path().map_err(|e| anyhow!("Invalid path: {}", e))?;
    let id = path
        .split('/')
        .last()
        .ok_or_else(|| anyhow!("invalid path format"))?;
    Uuid::parse_str(id).map_err(|e| anyhow!("invalid UUID: {}", e))
}

fn ok_response<T: serde::Serialize>(
    data: &T,
) -> Result<(http::server::HttpResponse, Option<LazyLoadBlob>)> {
    Ok((
        http::server::HttpResponse::new(http::StatusCode::OK),
        Some(LazyLoadBlob {
            mime: Some("application/json".into()),
            bytes: serde_json::to_vec(data)?,
        }),
    ))
}

fn error_response(error: anyhow::Error) -> (http::server::HttpResponse, Option<LazyLoadBlob>) {
    let status = if error.to_string().contains("not found") {
        http::StatusCode::NOT_FOUND
    } else {
        http::StatusCode::INTERNAL_SERVER_ERROR
    };

    println!("HTTPerror: {:?}", error);

    (
        http::server::HttpResponse::new(status),
        Some(LazyLoadBlob {
            mime: Some("application/json".into()),
            bytes: json!({"error": error.to_string()}).to_string().into_bytes(),
        }),
    )
}
