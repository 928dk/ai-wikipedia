use lz4;
use reqwest;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::PathBuf;
use std::time::Duration;
use fs2::FileExt;
use tauri::{AppHandle, Manager, Emitter};

const VERSION: &str = include_str!("../../VERSION");

#[derive(Serialize, Deserialize)]
pub struct WikipediaChunk {
    pub index: usize,
    pub title_prefix: String,
    pub articles: Vec<ChunkArticle>,
}

#[derive(Serialize, Deserialize)]
pub struct ChunkArticle {
    pub title: String,
    pub content: String,
}

#[derive(Serialize, Deserialize)]
pub struct ChunkManifest {
    pub version: String,
    pub chunks: Vec<ChunkInfo>,
    pub total_articles: usize,
    pub compression: String,
}

#[derive(Serialize, Deserialize)]
pub struct ChunkInfo {
    pub index: usize,
    pub filename: String,
    pub article_count: usize,
    pub original_size: usize,
    pub compressed_size: usize,
}

const SYNC_CONFIG_FILENAME: &str = "sync_config.json";
const SYNC_QUEUE_FILENAME: &str = "sync_queue.json";
const WIKI_FEATURED_API: &str = "https://en.wikipedia.org/api/rest_v1/feed/featured";
const WIKI_RANDOM_URL: &str = "https://en.wikipedia.org/wiki/Special:Random";
const LEX_API_URL: &str = "https://api.snl.no/1.1/search";
const WIKIBOOKS_API_URL: &str = "https://en.wikibooks.org/w/api.php";

const LEX_SEEDS: &[&str] = &[
    "historie", "natur", "kultur", "videnskab", "teknologi",
    "kunst", "musik", "litteratur", "sport", "geografi",
    "biologi", "fysik", "økonomi", "politik",
];

#[derive(Serialize, Deserialize, Clone)]
pub struct InboxFile {
    pub filename: String,
    pub text: String,
    pub format: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SyncConfig {
    pub enabled: bool,
    pub interval_hours: u64,
    pub news_enabled: bool,
    pub random_enabled: bool,
    pub lex_enabled: bool,
    pub wikibooks_enabled: bool,
    pub max_articles_per_sync: usize,
    pub auto_import: bool,
    pub last_sync: Option<String>,
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_hours: 24,
            news_enabled: true,
            random_enabled: true,
            lex_enabled: true,
            wikibooks_enabled: true,
            max_articles_per_sync: 10,
            auto_import: true,
            last_sync: None,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct SyncQueue {
    articles: Vec<PendingArticle>,
}

#[derive(Serialize, Deserialize, Clone)]
struct PendingArticle {
    pub title: String,
    pub source: String,
    pub fetched_at: String,
}

fn get_data_dir(app: &AppHandle) -> PathBuf {
    let app_dir = app.path().app_data_dir().expect("Failed to get app data dir");
    let wiki_dir = app_dir.join("wikipedia");
    fs::create_dir_all(&wiki_dir).ok();
    wiki_dir
}

// === Compression Commands ===

#[tauri::command]
fn compress_lz4(data: String) -> Result<Vec<u8>, String> {
    let input_len = data.len();
    let output: Vec<u8> = Vec::with_capacity(input_len / 2);
    let mut encoder = lz4::EncoderBuilder::new().build(output).map_err(|e| e.to_string())?;
    let mut input = std::io::Cursor::new(data);
    std::io::copy(&mut input, &mut encoder).map_err(|e| e.to_string())?;
    let (compressed, result) = encoder.finish();
    result.map_err(|e| e.to_string())?;
    log::info!("LZ4: {} bytes -> {} bytes ({:.1}%)",
               input_len, compressed.len(),
               (compressed.len() as f64 / input_len as f64) * 100.0);
    Ok(compressed)
}

#[tauri::command]
fn decompress_lz4(data: Vec<u8>) -> Result<String, String> {
    let mut decoder = lz4::Decoder::new(std::io::Cursor::new(data)).map_err(|e| e.to_string())?;
    let mut decompressed = Vec::new();
    std::io::copy(&mut decoder, &mut decompressed).map_err(|e| e.to_string())?;
    String::from_utf8(decompressed).map_err(|e| e.to_string())
}

#[tauri::command]
fn compress_zstd(data: String, level: i32) -> Result<Vec<u8>, String> {
    let input_len = data.len();
    let cursor = std::io::Cursor::new(data.into_bytes());
    let compressed = zstd::stream::encode_all(cursor, level).map_err(|e| e.to_string())?;
    log::info!("Zstd (level {}): {} bytes -> {} bytes ({:.1}%)",
               level, input_len, compressed.len(),
               (compressed.len() as f64 / input_len as f64) * 100.0);
    Ok(compressed)
}

#[tauri::command]
fn decompress_zstd(data: Vec<u8>) -> Result<String, String> {
    let cursor = std::io::Cursor::new(data);
    let decompressed = zstd::stream::decode_all(cursor).map_err(|e| e.to_string())?;
    String::from_utf8(decompressed).map_err(|e| e.to_string())
}

// === Wikipedia Storage Commands ===

#[tauri::command]
async fn save_wikipedia_chunk(
    app: AppHandle,
    chunk: WikipediaChunk,
    compression: String,
) -> Result<ChunkInfo, String> {
    let wiki_dir = get_data_dir(&app);
    let json = serde_json::to_string(&chunk).map_err(|e| e.to_string())?;
    let original_size = json.len();
    let (compressed, filename) = match compression.as_str() {
        "zstd" => {
            let data = compress_zstd(json, 3)?;
            (data, format!("chunk_{:04}.json.zst", chunk.index))
        }
        _ => {
            let data = compress_lz4(json)?;
            (data, format!("chunk_{:04}.json.lz4", chunk.index))
        }
    };
    let filepath = wiki_dir.join(&filename);
    fs::write(&filepath, &compressed).map_err(|e| e.to_string())?;
    log::info!("Saved chunk {}: {} articles, {} -> {} bytes",
               chunk.index, chunk.articles.len(), original_size, compressed.len());
    Ok(ChunkInfo {
        index: chunk.index,
        filename,
        article_count: chunk.articles.len(),
        original_size,
        compressed_size: compressed.len(),
    })
}

#[tauri::command]
async fn load_wikipedia_chunk(
    app: AppHandle,
    filename: String,
    compression: String,
) -> Result<WikipediaChunk, String> {
    let wiki_dir = get_data_dir(&app);
    let filepath = wiki_dir.join(&filename);
    let compressed = fs::read(&filepath).map_err(|e| e.to_string())?;
    let json = match compression.as_str() {
        "zstd" => decompress_zstd(compressed)?,
        _ => decompress_lz4(compressed)?,
    };
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_manifest(app: AppHandle, manifest: ChunkManifest) -> Result<(), String> {
    let wiki_dir = get_data_dir(&app);
    let manifest_path = wiki_dir.join("manifest.json");
    let json = serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?;
    fs::write(manifest_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
async fn load_manifest(app: AppHandle) -> Result<Option<ChunkManifest>, String> {
    let wiki_dir = get_data_dir(&app);
    let manifest_path = wiki_dir.join("manifest.json");
    if !manifest_path.exists() {
        return Ok(None);
    }
    let json = fs::read_to_string(manifest_path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct StorageStats {
    total_compressed: usize,
    total_original: usize,
    file_count: usize,
    compression_ratio: f64,
}

#[tauri::command]
async fn get_storage_stats(app: AppHandle) -> Result<StorageStats, String> {
    let wiki_dir = get_data_dir(&app);
    let mut total_compressed = 0;
    let mut total_original = 0;
    let mut file_count = 0;
    if wiki_dir.exists() {
        for entry in fs::read_dir(&wiki_dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let path = entry.path();
            if path.is_file() {
                total_compressed += fs::metadata(&path).map_err(|e| e.to_string())?.len() as usize;
                file_count += 1;
            }
        }
    }
    if let Some(m) = load_manifest(app).await? {
        total_original = m.chunks.iter().map(|c| c.original_size).sum();
    }
    Ok(StorageStats {
        total_compressed,
        total_original,
        file_count,
        compression_ratio: if total_original > 0 {
            total_compressed as f64 / total_original as f64
        } else { 0.0 },
    })
}

// === Article Commands ===

#[tauri::command]
async fn get_article_count(app: AppHandle) -> Result<usize, String> {
    if let Some(manifest) = load_manifest(app).await? {
        Ok(manifest.total_articles)
    } else {
        Ok(0)
    }
}

#[tauri::command]
async fn scrape_webpage(url: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "Mozilla/5.0 (compatible; AI-Wikipedia/1.0)")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;
    let html = response.text().await.map_err(|e| format!("Failed to read response: {}", e))?;
    let re = regex::Regex::new(r"<[^>]+>").unwrap();
    let text = re.replace_all(&html, " ");
    Ok(text.chars().take(5000).collect())
}

#[tauri::command]
async fn parse_document(path: String, parser_type: String) -> Result<String, String> {
    use std::process::Command;
    use std::path::Path;
    let script_paths = vec![
        "src-tauri/parsers/document_parser.py".to_string(),
        "parsers/document_parser.py".to_string(),
    ];
    let script_path = script_paths.iter()
        .find(|p| Path::new(p).exists())
        .ok_or_else(|| "Parser script not found".to_string())?;
    let output = if parser_type.is_empty() {
        Command::new("python3").args(&[script_path.as_str(), &path]).output()
    } else {
        Command::new("python3").args(&[script_path.as_str(), &path, &parser_type]).output()
    };
    match output {
        Ok(out) => {
            if out.status.success() {
                String::from_utf8(out.stdout).map_err(|e| format!("UTF-8 error: {}", e))
            } else {
                Err(String::from_utf8_lossy(&out.stderr).to_string())
            }
        }
        Err(e) => Err(format!("Failed to run parser: {}", e)),
    }
}

// === Sync Configuration Commands ===

#[tauri::command]
async fn get_sync_config(app: AppHandle) -> Result<SyncConfig, String> {
    let data_dir = get_data_dir(&app);
    let config_path = data_dir.join(SYNC_CONFIG_FILENAME);
    if !config_path.exists() {
        return Ok(SyncConfig::default());
    }
    match fs::read_to_string(&config_path) {
        Ok(json) => Ok(serde_json::from_str(&json).unwrap_or_default()),
        Err(_) => Ok(SyncConfig::default()),
    }
}

#[tauri::command]
async fn save_sync_config(app: AppHandle, config: SyncConfig) -> Result<(), String> {
    let data_dir = get_data_dir(&app);
    let config_path = data_dir.join(SYNC_CONFIG_FILENAME);
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(config_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_sync_queue(app: AppHandle) -> Result<Vec<PendingArticle>, String> {
    let data_dir = get_data_dir(&app);
    let queue_path = data_dir.join(SYNC_QUEUE_FILENAME);
    if !queue_path.exists() {
        return Ok(Vec::new());
    }
    let json = fs::read_to_string(&queue_path).map_err(|e| e.to_string())?;
    let queue: SyncQueue = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(queue.articles)
}

#[tauri::command]
async fn clear_sync_queue(app: AppHandle) -> Result<(), String> {
    let data_dir = get_data_dir(&app);
    let queue_path = data_dir.join(SYNC_QUEUE_FILENAME);
    if queue_path.exists() {
        fs::remove_file(&queue_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn update_sync_queue(app: AppHandle, articles: Vec<PendingArticle>) -> Result<(), String> {
    let data_dir = get_data_dir(&app);
    let queue_path = data_dir.join(SYNC_QUEUE_FILENAME);
    let queue = SyncQueue { articles };
    let json = serde_json::to_string_pretty(&queue).map_err(|e| e.to_string())?;
    fs::write(&queue_path, json).map_err(|e| e.to_string())
}

// === Wikipedia API Functions ===

async fn fetch_featured_articles() -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let now = chrono::Utc::now();
    let url = format!("{}/{}/{}/{}", WIKI_FEATURED_API,
                      now.format("%Y"), now.format("%m"), now.format("%d"));
    let response = client
        .get(&url)
        .header("User-Agent", "AI-Wikipedia/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch featured: {}", e))?;
    if !response.status().is_success() {
        return Err(format!("Featured API returned: {}", response.status()));
    }
    let data: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse featured JSON: {}", e))?;
    let mut titles = Vec::new();
    if let Some(news) = data.get("news") {
        if let Some(items) = news.as_array() {
            for item in items {
                if let Some(t) = item.get("title").and_then(|t| t.as_str()) {
                    titles.push(t.to_string());
                }
            }
        }
    }
    Ok(titles)
}

async fn fetch_random_article() -> Result<String, String> {
    let client = reqwest::Client::new();
    let response = client
        .get(WIKI_RANDOM_URL)
        .header("User-Agent", "AI-Wikipedia/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch random: {}", e))?;
    if let Some(segments) = response.url().path_segments() {
        let title = segments.last().unwrap_or("").replace("_", " ");
        if !title.is_empty() {
            return Ok(title);
        }
    }
    Err("Failed to extract title".to_string())
}

async fn fetch_lex_random_titles() -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let seed_count = LEX_SEEDS.len();
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos() as usize;
    let chosen: Vec<usize> = (0..3.min(seed_count)).map(|i| {
        (nanos.wrapping_mul(i + 1).wrapping_add(seed_count * 7)) % seed_count
    }).collect();
    let mut all_titles = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for &idx in &chosen {
        let seed = LEX_SEEDS[idx];
        let url = format!("{}?query={}&zone=lex", LEX_API_URL, url_encode(seed));
        if let Ok(resp) = client.get(&url)
            .header("User-Agent", "AI-Wikipedia/1.0")
            .send().await
        {
            if let Ok(data) = resp.json::<serde_json::Value>().await {
                let results = data.get("results").or_else(|| data.as_array().map(|_| &data));
                if let Some(arr) = results.and_then(|r| r.as_array()) {
                    for item in arr.iter().take(5) {
                        if let Some(t) = item.get("title").and_then(|t| t.as_str()) {
                            if seen.insert(t.to_lowercase()) {
                                all_titles.push(t.to_string());
                            }
                        }
                    }
                }
            }
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }
    Ok(all_titles)
}

fn url_encode(s: &str) -> String {
    s.chars().map(|c| match c {
        'æ' => "%C3%A6".to_string(), 'ø' => "%C3%B8".to_string(),
        'å' => "%C3%A5".to_string(), 'Æ' => "%C3%86".to_string(),
        'Ø' => "%C3%98".to_string(), 'Å' => "%C3%85".to_string(),
        _ if c.is_ascii_alphanumeric() || c == ' ' => c.to_string(),
        _ => {
            let bytes = c.to_string().into_bytes();
            bytes.iter().map(|b| format!("%{:02X}", b)).collect::<String>()
        }
    }).collect::<String>().replace(' ', "%20")
}

async fn fetch_wikibooks_random_titles(count: usize) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let url = format!(
        "{}?action=query&list=random&rnlimit={}&rnnamespace=0&format=json&origin=*",
        WIKIBOOKS_API_URL, count
    );
    let resp = client.get(&url)
        .header("User-Agent", "AI-Wikipedia/1.0")
        .send().await
        .map_err(|e| format!("WikiBooks random request failed: {}", e))?;
    let data: serde_json::Value = resp.json().await
        .map_err(|e| format!("WikiBooks random parse failed: {}", e))?;
    let mut titles = Vec::new();
    if let Some(items) = data["query"]["random"].as_array() {
        for item in items {
            if let Some(t) = item["title"].as_str() {
                titles.push(t.to_string());
            }
        }
    }
    Ok(titles)
}

async fn add_to_queue(app: &AppHandle, items: Vec<(String, String)>) -> Result<usize, String> {
    let data_dir = get_data_dir(app);
    let queue_path = data_dir.join(SYNC_QUEUE_FILENAME);
    let mut file = fs::OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .open(&queue_path)
        .map_err(|e| e.to_string())?;
    file.lock_exclusive().map_err(|e| e.to_string())?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).ok();
    let mut queue: SyncQueue = serde_json::from_str(&contents)
        .unwrap_or(SyncQueue { articles: Vec::new() });
    let mut existing_titles: std::collections::HashSet<String> = queue.articles.iter()
        .map(|a| a.title.to_lowercase())
        .collect();
    let now = chrono::Utc::now().to_rfc3339();
    for (title, source) in items {
        if existing_titles.contains(&title.to_lowercase()) { continue; }
        existing_titles.insert(title.to_lowercase());
        queue.articles.push(PendingArticle {
            title,
            source,
            fetched_at: now.clone(),
        });
    }
    let json = serde_json::to_string_pretty(&queue).map_err(|e| e.to_string())?;
    file.set_len(0).map_err(|e| e.to_string())?;
    file.seek(SeekFrom::Start(0)).map_err(|e| e.to_string())?;
    file.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
    Ok(queue.articles.len())
}

#[tauri::command]
async fn trigger_sync(app: AppHandle) -> Result<String, String> {
    let config = get_sync_config(app.clone()).await?;
    if !config.enabled {
        return Err("Nightly sync is disabled".to_string());
    }
    let mut titles: Vec<(String, String)> = Vec::new();
    if config.news_enabled {
        if let Ok(news) = fetch_featured_articles().await {
            for t in news { titles.push((t, "news".to_string())); }
        }
    }
    if config.random_enabled {
        for _ in 0..config.max_articles_per_sync {
            if let Ok(t) = fetch_random_article().await {
                titles.push((t, "random".to_string()));
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    }
    if config.lex_enabled {
        if let Ok(lex) = fetch_lex_random_titles().await {
            for t in lex { titles.push((t, "lex".to_string())); }
        }
    }
    if config.wikibooks_enabled {
        if let Ok(wb) = fetch_wikibooks_random_titles(config.max_articles_per_sync.min(5)).await {
            for t in wb { titles.push((t, "wikibooks".to_string())); }
        }
    }
    let count = add_to_queue(&app, titles.clone()).await?;
    let _ = app.emit("sync-queue-updated", count);
    // Update last_sync timestamp
    let data_dir = get_data_dir(&app);
    let config_path = data_dir.join(SYNC_CONFIG_FILENAME);
    let mut updated_config = config;
    updated_config.last_sync = Some(chrono::Utc::now().to_rfc3339());
    if let Ok(json) = serde_json::to_string_pretty(&updated_config) {
        let _ = fs::write(&config_path, json);
    }
    Ok(format!("Added {} articles to sync queue", count))
}

#[tauri::command]
async fn fetch_wikipedia_articles(titles: Vec<String>) -> Result<Vec<serde_json::Value>, String> {
    let client = reqwest::Client::new();
    let mut articles = Vec::new();

    for chunk in titles.chunks(5) {
        let titles_str: Vec<String> = chunk.iter()
            .map(|t| t.replace(' ', "_"))
            .collect();
        let titles_param = titles_str.join("|");

        let url = reqwest::Url::parse_with_params(
            "https://en.wikipedia.org/w/api.php",
            &[
                ("action", "query"),
                ("titles", &titles_param),
                ("prop", "extracts"),
                ("explaintext", "1"),
                ("exlimit", "20"),
                ("exchars", "10000"),
                ("format", "json"),
                ("origin", "*"),
            ]
        ).map_err(|e| e.to_string())?;

        let response = client
            .get(url)
            .header("User-Agent", "AI-Wikipedia/1.0")
            .send()
            .await
            .map_err(|e| format!("Request failed: {}", e))?;

        let data: serde_json::Value = response.json().await
            .map_err(|e| format!("Parse failed: {}", e))?;

        if let Some(pages) = data["query"]["pages"].as_object() {
            for (_id, page) in pages {
                if page.get("missing").is_some() { continue; }
                let title = page["title"].as_str().unwrap_or("").to_string();
                let extract = page["extract"].as_str().unwrap_or("").to_string();
                if extract.is_empty() { continue; }
                let pageid = page["pageid"].as_i64().unwrap_or(0);
                articles.push(serde_json::json!({
                    "title": title,
                    "content": extract,
                    "pageid": pageid,
                }));
            }
        }

        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    Ok(articles)
}

#[tauri::command]
async fn generate_summary(articles_json: String, model: Option<String>) -> Result<String, String> {
    let model = model.unwrap_or_else(|| "qwen2.5:3b".to_string());
    let prompt = format!(
        r#"You are a knowledge distiller. Read the following articles and write a cohesive weekly summary.
Synthesize the key themes, important facts, and connections between topics.
Format as a clear briefing with sections.
CRITICAL: Be factual. Do not invent information.

Articles:
{}

Weekly Briefing:"#, articles_json
    );

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "stream": false,
        "options": { "num_ctx": 8192 }
    });

    let response = client
        .post("http://localhost:11434/api/generate")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    let data: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    data["response"].as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "No response from Ollama".to_string())
}

#[tauri::command]
async fn find_knowledge_gaps(titles_json: String, model: Option<String>) -> Result<Vec<String>, String> {
    let model = model.unwrap_or_else(|| "qwen2.5:3b".to_string());
    let prompt = format!(
        r#"You are a knowledge gap analyst. Given the following list of article titles from a personal wiki,
identify topics that are LIKELY missing. Look for:
1. Topics that are mentioned indirectly (e.g. an article about "World War II" implies missing "Adolf Hitler")
2. Related concepts that should have their own page
3. Obvious connections that are absent

Return ONLY a JSON array of strings, e.g. ["Topic 1", "Topic 2", ...]. No explanation.

Existing article titles:
{}

Missing topics:"#, titles_json
    );

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "stream": false,
    });

    let response = client
        .post("http://localhost:11434/api/generate")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    let data: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    let text = data["response"].as_str().unwrap_or("[]");
    let mut topics: Vec<String> = serde_json::from_str(text).unwrap_or_else(|_| {
        text.lines()
            .filter(|l| l.starts_with("- ") || l.starts_with('"'))
            .map(|l| l.trim_start_matches("- ").trim_matches('"').to_string())
            .filter(|t| !t.is_empty())
            .collect()
    });
    topics.truncate(20);
    Ok(topics)
}

fn run_inbox_watcher(app_handle: AppHandle) {
    let inbox_path = std::env::var("HOME")
        .map(|home| PathBuf::from(home).join("Documents/Wiki-Inbox"))
        .unwrap_or_else(|_| PathBuf::from("/tmp/Wiki-Inbox"));

    fs::create_dir_all(&inbox_path).ok();
    log::info!("Watching inbox: {:?}", inbox_path);

    tauri::async_runtime::spawn(async move {
        let mut seen: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut check_interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            check_interval.tick().await;
            let entries = match fs::read_dir(&inbox_path) {
                Ok(e) => e,
                Err(_) => continue,
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_file() { continue; }
                let name = path.file_name()
                    .and_then(|n| n.to_str())
                    .map(|n| n.to_string())
                    .unwrap_or_default();
                if seen.contains(&name) { continue; }
                seen.insert(name.clone());

                let ext = path.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                let parser_type = match ext.as_str() {
                    "pdf" => "pdf", "docx" => "docx", "xlsx" => "xlsx",
                    "pptx" => "pptx", "epub" => "epub", "html" | "htm" => "html",
                    "md" | "markdown" => "markdown", "txt" => "txt",
                    "py" | "js" | "ts" | "java" | "cpp" | "rs" | "go" => "code",
                    "png" | "jpg" | "jpeg" | "gif" | "webp" => "media",
                    "zip" => "zip", "doc" => "legacy_doc",
                    _ => "txt",
                };

                let script_paths = vec![
                    "src-tauri/parsers/document_parser.py".to_string(),
                    "parsers/document_parser.py".to_string(),
                ];
                let script = script_paths.iter()
                    .find(|p| std::path::Path::new(p).exists())
                    .cloned();

                let path_str = path.to_string_lossy().to_string();
                let text = if let Some(script_path) = script {
                    match std::process::Command::new("python3")
                        .args(&[&script_path, &path_str, parser_type])
                        .output()
                    {
                        Ok(out) if out.status.success() => {
                            String::from_utf8_lossy(&out.stdout).to_string()
                        }
                        _ => format!("[File detected: {} — could not parse]", name),
                    }
                } else {
                    format!("[File detected: {}]", name)
                };

                log::info!("Inbox file processed: {} ({})", name, ext);
                let _ = app_handle.emit("inbox-file-detected", serde_json::json!({
                    "filename": name,
                    "text": text.chars().take(10000).collect::<String>(),
                    "format": parser_type,
                }));
            }
        }
    });
}

// === Application Entry Point ===

fn main() {
    env_logger::init();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                window.set_title(&format!("AI Wikipedia v{} - Powered by Ollama", VERSION.trim())).ok();
            }
            get_data_dir(&app.handle());
            log::info!("Storage initialized");
            // Start inbox watcher
            run_inbox_watcher(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            compress_lz4, decompress_lz4,
            compress_zstd, decompress_zstd,
            save_wikipedia_chunk, load_wikipedia_chunk,
            save_manifest, load_manifest,
            get_storage_stats, get_article_count,
            scrape_webpage, parse_document,
            get_sync_config, save_sync_config,
            get_sync_queue, clear_sync_queue, update_sync_queue,
            trigger_sync, fetch_wikipedia_articles, generate_summary, find_knowledge_gaps,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
