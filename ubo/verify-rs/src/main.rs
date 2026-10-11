// SPDX-License-Identifier: GPL-3.0-or-later
// ubo-verify <ubo-resources.json> [--perm N]
//
// 1. every array element must deserialize into adblock-rust's `Resource` and be accepted by `InMemoryResourceStorage::add_resource`
//    (`Engine::use_resources` swallows rejections silently, so this goes through the storage directly);
// 2. through a real `Engine`: for every scriptlet name and alias a rule `h<i>.example.com##+js(<ident>)` must produce an
//    `injected_script` that calls the scriptlet's function and contains the text of its direct dependencies (an empty script is
//    expected exactly when the resource needs a permission bit the rules were not parsed with);
// 3. for every redirect resource name and alias a rule `||r<i>.example.net^$redirect=<ident>` must return a `data:` URL whose MIME and
//    bytes equal the resource (resources carrying a permission can never be redirects in adblock-rust: expected `None`).
// Exit status 1 on any failure.

use adblock::lists::{FilterSet, ParseOptions};
use adblock::request::Request;
use adblock::resources::{InMemoryResourceStorage, MimeType, PermissionMask, Resource, ResourceType};
use adblock::Engine;
use base64::prelude::{Engine as _, BASE64_STANDARD};
use std::collections::BTreeMap;

fn function_name(text: &str) -> Option<String> {
    let rest = text.strip_prefix("function")?;
    let rest = rest.trim_start();
    if rest.len() == text.len() - "function".len() { return None; } // `function(` / `functionX`
    let end = rest.find(|c: char| c == '(' || c.is_whitespace() || c == '{' || c == ')' || c == '}')?;
    Some(rest[..end].to_string())
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let path = match args.get(1) { Some(p) if !p.starts_with("--") => p.clone(), _ => { eprintln!("usage: ubo-verify <ubo-resources.json> [--perm N]"); std::process::exit(2) } };
    let perm: u8 = args.iter().position(|a| a == "--perm").and_then(|i| args.get(i + 1)).and_then(|s| s.parse().ok()).unwrap_or(0b11);
    let raw = std::fs::read(&path).expect("read resources file");
    let items: Vec<serde_json::Value> = serde_json::from_slice(&raw).expect("the file is not a JSON array");

    let mut failures: Vec<String> = Vec::new();
    let mut resources: Vec<Resource> = Vec::new();
    for (i, v) in items.into_iter().enumerate() {
        match serde_json::from_value::<Resource>(v) {
            Ok(r) => resources.push(r),
            Err(e) => failures.push(format!("element {i}: does not deserialize into adblock::resources::Resource: {e}")),
        }
    }
    let parsed = resources.len();
    let mut storage = InMemoryResourceStorage::default();
    let mut accepted = 0usize;
    for r in &resources {
        match storage.add_resource(r.clone()) {
            Ok(()) => accepted += 1,
            Err(e) => failures.push(format!("{}: rejected by the resource storage: {e:?}", r.name)),
        }
    }

    // counts per class
    let mut by_kind: BTreeMap<String, usize> = BTreeMap::new();
    for r in &resources {
        let k = match &r.kind { ResourceType::Template => "template".to_string(), ResourceType::Mime(m) => m.to_string() };
        *by_kind.entry(k).or_default() += 1;
    }
    let trusted = resources.iter().filter(|r| r.permission.to_bits() != 0).count();
    let aliases: usize = resources.iter().map(|r| r.aliases.len()).sum();

    // rules
    let decoded = |r: &Resource| BASE64_STANDARD.decode(&r.content).unwrap_or_default();
    let mut rules = String::new();
    struct Probe { ident: String, resource: usize }
    let mut script_probes: Vec<Probe> = Vec::new();
    let mut redirect_probes: Vec<Probe> = Vec::new();
    for (ri, r) in resources.iter().enumerate() {
        let idents: Vec<&String> = std::iter::once(&r.name).chain(r.aliases.iter()).collect();
        match &r.kind {
            ResourceType::Template => for id in idents {
                let n = script_probes.len();
                rules.push_str(&format!("h{n}.example.com##+js({id})\n"));
                script_probes.push(Probe { ident: id.clone(), resource: ri });
            },
            ResourceType::Mime(MimeType::FnJavascript) => {}
            ResourceType::Mime(_) => for id in idents {
                let n = redirect_probes.len();
                rules.push_str(&format!("||r{n}.example.net^$redirect={id}\n"));
                redirect_probes.push(Probe { ident: id.clone(), resource: ri });
            },
        }
    }
    let mut set = FilterSet::new(false);
    set.add_filter_list(rules, ParseOptions { permissions: PermissionMask::from_bits(perm), ..Default::default() });
    let mut engine = Engine::new_with_filter_set(set);
    engine.use_resources(resources.clone());

    let mut script_ok = 0usize;
    for (n, p) in script_probes.iter().enumerate() {
        let r = &resources[p.resource];
        let needed = r.permission.to_bits();
        let allowed = needed & !perm == 0;
        let script = engine.url_cosmetic_resources(&format!("https://h{n}.example.com/")).injected_script;
        if !allowed {
            if script.is_empty() { script_ok += 1; } else { failures.push(format!("scriptlet {} (permission {needed:#b}) was injected although the rules only have {perm:#b}", p.ident)); }
            continue;
        }
        let text = String::from_utf8_lossy(&decoded(r)).to_string();
        let Some(fname) = function_name(&text) else { failures.push(format!("scriptlet {}: not function style (no `function name(` prefix)", r.name)); continue };
        if script.is_empty() { failures.push(format!("scriptlet {} (rule `+js({})`): the engine produced no injected_script", r.name, p.ident)); continue; }
        if !script.contains(&format!("{fname}(")) { failures.push(format!("scriptlet {}: injected_script does not call {fname}(", p.ident)); continue; }
        let mut missing = Vec::new();
        for d in &r.dependencies {
            match resources.iter().find(|x| &x.name == d) {
                Some(dr) => { let dt = String::from_utf8_lossy(&decoded(dr)).to_string(); if !script.contains(&dt) { missing.push(d.clone()); } }
                None => missing.push(format!("{d} (not a resource)")),
            }
        }
        if !missing.is_empty() { failures.push(format!("scriptlet {}: injected_script lacks dependencies {missing:?}", p.ident)); continue; }
        script_ok += 1;
    }

    let mut redirect_ok = 0usize;
    for (n, p) in redirect_probes.iter().enumerate() {
        let r = &resources[p.resource];
        let url = format!("https://r{n}.example.net/x");
        let req = Request::new(&url, "https://example.com/", "other", "get").expect("request");
        let res = engine.check_network_request(&req);
        if r.permission.to_bits() != 0 {
            if res.redirect.is_none() && res.should_block() { redirect_ok += 1; } else { failures.push(format!("redirect {}: has a permission, adblock-rust must not redirect to it", p.ident)); }
            continue;
        }
        let Some(data) = res.redirect else { failures.push(format!("redirect {}: no redirect returned", p.ident)); continue };
        let want_mime = match &r.kind { ResourceType::Mime(m) => m.to_string(), _ => unreachable!() };
        let Some(rest) = data.strip_prefix("data:") else { failures.push(format!("redirect {}: not a data: URL", p.ident)); continue };
        let Some((meta, body)) = rest.split_once(',') else { failures.push(format!("redirect {}: malformed data: URL", p.ident)); continue };
        if meta != format!("{want_mime};base64") { failures.push(format!("redirect {}: MIME {meta} != {want_mime}", p.ident)); continue; }
        if BASE64_STANDARD.decode(body).ok().as_deref() != Some(decoded(r).as_slice()) { failures.push(format!("redirect {}: body differs from the resource", p.ident)); continue; }
        redirect_ok += 1;
    }

    println!("file: {path}");
    println!("elements: {} parsed, {} accepted by the resource storage, {} rejected", parsed, accepted, failures.iter().filter(|f| f.contains("rejected by the resource storage") || f.contains("does not deserialize")).count());
    println!("by kind: {by_kind:?}; aliases: {aliases}; with permission: {trusted}");
    println!("rule permission mask: {perm:#04b}");
    println!("scriptlet idents (names + aliases) checked through the engine: {} ok of {}", script_ok, script_probes.len());
    println!("redirect idents (names + aliases) checked through the engine: {} ok of {}", redirect_ok, redirect_probes.len());
    if failures.is_empty() { println!("RESULT: OK"); } else {
        for f in &failures { println!("FAIL: {f}"); }
        println!("RESULT: {} failure(s)", failures.len());
        std::process::exit(1);
    }
}
