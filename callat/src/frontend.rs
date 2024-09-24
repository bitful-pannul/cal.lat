use kinode_process_lib::{homepage, http, Address};

pub fn serve(our: &Address) {
    homepage::add_to_homepage("cal.lat", None, Some("/"), None);
    let mut server = http::server::HttpServer::new(10);
    server
        .serve_ui(
            our,
            "ui",
            vec!["/"],
            http::server::HttpBindingConfig::default(),
        )
        .expect("failed to serve ui");
}
