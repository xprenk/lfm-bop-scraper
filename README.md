<div align="center">

# 🏎️ LFM BoP Scraper

**A Node.js web scraper for LFM's Balance of Performance using Puppeteer**

[![Node.js](https://img.shields.io/badge/Node.js-v14%2B-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 🚀 Features

- **Automated data extraction** from LFM BoP pages using Puppeteer
- **GT3 and GT4 support** with comprehensive car mappings
- **JSON output** for easy integration
- **Track mapping** to ACC identifiers

## 📦 Installation & Usage

```bash
npm install
```

```bash
npm start
```

The scraper will automatically:

1. Navigate to the LFM BoP page
2. Extract GT3 and GT4 data
3. Generate `dist/bop.json` with the results

## 📄 Output Format

```json
{
  "entries": [
    {
      "track": "silverstone",
      "carModel": 30,
      "ballastKg": -2
    }
  ]
}
```

## ⚙️ Requirements

- Node.js v14 or higher
- Active internet connection

## 🗂️ Data Mapping

The scraper includes comprehensive mappings for:

- **Car names** → ACC model IDs
- **Track names** → ACC identifiers

See the source code for complete mapping tables.

## Credits

- [Low Fuel Motorsport](https://lowfuelmotorsport.com) for public BoP data
- [Puppeteer](https://github.com/puppeteer/puppeteer) for headless browser automation
