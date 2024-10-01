use anyhow::Result;
use kinode_process_lib::{await_message, http, println, Address, Message, Request, Response};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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

#[derive(Serialize, Deserialize)]
pub enum LocationRequest {
    Local(LocalLocationRequest),
    Remote(RemoteLocationRequest),
}
//

#[derive(Debug, Serialize, Deserialize)]
pub enum LocalLocationRequest {
    NewLocation(Location),
    RemoveLocation(Uuid),
    UpdateLocation(Location),
    CreateInvite(Uuid, Address),
    AcceptInvite(Uuid),
    RejectInvite(Uuid),
}

#[derive(Debug, Serialize, Deserialize)]
pub enum RemoteLocationRequest {
    Sync {
        location_id: Uuid,
        data: Vec<u8>,
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
                } else if message.is_request() {
                    let request: LocalLocationRequest = serde_json::from_slice(message.body())?;
                    handle_local_request(our, request, state)?;
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

fn handle_local_request(
    our: &Address,
    request: LocalLocationRequest,
    state: &mut State,
) -> Result<()> {
    match request {
        LocalLocationRequest::NewLocation(location) => {
            state.add_location(location)?;
        }
        LocalLocationRequest::RemoveLocation(location_id) => {
            // state.remove_location(&location_id)?;
        }
        LocalLocationRequest::UpdateLocation(location) => {
            state.update_location(location)?;
        }
        LocalLocationRequest::CreateInvite(location_id, address) => {
            if let Some(location) = state.get_location(&location_id)? {
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
            // Implement invite acceptance logic
        }
        LocalLocationRequest::RejectInvite(_location_id) => {
            // Implement invite rejection logic
        }
    }
    Ok(())
}

fn handle_remote_message(our: &Address, message: Message, state: &mut State) -> Result<()> {
    match serde_json::from_slice::<RemoteLocationRequest>(message.body())? {
        RemoteLocationRequest::Sync { location_id, data } => {
            // if let Some(location) = state.get_location_mut(&location_id)? {
            //     // Implement CRDT merge logic here
            //     println!("Received sync data for location: {}", location_id);
            // } else {
            //     return respond_with_err(LocationError::UnknownLocation);
            // }
        }
        RemoteLocationRequest::Invite {
            location_id,
            name: _,
            data,
        } => {
            let location: Location = serde_json::from_slice(&data)?;
            state.add_location(location)?;
            println!("Received invite for location: {}", location_id);
        }
        RemoteLocationRequest::InviteResponse {
            location_id,
            accepted,
        } => {
            println!(
                "Received invite response for location: {}, accepted: {}",
                location_id, accepted
            );
            // Implement invite response logic
        }
    }
    Response::new()
        .body(serde_json::to_vec(&LocationResponse::Ok(()))?)
        .send()?;
    Ok(())
}

fn respond_with_err(err: LocationError) -> Result<()> {
    Response::new()
        .body(serde_json::to_vec(&LocationResponse::Err(err))?)
        .send()?;
    Ok(())
}
