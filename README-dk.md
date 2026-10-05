# AI Wikipedia

En bærbar, privatliv-først AI Wikipedia drevet af Ollama med multi-kilde-verifikation.

## Funktioner

- **AI-artikelgenerering** - Opret artikler ved hjælp af lokal Ollama LLM med RAG og verifikation
- **AI-chat-grænseflade** - CLI-stil terminal med Web Verify til/fra
- **RAG (Retrieval Augmented Generation)** - AI bruger dine importerede artikler som kontekst
- **Multi-kilde-verifikation** - Verificer påstande mod 20+ autoritative kilder (minimum 2 kræves)
  - **Lex.dk (Den Store Danske)** - Danmarks nationaleencyclopædi (mest betroet)
  - **Wikipedia & WikiData** - International encyclopædi og struktureret data
  - **20+ danske og internationale API'er** - Statistik, Jura, virksomhed og mere
- **Artikeleditor** - Rediger og opdater eksisterende artikler
- **Komprimeret lagring** - LZ4/Zstd komprimering af Wikipedia dumps (16GB → ~5-6GB)
- **Importer artikler** - Importer fra Wikipedia eller skrabet JSON-filer
- **Bærbar og synkroniserbar** - Eksporter/importer JSON til synkronisering på tværs af enheder
- **Dark Mode** - Indbygget tema til/fra

## Hurtig start

### Forudsætninger

1. **Ollama** - Installer fra [ollama.ai](https://ollama.ai)
   ```bash
   # Installer Ollama
   curl -fsSL https://ollama.ai/install.sh | sh
   
   # Start Ollama-tjenesten
   ollama serve
   
   # Hent anbefalet model (llama3.2 8B)
   ollama pull llama3.2
   ```

2. **Node.js** - v18+ kræves

### Installation

```bash
# Klon eller kopier projektet
cd /path/to/ai-wikipedia

# Installer afhængigheder
npm install

# Kør i udviklingstilstand
npm run dev
```

Åbn [http://localhost:1420](http://localhost:1420) i din browser.

### Bygge bureauapplikation (valgfrit)

```bash
# Installer Rust (kræves til Tauri)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Byg Tauri-appen
npm run tauri build
```

Executable vil være i `src-tauri/target/release/` eller `src-tauri/target/debug/`.

## Brug

### AI-chat (altid synlig)

AI CLI-chatten er altid synlig under søgelinjen:
- Vælg model: llama3.2 (8B anbefalet), mistral, phi3, codellama
- Aktiver **"Web Verify"** for at krydsreferere svar med eksterne kilder
- Skriv spørgsmål direkte og tryk på Send eller Enter
- Klik på **"Gem som Artikel"** for at gemme svar
- AI bruger RAG fra dine importerede artikler når tilgængeligt

### Generer artikel med AI

1. Klik på **"+ Generer med AI"**
2. Indtast et emne (f.eks., "Quantum Computing")
3. Klik på **Generer**
4. Artikel oprettes ved hjælp af Ollama med:
   - RAG kontekst fra dine importerede artikler
   - Verifikation fra eksterne kilder
   - Kildehenvisninger i outputtet

### Verificer påstande

1. Åbn en hvilken som helst artikel
2. Klik på **"Verificer Påstande"**
3. Hver påstand kontrolleres mod aktiverede kilder
4. Resultater viser: ✓ Verificeret, ? Bestridt, eller − Ikke verificeret
5. **Minimum 2 kilder** kræves til verifikation

### Rediger artikler

1. Åbn en hvilken som helst artikel
2. Klik på **"Rediger Artikel"**
3. Ret titel, resumé eller indhold
4. Administrer billeder: tilføj, fjern eller omorganiser (↑↓)
5. Klik på **"Gem Ændringer"**

### Aktiver/deaktiver kilder

1. Klik på **"Kilder"** i headeren
2. Slå kilder til/fra
3. Tilføj brugerdefinerede API-endepunkter
4. Ændringer gemmes i localStorage

### Importer artikler

1. Klik på **"Importer Artikel"**
2. Indtast artikeltitler fra Wikipedia (én pr. linje)
3. Klik på **"Importer"**
4. Artikler tilføjes med verificeret status

Brug alternativt **"Eksporter / Synkroniser"** til at importere skrabet JSON-filer.

### Eksporter / Synkroniser data

1. Klik på **"Eksporter / Synkroniser"**
2. Klik på **"Eksporter Alt"** for at downloade JSON
3. Gem på USB eller cloud-lagring
4. På målenheden, brug **"Importer fra JSON"**

## Avanceret skraber

Mass importer artikler fra enhver kilde med billeder:

```bash
# Wikipedia med billeder
python3 scraper_advanced.py --source wikipedia --query "Machine Learning" --limit 50

# Enhver hjemmeside med crawling
python3 scraper_advanced.py --source website --url "https://pol.dk" --crawl-depth 1 --max-pages 10

# Lex.dk (dansk)
python3 scraper_advanced.py --source lex.dk --query "Danmark"
```

Se `SCRAPER_README.md` for fuld dokumentation.

### Komprimeret lagring

1. Klik på **"Lagring"** i headeren
2. Vælg komprimering: **LZ4** (hurtig) eller **Zstd** (bedre forhold)
3. Klik på **"Gem til Komprimeret Lagring"**
4. Se komprimeringsstatistik: original vs komprimeret størrelse
5. Eksporter komprimerede bundles til backup

**Forventede komprimeringsforhold:**
| Algoritme | Forhold | Hastighed | CPU-påvirkning |
|-----------|--------|-----------|----------------|
| LZ4 | ~40% | 2GB/s | Meget lav |
| Zstd | ~35% | 500MB/s | Lav-Med |

**For 16GB Wikipedia:** ~5-6GB med LZ4, ~4-5GB med Zstd

## Verifikationskilder

### Primære kilder (aktiveret som standard)
| Kilde | Type | Beskrivelse |
|--------|------|-------------|
| **Lex.dk** | Encyclopædi | Danmarks nationaleencyclopædi (Den Store Danske) |
| **Wikipedia** | Encyclopædi | International encyclopædi |
| **WikiData** | Struktureret Data | Struktureret vidensbase |

### Danske offentlige API'er
| Kilde | Nøgleord | Beskrivelse |
|--------|----------|-------------|
| Danmarks Statistik | statistics, population | Statistik Danmarks API |
| CVR.dk | company, virksomhed | Dansk Virksomhedsregister |
| Retsinformation | law, legal, folketing | Danske juridiske dokumenter |
| Nationalbanken | currency, valuta | Valutakurser |
| Dataforsyningen | geo, address | Geografiske data |
| DMI Vejr | weather, vejr | Vejrdata |
| MotorAPI | vehicle, bil | Køretøjsregistrering |
| Lægemiddelstyrelsen | medicine, medicin | Lægemiddelpriser |
| SSI COVID-19 | covid, coronavirus | COVID-19 overvågningsdata |
| Folketinget | parliament, politics | Parlamentariske dokumenter |
| DSB Feeds | train, tog | Togtrafik |
| Energi Data Service | energy, solar, wind | Energiproduktionsdata |
| elprisenligenu.dk | electricity, strom | Elpriser |

### Internationale kilder
| Kilde | Nøgleord | Beskrivelse |
|--------|----------|-------------|
| Eurostat | eu, european | EU Statistik |
| IMF Data | imf, global economy | International Monetary Fund |
| OECD Data | oecd | Økonomisk samarbejdsdata |
| SEC EDGAR | sec, edgar | amerikanske virksomhedsindberetninger |
| EUR-Lex | eu law | EU lovgivning |
| EconPapers | economics, research | Økonomiske arbejdsdokumenter |

### CBS biblioteksressourcer
| Kilde | Adgang | Beskrivelse |
|--------|--------|-------------|
| CVR.dk | Gratis | Dansk Virksomhedsregister |
| Eurostat | Gratis | EU Statistik |
| IMF Data | Gratis | International statistik |
| SEC EDGAR | Gratis | amerikanske virksomhedsindberetninger |
| EUR-Lex | Gratis | EU-jura |
| OECD Data | Campus/VPN | OECD-publikationer |
| Domsdatabasen | Gratis | Danske retssager |
| EconLit | Campus/VPN | Økonomisk litteratur |

**Bemærk:** Nogle CBS biblioteksressourcer kræver campus eller VPN-adgang.

## Konfiguration

### Ollama-indstillinger

Appen forbinder til Ollama på `http://localhost:11434` som standard.

For at ændre modellen, brug dropdown i CLI Chat-grænsefladen.

**Anbefalede modeller:**
- `llama3.2` (8B) - Bedst til faktuel nøjagtighed, standard
- `llama3.2:1b` - Hurtig men begrænset (markeret ⚠️)
- `mistral` - God alsidig
- `phi3` - Microsoft-model
- `codellama` - Til kode-relaterede emner

### Tilføje brugerdefinerede verifikationskilder

Rediger `CUSTOM_VERIFIERS` i `src/App.tsx`:

```typescript
const CUSTOM_VERIFIERS = {
  'my-source': async (query) => {
    const sources: VerificationSource[] = [];
    try {
      const response = await fetch(`https://api.example.com/search?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      // Parse og tilføj kilder
    } catch (e) { console.error('Error:', e); }
    return sources;
  },
};
```

## Datalagring

### Lokal lagring
- **Webversion**: localStorage (browser-specifik)
- **Bureauapplikation**: localStorage (vedvarer mellem sessioner)

### Komprimeret lagring (Wikipedia dumps)
- Gemt i app-data-mappen som `.json.lz4` eller `.json.zst` chunks
- Manifest sporer chunk-metadata for effektiv hentning
- Eksporter hele komprimerede bundle til backup

For at overføre data:
1. Eksporter til JSON (eller komprimeret bundle)
2. Kopier fil til målenhed
3. Importer JSON på målenhed

## Privatliv

- Al AI-behandling bruger lokal Ollama - ingen data sendes til eksterne AI-tjenester
- Verifikation bruger offentlige API'er (kun-læsning)
- Data gemmes lokalt på din maskine
- Eksporterede filer er ukrypteret JSON - hold dem sikre

## Teknologistak

- **Frontend**: React 18 + TypeScript + TailwindCSS
- **Build-værktøj**: Vite
- **Bureau**: Tauri 2.0 (Rust)
- **Komprimering**: LZ4 + Zstd (Rust)
- **AI**: Ollama (lokal LLM)
- **Verifikation**: 20+ API'er (Wikipedia, WikiData, Lex.dk, Danske API'er)

## Projektstruktur

```
ai-wikipedia/
├── src/
│   ├── App.tsx          # Hovedapplikation (alle komponenter)
│   ├── main.tsx         # React-indgangspunkt
│   └── index.css        # Tailwind-stilarter
├── src-tauri/           # Tauri bureauapplikation
│   ├── src/
│   │   ├── lib.rs       # Rust-kommandoer (komprimering, lagring)
│   │   └── main.rs      # Indgangspunkt
│   ├── Cargo.toml       # Rust-afhængigheder
│   └── tauri.conf.json  # Tauri-konfiguration
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── SPEC.md              # Funktionsspecifikation
├── VERSION              # Aktuel version
├── CHANGELOG.md        # Versionshistorie
├── CONTEXT.md           # Projektkontekst
└── HOWTHISWASBUILT.md  # Byg-dokumentation
```

## Fejlfinding

### "Ollama ikke tilgængelig"
```bash
# Start Ollama
ollama serve

# Tjek om den kører
curl http://localhost:11434/api/tags

# List tilgængelige modeller
ollama list
```

### Build fejler på Tauri
```bash
# Opdater Rust
rustup update

# Ryd og genbyg
cd src-tauri
cargo clean
cargo update
```

### Komprimering virker ikke
```bash
# Tjek om Rust kompilerer
cd src-tauri
cargo check
```

## Licens

MIT License - Se LICENSE-fil for detaljer.