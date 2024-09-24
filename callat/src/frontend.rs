use kinode_process_lib::{homepage, http, Address, LazyLoadBlob, Message};

pub fn serve(our: &Address) -> http::server::HttpServer {
    homepage::add_to_homepage("cal.lat", None, Some("/"), None);
    let mut server = http::server::HttpServer::new(10);
    let config = http::server::HttpBindingConfig::default();
    server
        .serve_ui(our, "ui", vec!["/"], config.clone())
        .expect("failed to serve ui");

    // bind GET /api/all_events
    // TODO: /api/:id
    //       /api/:start-date/:end-date
    //       etc etc
    server
        .bind_http_path("/api/all_events", config)
        .expect("failed to bind /api/all_events");

    server
}

pub fn handle_request(
    server: &mut http::server::HttpServer,
    message: &Message,
) -> anyhow::Result<()> {
    let request = server.parse_request(message.body())?;

    server.handle_request(
        request,
        |request| {
            // ignore http requests for now
            println!("got http request: {:?}", request);
            (
                http::server::HttpResponse::new(http::StatusCode::OK),
                Some(LazyLoadBlob {
                    mime: Some("application/json".into()),
                    bytes: serde_json::json!({
                        "one": {
                            "lon": -95.075587,
                            "lat": 56.157916
                        }
                    })
                    .to_string()
                    .as_bytes()
                    .to_vec(),
                }),
            )
        },
        |_, _, _| {
            // ignore ws pushes for now
        },
    );

    Ok(())
}
