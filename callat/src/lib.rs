use std::str::FromStr;

use anyhow::Result;
use kinode::process::standard::NodeId;
use kinode_process_lib::{await_message, http, println, Address, Message, ProcessId, Request};
use serde::{Deserialize, Serialize};

mod frontend;
mod geocity;
mod state;
use state::{Location, State};

wit_bindgen::generate!({
    path: "target/wit",
    world: "callat-template-os-v0",
    generate_unused_types: true,
    additional_derives: [PartialEq, serde::Deserialize, serde::Serialize],
});

const TIMEOUT: u64 = 30;

// Local requests like adding a friend, updating a location, etc.
// are handled by http methods in frontend.rs.

#[derive(Debug, Serialize, Deserialize)]
pub enum RemoteRequest {
    Ping,                              // request remote node to update us
    Sync { locations: Vec<Location> }, // message, spinning sync until received?
    FriendRequest,
    FriendResponse,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum LocationResponse {
    Ok(()),
    Err(LocationError),
}

#[derive(Debug, Serialize, Deserialize)]
pub enum LocationError {
    UnknownLocation,
    UnauthorizedMember,
    BadSync,
    InviteNotFound,
}

kinode_process_lib::call_init!(init);
fn init(our: Address) {
    let mut state = State::new(&our).unwrap();

    let mut server = frontend::serve(&our);

    loop {
        handle_message(&our, &mut state, &mut server)
            .map_err(|e| println!("error: {:?}", e))
            .ok();
    }
}

fn handle_message(
    our: &Address,
    state: &mut State,
    server: &mut http::server::HttpServer,
) -> Result<()> {
    match await_message() {
        Ok(message) => {
            if message.is_local(our) {
                if message.is_process("timer:distro:sys") {
                    println!("got timer");
                    kinode_process_lib::timer::set_timer(30_000, None);
                    Ok(())
                } else if message.is_process("http_server:distro:sys") {
                    frontend::handle_request(our, server, &message, state)?;
                    Ok(())
                } else {
                    Ok(())
                }
            } else if message.is_request() {
                handle_remote_message(our, message, state)?;
                Ok(())
            } else {
                Ok(())
            }
        }
        Err(send_error) => {
            if send_error.message.is_request() {
                if let Some(context) = send_error.context() {
                    let _target: Address = std::str::from_utf8(context)?.parse()?;
                    // Implement retry logic if needed
                }
            }
            Ok(())
        }
    }
}

fn handle_remote_message(our: &Address, message: Message, state: &mut State) -> Result<()> {
    let sender: NodeId = message.source().node().into();

    match serde_json::from_slice::<RemoteRequest>(message.body())? {
        RemoteRequest::Ping => {
            println!("Received ping from {}", sender);

            // if node is a friend, get it's status and give it our latest locations
            if let Some(friend) = state.get_friend(&sender) {
                let locations = state.get_locations_by_owner(&our.node().into())?;

                // for each location, fuzz the date and location and send to friend,
                // only our own locations for now, can gossip around others as well..
                let fuzzed_locations = state
                    .geo_protocol
                    .fuzz_locations(locations, &friend.friend_type);

                let req = RemoteRequest::Sync {
                    locations: fuzzed_locations,
                };

                let address = Address::new(sender, ProcessId::from_str(our.process()).unwrap());

                Request::to(address)
                    .body(serde_json::to_vec(&req)?)
                    .send()?;
            }
        }
        RemoteRequest::Sync { locations } => {
            println!("Received sync data for {} locations", locations.len());

            for location in locations {
                state.add_location(location)?;
            }
            // push notifs?
        }
        RemoteRequest::FriendRequest => {
            println!("Received friend request from {}", sender);
            state.add_pending_friend_request(sender);
            // push notifs here would be pretty cool no?
        }
        RemoteRequest::FriendResponse => {
            println!("Received friend response from {}", sender);
            state.handle_friend_response(sender);
        }
    }
    Ok(())
}
