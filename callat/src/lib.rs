use anyhow::Result;
use kinode_process_lib::{await_message, println, Address, Message, Request, Response};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

mod state;
use state::{Coordinate, Location, State, TimeRange};

wit_bindgen::generate!({
    path: "target/wit",
    world: "callat-template-os-v0",
    generate_unused_types: true,
    additional_derives: [PartialEq, serde::Deserialize, serde::Serialize],
});

const TIMEOUT: u64 = 30;

#[derive(Serialize, Deserialize)]
pub enum LocationRequest {
    Local(LocalLocationRequest),
    Remote(RemoteLocationRequest),
}

#[derive(Debug, Serialize, Deserialize)]
pub enum LocalLocationRequest {
    NewLocation(Location),
    RemoveLocation(Uuid),
    AddComment(Uuid, String),   // (location_id, content)
    AddMember(Uuid, String),    // (location_id, member)
    RemoveMember(Uuid, String), // (location_id, member)
    UpdateLocation(Uuid, LocationUpdate),
    CreateInvite(Uuid, Address),
    AcceptInvite(Uuid),
    RejectInvite(Uuid),
}

#[derive(Debug, Serialize, Deserialize)]
pub enum LocationUpdate {
    SetDescription(String),
    SetTimeRange(TimeRange),
    SetCoordinate(Coordinate),
}

#[derive(Debug, Serialize, Deserialize)]
pub enum RemoteLocationRequest {
    Sync {
        location_id: Uuid,
        comments: Vec<u8>,
        members: Vec<u8>,
    },
    Invite {
        location_id: Uuid,
        name: String,
        data: Vec<u8>,
    },
    InviteResponse {
        location_id: Uuid,
        accepted: bool,
    },
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
    let mut state = match kinode_process_lib::get_state() {
        Some(saved_state) => match State::deserialize(&saved_state) {
            Ok(state) => {
                println!("loading saved state");
                state
            }
            Err(e) => {
                println!(
                    "failed to deserialize saved state: {:?}, generating new state",
                    e
                );
                State::new()
            }
        },
        None => {
            println!("no saved state found, generating new state");
            State::new()
        }
    };

    // frontend::serve(&our);

    kinode_process_lib::timer::set_timer(30_000, None);

    loop {
        handle_message(&our, &mut state)
            .map_err(|e| println!("error: {:?}", e))
            .ok();
    }
}

fn handle_message(our: &Address, state: &mut State) -> Result<()> {
    match await_message() {
        Ok(message) => {
            if message.is_local(our) {
                if message.is_process("timer:distro:sys") {
                    // state.retry_all_failed_messages()?;
                    println!("got tima");
                    kinode_process_lib::timer::set_timer(30_000, None);
                    Ok(())
                } else if message.is_process("http_server:distro:sys") {
                    // Assume frontend::handle_http_request is implemented elsewhere
                    // frontend::handle_http_request(our, message, state, ws_channels)
                    Ok(())
                } else if message.is_request() {
                    let request: LocalLocationRequest = serde_json::from_slice(message.body())?;
                    handle_local_request(our, request, state)?;
                    // Assume frontend::send_ws_updates is implemented elsewhere
                    // frontend::send_ws_updates(&state, ws_channels);
                    // state.persist();
                    Ok(())
                } else {
                    Ok(())
                }
            } else if message.is_request() {
                handle_remote_message(our, message, state)?;
                // frontend::send_ws_updates(&state, ws_channels);
                // state.persist();
                Ok(())
            } else {
                Ok(())
            }
        }
        Err(send_error) => {
            if send_error.message.is_request() {
                if let Some(context) = send_error.context() {
                    let target: Address = std::str::from_utf8(context)?.parse()?;
                    // tate.failed_messages.insert(target, send_error.message);
                }
            }
            Ok(())
        }
    }
}

fn handle_local_request(
    our: &Address,
    request: LocalLocationRequest,
    state: &mut State,
) -> Result<()> {
    match request {
        LocalLocationRequest::NewLocation(location) => {
            state.add_location(location);
        }
        LocalLocationRequest::RemoveLocation(location_id) => {
            state.remove_location(&location_id);
        }
        LocalLocationRequest::AddComment(location_id, content) => {
            let author = "TODO".to_string();
            state.add_comment_to_location(&location_id, author, content)?;
        }
        LocalLocationRequest::AddMember(location_id, member) => {
            state.add_member_to_location(&location_id, member)?;
        }
        LocalLocationRequest::RemoveMember(location_id, member) => {
            state.remove_member_from_location(&location_id, &member)?;
        }
        LocalLocationRequest::UpdateLocation(location_id, update) => {
            if let Some(location) = state.get_location_mut(&location_id) {
                match update {
                    LocationUpdate::SetDescription(description) => {
                        location.set_description(description);
                    }
                    LocationUpdate::SetTimeRange(time_range) => {
                        location.set_time_range(time_range);
                    }
                    LocationUpdate::SetCoordinate(coordinate) => {
                        location.set_coordinate(coordinate);
                    }
                }
            }
        }
        LocalLocationRequest::CreateInvite(location_id, address) => {
            if let Some(location) = state.get_location(&location_id) {
                let data = serde_json::to_vec(&location)?;
                Request::to(&address)
                    .body(serde_json::to_vec(&RemoteLocationRequest::Invite {
                        location_id,
                        name: location.description.clone(),
                        data,
                    })?)
                    .context(address.to_string())
                    .expects_response(TIMEOUT)
                    .send()?;
            }
        }
        LocalLocationRequest::AcceptInvite(_location_id) => {
            // Implement invite acceptance logic using state functions
        }
        LocalLocationRequest::RejectInvite(_location_id) => {
            // Implement invite rejection logic using state functions
        }
    }
    Ok(())
}

fn handle_remote_message(our: &Address, message: Message, state: &mut State) -> Result<()> {
    match serde_json::from_slice::<RemoteLocationRequest>(message.body())? {
        RemoteLocationRequest::Sync {
            location_id,
            comments,
            members,
        } => {
            if let Some(location) = state.get_location_mut(&location_id) {
                location.deserialize_crdt_data(&comments, &members)?;
            } else {
                return respond_with_err(LocationError::UnknownLocation);
            }
        }
        RemoteLocationRequest::Invite {
            location_id,
            name: _,
            data,
        } => {
            let location: Location = serde_json::from_slice(&data)?;
            state.add_location(location);
        }
        RemoteLocationRequest::InviteResponse {
            location_id: _,
            accepted: _,
        } => {
            // Implement invite response logic using state functions
        }
    }
    Response::new()
        .body(serde_json::to_vec(&LocationResponse::Ok(()))?)
        .send()?;
    Ok(())
}

// TODO...
fn respond_with_err(err: LocationError) -> anyhow::Result<()> {
    Response::new()
        .body(serde_json::to_vec(&LocationResponse::Err(err))?)
        .send()
        .unwrap();
    Ok(())
}

// Additional helper functions can be added here as needed
